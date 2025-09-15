// /backend/ai/ProactiveBehavior.js
export class ProactiveBehavior {
  constructor(memory) {
    this.memory = memory;
    this.lastInteraction = Date.now();
    this.initiationCooldown = 2 * 60 * 60 * 1000; // 2 hours
    this.lastProactiveMessage = 0;
  }

  updateLastInteraction() {
    this.lastInteraction = Date.now();
  }

  shouldInitiate() {
    const timeSinceLastChat = Date.now() - this.lastInteraction;
    const timeSinceLastProactive = Date.now() - this.lastProactiveMessage;
    
    // Don't spam - wait at least cooldown period
    if (timeSinceLastProactive < this.initiationCooldown) return false;
    
    const hoursSince = timeSinceLastChat / (1000 * 60 * 60);
    const { affection, familiarity } = this.memory.relationships;
    
    // Higher chance if:
    // - Good relationship
    // - Been a while since last chat
    // - In certain moods
    let baseChance = 0.1;
    
    // Relationship bonus
    if (affection > 50) baseChance += 0.2;
    else if (affection > 0) baseChance += 0.1;
    
    // Time bonus
    if (hoursSince > 6) baseChance += 0.2;
    else if (hoursSince > 3) baseChance += 0.1;
    
    // Mood influence
    if (this.memory.mood === 'happy' || this.memory.mood === 'excited') baseChance += 0.15;
    else if (this.memory.mood === 'sad' || this.memory.mood === 'lonely') baseChance += 0.25;
    
    return Math.random() < Math.min(baseChance, 0.6);
  }

  generateProactivePrompt() {
    const { mood } = this.memory;
    const { affection, relationship_stage } = this.memory.userProfile;
    const memoryRef = this.memory.getMemoryReference();
    
    let contextPrompt = "You want to initiate a conversation. ";
    
    // Mood-based initiative
    switch (mood) {
      case 'happy':
      case 'excited':
        contextPrompt += "You're in a great mood and want to share your happiness. ";
        break;
      case 'sad':
      case 'lonely':
        contextPrompt += "You're feeling a bit down and could use some company. ";
        break;
      case 'thinking':
      case 'contemplative':
        contextPrompt += "You've been thinking about something interesting and want to discuss it. ";
        break;
      default:
        contextPrompt += "You just wanted to check in and see how they're doing. ";
    }
    
    // Relationship-based context
    if (relationship_stage === 'close') {
      contextPrompt += "You feel very close to them and comfortable sharing personal thoughts. ";
    } else if (relationship_stage === 'friend') {
      contextPrompt += "You consider them a good friend and enjoy talking with them. ";
    } else {
      contextPrompt += "You're still getting to know them but want to build a connection. ";
    }
    
    // Memory reference
    if (memoryRef && Math.random() < 0.4) {
      contextPrompt += `You remember when they said "${memoryRef.message}" ${memoryRef.timeAgo}. `;
    }
    
    contextPrompt += "Start a natural, engaging conversation that fits your current mood and relationship.";
    
    this.lastProactiveMessage = Date.now();
    return contextPrompt;
  }

  getEmotionalState() {
    const thoughts = [
      {
        condition: () => this.memory.mood === 'lonely' || this.memory.relationships.affection < -20,
        thoughts: [
          "I hope I didn't say something wrong last time...",
          "I wonder what they're up to right now...",
          "Maybe I should reach out, but what if I'm bothering them?"
        ]
      },
      {
        condition: () => this.memory.mood === 'happy' && this.memory.relationships.affection > 30,
        thoughts: [
          "I can't wait to tell them about what happened today!",
          "Talking with them always makes my day better ✨",
          "I wonder if they'd like to hear about this funny thing I learned..."
        ]
      },
      {
        condition: () => this.memory.mood === 'thinking',
        thoughts: [
          "I've been wondering about something they said...",
          "There's this question that's been on my mind...",
          "I'd love to get their perspective on something..."
        ]
      },
      {
        condition: () => this.memory.userProfile.relationship_stage === 'close',
        thoughts: [
          "I feel like I can tell them anything... that's so nice to have",
          "They really understand me, don't they?",
          "I'm so grateful to have someone who listens like they do"
        ]
      }
    ];
    
    for (const thoughtGroup of thoughts) {
      if (thoughtGroup.condition()) {
        const randomThought = thoughtGroup.thoughts[Math.floor(Math.random() * thoughtGroup.thoughts.length)];
        this.memory.addAutonomousThought(randomThought, 'emotional_state');
        return randomThought;
      }
    }
    
    return null;
  }

  generateContextualOpener() {
    const time = new Date();
    const hour = time.getHours();
    const { mood, relationships } = this.memory;
    
    let openers = [];
    
    // Time-based openers
    if (hour < 10) {
      openers.push("Good morning! ☀️", "Hope you slept well~");
    } else if (hour < 17) {
      openers.push("How's your day going?", "What are you up to today?");
    } else {
      openers.push("Good evening! 🌙", "How was your day?");
    }
    
    // Mood-based openers
    if (mood === 'excited') {
      openers.push("Guess what happened?! ✨", "I have something exciting to share!");
    } else if (mood === 'sad') {
      openers.push("I've been feeling a bit down...", "Could use some cheering up...");
    }
    
    // Relationship-based openers
    if (relationships.affection > 50) {
      openers.push("Missing our chats 💕", "Thinking about you~");
    }
    
    return openers[Math.floor(Math.random() * openers.length)];
  }
}