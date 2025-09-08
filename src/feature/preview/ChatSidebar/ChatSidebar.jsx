import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import "./ChatSidebarStyle.css";

const ChatSidebar = ({
  isChatOpen,
  setIsChatOpen,
  participants = [],
  chatMessages = [],
  onSendMessage,
  userName,
}) => {
  const [msg, setMsg] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    onSendMessage(msg.trim());
    setMsg("");
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "19:48";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "19:48";
    }
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getSenderName = (message, isSystemMessage) => {
    if (message.sender === userName) return "You";
    if (isSystemMessage) return "System";
    return message.sender;
  };

  if (!isChatOpen) return null;

  return (
    <div className="simple-chat-sidebar">
      {/* Header */}
      <div className="chat-header">
        <h3 className="chat-title">In-call messages</h3>
        <button className="close-button" onClick={() => setIsChatOpen(false)}>
          ×
        </button>
      </div>

      {/* Messages Area */}
      <div className="messages-area">
        {chatMessages.length === 0 && (
          <div className="no-messages">No messages yet. Start chatting!</div>
        )}
        {chatMessages.map((message, index) => {
          // Handle system messages (like recording notifications)
          const isSystemMessage = message.sender === 'system' || 
                                 message.content?.includes('LIVE') || 
                                 message.content?.includes('recording') ||
                                 message.content?.includes('meeting');
          
          // Handle messages with invalid content (like raw IDs)
          const isValidMessage = message.content && 
                                typeof message.content === 'string' && 
                                message.content.length > 0 &&
                                !message.content.match(/^[a-f0-9-]{36}$/i); // Not a UUID
          
          if (!isValidMessage && !isSystemMessage) {
            return null; // Skip invalid messages
          }

          return (
            <div key={`${message.sender}-${message.timestamp}-${index}`} className="message">
              <div className="message-header">
                <span className="sender-name">
                  {getSenderName(message, isSystemMessage)}
                </span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div className={`message-content ${message.sender === userName ? 'own-message' : ''} ${isSystemMessage ? 'system-message' : ''}`}>
                {isSystemMessage && message.content?.includes('LIVE') && (
                  <span className="live-indicator">●</span>
                )}
                {message.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form className="message-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Send a message"
          className="message-input"
        />
        <button type="submit" className="send-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
          </svg>
        </button>
      </form>
    </div>
  );
};

ChatSidebar.propTypes = {
  isChatOpen: PropTypes.bool.isRequired,
  setIsChatOpen: PropTypes.func.isRequired,
  participants: PropTypes.array,
  chatMessages: PropTypes.array,
  onSendMessage: PropTypes.func.isRequired,
  userName: PropTypes.string,
};

export default ChatSidebar;
