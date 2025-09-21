// Fixed server.js with better Ollama handling and debugging
// Complete Fixed server.js with optimized Ollama handling
import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";
import JSON5 from "json5";
const json5parse = JSON5.parse;

// Import your AI training system
import { AnnieMemory } from "./ai/AnnieMemory.js";
import { ProactiveBehavior } from "./ai/ProactiveBehavior.js";
import { SentimentAnalyzer } from "./ai/SentimentAnalyzer.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(bodyParser.json());

const activeConnections = new Map();
let connectionCounter = 0;

// Initialize AI system
const annieMemory = new AnnieMemory();
const sentimentAnalyzer = new SentimentAnalyzer();
let proactiveBehavior;

await annieMemory.loadMemory();
proactiveBehavior = new ProactiveBehavior(annieMemory);

// ✅ OPTIMIZED OLLAMA QUERY FUNCTION
async function queryAnnieWithMemory(userPrompt, isProactive = false) {
  console.log("🔹 Starting query to Ollama...");

  const sentiment = sentimentAnalyzer.analyzeSentiment(userPrompt);
  const emotionalContext = sentimentAnalyzer.getEmotionalContext(userPrompt, sentiment);
  const insights = annieMemory.getPersonalityInsights();
  const recentContext = annieMemory.getRecentContext(3); // Reduced from 8
  const memoryRef = annieMemory.shouldShowMemoryReference() ? annieMemory.getMemoryReference() : null;

  // ✅ MUCH SIMPLER PROMPT - The key fix!
  let systemPrompt = `You are Ai Hoshino, a cheerful, playful AI companion. 
Current mood: ${annieMemory.mood}. 
Talk to the user in a warm, natural, and realistic way — like a friend. 
Keep responses short and conversational.

At the END of your reply, also include a single JSON object on a new line with this exact format:
{"expression": "happy", "motion": "smile"}

Valid expressions: happy, sad, neutral, excited, thinking, surprised
Valid motions: smile, nod, tiltHead, blink, wave, idle

User: ${userPrompt}
`;

  try {
    console.log("🔹 Sending request to Ollama...");
    console.log("🔹 Prompt length:", systemPrompt.length);

    // ✅ CRITICAL FIXES:
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⏰ Request timeout - aborting");
      controller.abort();
    }, 120000); // Increased to 25 seconds

    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "tinyllama",
        prompt: systemPrompt,
        stream: false, // ✅ NO streaming
        options: {
          temperature: 0.3, // ✅ Lower temperature for more consistent JSON
          num_predict: 100, // ✅ Shorter responses
          top_k: 5, // ✅ More focused responses
          top_p: 0.8,
          repeat_penalty: 1.1,
          stop: ["\n\nUser:", "Human:", "\n\n", "```"] // ✅ Better stop sequences
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log("🔹 Response status:", res.status);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("🔹 Raw Ollama response:", JSON.stringify(data, null, 2));

    if (!data.response || typeof data.response !== "string") {
      throw new Error("Invalid response format from Ollama");
    }

    console.log("🔹 Response content:", data.response);

    let annieResponse = parseAnnieResponse(data.response);

    // ✅ Final validation with better fallback
    if (!annieResponse.reply || annieResponse.reply.length < 3) {
      console.warn("⚠️ Response too short, using contextual fallback");
      annieResponse = getContextualFallback(userPrompt, sentiment);
    }

    console.log("✅ Final Annie response:", annieResponse);

    // Save to memory (existing code)
    if (!isProactive) {
      annieMemory.addConversation('User', userPrompt, { sentiment, ...emotionalContext });
      annieMemory.updateMood(sentiment);
      annieMemory.updateRelationships(sentiment);
    }

    annieMemory.addConversation('Annie', annieResponse.reply, {
      expression: annieResponse.expression,
      motion: annieResponse.motion,
      mood: annieMemory.mood
    });

    await annieMemory.saveTrainingData(userPrompt, annieResponse, {
      mood: annieMemory.mood,
      relationship_stage: annieMemory.userProfile.relationship_stage,
      affection: annieMemory.relationships.affection,
      recentHistory: recentContext
    });

    // ✅ Save less frequently to reduce I/O
    if (Math.random() < 0.2) { // Reduced from 0.3
      await annieMemory.saveMemory();
    }

    return annieResponse;

  } catch (error) {
    console.error("❌ Error querying Ollama:", error.name, error.message);

    // ✅ Better error handling with contextual fallbacks
    if (error.name === 'AbortError') {
      return getTimeoutFallback(userPrompt);
    }

    if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      return getConnectionFallback();
    }

    return getGenericFallback(userPrompt);
  }
}

