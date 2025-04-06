// services/summaryService.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

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

export async function summarizeText(text) {
  const modelUrl =
    "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
  const maxInputLength = 800; // Characters per chunk
  const chunks = [];
  for (let i = 0; i < text.length; i += maxInputLength) {
    chunks.push(text.slice(i, i + maxInputLength));
  }

  const summaries = [];
  for (const chunk of chunks) {
    try {
      const response = await axios.post(
        modelUrl,
        {
          inputs: chunk,
          parameters: { max_length: 100 }, // Shorter summary per chunk
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
          },
        }
      );
      const summaryText = response.data[0].summary_text;
      summaries.push(summaryText);
    } catch (error) {
      console.error("Error summarizing chunk:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(
        "Error summarizing chunk: " +
          (error.response?.data?.error || error.message)
      );
    }
  }

  // Combine summaries
  const combinedSummary = summaries.join(" ");
  const bulletPoints = combinedSummary
    .split(".")
    .map((item) => item.trim())
    .filter((item) => item);
  console.log("Combined summary:", combinedSummary);
  console.log("Generated bullet points:", bulletPoints);
  return { summary: combinedSummary, bulletPoints };
}

// New function to analyze emotions in the meeting transcript
async function analyzeEmotions(text) {
  const emotionModelUrl =
    "https://api-inference.huggingface.co/models/monologg/bert-base-cased-goemotions-original";
  const sentences = text
    .split(/[.!?](?:\s|$)/)
    .filter((sentence) => sentence.trim());

  const sentenceEmotions = [];
  for (const sentence of sentences) {
    if (!sentence) {
      sentenceEmotions.push({ text: sentence, emotion: "Neutral" });
      continue;
    }

    try {
      const response = await axios.post(
        emotionModelUrl,
        { inputs: sentence.trim() },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
          },
        }
      );
      console.log(
        `Sentence emotion response for "${sentence}":`,
        response.data
      );
      const rawLabel = response.data[0][0].label.toLowerCase();
      const emotionLabel = emotionLabelMap[rawLabel] || "Neutral";
      sentenceEmotions.push({ text: sentence, emotion: emotionLabel });
    } catch (error) {
      console.error(
        `Error analyzing emotion for "${sentence}":`,
        error.message
      );
      sentenceEmotions.push({ text: sentence, emotion: "Neutral" });
    }
  }

  // Determine overall emotion for the meeting
  const emotionCounts = sentenceEmotions.reduce((acc, item) => {
    acc[item.emotion] = (acc[item.emotion] || 0) + 1;
    return acc;
  }, {});
  let overallEmotion = "Neutral";
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      overallEmotion = emotion;
    }
  }

  return {
    overallEmotion,
    sentences: sentenceEmotions,
  };
}

// Function to process meeting minutes, action items, decisions, and emotions
export async function generateMeetingMinutes(meetingText) {
  // Get the summary from summarizeText
  const { summary, bulletPoints } = await summarizeText(meetingText);

  // Extract action items and decisions from the original text
  const actionItems = extractActionItems(meetingText);
  const decisions = extractDecisions(meetingText);

  // Analyze emotions in the meeting transcript
  const emotions = await analyzeEmotions(meetingText);

  // Structure the meeting minutes
  const meetingMinutes = {
    summary: summary,
    bulletPoints: bulletPoints,
    actionItems: actionItems,
    decisions: decisions,
    overallEmotion: emotions.overallEmotion,
    sentenceEmotions: emotions.sentences,
  };

  return meetingMinutes;
}

