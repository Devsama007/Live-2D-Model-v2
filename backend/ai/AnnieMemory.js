// /backend/ai/AnnieMemory.js
import fs from 'fs/promises';
import path from 'path';

export class AnnieMemory {
  constructor() {
    this.conversationHistory = [];
    this.userProfile = {
      name: null,
      interests: [],
      personality: 'unknown',
      relationship_stage: 'stranger', // stranger -> acquaintance -> friend -> close
      preferred_topics: [],
      dislikes: []
    };
    this.mood = 'neutral';
    this.relationships = {
      affection: 0, // -100 to 100
      trust: 0,
      familiarity: 0
    };
    this.autonomousThoughts = [];
    this.memoryFile = path.join(process.cwd(), 'annie_data', 'memory.json');
    this.trainingFile = path.join(process.cwd(), 'annie_data', 'training.jsonl');
  }

  async ensureDataFolder() {
    const dataDir = path.dirname(this.memoryFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  async saveMemory() {
    await this.ensureDataFolder();
    const memoryData = {
      history: this.conversationHistory.slice(-200), // Keep last 200 messages
      profile: this.userProfile,
      mood: this.mood,
      relationships: this.relationships,
      autonomousThoughts: this.autonomousThoughts.slice(-50),
      lastUpdated: Date.now()
    };
    
    await fs.writeFile(this.memoryFile, JSON.stringify(memoryData, null, 2));
    console.log('💾 Annie memory saved');
  }

  async loadMemory() {
    try {
      await this.ensureDataFolder();
      const data = await fs.readFile(this.memoryFile, 'utf8');
      const memory = JSON.parse(data);
      
      this.conversationHistory = memory.history || [];
      this.userProfile = { ...this.userProfile, ...memory.profile };
      this.mood = memory.mood || 'neutral';
      this.relationships = { ...this.relationships, ...memory.relationships };
      this.autonomousThoughts = memory.autonomousThoughts || [];
      
      console.log('🧠 Annie memory loaded:', {
        conversations: this.conversationHistory.length,
        mood: this.mood,
        affection: this.relationships.affection
      });
    } catch (e) {
      console.log('🆕 Starting with fresh memory');
      await this.saveMemory();
    }
  }

  addConversation(sender, message, metadata = {}) {
    this.conversationHistory.push({
      sender,
      message,
      timestamp: Date.now(),
      mood: this.mood,
      ...metadata
    });
  }

  updateMood(sentiment, intensity = 1) {
    const moodMap = {
      'happy': { happy: 0.7, excited: 0.2, content: 0.1 },
      'sad': { sad: 0.6, melancholy: 0.3, neutral: 0.1 },
      'angry': { angry: 0.5, frustrated: 0.3, pouty: 0.2 },
      'excited': { excited: 0.6, happy: 0.3, energetic: 0.1 },
      'thinking': { contemplative: 0.5, curious: 0.3, neutral: 0.2 }
    };

    // Update mood based on sentiment (-1 to 1)
    if (sentiment > 0.6) this.mood = 'happy';
    else if (sentiment > 0.3) this.mood = 'content';
    else if (sentiment < -0.6) this.mood = 'sad';
    else if (sentiment < -0.3) this.mood = 'frustrated';
    else this.mood = 'neutral';
  }

  updateRelationships(userSentiment, interactionType = 'normal') {
    // Update affection based on how user treats Annie
    if (userSentiment > 0.5) {
      this.relationships.affection += 2;
      this.relationships.trust += 1;
    } else if (userSentiment < -0.5) {
      this.relationships.affection -= 3;
      this.relationships.trust -= 2;
    }

    // Update familiarity over time
    this.relationships.familiarity += 0.5;

    // Clamp values
    Object.keys(this.relationships).forEach(key => {
      this.relationships[key] = Math.max(-100, Math.min(100, this.relationships[key]));
    });

    // Update relationship stage
    this.updateRelationshipStage();
  }

  updateRelationshipStage() {
    const { affection, trust, familiarity } = this.relationships;
    
    if (affection > 60 && trust > 50 && familiarity > 80) {
      this.userProfile.relationship_stage = 'close';
    } else if (affection > 30 && trust > 20 && familiarity > 40) {
      this.userProfile.relationship_stage = 'friend';
    } else if (familiarity > 20) {
      this.userProfile.relationship_stage = 'acquaintance';
    }
  }

  addAutonomousThought(thought, trigger = 'random') {
    this.autonomousThoughts.push({
      thought,
      trigger,
      timestamp: Date.now(),
      mood: this.mood
    });
  }

  getRecentContext(limit = 5) {
    return this.conversationHistory
      .slice(-limit)
      .map(h => `${h.sender}: ${h.message}`)
      .join('\n');
  }

  getPersonalityInsights() {
    const convCount = this.conversationHistory.length;
    const avgSentiment = this.conversationHistory
      .filter(h => h.sentiment !== undefined)
      .reduce((sum, h) => sum + h.sentiment, 0) / convCount || 0;

    return {
      relationship: this.userProfile.relationship_stage,
      affection: this.relationships.affection,
      trust: this.relationships.trust,
      familiarity: this.relationships.familiarity,
      conversations: convCount,
      avgSentiment,
      currentMood: this.mood
    };
  }

  shouldShowMemoryReference() {
    // Sometimes reference past conversations
    return this.conversationHistory.length > 10 && Math.random() < 0.3;
  }

  getMemoryReference() {
    if (this.conversationHistory.length < 5) return null;
    
    const recentMemories = this.conversationHistory
      .filter(h => h.sender === 'User' && Date.now() - h.timestamp < 7 * 24 * 60 * 60 * 1000) // Last week
      .slice(-10);
    
    if (recentMemories.length === 0) return null;
    
    const randomMemory = recentMemories[Math.floor(Math.random() * recentMemories.length)];
    return {
      message: randomMemory.message,
      timeAgo: this.formatTimeAgo(Date.now() - randomMemory.timestamp)
    };
  }

  formatTimeAgo(ms) {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  async saveTrainingData(userInput, annieOutput, context) {
    await this.ensureDataFolder();
    
    const trainingExample = {
      prompt: this.buildTrainingPrompt(userInput, context),
      completion: JSON.stringify(annieOutput),
      metadata: {
        mood: this.mood,
        relationship_stage: this.userProfile.relationship_stage,
        affection: this.relationships.affection,
        timestamp: Date.now()
      }
    };
    
    await fs.appendFile(this.trainingFile, JSON.stringify(trainingExample) + '\n');
  }

  buildTrainingPrompt(userInput, context) {
    return `Context: Mood=${context.mood}, Relationship=${context.relationship_stage}, Affection=${context.affection}
Recent: ${context.recentHistory}
User: ${userInput}
Annie:`;
  }
}