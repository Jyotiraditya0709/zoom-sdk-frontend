import React, { useState, useEffect, useRef } from "react";
import "./ChatSidebarStyle.css";
import UserList from "./UserList";
import ChatBox from "./ChatBox";

const ChatSidebar = ({
  isChatOpen,
  setIsChatOpen,
  participants = [],
  chatMessages = [],
  onSendMessage,
  userName,
}) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef(null);

  // Convert participants to users format for UserList
  const users = participants.map((participant) => ({
    id: participant.userId,
    name:
      participant.displayName ||
      `User ${participant.userId?.toString().slice(-4) || "Guest"}`,
    designation: participant.role === 1 ? "Host" : "Attendee",
        img: "/assets/svg/user.svg",
    type: participant.role === 1 ? "host" : "attendee",
  }));

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Filter messages for selected user (for private chat)
  const getMessagesForUser = (userId) => {
    if (!selectedUser) return chatMessages; // Show all messages for group chat
    return chatMessages.filter(
      (msg) => msg.sender === selectedUser.name || msg.sender === userName
    );
  };

  // Handle group chat selection
  const handleGroupChatSelect = () => {
    setSelectedUser(null); // null means group chat
  };

  const handleSend = (msg) => {
    if (onSendMessage && msg.trim()) {
      onSendMessage(msg.trim());
      setMessageInput("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend(messageInput);
  };

  if (!isChatOpen) return null;

  return (
    <div className="chatSideBar active">
      {!selectedUser && (
        <div
          style={{
            background: "#fff",
            color: "#222",
            width: "400px",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid #e0e0e0",
            boxShadow: "-2px 0 12px rgba(0,0,0,0.1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "18px 24px 12px 24px",
              borderBottom: "1px solid #e0e0e0",
              background: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>Chat</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                style={{
                  background: showParticipants ? "#00baff" : "#f0f0f0",
                  color: showParticipants ? "#fff" : "#666",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!showParticipants) {
                    e.target.style.background = "#e0e0e0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showParticipants) {
                    e.target.style.background = "#f0f0f0";
                  }
                }}
              >
                {showParticipants ? "Chat" : "Participants"}
              </button>
              <button
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "22px",
                  color: "#888",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "4px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f0f0f0";
                  e.target.style.color = "#666";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "none";
                  e.target.style.color = "#888";
                }}
                aria-label="Close chat panel"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 0 0 0",
              minHeight: 0,
              background: "#f8f9fa",
            }}
          >
            {showParticipants ? (
              <UserList users={users} onSelect={setSelectedUser} />
            ) : (
              <>
                {chatMessages.length === 0 ? (
                  <div
                    style={{
                      color: "#888",
                      textAlign: "center",
                      marginTop: "32px",
                      fontSize: "14px",
                    }}
                  >
                    No messages yet. Start chatting!
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        padding: "8px 24px 8px 24px",
                        fontSize: 15,
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#226",
                          minWidth: 60,
                          flexShrink: 0,
                          textAlign: "right",
                          marginRight: 8,
                        }}
                      >
                        {msg.sender}:
                      </div>
                      <div
                        style={{
                          color: "#222",
                          flex: 1,
                          wordBreak: "break-word",
                        }}
                      >
                        <div style={{ marginBottom: "2px" }}>{msg.content}</div>
                        <div
                          style={{
                            color: "#888",
                            fontSize: "12px",
                            marginTop: "2px",
                          }}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          {!showParticipants && (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                borderTop: "1px solid #e0e0e0",
                padding: "16px 24px",
                background: "#fff",
                gap: "8px",
              }}
            >
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "15px",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#00baff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#ccc";
                }}
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                style={{
                  background: messageInput.trim() ? "#00baff" : "#ccc",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontWeight: 600,
                  fontSize: "15px",
                  cursor: messageInput.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  minWidth: "60px",
                }}
                onMouseEnter={(e) => {
                  if (messageInput.trim()) {
                    e.target.style.background = "#0099cc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (messageInput.trim()) {
                    e.target.style.background = "#00baff";
                  }
                }}
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
      {selectedUser && (
        <ChatBox
          user={selectedUser}
          messages={getMessagesForUser(selectedUser.id)}
          onSend={handleSend}
          onSelect={setSelectedUser}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
