import Sentiment from "sentiment";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const sentiment = new Sentiment();

// Mapping for sentiment labels from the cardiffnlp/twitter-roberta-base-sentiment model
const sentimentLabelMap = {
  label_0: "negative",
  label_1: "neutral",
  label_2: "positive",
};

// Mapping for emotion labels from the monologg/bert-base-cased-goemotions-original model
const emotionLabelMap = {
  admiration: "Happy",
  amusement: "Happy",
  approval: "Happy",
  caring: "Happy",
  gratitude: "Happy",
  joy: "Happy",
  love: "Happy",
  optimism: "Happy",
  pride: "Happy",
  relief: "Happy",
  excitement: "Excited",
  surprise: "Excited",
  realization: "Excited",
  disappointment: "Sad",
  embarrassment: "Sad",
  grief: "Sad",
  remorse: "Sad",
  sadness: "Sad",
  anger: "Angry",
  annoyance: "Angry",
  disapproval: "Angry",
  disgust: "Angry",
  confusion: "Neutral",
  curiosity: "Neutral",
  fear: "Neutral",
  nervousness: "Neutral",
  neutral: "Neutral",
};

export async function analyzeSentimentBySpeaker(sentencesBySpeaker) {
  const sentimentModelUrl =
    "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment";
  const emotionModelUrl =
    "https://api-inference.huggingface.co/models/monologg/bert-base-cased-goemotions-original";
  const results = {};

  for (const [speaker, sentences] of Object.entries(sentencesBySpeaker)) {
    const speakerText = sentences
      .map((s) => s.text)
      .join(" ")
      .trim();
    if (!speakerText) {
      results[speaker] = {
        overallSentiment: "neutral",
        overallEmotion: "Neutral",
        sentences: [],
      };
      continue;
    }

    // Analyze overall sentiment for the speaker
    let overallSentiment = "neutral";
    try {
      const response = await axios.post(
        sentimentModelUrl,
        { inputs: speakerText },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
          },
        }
      );
      console.log(`Overall sentiment response for ${speaker}:`, response.data);
      const rawLabel = response.data[0][0].label.toLowerCase();
      overallSentiment = sentimentLabelMap[rawLabel] || rawLabel;
    } catch (error) {
      console.error(
        `Error analyzing overall sentiment for ${speaker}:`,
        error.message
      );
    }

    // Analyze overall emotion for the speaker
    let overallEmotion = "Neutral";
    const sentenceEmotions = []; // To store emotions for calculating overall emotion
    for (const sentence of sentences) {
      if (!sentence.text || !sentence.text.trim()) {
        sentenceEmotions.push("Neutral");
        continue;
      }

      try {
        const response = await axios.post(
          emotionModelUrl,
          { inputs: sentence.text.trim() },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            },
          }
        );
        console.log(
          `Sentence emotion response for "${sentence.text}":`,
          response.data
        );
        const rawLabel = response.data[0][0].label.toLowerCase();
        const emotionLabel = emotionLabelMap[rawLabel] || "Neutral";
        sentenceEmotions.push(emotionLabel);
      } catch (error) {
        console.error(
          `Error analyzing emotion for "${sentence.text}":`,
          error.message
        );
        sentenceEmotions.push("Neutral");
      }
    }

    // Determine overall emotion based on the most frequent emotion
    const emotionCounts = sentenceEmotions.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {});
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        overallEmotion = emotion;
      }
    }

    // Analyze sentiment and emotion for each sentence
    const sentenceDetails = [];
    for (const sentence of sentences) {
      if (!sentence.text || !sentence.text.trim()) {
        sentenceDetails.push({
          text: sentence.text || "",
          intent: sentence.intent,
          start: sentence.start,
          end: sentence.end,
          sentiment: "neutral",
          emotion: "Neutral",
        });
        continue;
      }

      let sentimentLabel = "neutral";
      let emotionLabel = "Neutral";

      // Analyze sentiment for the sentence
      try {
        const sentimentResponse = await axios.post(
          sentimentModelUrl,
          { inputs: sentence.text.trim() },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            },
          }
        );
        console.log(
          `Sentence sentiment response for "${sentence.text}":`,
          sentimentResponse.data
        );
        const rawSentimentLabel =
          sentimentResponse.data[0][0].label.toLowerCase();
        sentimentLabel =
          sentimentLabelMap[rawSentimentLabel] || rawSentimentLabel;
      } catch (error) {
        console.error(
          `Error analyzing sentiment for "${sentence.text}":`,
          error.message
        );
      }

      // Analyze emotion for the sentence
      try {
        const emotionResponse = await axios.post(
          emotionModelUrl,
          { inputs: sentence.text.trim() },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            },
          }
        );
        console.log(
          `Sentence emotion response for "${sentence.text}":`,
          emotionResponse.data
        );
        const rawEmotionLabel = emotionResponse.data[0][0].label.toLowerCase();
        emotionLabel = emotionLabelMap[rawEmotionLabel] || "Neutral";
      } catch (error) {
        console.error(
          `Error analyzing emotion for "${sentence.text}":`,
          error.message
        );
      }

      sentenceDetails.push({
        text: sentence.text,
        intent: sentence.intent,
        start: sentence.start,
        end: sentence.end,
        sentiment: sentimentLabel,
        emotion: emotionLabel,
      });
    }

    results[speaker] = {
      overallSentiment,
      overallEmotion,
      sentences: sentenceDetails,
    };
  }

  return results;
}

export function extractActionItems(text) {
  const actionItems = [];
  const decisions = [];
  const lines = text.split(".");

  lines.forEach((line) => {
    if (line.match(/should|must|will|need to/i)) {
      actionItems.push(line.trim());
    }
    if (line.match(/decided|agreed|determined/i)) {
      decisions.push(line.trim());
    }
  });

  return { actionItems, decisions };
}