// ✅ MUCH IMPROVED JSON PARSING
function parseAnnieResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== "string") return null;

  console.log("🔍 Parsing response:", rawResponse.substring(0, 200) + "...");

  // Extract JSON metadata at the end
  const jsonMatch = rawResponse.match(/\{[^}]*\}/);
  let expression = "neutral";
  let motion = "idle";

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[0]);
      expression = validateExpression(meta.expression);
      motion = validateMotion(meta.motion);
    } catch (e) {
      console.warn("⚠️ Metadata parse failed:", e.message);
    }
  }

  // Take everything BEFORE the JSON as the actual reply
  const replyText = rawResponse.replace(/\{[^}]*\}/, "").trim();

  return {
    reply: replyText,
    expression,
    motion
  };
}


// ✅ Helper functions for validation and fallbacks
function validateExpression(exp) {
  const valid = ["happy", "sad", "neutral", "excited", "thinking", "surprised"];
  return valid.includes(exp) ? exp : "neutral";
}

function validateMotion(motion) {
  const valid = ["smile", "nod", "tiltHead", "blink", "wave", "idle"];
  return valid.includes(motion) ? motion : "idle";
}

function getContextualFallback(userPrompt, sentiment) {
  const responses = {
    positive: [
      "That sounds great! Tell me more! 😊",
      "I'm so happy to hear that! 💕",
      "That's wonderful! How exciting! ✨"
    ],
    negative: [
      "I'm sorry to hear that... How can I help? 💙",
      "That sounds tough. I'm here for you! 🤗",
      "Oh no... Want to talk about it? 😔"
    ],
    neutral: [
      "That's interesting! What do you think about it? 🤔",
      "I see! Can you tell me more? 😌",
      "Hmm, that's something to think about! 💭"
    ]
  };

  const category = sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral';
  const msgs = responses[category];
  const reply = msgs[Math.floor(Math.random() * msgs.length)];

  return {
    reply,
    expression: category === 'positive' ? 'happy' : category === 'negative' ? 'sad' : 'thinking',
    motion: category === 'positive' ? 'smile' : category === 'negative' ? 'nod' : 'tiltHead'
  };
}

function getTimeoutFallback(userPrompt) {
  const responses = [
    "Sorry, I need a moment to think... Can you ask me again? 🤔",
    "My thoughts are running slow right now... Try once more? 💭",
    "Hmm, I'm taking too long to respond! Let me try again! ⏰"
  ];

  return {
    reply: responses[Math.floor(Math.random() * responses.length)],
    expression: "thinking",
    motion: "tiltHead"
  };
}

function getConnectionFallback() {
  return {
    reply: "I'm having trouble connecting to my brain... Is Ollama running? 🤖",
    expression: "sad",
    motion: "lookAway"
  };
}

function getGenericFallback(userPrompt) {
  return {
    reply: "Something went wrong with my thoughts... What were we talking about? 😅",
    expression: "neutral",
    motion: "idle"
  };
}

// ✅ Enhanced Ollama health check
async function checkOllamaHealthDetailed() {
  try {
    console.log("🔍 Checking Ollama health...");

    // Check if Ollama is running
    const tagsRes = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!tagsRes.ok) {
      throw new Error(`Ollama server error: ${tagsRes.status}`);
    }

    const tagsData = await tagsRes.json();
    console.log("📋 Available models:", tagsData.models?.map(m => m.name) || []);

    // Check if tinyllama is available
    const hasTinyLlama = tagsData.models?.some(m => m.name.includes('tinyllama'));

    if (!hasTinyLlama) {
      console.warn("⚠️ tinyllama model not found! Available models:", tagsData.models?.map(m => m.name));
      return { available: true, modelReady: false, models: tagsData.models };
    }

    // Test a simple generation
    const testRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tinyllama",
        prompt: 'Say "OK" in JSON: {"reply": "OK"}',
        stream: false,
        options: { num_predict: 20 }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!testRes.ok) {
      throw new Error(`Test generation failed: ${testRes.status}`);
    }

    const testData = await testRes.json();
    const isWorking = testData.response && testData.response.includes('OK');

    console.log(isWorking ? "✅ Ollama test successful" : "⚠️ Ollama test failed");

    return {
      available: true,
      modelReady: isWorking,
      models: tagsData.models,
      testResponse: testData.response
    };

  } catch (error) {
    console.error("❌ Ollama health check failed:", error.message);
    return {
      available: false,
      modelReady: false,
      error: error.message
    };
  }
}

