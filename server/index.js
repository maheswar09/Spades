import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { transcribeAudio } from "./services/deepgramService.js";
import {
  summarizeText,
  generateMeetingMinutes,
} from "./services/summaryService.js";
import { analyzeSentimentBySpeaker } from "./services/analysisService.js";
import natural from "natural"; // Updated import
const { SentenceTokenizer } = natural; // Destructure SentenceTokenizer
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors({ origin: ["http://localhost:5173"] }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioDir = path.join(__dirname, "recordings");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["audio/mpeg", "audio/wav", "video/mp4"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only MP3, WAV, and MP4 files are allowed."));
    }
    cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});
let storedTranscript = "";
let analysisResults = {};
const clients = new Set();
const tokenizer = new SentenceTokenizer();

function classifyIntent(sentence) {
  const lowerSentence = sentence.toLowerCase().trim();
  if (lowerSentence.endsWith("?")) {
    return "interrogative";
  } else if (lowerSentence.endsWith("!")) {
    return "exclamatory";
  } else if (
    lowerSentence.includes("need to") ||
    lowerSentence.includes("must") ||
    lowerSentence.includes("should") ||
    lowerSentence.includes("will") ||
    lowerSentence.match(/^(please|do|go|make|take|start|finish)/)
  ) {
    return "imperative";
  } else {
    return "declarative";
  }
}

