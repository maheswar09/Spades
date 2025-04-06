import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, FileText, List, CheckSquare, MessageSquare, Users } from "lucide-react";

const Dashboard = () => {
  const [transcripts, setTranscripts] = useState([]);
  const [analysisResults, setAnalysisResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
    const ws = new WebSocket("ws://localhost:3000/ws");

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "start") {
        setTranscripts([]);
        setAnalysisResults({});
      } else if (message.type === "transcript") {
        setTranscripts((prev) => [
          ...prev,
          {
            words: message.words,
            timestamp: message.timestamp,
          },
        ]);
      } else if (message.type === "stop") {
        setAnalysisResults({
          transcript: message.transcript || "",
          summary: message.summary || "",
          bulletPoints: message.bulletPoints || [],
          actionItems: message.actionItems || [],
          decisions: message.decisions || [],
          toneBySpeaker: message.toneBySpeaker || {},
          sentencesBySpeaker: message.sentencesBySpeaker || {},
          sentimentBySpeaker: message.sentimentBySpeaker || {},
          speakers: message.speakers || {},
        });
      }
    };

    return () => ws.close();
  }, []);

  const formatTranscriptWithSpeakers = (words) => {
    let currentSpeaker = null;
    let formattedText = [];
    let currentText = "";

    words.forEach((word) => {
      const speaker = word.speaker + 1;
      if (currentSpeaker !== speaker) {
        if (currentText) {
          formattedText.push(`Speaker ${currentSpeaker}: ${currentText.trim()}`);
        }
        currentSpeaker = speaker;
        currentText = word.word;
      } else {
        currentText += ` ${word.word}`;
      }
    });

    if (currentText) {
      formattedText.push(`Speaker ${currentSpeaker}: ${currentText.trim()}`);
    }

    return formattedText;
  };

  // Function to format seconds into MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex items-center mb-8">
          <Mic className="h-20 w-20 text-purple-400 mr-3" />
          <h1 className="text-4xl font-bold text-white">Live Meeting Dashboard</h1>
        </div>

        {loading ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <p className="text-xl text-purple-200">Waiting for live transcription...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Live Transcription - Full Width */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
            >
              <div className="flex items-center mb-4">
                <FileText className="h-10 w-10 text-purple-400 mr-2" />
                <h2 className="text-2xl font-semibold text-white">Live Transcription</h2>
              </div>
              <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200">
                {transcripts.length > 0 ? (
                  transcripts.map((entry, index) => {
                    const formattedLines = formatTranscriptWithSpeakers(entry.words);
                    return (
                      <div key={index} className="mb-4">
                        <div className="text-sm text-purple-300 mb-1">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </div>
                        {formattedLines.map((line, lineIndex) => (
                          <div key={lineIndex} className="bg-white/5 rounded-lg p-3 mb-2">
                            <p className="text-lg">{line}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <p>No live transcription available yet.</p>
                )}
              </div>
            </motion.div>

            {/* Analysis Results */}
            {Object.keys(analysisResults).length > 0 && (
              <>
                {/* Summary - Full Width */}
                {analysisResults.summary && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                  >
                    <div className="flex items-center mb-4">
                      <MessageSquare className="h-10 w-10 text-purple-400 mr-2" />
                      <h3 className="text-2xl font-semibold text-white">Summary</h3>
                    </div>
                    <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200">
                      <p>{analysisResults.summary}</p>
                    </div>
                  </motion.div>
                )}

                {/* Two-column grid for remaining items */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {analysisResults.bulletPoints?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <List className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Key Points</h3>
                      </div>
                      <ul className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200 space-y-2">
                        {analysisResults.bulletPoints.map((point, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-lg text-purple-400 mr-2">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {analysisResults.actionItems?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <CheckSquare className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Action Items</h3>
                      </div>
                      <ul className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200 space-y-2">
                        {analysisResults.actionItems.map((item, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-lg text-purple-400 mr-2">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {analysisResults.decisions?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <List className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Decisions</h3>
                      </div>
                      <ul className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200 space-y-2">
                        {analysisResults.decisions.map((decision, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-lg text-purple-400 mr-2">✓</span>
                            {decision}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {analysisResults.sentimentBySpeaker && Object.keys(analysisResults.sentimentBySpeaker).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <Users className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Sentiment Analysis</h3>
                      </div>
                      <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200 grid grid-cols-1 gap-4">
                        {Object.entries(analysisResults.sentimentBySpeaker).map(([speaker, sentiment]) => (
                          <div key={speaker} className="bg-white/5 rounded-lg p-4">
                            <h4 className="text-lg text-purple-400 font-medium mb-1">{speaker}</h4>
                            <p className="text-lg">{sentiment.overallSentiment} (Sentiment) / {sentiment.overallEmotion} (Emotion)</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {analysisResults.toneBySpeaker && Object.keys(analysisResults.toneBySpeaker).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <Users className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Tone by Speaker</h3>
                      </div>
                      <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200">
                        {Object.entries(analysisResults.toneBySpeaker).map(([speaker, tones]) => (
                          <div key={speaker} className="mb-4">
                            <h4 className="text-lg text-purple-400 font-medium mb-2">{speaker}</h4>
                            <ul className="space-y-2">
                              {tones.map((tone, index) => (
                                <li key={index} className="flex flex-col">
                                  <span className="text-purple-400">
                                    {formatTime(tone.start)} - {formatTime(tone.end)}
                                  </span>
                                  <span>{tone.text} (Intent: {tone.intent})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {analysisResults.sentencesBySpeaker && Object.keys(analysisResults.sentencesBySpeaker).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
                    >
                      <div className="flex items-center mb-4">
                        <FileText className="h-10 w-10 text-purple-400 mr-2" />
                        <h3 className="text-2xl font-semibold text-white">Sentences by Speaker</h3>
                      </div>
                      <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200">
                        {Object.entries(analysisResults.sentencesBySpeaker).map(([speaker, sentences]) => (
                          <div key={speaker} className="mb-4">
                            <h4 className="text-lg text-purple-400 font-medium mb-2">{speaker}</h4>
                            <ul className="space-y-2">
                              {sentences.map((sentence, index) => (
                                <li key={index} className="flex flex-col">
                                  <span className="text-purple-400">
                                    {formatTime(sentence.start)} - {formatTime(sentence.end)}
                                  </span>
                                  <span>{sentence.text} (Intent: {sentence.intent})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;