// ✅ Simple test endpoint for direct Ollama testing
app.post("/ollama-direct-test", async (req, res) => {
  console.log("🧪 Testing direct Ollama connection...");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);  //120 sec

    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tinyllama",
        prompt: 'Say "Hello World" in JSON format: {"message": "Hello World"}',
        stream: false,
        options: {
          num_predict: 50
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Direct Ollama test successful:", data);

    res.json({
      success: true,
      ollamaResponse: data
    });

  } catch (error) {
    console.error("❌ Direct Ollama test failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      suggestion: error.name === 'AbortError' ?
        'Ollama is too slow - check system resources' :
        'Check if Ollama is running: ollama serve'
    });
  }
});

// Enhanced Socket.IO handling with better error handling
io.on("connection", (socket) => {
  connectionCounter++;
  const connectionId = connectionCounter;
  const connectionTime = Date.now();

  activeConnections.set(socket.id, {
    id: connectionId,
    connectedAt: connectionTime,
    lastActivity: connectionTime
  });

  console.log(`✅ User connected: ${socket.id} (Connection #${connectionId})`);
  console.log(`📊 Active connections: ${activeConnections.size}`);

  proactiveBehavior.updateLastInteraction();

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });

  socket.on('disconnect', (reason) => {
    const connection = activeConnections.get(socket.id);
    const duration = connection ? Date.now() - connection.connectedAt : 0;

    console.log(`❌ User disconnected: ${socket.id} (Connection #${connection?.id || 'unknown'})`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📊 Remaining connections: ${activeConnections.size - 1}`);

    activeConnections.delete(socket.id);
  });

  // Send initial stats
  try {
    socket.emit("annieStats", {
      mood: annieMemory.mood,
      relationship: annieMemory.userProfile.relationship_stage,
      affection: annieMemory.relationships.affection,
      conversations: annieMemory.conversationHistory.length,
      lastSeen: annieMemory.conversationHistory.length > 0 ?
        annieMemory.conversationHistory[annieMemory.conversationHistory.length - 1].timestamp : null,
      connectionId: connectionId
    });

    // ✅ Send connection confirmation
    socket.emit("connectionConfirmed", {
      connectionId,
      serverTime: Date.now(),
      ollamaStatus: "checking..."
    });

  } catch (error) {
    console.error(`Failed to send initial data to ${socket.id}:`, error);
  }

  // ✅ IMPROVED: Better message handling with timeout protection
  socket.on("chatMessage", async (msg) => {
    console.log(`💬 Message from ${socket.id}:`, msg);

    if (activeConnections.has(socket.id)) {
      activeConnections.get(socket.id).lastActivity = Date.now();
    }

    proactiveBehavior.updateLastInteraction();

    // ✅ Add processing indicator
    socket.emit("processingMessage", { timestamp: Date.now() });

    try {
      // ✅ Add timeout protection (30 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Ollama request timeout")), 30000);
      });

      const reply = await Promise.race([
        queryAnnieWithMemory(msg),
        timeoutPromise
      ]);

      console.log(`✅ Sending reply to ${socket.id}:`, reply);

      socket.emit("aiReply", reply);
      socket.emit("annieStats", {
        mood: annieMemory.mood,
        relationship: annieMemory.userProfile.relationship_stage,
        affection: annieMemory.relationships.affection,
        conversations: annieMemory.conversationHistory.length
      });

    } catch (error) {
      console.error(`❌ Error processing message from ${socket.id}:`, error.message);

      socket.emit("aiReply", {
        reply: "Sorry, I'm having some connection issues... Can you try again in a moment? 😔",
        expression: "sad",
        motion: "lookAway"
      });

      // ✅ Send error details in development
      if (process.env.NODE_ENV === 'development') {
        socket.emit("debugError", {
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  });

  socket.on("getAnnieThoughts", () => {
    try {
      const thoughts = proactiveBehavior.getEmotionalState();
      socket.emit("annieThoughts", {
        thoughts,
        mood: annieMemory.mood,
        recentMemories: annieMemory.autonomousThoughts.slice(-3)
      });
    } catch (error) {
      console.error(`Error getting Annie's thoughts for ${socket.id}:`, error);
    }
  });

  // ✅ Add Ollama health check endpoint for client
  socket.on("checkOllamaStatus", async () => {
    try {
      const health = await checkOllamaHealthDetailed();
      socket.emit("ollamaStatus", {
        ...health,
        timestamp: Date.now()
      });
    } catch (error) {
      socket.emit("ollamaStatus", {
        available: false,
        error: error.message,
        timestamp: Date.now()
      });
    }
  });

  // Heartbeat system
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  socket.on('pong', () => {
    if (activeConnections.has(socket.id)) {
      activeConnections.get(socket.id).lastActivity = Date.now();
    }
  });

  // Clear heartbeat on disconnect
  socket.on('disconnect', () => {
    clearInterval(heartbeatInterval);
  });
});

