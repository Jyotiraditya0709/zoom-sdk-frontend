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
  const messagesEndRef = useRef(null);

  // Convert participants to users format for UserList
  const users = participants.map((participant) => ({
    id: participant.userId,
    name: participant.displayName || participant.userId?.toString() || "Guest",
    designation: participant.role === 1 ? "Host" : "Attendee",
    img: "/assets/svg/user.svg",
    type: participant.role === 1 ? "host" : "participant",
  }));

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Convert chat messages to the format expected by ChatBox
  const formatMessagesForChatBox = () => {
    return chatMessages.map((msg) => ({
      from: msg.sender,
      text: msg.content,
      img: "/assets/svg/user.svg",
      timestamp: msg.timestamp,
    }));
  };

  const handleSend = (msg) => {
    if (onSendMessage && msg.trim()) {
      onSendMessage(msg.trim());
    }
  };

  if (!isChatOpen) return null;

  return (
    <div className="chatSideBar active">
      {!selectedUser && <UserList users={users} onSelect={setSelectedUser} />}
      {selectedUser && (
        <ChatBox
          user={selectedUser}
          messages={formatMessagesForChatBox()}
          onSend={handleSend}
          onSelect={setSelectedUser}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
