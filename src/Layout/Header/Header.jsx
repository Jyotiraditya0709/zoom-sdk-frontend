import React, { useState, useEffect } from "react";
import "./Header.css";
import { useLocation } from "react-router-dom";
import { WatchIcon } from "../../icon/icon";

const Header = ({
  userEmail = "VictorWadhwa26@gmail.com",
  userName = "Victor Wadhwa",
  meetingTitle = "Discussion about finance & accounting and basic fundamentals of taxation",
  startTime = null,
  showTimer = true,
}) => {
  const location = useLocation();
  const pathname = location.pathname;
  const [timer, setTimer] = useState("00:00:00");

  // Timer functionality
  useEffect(() => {
    if (!showTimer || !startTime) return;

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diff = now - start;

      if (diff < 0) {
        setTimer("00:00:00");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimer(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, showTimer]);

  return (
    <div
      className={`headerMain ${
        (pathname === "/joiner-screen" ||
          pathname === "/screen-share" ||
          pathname.includes("/meeting/")) &&
        "borderBottom"
      }`}
    >
      {pathname === "/pre-join" && (
        <div className="headerContentOne">
          <img src="/assets/svg/getPrepped.svg" alt="getPrepped" />
          <div className="profileDetailHeader">
            <div className="profileName">
              <span className="emailText">{userEmail}</span>
              <span className="nameText">{userName}</span>
            </div>
            <div className="profileImage">
              <img src="/assets/svg/userDummy.svg" alt="Profile" />
            </div>
          </div>
        </div>
      )}

      {(pathname === "/joiner-screen" ||
        pathname === "/screen-share" ||
        pathname.includes("/meeting/")) && (
        <div className="headerContentTwo">
          <div className="headerLeftJoinerScreen">
            <img src="/assets/svg/getPrepped.svg" alt="getPrepped" />
            <span className="headerDescription">{meetingTitle}</span>
          </div>

          <div className="headerRightJoinerScreen">
            {showTimer && (
              <div className="timerCount">
                <WatchIcon /> {timer}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
