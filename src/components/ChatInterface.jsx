// /src/components/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import './ChatInterface.css';

export default function ChatInterface({ socket }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    // Listen for AI replies
    socket.on('aiReply', (reply) => {
      setMessages(prev => [...prev, {
        type: 'annie',
        content: reply.reply,
        expression: reply.expression,
        motion: reply.motion,
        timestamp: Date.now()
      }]);
      setIsTyping(false);
    });

    // Listen for proactive messages from Annie
    socket.on('proactiveMessage', (message) => {
      setMessages(prev => [...prev, {
        type: 'annie',
        content: message.reply,
        expression: message.expression,
        motion: message.motion,
        timestamp: message.timestamp,
        isProactive: true
      }]);

      // Auto-open chat if closed
      if (!showChat) {
        setShowChat(true);
        // Flash notification
        setTimeout(() => {
          const chatButton = document.querySelector('.chat-toggle');
          if (chatButton) {
            chatButton.style.animation = 'flash 0.5s ease-in-out';
            setTimeout(() => {
              chatButton.style.animation = '';
            }, 500);
          }
        }, 100);
      }
    });

    // 🔥 Handle server heartbeat
    socket.on('ping', () => {
      socket.emit('pong'); // reply to keep connection alive
    });


    return () => {
      socket.off('aiReply');
      socket.off('proactiveMessage');
    };
  }, [socket, showChat]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket || isTyping) return;

    const userMessage = {
      type: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    socket.emit('chatMessage', inputValue);
    setInputValue('');
    setIsTyping(true);

    // Show typing indicator
    setTimeout(() => {
      if (isTyping) {
        setMessages(prev => [...prev, {
          type: 'typing',
          timestamp: Date.now()
        }]);
      }
    }, 500);
  };

  const getExpressionEmoji = (expression) => {
    const expressions = {
      'happy': '😊',
      'excited': '🤩',
      'sad': '😢',
      'angry': '😠',
      'thinking': '🤔',
      'shy': '😳',
      'surprised': '😲',
      'neutral': '😐'
    };
    return expressions[expression] || '😐';
  };

  return (
    <div className="chat-interface">
      {/* Chat Toggle Button */}
      <button
        className="chat-toggle"
        onClick={() => setShowChat(!showChat)}
      >
        💬 Chat with Ai Hoshino
        {messages.filter(m => m.isProactive && !m.read).length > 0 && (
          <span className="notification-dot"></span>
        )}
      </button>

      {/* Chat Window */}
      {showChat && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-title">
              <span>💕 Chat with Ai Hoshino</span>
              <small>She remembers everything!</small>
            </div>
            <button
              className="close-chat"
              onClick={() => setShowChat(false)}
            >
              ×
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                {message.type === 'user' && (
                  <div className="message-content user-message">
                    <span>{message.content}</span>
                  </div>
                )}

                {message.type === 'annie' && (
                  <div className="message-content annie-message">
                    <div className="annie-avatar">
                      {getExpressionEmoji(message.expression)}
                    </div>
                    <div className="annie-text">
                      <span>{message.content}</span>
                      {message.isProactive && (
                        <small className="proactive-tag">💫 Ai initiated</small>
                      )}
                    </div>
                  </div>
                )}

                {message.type === 'typing' && (
                  <div className="message-content annie-message">
                    <div className="annie-avatar">🤔</div>
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message to Annie..."
              className="chat-input"
              disabled={isTyping}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isTyping || !inputValue.trim()}
            >
              {isTyping ? '...' : '💝'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}