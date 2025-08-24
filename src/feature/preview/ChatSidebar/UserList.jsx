import React, { useState } from "react";
import {
  MicroPhone,
  OffVideoCamera,
  UnMicroPhone,
  VideoCamera,
} from "../../../icon/icon";

const UserList = ({ users, onSelect }) => {
  const [muteStates, setMuteStates] = useState({});
  const [videoStates, setVideoStates] = useState({});

  const toggleMute = (id) => {
    setMuteStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVideo = (id) => {
    setVideoStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ padding: "0" }}>
      {users.map((user, idx) => (
        <div
          key={user.id}
          style={{
            display: "flex",
            alignItems: "center",
            background: idx % 2 === 0 ? "#fff" : "#f3f4f6",
            padding: "12px 24px",
            borderBottom: "1px solid #f0f0f0",
            fontSize: 16,
            minHeight: 56,
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "#f8f9fa";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = idx % 2 === 0 ? "#fff" : "#f3f4f6";
          }}
          onClick={() => onSelect(user)}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#e3e7ed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 18,
              color: "#3a3a3a",
              marginRight: 16,
              textTransform: "uppercase",
            }}
          >
            {user.name?.[0] || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 500,
                color: "#222",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name}
            </span>
            <span
              style={{
                fontSize: 14,
                color: "#666",
                display: "block",
              }}
            >
              {user.designation}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {user.type === "host" && (
              <span
                style={{
                  background: "#ff6b35",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Host
              </span>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute(user.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "4px",
                  color: muteStates[user.id] ? "#ef4444" : "#666",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "none";
                }}
              >
                {muteStates[user.id] ? <UnMicroPhone /> : <MicroPhone />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVideo(user.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "4px",
                  color: videoStates[user.id] ? "#ef4444" : "#666",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "none";
                }}
              >
                {videoStates[user.id] ? <OffVideoCamera /> : <VideoCamera />}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;
