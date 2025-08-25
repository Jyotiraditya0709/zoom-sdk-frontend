import React, { useState, useRef, useEffect } from "react";
import { LeftArrow, ThreeDotIcon, SendIcon } from "../../../icon/icon";

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
    <div className="chatBoxBlock">
      <div className="backRouteChat" onClick={() => onSelect(false)}>
        <LeftArrow /> Back
      </div>
      <div className="chatHeader">
        <span className="chatHeaderTitle">Chats ({messages.length})</span>
        <span className="threeDotDropdown">
          <ThreeDotIcon />
        </span>
      </div>

      <div className="messageAreaBlock">
        {messages.length === 0 && (
          <div className="no-messages">No messages yet. Start chatting!</div>
        )}
        {messages.map((m, i) => (
          <div
            className={`chat-msg ${
              m.from === user.name ? "from-user" : "from-me"
            }`}
            key={i}
          >
            <div className="chatMsgContent">
              <div className="message-avatar">
                <div className="avatar-fallback">
                  {m.from ? m.from.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
              <div className="messageFormSide">
                <div className="upperNameUser">
                  <span className="fromMessage">{m.from}</span>
                  <span className="timeView">{m.timestamp || "05:32 PM"}</span>
                </div>
                <span className="messageDescription">{m.text}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chatInputBox" onSubmit={handleSubmit}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Type message here.."
        />
        <button type="submit">
          <SendIcon />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
