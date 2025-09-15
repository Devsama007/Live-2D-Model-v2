// /src/components/AnnieStats.jsx
import React, { useState, useEffect } from 'react';
import './AnnieStats.css';

export default function AnnieStats({ socket }) {
  const [stats, setStats] = useState({
    mood: 'neutral',
    relationship: 'stranger',
    affection: 0,
    conversations: 0,
    lastSeen: null
  });
  
  const [thoughts, setThoughts] = useState(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for stats updates
    socket.on('annieStats', (newStats) => {
      setStats(newStats);
    });

    // Listen for Annie's thoughts
    socket.on('annieThoughts', (thoughtData) => {
      setThoughts(thoughtData);
    });

    return () => {
      socket.off('annieStats');
      socket.off('annieThoughts');
    };
  }, [socket]);

  const getRelationshipColor = (stage) => {
    const colors = {
      'stranger': '#6b7280',
      'acquaintance': '#3b82f6', 
      'friend': '#10b981',
      'close': '#f59e0b'
    };
    return colors[stage] || '#6b7280';
  };

  const getAffectionColor = (affection) => {
    if (affection > 50) return '#10b981'; // Green
    if (affection > 0) return '#3b82f6';  // Blue  
    if (affection > -30) return '#6b7280'; // Gray
    return '#ef4444'; // Red
  };

  const getMoodEmoji = (mood) => {
    const moods = {
      'happy': '😊',
      'excited': '🤩', 
      'sad': '😢',
      'angry': '😠',
      'thinking': '🤔',
      'shy': '😳',
      'neutral': '😐',
      'content': '😌'
    };
    return moods[mood] || '😐';
  };

  const requestThoughts = () => {
    if (socket) {
      socket.emit('getAnnieThoughts');
    }
  };

  return (
    <div className="annie-stats-container">
      {/* Toggle Button */}
      <button 
        className="stats-toggle"
        onClick={() => setShowStats(!showStats)}
      >
        {getMoodEmoji(stats.mood)} Ai Hoshino
      </button>

      {/* Stats Panel */}
      {showStats && (
        <div className="stats-panel">
          <div className="stats-header">
            <h3>Ai's Status</h3>
            <button className="close-btn" onClick={() => setShowStats(false)}>×</button>
          </div>

          <div className="stats-content">
            {/* Mood */}
            <div className="stat-item">
              <span className="stat-label">Mood:</span>
              <span className="stat-value mood">
                {getMoodEmoji(stats.mood)} {stats.mood}
              </span>
            </div>

            {/* Relationship */}
            <div className="stat-item">
              <span className="stat-label">Relationship:</span>
              <span 
                className="stat-value relationship"
                style={{ color: getRelationshipColor(stats.relationship) }}
              >
                {stats.relationship}
              </span>
            </div>

            {/* Affection */}
            <div className="stat-item">
              <span className="stat-label">Affection:</span>
              <div className="affection-bar">
                <div 
                  className="affection-fill"
                  style={{ 
                    width: `${Math.max(0, Math.min(100, stats.affection + 50))}%`,
                    backgroundColor: getAffectionColor(stats.affection)
                  }}
                ></div>
                <span 
                  className="affection-text"
                  style={{ color: getAffectionColor(stats.affection) }}
                >
                  {stats.affection}/100
                </span>
              </div>
            </div>

            {/* Conversations */}
            <div className="stat-item">
              <span className="stat-label">Conversations:</span>
              <span className="stat-value">{stats.conversations}</span>
            </div>

            {/* Thoughts Button */}
            <button 
              className="thoughts-btn"
              onClick={requestThoughts}
            >
              💭 What's on her mind?
            </button>

            {/* Display Thoughts */}
            {thoughts && (
              <div className="thoughts-panel">
                <h4>Ai's Thoughts:</h4>
                <p className="current-thought">"{thoughts.thoughts}"</p>
                {thoughts.recentMemories && thoughts.recentMemories.length > 0 && (
                  <div className="recent-memories">
                    <h5>Recent memories:</h5>
                    {thoughts.recentMemories.map((memory, i) => (
                      <p key={i} className="memory-item">
                        • {memory.thought}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}