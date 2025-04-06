import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { createClient } from "@deepgram/sdk";

if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error(
    "DEEPGRAM_API_KEY is not set in the environment variables. Please add it to your .env file."
  );
}

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export async function transcribeAudio(filePath) {
  try {
    const response = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(filePath),
      {
        model: "nova-3",
        diarize: true, // Enable diarization to separate speakers
        punctuate: true, // Add punctuation for better readability
        utterances: true,
        intent: true,
        utt_split: 0.5,
        smart_format: true,
        intents: true,
        custom_intent: [
          "provide_update",
          "assign_task",
          "plan_strategy",
          "discuss_charity",
        ],
        custom_intent_mode: "extended",
      }
    );
    console.log("Deepgram response:", JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error("Deepgram transcription error:", error);
    throw error;
  }
}
