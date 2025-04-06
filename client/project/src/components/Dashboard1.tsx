import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, BarChart2, MessageSquare, Users, CheckSquare, List } from "lucide-react";

const Dashboard1 = () => {
  const [transcript, setTranscript] = useState("");
  const [analysisResults, setAnalysisResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("full"); // "full" or "bySpeaker"

  useEffect(() => {
    fetch("http://localhost:3000/dashboard1")
      .then((res) => res.json())
      .then((data) => {
        setTranscript(data.transcript);
        setAnalysisResults(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching dashboard data:", err);
        setLoading(false);
      });
  }, []);

  // Function to format seconds into MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Reconstruct the full transcript as a list of sentences with timestamps
  const getFullTranscriptSentences = () => {
    if (!analysisResults.speakers || Object.keys(analysisResults.speakers).length === 0) {
      return [];
    }

    const allSentences = [];
    Object.entries(analysisResults.speakers).forEach(([speaker, sentences]) => {
      sentences.forEach((sentence) => {
        allSentences.push({
          ...sentence,
          speaker,
        });
      });
    });

    allSentences.sort((a, b) => a.start - b.start);
    return allSentences;
  };

  const fullTranscriptSentences = getFullTranscriptSentences();

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex items-center mb-8">
          <BarChart2 className="h-20 w-20 text-purple-400 mr-3" />
          <h1 className="text-4xl font-bold text-white">Meeting Analysis Dashboard</h1>
        </div>

        {/* Toggle Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => setViewMode(viewMode === "full" ? "bySpeaker" : "full")}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {viewMode === "full" ? "View Transcript by Speaker" : "View Full Transcript"}
          </button>
        </motion.div>

        {loading ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4">
                <div className="h-4 bg-purple-400/20 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-purple-400/20 rounded"></div>
                  <div className="h-4 bg-purple-400/20 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Transcript Section - Full Width */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-96"
            >
              <div className="flex items-center mb-4">
                <FileText className="h-10 w-10 text-purple-400 mr-2" />
                <h2 className="text-2xl font-semibold text-white">
                  {viewMode === "full" ? "Full Transcript" : "Transcript by Speaker"}
                </h2>
              </div>
              <div className="text-lg overflow-y-auto h-[calc(100%-4rem)] text-purple-200">
                {viewMode === "full" ? (
                  fullTranscriptSentences.length > 0 ? (
                    <ul className="space-y-2">
                      {fullTranscriptSentences.map((sentence, index) => (
                        <li key={index} className="flex flex-col">
                          <span className="text-purple-400">
                            {formatTime(sentence.start)} - {formatTime(sentence.end)}
                          </span>
                          <span>{sentence.speaker}: {sentence.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "No transcript available."
                  )
                ) : (
                  analysisResults.speakers && Object.keys(analysisResults.speakers).length > 0 ? (
                    Object.entries(analysisResults.speakers).map(([speaker, sentences]) => (
                      <div key={speaker} className="mb-4">
                        <h3 className="text-lg text-purple-400 font-medium mb-2">{speaker}</h3>
                        <ul className="space-y-2">
                          {sentences.map((sentence, index) => (
                            <li key={index} className="flex flex-col">
                              <span className="text-purple-400">
                                {formatTime(sentence.start)} - {formatTime(sentence.end)}
                              </span>
                              <span>{sentence.text} {sentence.intent && `(Intent: ${sentence.intent})`}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    "No speaker data available."
                  )
                )}
              </div>
            </motion.div>

            {/* Summary Section - Full Width */}
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

            {/* Two-column grid for remaining cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {analysisResults.bulletPoints && (
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

              {analysisResults.actionItems && analysisResults.actionItems.length > 0 && (
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

              {analysisResults.sentimentBySpeaker && (
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
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard1;