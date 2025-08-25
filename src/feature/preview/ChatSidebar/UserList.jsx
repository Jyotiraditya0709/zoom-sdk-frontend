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
    <div className="userListChartBox">
      {users.map((user) => (
        <div className="userItemsChartBox" key={user.id}>
          <div className="avatar">
            <span className="avatarBox">
              <div className="avatar-fallback">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            </span>
            <div className="usersNameDetails">
              <div className="user-name" onClick={() => onSelect(user)}>
                {user.name}
              </div>
              <div className="user-designation">{user.designation}</div>
            </div>
          </div>

          <div className="rightSideChartBox">
            {user.type && (
              <span
                className={`hostShow ${
                  user.type === "host" ? "host" : "participant"
                }`}
              >
                {user.type === "host" ? "Host" : ""}
              </span>
            )}
            <span onClick={() => toggleMute(user.id)}>
              {muteStates[user.id] ? <UnMicroPhone /> : <MicroPhone />}
            </span>
            <span onClick={() => toggleVideo(user.id)}>
              {videoStates[user.id] ? <OffVideoCamera /> : <VideoCamera />}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;
