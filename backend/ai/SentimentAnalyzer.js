// /backend/ai/SentimentAnalyzer.js
export class SentimentAnalyzer {
  constructor() {
    // Positive keywords and their weights
    this.positiveWords = {
      // Love/Affection (high weight)
      'love': 3, 'adore': 3, 'cherish': 3, 'treasure': 3,
      'beautiful': 2, 'amazing': 2, 'wonderful': 2, 'perfect': 2,
      'sweet': 2, 'cute': 2, 'adorable': 2,
      
      // Happiness (medium weight)
      'happy': 2, 'joy': 2, 'excited': 2, 'glad': 2,
      'smile': 1.5, 'laugh': 1.5, 'fun': 1.5,
      'good': 1, 'nice': 1, 'great': 1.5, 'awesome': 2,
      
      // Approval
      'yes': 1, 'sure': 1, 'definitely': 1.5, 'absolutely': 2,
      'thanks': 1.5, 'thank you': 2,
      
      // Emojis
      '❤️': 3, '💕': 3, '💖': 3, '😍': 2.5, '🥰': 2.5,
      '😊': 2, '😄': 2, '😁': 2, '🙂': 1.5, '✨': 1.5,
      '💯': 2, '👍': 1.5, '😘': 2.5
    };
    
    // Negative keywords and their weights
    this.negativeWords = {
      // Strong negative
      'hate': -3, 'terrible': -3, 'awful': -3, 'disgusting': -3,
      'stupid': -2.5, 'dumb': -2.5, 'idiot': -2.5, 'annoying': -2,
      
      // Sadness/Hurt
      'sad': -2, 'hurt': -2, 'cry': -2, 'upset': -2,
      'disappointed': -2, 'angry': -2.5, 'mad': -2,
      
      // Dismissive
      'whatever': -1.5, 'boring': -1.5, 'meh': -1,
      'no': -1, 'stop': -1.5, 'shut up': -2.5,
      'leave me alone': -2,
      
      // Bad/Negative
      'bad': -1.5, 'wrong': -1, 'worse': -2,
      
      // Emojis
      '😢': -2, '😭': -2.5, '😠': -2.5, '😡': -3,
      '🙄': -1.5, '😒': -1.5, '💔': -2.5, '😤': -2
    };
    
    // Context modifiers
    this.intensifiers = {
      'very': 1.5, 'really': 1.5, 'extremely': 2, 'super': 1.5,
      'so': 1.3, 'totally': 1.5, 'absolutely': 2, 'completely': 2
    };
    
    this.diminishers = {
      'kinda': 0.7, 'somewhat': 0.7, 'a little': 0.6,
      'slightly': 0.6, 'maybe': 0.8, 'perhaps': 0.8
    };
  }

  analyzeSentiment(text) {
    if (!text || typeof text !== 'string') return 0;
    
    const words = text.toLowerCase()
      .replace(/[^\w\s-🿿]/g, ' ') // Keep words and emojis
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    let score = 0;
    let wordCount = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let multiplier = 1;
      
      // Check for intensifiers/diminishers before the word
      if (i > 0) {
        const prevWord = words[i - 1];
        if (this.intensifiers[prevWord]) {
          multiplier = this.intensifiers[prevWord];
        } else if (this.diminishers[prevWord]) {
          multiplier = this.diminishers[prevWord];
        }
      }
      
      // Check positive words
      if (this.positiveWords[word]) {
        score += this.positiveWords[word] * multiplier;
        wordCount++;
      }
      
      // Check negative words  
      if (this.negativeWords[word]) {
        score += this.negativeWords[word] * multiplier;
        wordCount++;
      }
      
      // Check for emoji patterns
      if (this.isEmoji(word)) {
        const emojiScore = this.getEmojiSentiment(word);
        if (emojiScore !== 0) {
          score += emojiScore;
          wordCount++;
        }
      }
    }
    
    // Normalize score (-1 to 1)
    if (wordCount === 0) return 0;
    
    const normalizedScore = score / Math.max(wordCount, 1);
    return Math.max(-1, Math.min(1, normalizedScore / 3)); // Scale to -1 to 1 range
  }

  isEmoji(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
  }

  getEmojiSentiment(emoji) {
    // Check if emoji is in our predefined lists
    if (this.positiveWords[emoji]) return this.positiveWords[emoji];
    if (this.negativeWords[emoji]) return this.negativeWords[emoji];
    
    // General emoji categorization
    const happyEmojis = ['😊', '😄', '😃', '😀', '🙂', '😌', '🤗'];
    const sadEmojis = ['😢', '😭', '😞', '😔', '🥺', '😪'];
    const angryEmojis = ['😠', '😡', '🤬', '😤'];
    const loveEmojis = ['❤️', '💕', '💖', '💝', '😍', '🥰'];
    
    if (happyEmojis.includes(emoji)) return 2;
    if (loveEmojis.includes(emoji)) return 3;
    if (sadEmojis.includes(emoji)) return -2;
    if (angryEmojis.includes(emoji)) return -2.5;
    
    return 0;
  }

  getEmotionalContext(text, sentiment) {
    const emotions = {
      affection: this.hasPattern(text, ['love', 'care', 'miss', '❤️', '💕']),
      playfulness: this.hasPattern(text, ['haha', 'lol', 'fun', 'play', '😄']),
      concern: this.hasPattern(text, ['okay', 'alright', 'worry', 'hope']),
      criticism: this.hasPattern(text, ['wrong', 'bad', 'terrible', 'annoying']),
      appreciation: this.hasPattern(text, ['thanks', 'grateful', 'appreciate', 'sweet'])
    };
    
    return {
      sentiment,
      dominantEmotion: this.getDominantEmotion(emotions),
      emotions,
      intensity: Math.abs(sentiment)
    };
  }

  hasPattern(text, patterns) {
    const lowerText = text.toLowerCase();
    return patterns.some(pattern => lowerText.includes(pattern));
  }

  getDominantEmotion(emotions) {
    const trueEmotions = Object.entries(emotions)
      .filter(([_, value]) => value)
      .map(([key, _]) => key);
    
    if (trueEmotions.length === 0) return 'neutral';
    return trueEmotions[0]; // Return first detected emotion
  }

  // Analyze conversation patterns over time
  analyzeRelationshipTrend(conversations) {
    if (!conversations || conversations.length < 5) return 'new';
    
    const recent = conversations.slice(-10);
    const avgSentiment = recent
      .filter(c => c.sentiment !== undefined)
      .reduce((sum, c) => sum + c.sentiment, 0) / recent.length;
    
    if (avgSentiment > 0.3) return 'improving';
    if (avgSentiment < -0.3) return 'declining';
    return 'stable';
  }
}