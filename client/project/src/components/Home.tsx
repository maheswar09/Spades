import React, { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileAudio, Mic, BarChart2 } from "lucide-react";

const Home = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setError("No file selected.");
      return;
    }
    await uploadFile(selectedFile);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    
    const selectedFile = event.dataTransfer.files[0];
    if (!selectedFile) {
      setError("No file selected.");
      return;
    }
    await uploadFile(selectedFile);
  };

  const uploadFile = async (file: File) => {
    const allowedTypes = ["audio/mpeg", "audio/wav", "video/mp4"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a valid MP3, WAV, or MP4 file.");
      return;
    }

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:3000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file.");
      }

      const data = await response.json();
      console.log("File uploaded successfully:", data);
      window.location.href = "/dashboard1";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while uploading the file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto text-center"
      >
        <h1 className="text-5xl font-bold text-white mb-6">
          AI-Powered Meeting Assistant
        </h1>
        <h2 className="text-2xl text-purple-200 mb-12">
          Transform your meetings with real-time transcription, analysis, and insights
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6"
          >
            <div className="flex justify-center mb-4">
              <Mic className="h-20 w-20 text-purple-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Live Recording</h3>
            <p className="text-lg text-purple-200">
              Record and transcribe your meetings in real-time with high accuracy
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6"
          >
            <div className="flex justify-center mb-4">
              <FileAudio className="h-20 w-20 text-purple-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">File Analysis</h3>
            <p className="text-lg text-purple-200">
              Upload existing audio files for instant transcription and analysis
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6"
          >
            <div className="flex justify-center mb-4">
              <BarChart2 className="h-20 w-20 text-purple-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Smart Insights</h3>
            <p className="text-lg text-purple-200">
              Get AI-powered summaries, action items, and sentiment analysis
            </p>
          </motion.div>
        </div>

        <div className="max-w-xl mx-auto">
          <motion.div
            className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
              dragActive ? 'border-purple-400 bg-purple-500/20' : 'border-purple-500/50 hover:border-purple-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <Upload className="h-20 w-20 text-purple-400 mb-4" />
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".mp3,.wav,.mp4"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <span className="bg-purple-500 text-white text-xl px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors">
                  {uploading ? "Uploading..." : "Upload File"}
                </span>
              </label>
              <p className="text-lg text-purple-200 mt-4">
                Drag & drop your audio/video file here or click to browse
              </p>
              {error && (
                <p className="text-red-400 mt-4">{error}</p>
              )}
              {uploading && (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-purple-200 mt-2">Processing your file...</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;