// Fixed server.js with better Ollama handling and debugging
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

// ✅ FIXED: Better Ollama connection with proper stream handling
// Replace your queryAnnieWithMemory function with this fixed version

async function queryAnnieWithMemory(userPrompt, isProactive = false) {
  console.log("🔹 Starting query to Ollama...");
  
  const sentiment = sentimentAnalyzer.analyzeSentiment(userPrompt);
  const emotionalContext = sentimentAnalyzer.getEmotionalContext(userPrompt, sentiment);
  const insights = annieMemory.getPersonalityInsights();
  const recentContext = annieMemory.getRecentContext(8);
  const memoryRef = annieMemory.shouldShowMemoryReference() ? annieMemory.getMemoryReference() : null;

  // ✅ MUCH SHORTER PROMPT to avoid timeout
  let systemPrompt = `You are Annie (Ai Hoshino). Respond as a cheerful anime girl.

Current mood: ${annieMemory.mood}
Relationship: ${annieMemory.userProfile.relationship_stage}

Respond in JSON format:
{
  "reply": "your response here",
  "expression": "happy|sad|neutral|excited|thinking",
  "motion": "smile|nod|tilt|blink"
}`;

  const prompt = isProactive ? 
    `${systemPrompt}\n\nContext: ${userPrompt}\nAnnie:` :
    `${systemPrompt}\n\nUser: ${userPrompt}\nAnnie:`;

  try {
    console.log("🔹 Sending request to Ollama...");
    console.log("🔹 Prompt length:", prompt.length);
    
    // ✅ FIXED: Add proper timeout and simplified request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⏰ Request timeout - aborting");
      controller.abort();
    }, 15000); // 15 second timeout

    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "gemma:2b",
        prompt: prompt,
        stream: false, // ✅ Critical: NO streaming
        options: {
          temperature: 0.7,
          num_predict: 150, // ✅ Limit response length
          top_k: 10,
          top_p: 0.9,
          stop: ["\n\nUser:", "Human:", "\n\n"] // ✅ Stop sequences
        }
      }),
      signal: controller.signal // ✅ Add abort signal
    });

    clearTimeout(timeoutId); // Clear timeout if request completes

    console.log("🔹 Response status:", res.status);
    console.log("🔹 Response headers:", Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log("🔹 Raw Ollama response:", JSON.stringify(data, null, 2));

    // ✅ Better response validation
    if (!data.response || typeof data.response !== "string") {
      throw new Error("Invalid or empty response from Ollama");
    }

    console.log("🔹 Response content:", data.response);

    let annieResponse = parseAnnieResponse(data.response);
    
    // ✅ Validate parsed response
    if (!annieResponse.reply || annieResponse.reply === "...") {
      console.warn("⚠️ Parsed response was empty, using fallback");
      annieResponse = {
        reply: "Hi there! How can I help you? 😊",
        expression: "happy",
        motion: "smile"
      };
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

    if (Math.random() < 0.3) {
      await annieMemory.saveMemory();
    }

    return annieResponse;

  } catch (error) {
    console.error("❌ Error querying Ollama:", error.name, error.message);
    
    // ✅ Different fallback based on error type
    if (error.name === 'AbortError') {
      return {
        reply: "Sorry, I'm taking too long to think... let me try again! 🤔",
        expression: "thinking",
        motion: "tiltHead"
      };
    }
    
    if (error.message.includes('fetch')) {
      return {
        reply: "I can't connect to my brain right now... is Ollama running? 😅",
        expression: "sad",
        motion: "lookAway"
      };
    }
    
    return {
      reply: "Hmm, something went wrong with my thoughts... 💭",
      expression: "thinking",
      motion: "tiltHead"
    };
  }
}

