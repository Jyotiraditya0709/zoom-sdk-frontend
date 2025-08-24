import React, { useState, useRef, useEffect } from "react";
import { LeftArrow, ThreeDotIcon } from "../../../icon/icon";

const ChatBox = ({ user, messages = [], onSend, onSelect }) => {
  const [msg, setMsg] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    onSend(msg.trim());
    setMsg("");
  };

  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => onSelect(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#f0f0f0";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "none";
            }}
          >
            <LeftArrow />
          </button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>
            {user ? `Chat with ${user.name}` : "Group Chat"}
          </h3>
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          {messages.length} messages
        </div>
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 0 0 0",
          minHeight: 0,
          background: "#f8f9fa",
        }}
      >
        {messages.length === 0 ? (
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
          messages.map((m, i) => (
            <div
              key={i}
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
                {m.sender || "Unknown"}:
              </div>
              <div
                style={{
                  color: "#222",
                  flex: 1,
                  wordBreak: "break-word",
                }}
              >
                <div style={{ marginBottom: "2px" }}>
                  {m.content || m.message || ""}
                </div>
                <div
                  style={{
                    color: "#888",
                    fontSize: "12px",
                    marginTop: "2px",
                  }}
                >
                  {m.timestamp || ""}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
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
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
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
          disabled={!msg.trim()}
          style={{
            background: msg.trim() ? "#00baff" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontWeight: 600,
            fontSize: "15px",
            cursor: msg.trim() ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            minWidth: "60px",
          }}
          onMouseEnter={(e) => {
            if (msg.trim()) {
              e.target.style.background = "#0099cc";
            }
          }}
          onMouseLeave={(e) => {
            if (msg.trim()) {
              e.target.style.background = "#00baff";
            }
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