app.get("/dashboard1", (req, res) => {
  res.json({
    transcript: storedTranscript,
    ...analysisResults,
  });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("Received file upload:", req.file?.filename);
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;
  let wavPath = filePath;

  try {
    // Convert to WAV if necessary
    if (!filePath.endsWith(".wav")) {
      console.log("Converting file to WAV...");
      wavPath = filePath.replace(/\.[^/.]+$/, ".wav");
      await convertWebmToWav(filePath, wavPath);
      console.log("File converted to WAV:", wavPath);
    }

    // Reset stored data
    storedTranscript = "";
    analysisResults = {};

    let transcription;
    try {
      console.log("Transcribing audio with Deepgram...");
      transcription = await transcribeAudio(wavPath);
      console.log("Deepgram transcription completed.");
      console.log(
        "Deepgram full response:",
        JSON.stringify(transcription, null, 2)
      );
      storedTranscript =
        transcription.result.results.channels[0].alternatives[0].transcript ||
        "";
      console.log("Extracted transcript:", storedTranscript);

      const speakers = {};
      const toneBySpeaker = {};
      const sentencesBySpeaker = {};
      const alternative =
        transcription.result.results.channels[0].alternatives[0];
      console.log(
        "Alternative structure:",
        JSON.stringify(alternative, null, 2)
      );

      // Map intents from Deepgram's intents.segments (if available)
      const intentSegments =
        transcription.result.results.channels[0]?.intents?.segments || [];
      const intentMap = new Map();
      intentSegments.forEach((segment) => {
        const segmentText = segment.text.toLowerCase().trim();
        const intent = segment.intents[0]?.intent || "unknown";
        intentMap.set(segmentText, intent);
      });
      console.log("Intent segments mapped:", intentMap);

      // Extract utterances for intent fallback and toneBySpeaker
      const utterances = alternative.utterances || [];
      const utteranceIntents = new Map();
      utterances.forEach((u) => {
        const utteranceText = u.transcript.toLowerCase().trim();
        utteranceIntents.set(utteranceText, u.intent || "unknown");
      });
      console.log("Utterance intents mapped:", utteranceIntents);

      // Extract sentences with timestamps from paragraphs.sentences
      const paragraphs = alternative.paragraphs?.paragraphs || [];
      const allSentences = [];

      if (paragraphs.length > 0) {
        console.log("Using paragraphs.sentences for sentence extraction...");
        paragraphs.forEach((paragraph) => {
          const speaker = paragraph.speaker || 0;
          const sentences = paragraph.sentences || [];

          sentences.forEach((sentence) => {
            const sentenceText = sentence.text.trim();
            const sentenceStart = sentence.start;
            const sentenceEnd = sentence.end;

            // Map intent to the sentence
            let intent = "unknown";
            const lowerSentenceText = sentenceText.toLowerCase().trim();

            // First, try to match with intents.segments
            for (const [segmentText, segmentIntent] of intentMap.entries()) {
              if (
                lowerSentenceText === segmentText ||
                lowerSentenceText.includes(segmentText)
              ) {
                intent = segmentIntent;
                break;
              }
            }

            // If no segment-level intent, fall back to utterance-level intent
            if (intent === "unknown") {
              for (const u of utterances) {
                if (sentenceStart >= u.start && sentenceEnd <= u.end) {
                  const utteranceText = u.transcript.toLowerCase().trim();
                  intent = utteranceIntents.get(utteranceText) || "unknown";
                  break;
                }
              }
            }

            // If still no intent, fall back to classifyIntent
            if (intent === "unknown" || intent === "none") {
              intent = classifyIntent(sentenceText);
            }

            allSentences.push({
              text: sentenceText,
              start: sentenceStart,
              end: sentenceEnd,
              speaker: speaker,
              intent: intent,
            });
          });
        });
      } else if (utterances.length > 0) {
        console.log("Falling back to utterances for sentence extraction...");
        utterances.forEach((u) => {
          const speaker = u.speaker || 0;
          const utteranceText = u.transcript || "";
          const sentences = tokenizer.tokenize(utteranceText);
          const utteranceDuration = u.end - u.start;
          const sentenceDuration = utteranceDuration / sentences.length;

          sentences.forEach((sentence, index) => {
            const sentenceStart = u.start + index * sentenceDuration;
            const sentenceEnd = sentenceStart + sentenceDuration;
            let intent = u.intent || "unknown";

            if (intent === "unknown" || intent === "none") {
              intent = classifyIntent(sentence);
            }

            allSentences.push({
              text: sentence,
              start: sentenceStart,
              end: sentenceEnd,
              speaker: speaker,
              intent: intent,
            });
          });
        });
      } else {
        console.log(
          "No paragraphs or utterances found, using full transcript."
        );
        allSentences.push({
          text: storedTranscript,
          start: 0,
          end: 0,
          speaker: 0,
          intent: classifyIntent(storedTranscript),
        });
      }

      console.log(
        "Extracted sentences:",
        JSON.stringify(allSentences, null, 2)
      );

      // Group sentences by speaker
      allSentences.forEach((sentence) => {
        const speaker = `Speaker ${sentence.speaker}`;
        if (!speakers[speaker]) speakers[speaker] = [];
        if (!sentencesBySpeaker[speaker]) sentencesBySpeaker[speaker] = [];
        if (!toneBySpeaker[speaker]) toneBySpeaker[speaker] = [];

        // Add to speakers as a list of sentences (transcript-like format)
        speakers[speaker].push({
          text: sentence.text,
          start: sentence.start,
          end: sentence.end,
          intent: sentence.intent,
        });

        // Add to sentencesBySpeaker (same as speakers in this case)
        sentencesBySpeaker[speaker].push({
          text: sentence.text,
          start: sentence.start,
          end: sentence.end,
          intent: sentence.intent,
        });

        // For toneBySpeaker, group sentences into utterances
        const matchingUtterance = utterances.find((u) => {
          const startDiff = Math.abs(u.start - sentence.start);
          const endDiff = Math.abs(u.end - sentence.end);
          return startDiff <= 0.5 && endDiff <= 0.5;
        });

        if (
          matchingUtterance &&
          !toneBySpeaker[speaker].some(
            (u) => u.text === matchingUtterance.transcript
          )
        ) {
          toneBySpeaker[speaker].push({
            text: matchingUtterance.transcript,
            intent: matchingUtterance.intent || "unknown",
            start: matchingUtterance.start,
            end: matchingUtterance.end,
          });
        }
      });

      console.log("Final speakers object:", JSON.stringify(speakers, null, 2));
      console.log("Tone by speaker:", JSON.stringify(toneBySpeaker, null, 2));
      console.log(
        "Sentences by speaker:",
        JSON.stringify(sentencesBySpeaker, null, 2)
      );
      analysisResults.speakers = speakers;
      analysisResults.toneBySpeaker = toneBySpeaker;
      analysisResults.sentencesBySpeaker = sentencesBySpeaker;
    } catch (error) {
      console.error("Transcription failed:", error.message);
      storedTranscript = "";
      analysisResults = { error: "Transcription failed: " + error.message };
    }

    if (storedTranscript) {
      try {
        console.log("Analyzing full transcript...");
        await analyzeFullTranscript();
        console.log("Analysis results:", analysisResults);
      } catch (error) {
        console.error("Analysis failed:", error.message);
        analysisResults.error = error.message;
      }
    } else {
      console.warn("Skipping analysis due to empty transcript.");
    }
    console.log("Sending results to WebSocket clients...");
    if (wss.clients.size === 0) {
      console.warn("No WebSocket clients connected to receive results.");
    }
    // Send WebSocket messages
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        console.log("Sending transcript message...");
        client.send(
          JSON.stringify({
            type: "transcript",
            words:
              transcription?.result?.results?.channels[0]?.alternatives[0]
                ?.words || [],
            timestamp: Date.now(),
          })
        );

        console.log("Sending stop message with analysis results...");
        const stopMessage = {
          type: "stop",
          transcript: storedTranscript,
          summary: analysisResults.summary || "",
          bulletPoints: analysisResults.bulletPoints || [],
          actionItems: analysisResults.actionItems || [],
          decisions: analysisResults.decisions || [],
          toneBySpeaker: analysisResults.toneBySpeaker || {},
          sentencesBySpeaker: analysisResults.sentencesBySpeaker || {},
          sentimentBySpeaker: analysisResults.sentimentBySpeaker || {},
          speakers: analysisResults.speakers || {},
        };
        console.log("Stop message content:", stopMessage);
        client.send(JSON.stringify(stopMessage));
      } else {
        console.log("WebSocket client not in OPEN state:", client.readyState);
      }
    });

    // Clean up all generated files
    const lastRecordingPath = path.join(audioDir, "last_recording.wav");
    [filePath, wavPath, lastRecordingPath].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🗑️ Deleted: ${file}`);
      }
    });

    res.json({ message: "File uploaded and processed successfully" });
  } catch (error) {
    console.error("Error processing uploaded file:", error);
    res.json({
      message: "File uploaded but processing failed",
      error: error.message,
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  clients.add(ws);

  const audioTimestamps = new Set();

  ws.send(JSON.stringify({ transcript: storedTranscript, ...analysisResults }));

  ws.on("message", async (data) => {
    console.log("Received data type:", typeof data, "content:", data);

    if (data instanceof Buffer) {
      const dataStr = data.toString("utf8");
      try {
        const msg = JSON.parse(dataStr);
        console.log("Parsed message:", msg);
        if (msg.type === "start") {
          console.log("🎤 Recording started");
          storedTranscript = "";
          analysisResults = {};
          audioTimestamps.clear();
          broadcast({ type: "start", transcript: "" });
          return;
        } else if (msg.type === "stop") {
          console.log("🛑 Recording stopped");
          await analyzeFullTranscript();
          broadcast({
            type: "stop",
            transcript: storedTranscript,
            summary: analysisResults.summary,
            bulletPoints: analysisResults.bulletPoints,
            actionItems: analysisResults.actionItems,
            decisions: analysisResults.decisions,
            toneBySpeaker: analysisResults.toneBySpeaker || {},
            sentencesBySpeaker: analysisResults.sentencesBySpeaker || {},
            sentimentBySpeaker: analysisResults.sentimentBySpeaker || {},
          });
          return;
        }
      } catch (e) {
        console.log("Not a JSON message, assuming audio chunk");
      }

      if (data.length > 1000) {
        console.log("📦 Received audio chunk, size:", data.length);
        const timestamp = Date.now();
        audioTimestamps.add(timestamp);
        const result = await processAudioChunk(data, timestamp);
        storedTranscript = storedTranscript
          ? `${storedTranscript} ${result.transcript}`
          : result.transcript;

        broadcast({
          type: "transcript",
          transcript: result.transcript,
          words: result.words,
          timestamp: result.timestamp,
          deepgramTimestamp: result.deepgramTimestamp,
        });
        console.log("📝 Chunk transcript sent:", result.transcript);
      }
      return;
    }

    console.log("Unexpected data type received:", typeof data);
  });

  ws.on("close", () => {
    console.log("📁 WebSocket closed");
    audioTimestamps.forEach((timestamp) => cleanupAudioFiles(timestamp));
    audioTimestamps.clear();
    clients.delete(ws);
  });

  ws.on("error", (error) =>
    console.error("❌ WebSocket error:", error.message)
  );
});

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

async function processAudioChunk(chunk, timestamp) {
  const inputPath = path.join(audioDir, `chunk_${timestamp}.webm`);
  const wavPath = inputPath.replace(".webm", ".wav");

  fs.writeFileSync(inputPath, chunk);
  await convertWebmToWav(inputPath, wavPath);

  const transcription = await transcribeAudio(wavPath);
  const alternative = transcription.result.results.channels[0].alternatives[0];
  const transcriptText = alternative.transcript || "";
  const words = alternative.words || [];
  const utterances = alternative.utterances || [];

  // Append to storedTranscript
  storedTranscript = storedTranscript
    ? `${storedTranscript} ${transcriptText}`
    : transcriptText;

  // Process speaker data
  const speakers = analysisResults.speakers || {};
  const sentencesBySpeaker = analysisResults.sentencesBySpeaker || {};
  const toneBySpeaker = analysisResults.toneBySpeaker || {};

  utterances.forEach((u) => {
    const speaker = `Speaker ${u.speaker || 0}`;
    const sentenceText = u.transcript || "";

    if (!speakers[speaker]) speakers[speaker] = [];
    if (!sentencesBySpeaker[speaker]) sentencesBySpeaker[speaker] = [];
    if (!toneBySpeaker[speaker]) toneBySpeaker[speaker] = [];

    const intent = u.intent || classifyIntent(sentenceText);

    speakers[speaker].push({
      text: sentenceText,
      start: u.start,
      end: u.end,
      intent: intent,
    });
    sentencesBySpeaker[speaker].push({
      text: sentenceText,
      start: u.start,
      end: u.end,
      intent: intent,
    });
    toneBySpeaker[speaker].push({
      text: sentenceText,
      intent: intent,
      start: u.start,
      end: u.end,
    });
  });

  // Update analysisResults
  analysisResults.speakers = speakers;
  analysisResults.sentencesBySpeaker = sentencesBySpeaker;
  analysisResults.toneBySpeaker = toneBySpeaker;

  return {
    transcript: transcriptText,
    words: words,
    timestamp: timestamp,
    deepgramTimestamp: transcription.result.metadata.created,
  };
}

async function analyzeFullTranscript() {
  try {
    const meetingMinutes = await generateMeetingMinutes(storedTranscript);
    const sentimentBySpeaker = await analyzeSentimentBySpeaker(
      analysisResults.sentencesBySpeaker || {}
    );
    analysisResults = {
      summary: meetingMinutes.summary,
      bulletPoints: meetingMinutes.bulletPoints,
      actionItems: meetingMinutes.actionItems,
      decisions: meetingMinutes.decisions,
      toneBySpeaker: analysisResults.toneBySpeaker || {},
      sentencesBySpeaker: analysisResults.sentencesBySpeaker || {},
      sentimentBySpeaker: sentimentBySpeaker,
      speakers: analysisResults.speakers || {},
    };
    console.log("Generated Meeting Minutes:", analysisResults);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    analysisResults.error = error.message;
  }
}

function convertWebmToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error("Input file does not exist"));
    }

    const ffmpeg = spawn("C:/ffmpeg/bin/ffmpeg", [
      "-i",
      inputPath,
      "-ar",
      "16000",
      "-acodec",
      "pcm_s16le",
      outputPath,
    ]);

    ffmpeg.stderr.on("data", (data) => console.log(`🎬 FFmpeg: ${data}`));
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        fs.writeFileSync(
          path.join(audioDir, "last_recording.wav"),
          fs.readFileSync(outputPath)
        );
        resolve();
      } else {
        reject(new Error("FFmpeg conversion failed"));
      }
    });
  });
}

function cleanupAudioFiles(timestamp) {
  const webmPath = path.join(audioDir, `chunk_${timestamp}.webm`);
  const wavPath = path.join(audioDir, `chunk_${timestamp}.wav`);
  const lastRecordingPath = path.join(audioDir, "last_recording.wav");

  [webmPath, wavPath, lastRecordingPath].forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`🗑️ Deleted: ${file}`);
    }
  });
}