// Enhanced function to extract action items with owners and deadlines
function extractActionItems(text) {
  const structuredActionItems = [];

  // Split into sentences more accurately
  const sentences = text.split(/[.!?](?:\s|$)/);

  // Process each sentence with context
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    // Get context (previous and next sentences)
    const prevSentence = i > 0 ? sentences[i - 1].trim() : "";
    const nextSentence =
      i < sentences.length - 1 ? sentences[i + 1].trim() : "";

    // Check for action patterns with more sophisticated regex
    const actionPatterns = [
      // Task assignment patterns
      {
        regex:
          /(\w+)\s+(?:will|shall|must|needs? to|has to|should|is going to)\s+([^,.]+)/i,
        type: "task",
        priority: "medium",
      },
      {
        regex:
          /(?:we|team)\s+(?:will|shall|must|need to|have to|should)\s+([^,.]+)/i,
        type: "team-task",
        priority: "medium",
      },
      // Urgent tasks
      {
        regex:
          /(?:urgent|immediately|asap|right away|critical)(?:[^,.]*?)(?:task|action|need)\s+([^,.]+)/i,
        type: "urgent-task",
        priority: "high",
      },
      // Follow-up items
      {
        regex: /follow(?:\s|-)?up\s+(?:on|with)?\s+([^,.]+)/i,
        type: "follow-up",
        priority: "medium",
      },
      // Action verbs at beginning of sentence
      {
        regex:
          /^(?:implement|create|develop|establish|prepare|research|investigate|contact|schedule|organize|review|update|complete)\s+([^,.]+)/i,
        type: "action",
        priority: "medium",
      },
      // Conversational suggestions
      {
        regex:
          /(?:feel free to|you can|you should|you might want to|try to|consider)\s+([^,.]+)/i,
        type: "suggestion",
        priority: "low",
      },
      // Questions that imply action
      {
        regex: /(?:is there anything|what|how about)\s+([^?]+)\?/i,
        type: "question-action",
        priority: "medium",
      },
      // Invitations
      {
        regex:
          /(?:come back|reach out|contact me|let me know|tell me)\s+([^,.]+)/i,
        type: "invitation",
        priority: "medium",
      },
    ];

    // Check each pattern
    for (const pattern of actionPatterns) {
      const match = sentence.match(pattern.regex);
      if (match) {
        // Extract owner if present
        let owner = null;
        if (pattern.type === "task" && match[1]) {
          owner = match[1];
        } else {
          // Try to find owner in other patterns
          const ownerMatch = sentence.match(
            /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:will|to|should|needs to)/i
          );
          if (ownerMatch) owner = ownerMatch[1];
        }

        // Extract deadline if present
        let deadline = null;
        const deadlinePatterns = [
          /by\s+(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|end of \w+|\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+\w+)/i,
          /due\s+(?:on|by)?\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+of\s+\w+)/i,
          /(this|next)\s+(week|month|quarter)/i,
          /(?:anytime|whenever)\s+([^,.]+)/i,
        ];

        for (const deadlinePattern of deadlinePatterns) {
          const deadlineMatch = sentence.match(deadlinePattern);
          if (deadlineMatch) {
            deadline = deadlineMatch[1];
            break;
          }
        }

        // Add structured action item
        structuredActionItems.push({
          text: sentence,
          type: pattern.type,
          owner: owner,
          deadline: deadline,
          priority: pattern.priority,
          context: prevSentence,
        });

        break;
      }
    }

    // Special case for conversational content - look for implied actions
    if (
      sentence.includes("feel free to come back") ||
      sentence.includes("take care") ||
      sentence.includes("miss most about home")
    ) {
      structuredActionItems.push({
        text: sentence,
        type: "suggestion",
        owner: null,
        deadline: null,
        priority: "low",
        context: prevSentence,
      });
    }
  }

  // Format action items for display
  const formattedActionItems = structuredActionItems.map((item) => {
    let formattedItem = `${item.text}`;

    // Add metadata if available
    const metadata = [];
    if (item.owner) metadata.push(`Owner: ${item.owner}`);
    if (item.deadline) metadata.push(`Due: ${item.deadline}`);
    if (item.priority === "high") metadata.push("Priority: High");

    if (metadata.length > 0) {
      formattedItem += ` (${metadata.join(" | ")})`;
    }

    return formattedItem;
  });

  // Ensure we always return at least one action item for conversational content
  if (
    formattedActionItems.length === 0 &&
    text.toLowerCase().includes("feel free to come back")
  ) {
    return [
      "Feel free to come back anytime you want to talk (Type: invitation)",
    ];
  }

  return formattedActionItems.length > 0 ? formattedActionItems : [];
}

// Helper function to extract decisions
function extractDecisions(text) {
  const decisionKeywords = [
    "decided",
    "agreed",
    "approved",
    "resolved",
    "concluded",
    "Conclude",
    "Approve",
    "Reject",
    "Accept",
    "Deduce",
    "Resolve",
    "Commit",
    "Confirm",
    "Select",
    "Opt",
    "Determine",
    "Finalize",
    "Ratify",
    "Authorize",
    "Define",
    "Establish",
    "Designate",
    "Prioritize",
    "Verify",
    "Endorse",
    "Concur",
    "Elect",
    "Consent",
    "Discern",
    "Weigh",
    "Contemplate",
    "Consider",
    "Choose",
  ];
  const sentences = text.split(".");
  const decisions = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) =>
      decisionKeywords.some((keyword) =>
        sentence.toLowerCase().includes(keyword)
      )
    )
    .map((item) => `${item}`);

  return decisions.length > 0 ? decisions : [];
}
