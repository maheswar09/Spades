let mediaRecorder;
let audioContext;
let destination;
let tabStream;
let micStream;
let ws;
let isRecording = false;

document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const dashboardButton = document.getElementById("dashboardButton");
  const viewSummaryButton = document.getElementById("viewSummaryButton");
  const newRecordingButton = document.getElementById("newRecordingButton");

  startButton.addEventListener("click", startRecording);
  stopButton.addEventListener("click", stopRecording);
  dashboardButton.addEventListener("click", openDashboard);
  viewSummaryButton.addEventListener("click", viewSummary);
  newRecordingButton.addEventListener("click", startRecording);

  showView("initial-view");
});

async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    console.error("Microphone permission denied:", err);
    alert("Microphone access is required. Please allow it.");
    return false;
  }
}

async function startRecording() {
  try {
    const micPermissionGranted = await requestMicrophonePermission();
    if (!micPermissionGranted) return;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("Active tab:", tab.id, "URL:", tab.url);

    if (
      !tab ||
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("about:")
    ) {
      throw new Error("Cannot capture audio from this tab.");
    }

    tabStream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
        if (chrome.runtime.lastError) {
          console.error("Tab capture error:", chrome.runtime.lastError.message);
          reject(new Error("Failed to capture tab audio"));
        } else {
          resolve(stream);
        }
      });
    });

    if (!tabStream) throw new Error("Failed to capture tab audio");

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    audioContext = new AudioContext();
    destination = audioContext.createMediaStreamDestination();

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    if (tabStream && tabStream.getAudioTracks().length > 0) {
      const tabSource = audioContext.createMediaStreamSource(tabStream);
      tabSource.connect(destination);
      tabSource.connect(audioContext.destination);
      console.log("Tab and microphone audio mixed");
    } else {
      console.warn("No audio from tab, using microphone only");
    }

    ws = new WebSocket("ws://localhost:3000/ws");
    ws.onopen = () => {
      console.log("WebSocket connected to backend");
      const startMsg = JSON.stringify({ type: "start" });
      console.log("Sending:", startMsg);
      ws.send(startMsg);
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from backend:", data); // Log full response
      chrome.runtime.sendMessage({
        type: "transcription",
        data: data.transcript,
      });
    };
    ws.onerror = (e) => console.error("WebSocket error:", e);
    ws.onclose = () => console.log("WebSocket closed");

    isRecording = true;
    startChunkRecording();
    showView("recording-view");
  } catch (error) {
    console.error("Error starting recording:", error.message);
    alert(`Recording failed: ${error.message}`);
  }
}

function startChunkRecording() {
  if (!isRecording) return;

  mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType: "audio/webm;codecs=opus",
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 1000) {
      console.log("Sending audio chunk, size:", event.data.size);
      const chunkBlob = new Blob([event.data], { type: "audio/webm" });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunkBlob);
      }
      // Removed download logic
    } else {
      console.log("Skipping small chunk, size:", event.data.size);
    }
  };

  mediaRecorder.onstop = () => {
    if (isRecording) {
      setTimeout(startChunkRecording, 100);
    }
  };

  mediaRecorder.start();
  setTimeout(() => {
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }, 5000);
  console.log("MediaRecorder started for 5-second chunk");
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    isRecording = false;
    mediaRecorder.stop();
    console.log("MediaRecorder stopped");

    if (tabStream) {
      tabStream.getTracks().forEach((track) => track.stop());
      console.log("Tab stream stopped");
    }
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      console.log("Microphone stream stopped");
    }
    if (audioContext) {
      audioContext.close();
      console.log("AudioContext closed");
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      const stopMsg = JSON.stringify({ type: "stop" });
      console.log("Sending:", stopMsg);
      ws.send(stopMsg);
      setTimeout(() => {
        ws.close();
        console.log("WebSocket closed");
        showView("summary-view");
      }, 2000);
    }
  }
}

function openDashboard() {
  chrome.tabs.create({ url: "http://localhost:5173/dashboard" });
}

function viewSummary() {
  chrome.tabs.create({ url: "http://localhost:5173/dashboard" });
}

function showView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((view) => view.classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
}