// Your existing REST API endpoints
app.post("/test", async (req, res) => {
  const { prompt } = req.body;
  try {
    const reply = await queryAnnieWithMemory(prompt);
    res.json(reply);
  } catch (err) {
    console.error("Error querying Ollama:", err);
    res.status(500).json({ error: "Ollama request failed" });
  }
});

app.get("/annie/stats", (req, res) => {
  res.json({
    memory: annieMemory.getPersonalityInsights(),
    recentConversations: annieMemory.conversationHistory.slice(-10),
    autonomousThoughts: annieMemory.autonomousThoughts.slice(-5),
    connections: {
      active: activeConnections.size,
      total: connectionCounter
    }
  });
});

// ✅ Enhanced Ollama status endpoint
app.get("/ollama/status", async (req, res) => {
  const health = await checkOllamaHealthDetailed();
  res.json({
    ...health,
    endpoint: "http://127.0.0.1:11434",
    timestamp: Date.now()
  });
});

app.post("/annie/reset", async (req, res) => {
  annieMemory.conversationHistory = [];
  annieMemory.userProfile = {
    name: null,
    interests: [],
    personality: 'unknown',
    relationship_stage: 'stranger',
    preferred_topics: [],
    dislikes: []
  };
  annieMemory.mood = 'neutral';
  annieMemory.relationships = { affection: 0, trust: 0, familiarity: 0 };
  annieMemory.autonomousThoughts = [];

  await annieMemory.saveMemory();
  res.json({ message: "Annie's memory has been reset" });
});

// ✅ Add a simple health endpoint
app.get("/health", (req, res) => {
  res.json({
    server: "running",
    connections: activeConnections.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now()
  });
});

// Start server with enhanced health checking
const PORT = 5000;
server.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🧠 Annie's memory loaded - ${annieMemory.conversationHistory.length} conversations`);
  console.log(`💕 Current relationship: ${annieMemory.userProfile.relationship_stage} (${annieMemory.relationships.affection}/100 affection)`);

  // ✅ Enhanced Ollama health check on startup
  console.log("🔍 Checking Ollama status...");
  const health = await checkOllamaHealthDetailed();

  if (health.available && health.modelReady) {
    console.log("🤖 Ollama is ready and working!");
  } else if (health.available && !health.modelReady) {
    console.log("⚠️  Ollama is running but tinyllama might not be loaded");
    console.log("💡 Try running: ollama pull tinyllama");
  } else {
    console.log("❌ Ollama is not running!");
    console.log("💡 Start it with: ollama serve");
    console.log("💡 Then install tinyllama: ollama pull tinyllama");
  }

  console.log("🤖 Server ready for connections");
  console.log("🔗 Test endpoints:");
  console.log(`   • Health: http://localhost:${PORT}/health`);
  console.log(`   • Ollama Status: http://localhost:${PORT}/ollama/status`);
  console.log(`   • Ollama Test: POST http://localhost:${PORT}/ollama-direct-test`);
});