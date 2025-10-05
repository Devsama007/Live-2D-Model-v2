// /backend/ai/AnnieMemory.js - WITH QDRANT INTEGRATION
import fs from 'fs/promises';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

export class AnnieMemory {
  constructor() {
    this.conversationHistory = [];
    this.userProfile = {
      name: null,
      interests: [],
      personality: 'unknown',
      relationship_stage: 'stranger',
      preferred_topics: [],
      dislikes: []
    };
    this.mood = 'neutral';
    this.relationships = {
      affection: 0,
      trust: 0,
      familiarity: 0
    };
    this.autonomousThoughts = [];
    this.memoryFile = path.join(process.cwd(), 'annie_data', 'memory.json');
    this.trainingFile = path.join(process.cwd(), 'annie_data', 'training.jsonl');
    
    // Qdrant setup
    this.qdrantClient = null;
    this.qdrantReady = false;
    this.collectionName = 'annie_conversations';
    this.conversationIdCounter = 0;
  }

  // Initialize Qdrant connection
  async initQdrant(url, apiKey) {
    try {
      console.log('🔌 Connecting to Qdrant...');
      
      this.qdrantClient = new QdrantClient({ 
        url,
        apiKey
      });

      // Check if collection exists
      try {
        await this.qdrantClient.getCollection(this.collectionName);
        console.log('✅ Qdrant collection found:', this.collectionName);
      } catch (e) {
        console.log('📦 Creating new Qdrant collection...');
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 2048, // tinyllama embedding size
            distance: 'Cosine'
          }
        });
        console.log('✅ Qdrant collection created!');
      }

      this.qdrantReady = true;
      console.log('✅ Qdrant initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Qdrant:', error.message);
      console.log('⚠️  Continuing without Qdrant - conversations will only save to JSON');
      this.qdrantReady = false;
    }
  }

  // Get embedding from Ollama
  async getEmbedding(text) {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tinyllama',
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('❌ Failed to get embedding:', error.message);
      return null;
    }
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
      history: this.conversationHistory.slice(-200),
      profile: this.userProfile,
      mood: this.mood,
      relationships: this.relationships,
      autonomousThoughts: this.autonomousThoughts.slice(-50),
      lastUpdated: Date.now(),
      qdrantSync: this.qdrantReady
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
      
      this.conversationIdCounter = this.conversationHistory.length;
      
      console.log('🧠 Annie memory loaded:', {
        conversations: this.conversationHistory.length,
        mood: this.mood,
        affection: this.relationships.affection,
        qdrantSync: memory.qdrantSync || false
      });
    } catch (e) {
      console.log('🆕 Starting with fresh memory');
      await this.saveMemory();
    }
  }

  // ENHANCED: Add conversation to both JSON and Qdrant
  async addConversation(sender, message, metadata = {}) {
    const timestamp = Date.now();
    const conversationEntry = {
      id: this.conversationIdCounter++,
      sender,
      message,
      timestamp,
      mood: this.mood,
      ...metadata
    };

    // Add to JSON
    this.conversationHistory.push(conversationEntry);

    // Add to Qdrant if ready and is user message
    if (this.qdrantReady && sender === 'User') {
      await this.addToQdrant(conversationEntry);
    }

    return conversationEntry;
  }

  // Add conversation to Qdrant with embedding
  async addToQdrant(conversationEntry) {
    try {
      const searchText = `User: ${conversationEntry.message}`;
      const embedding = await this.getEmbedding(searchText);
      
      if (!embedding) {
        console.warn('⚠️  Skipping Qdrant storage - no embedding');
        return;
      }

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: conversationEntry.id,
            vector: embedding,
            payload: {
              sender: conversationEntry.sender,
              message: conversationEntry.message,
              timestamp: conversationEntry.timestamp,
              mood: conversationEntry.mood,
              sentiment: conversationEntry.sentiment || 0,
              relationship_stage: this.userProfile.relationship_stage,
              affection: this.relationships.affection
            }
          }
        ]
      });

      console.log('💎 Conversation added to Qdrant (ID:', conversationEntry.id, ')');
      
    } catch (error) {
      console.error('❌ Failed to add to Qdrant:', error.message);
    }
  }

  // Search similar conversations in Qdrant
  async searchSimilarConversations(query, limit = 5) {
    if (!this.qdrantReady) {
      console.warn('⚠️  Qdrant not ready, returning recent conversations');
      return this.conversationHistory
        .filter(c => c.sender === 'User')
        .slice(-limit);
    }

    try {
      const queryEmbedding = await this.getEmbedding(query);
      
      if (!queryEmbedding) {
        throw new Error('Failed to get query embedding');
      }

      const searchResults = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: true
      });

      return searchResults.map(result => ({
        score: result.score,
        message: result.payload.message,
        mood: result.payload.mood,
        timestamp: result.payload.timestamp,
        sentiment: result.payload.sentiment,
        relationship_stage: result.payload.relationship_stage
      }));

    } catch (error) {
      console.error('❌ Qdrant search failed:', error.message);
      return [];
    }
  }

  // Sync existing JSON conversations to Qdrant
  async syncJsonToQdrant() {
    if (!this.qdrantReady) {
      console.warn('⚠️  Cannot sync - Qdrant not ready');
      return;
    }

    console.log('🔄 Syncing', this.conversationHistory.length, 'conversations to Qdrant...');
    
    let syncCount = 0;
    const userConversations = this.conversationHistory.filter(c => c.sender === 'User');

    for (const convo of userConversations) {
      await this.addToQdrant(convo);
      syncCount++;
      
      if (syncCount % 10 === 0) {
        console.log(`📊 Synced ${syncCount}/${userConversations.length} conversations...`);
      }
    }

    console.log('✅ Sync complete!', syncCount, 'conversations added to Qdrant');
  }

  updateMood(sentiment, intensity = 1) {
    if (sentiment > 0.6) this.mood = 'happy';
    else if (sentiment > 0.3) this.mood = 'content';
    else if (sentiment < -0.6) this.mood = 'sad';
    else if (sentiment < -0.3) this.mood = 'frustrated';
    else this.mood = 'neutral';
  }

  updateRelationships(userSentiment, interactionType = 'normal') {
    if (userSentiment > 0.5) {
      this.relationships.affection += 2;
      this.relationships.trust += 1;
    } else if (userSentiment < -0.5) {
      this.relationships.affection -= 3;
      this.relationships.trust -= 2;
    }

    this.relationships.familiarity += 0.5;

    Object.keys(this.relationships).forEach(key => {
      this.relationships[key] = Math.max(-100, Math.min(100, this.relationships[key]));
    });

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
      currentMood: this.mood,
      qdrantEnabled: this.qdrantReady
    };
  }

  shouldShowMemoryReference() {
    return this.conversationHistory.length > 10 && Math.random() < 0.3;
  }

  getMemoryReference() {
    if (this.conversationHistory.length < 5) return null;
    
    const recentMemories = this.conversationHistory
      .filter(h => h.sender === 'User' && Date.now() - h.timestamp < 7 * 24 * 60 * 60 * 1000)
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