// ✅ Also add this simple test endpoint
app.post("/ollama-direct-test", async (req, res) => {
  console.log("🧪 Testing direct Ollama connection...");
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma:2b",
        prompt: "Say 'Hello World' in JSON format: {\"message\": \"Hello World\"}",
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



// ✅ FIXED: Much better JSON parsing with multiple fallback strategies
function parseAnnieResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== "string") {
    console.warn("⚠️ Empty or invalid raw response");
    return { 
      reply: "I'm having trouble right now... 😅", 
      expression: "neutral", 
      motion: "idle" 
    };
  }

  console.log("🔍 Parsing response:", rawResponse.substring(0, 200) + "...");

  // Strategy 1: Try to find and parse complete JSON block
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      console.log("🔍 Found JSON match:", jsonMatch[0]);
      const parsed = json5parse(jsonMatch[0]);
      
      if (parsed.reply && typeof parsed.reply === "string") {
        console.log("✅ Successfully parsed JSON");
        return {
          reply: parsed.reply.trim(),
          expression: parsed.expression || "neutral",
          motion: parsed.motion || "idle"
        };
      }
    }
  } catch (e) {
    console.warn("⚠️ JSON5 parse failed:", e.message);
  }

  // Strategy 2: Extract fields using regex
  try {
    const replyMatch = rawResponse.match(/"reply"\s*:\s*"([^"]+)"/);
    const expMatch = rawResponse.match(/"expression"\s*:\s*"([^"]+)"/);
    const motionMatch = rawResponse.match(/"motion"\s*:\s*"([^"]+)"/);

    if (replyMatch && replyMatch[1]) {
      console.log("✅ Extracted reply via regex");
      return {
        reply: replyMatch[1].trim(),
        expression: expMatch ? expMatch[1] : "neutral",
        motion: motionMatch ? motionMatch[1] : "idle"
      };
    }
  } catch (e) {
    console.warn("⚠️ Regex extraction failed:", e.message);
  }

  // Strategy 3: Look for dialogue without JSON
  const dialogueMatch = rawResponse.match(/(?:Annie|Ai):\s*(.+)/i);
  if (dialogueMatch && dialogueMatch[1]) {
    console.log("✅ Found dialogue format");
    return {
      reply: dialogueMatch[1].trim(),
      expression: "neutral",
      motion: "idle"
    };
  }

  // Strategy 4: Use first reasonable sentence
  const sentences = rawResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 0) {
    console.log("✅ Using first sentence");
    return {
      reply: sentences[0].trim() + (sentences[0].match(/[.!?]$/) ? "" : "."),
      expression: "neutral",
      motion: "idle"
    };
  }

  // Final fallback
  console.warn("⚠️ All parsing strategies failed, using fallback");
  return {
    reply: "I'm having some trouble with my thoughts right now... 😅",
    expression: "thinking",
    motion: "tiltHead"
  };
}

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

  // ✅ FIXED: Better message handling with timeout protection
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
      const res = await fetch("http://127.0.0.1:11434/api/tags", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      socket.emit("ollamaStatus", {
        available: res.ok,
        models: res.ok ? await res.json() : null,
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
});

// ✅ Add Ollama health monitoring
async function checkOllamaHealth() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags");
    if (res.ok) {
      console.log("✅ Ollama is running");
      return true;
    }
  } catch (error) {
    console.log("❌ Ollama is not available:", error.message);
  }
  return false;
}

// Your existing REST API endpoints (unchanged)
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

// ✅ Add Ollama status endpoint
app.get("/ollama/status", async (req, res) => {
  const isHealthy = await checkOllamaHealth();
  res.json({
    available: isHealthy,
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

const PORT = 5000;
server.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🧠 Annie's memory loaded - ${annieMemory.conversationHistory.length} conversations`);
  console.log(`💕 Current relationship: ${annieMemory.userProfile.relationship_stage} (${annieMemory.relationships.affection}/100 affection)`);
  
  // ✅ Check Ollama on startup
  const ollamaHealth = await checkOllamaHealth();
  if (ollamaHealth) {
    console.log("🤖 Ollama connection verified");
  } else {
    console.log("⚠️  WARNING: Ollama is not running! Start it with: ollama serve");
  }
  
  console.log("🤖 Server ready for connections");
});