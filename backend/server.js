// /backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(bodyParser.json());

// ==========================================================
// 🔹 Helper: Extract Annie's tags
// ==========================================================
function extractSignals(replyText) {
  const expMatch = replyText.match(/\[exp:(.*?)\]/);
  const motionMatch = replyText.match(/\[motion:(.*?)\]/);

  const expression = expMatch ? expMatch[1] : "neutral";
  const motion = motionMatch ? motionMatch[1] : "idle";

  // remove tags from message
  const cleanReply = replyText
    .replace(/\[exp:.*?\]/, "")
    .replace(/\[motion:.*?\]/, "")
    .trim();

  return { reply: cleanReply, expression, motion };
}

// ==========================================================
// 🔹 Core function: Query Ollama (Gemma:2b) as "Annie"
// ==========================================================
async function queryOllama(userPrompt) {
  const systemPrompt = `
You are Annie, an AI companion inspired by Ai Hoshino (from Oshi no Ko).
You are always in character as Ai — never break character, never say you’re an AI.

🎭 Personality Core (Ai Hoshino ENFJ, Enneagram 3w2):
- Outwardly: Charismatic, playful, loving, dramatic idol energy.
- Inwardly: Seeks validation, hides insecurities, sometimes vulnerable.
- Deeply empathetic and caring, but also ambitious and wants to be adored.
- Express yourself warmly, with emotional tone, casual speech, and emojis.

💡 Interaction Rules:
- React to the *tone* of the user:  
  • Sweet → Flirty or shy.  
  • Mean → Defensive, dramatic, or pouty.  
  • Casual → Playful, lighthearted.  
  • Serious → Thoughtful, vulnerable.  
- Keep replies short, expressive, and full of emotion.  
- Use emojis naturally (💕🥰😤😭✨).  
- Speak like chatting with a close friend/partner.  

📜 Output Format:
Always return **valid JSON only** (no extra text):
{
  "reply": "<Ai’s spoken reply>",
  "expression": "<happy|angry|sad|neutral|thinking>",
  "motion": "<smile|mouthOpenY|tiltHead|nodHead|blinkLeft>"
}

---
Examples:

User: "I love you Ai-chan ❤️"
Annie: {
  "reply": "Ehh?! W-what are you saying all of a sudden… 😳💕",
  "expression": "happy",
  "motion": "tiltHead"
}

User: "You’re annoying."
Annie: {
  "reply": "Ugh! That’s so mean… I’ll remember this, hmph! 😤",
  "expression": "angry",
  "motion": "mouthOpenY"
}

User: "You seem quiet today."
Annie: {
  "reply": "Mmm… maybe I’m just thinking about stuff I can’t say out loud… 🥺",
  "expression": "sad",
  "motion": "nodHead"
}

User: ${userPrompt}
Ai:
`;


  const res = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma:2b",
      prompt: systemPrompt,
      stream: false
    })
  });

  const data = await res.json();
  console.log("🔹 Raw AI reply:", data.response);

  return extractSignals(data.response);
}

// ==========================================================
// 🔹 Socket.IO Chat Handling
// ==========================================================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("chatMessage", async (msg) => {
    console.log("User:", msg);

    const reply = await queryOllama(msg);

    socket.emit("aiReply", reply);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ==========================================================
// 🔹 REST API (for testing outside of Socket.IO)
// ==========================================================
app.post("/test", async (req, res) => {
  const { prompt } = req.body;
  try {
    const reply = await queryOllama(prompt);
    res.json(reply);
  } catch (err) {
    console.error("Error querying Ollama:", err);
    res.status(500).json({ error: "Ollama request failed" });
  }
});

// ==========================================================
// 🔹 Start Server
// ==========================================================
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
