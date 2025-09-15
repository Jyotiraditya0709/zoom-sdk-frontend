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
  meetingData,
  getModalHeading,
}) => {
  const [msg, setMsg] = useState("");
  const messagesEndRef = useRef(null);
  const sidebarRef = useRef(null);

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
    if (!timestamp) {
      // Return current time if no timestamp provided
      return new Date().toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      // Return current time if timestamp is invalid
      return new Date().toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
    
    // Use user's locale and timezone for international support
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const getSenderName = (message, isSystemMessage) => {
    if (message.sender === userName) return "You";
    if (isSystemMessage) return "System";
    
    // Try to get proper name from meetingData
    if (meetingData) {
      if (message.sender === meetingData.mentorId) {
        return meetingData.mentorName || message.sender;
      }
      if (message.sender === meetingData.menteeId) {
        return meetingData.menteeName || message.sender;
      }
    }
    
    return message.sender;
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        // Don't close if clicking on chat button or its children
        !event.target.closest('.chatSetting') &&
        !event.target.closest('.commonJoinderBtn')
      ) {
        setIsChatOpen(false);
      }
    };

    if (isChatOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isChatOpen, setIsChatOpen]);

  if (!isChatOpen) return null;

  return (
    <div className="simple-chat-sidebar" ref={sidebarRef}>
      {/* Header */}
      <div className="chat-header">
        <h3 className="chat-title">{getModalHeading ? getModalHeading('chat') : 'Chat'}</h3>
              <button
               onClick={() => setIsChatOpen(false)}
                style={{
                  background: "none",
                  border: "1px solid #101010",
                  fontSize: 22,
                  color: "#888",
                  cursor: "pointer",
                  marginLeft: 8,
                  paddingLeft: 8,
                  paddingRight: 8,
                }}
                aria-label="Close info panel"
              >
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

          const isOwnMessage = message.sender === userName;
          
          // Determine message class based on type
          let messageClass = 'other-message';
          if (isSystemMessage) {
            messageClass = 'system-message';
          } else if (isOwnMessage) {
            messageClass = 'own-message';
          }
          
          return (
            <div key={`${message.sender}-${message.timestamp}-${index}`} className={`message ${messageClass}`}>
              {!isSystemMessage && (
                <div className="message-header">
                  <span className="sender-name">
                    {getSenderName(message, isSystemMessage)}
                  </span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
              )}
              <div className={`message-content ${messageClass}`}>
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
  meetingData: PropTypes.object,
  getModalHeading: PropTypes.func,
};

export default ChatSidebar;
