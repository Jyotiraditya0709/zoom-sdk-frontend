import React, { useState, useEffect } from "react";
import "./Header.css";
import { useLocation } from "react-router-dom";
import { WatchIcon } from "../../icon/icon";
import DynamicLogo from "../../components/DynamicLogo";
import { useOrgId } from "../../hooks/useOrgId";

const Header = ({
  userEmail = "VictorWadhwa26@gmail.com",
  userName = "Victor Wadhwa",
  meetingTitle = "Discussion about finance & accounting and basic fundamentals of taxation",
  startTime = null,
  showTimer = true,
}) => {
  const location = useLocation();
  const pathname = location.pathname;
  const orgId = useOrgId();
  const [timer, setTimer] = useState("00:00:00");
  const [isVisible, setIsVisible] = useState(true);

  // Ensure header visibility after mount (fixes refresh issues in production)
  useEffect(() => {
    // Force header to be visible after component mounts
    console.log("Header code is here");
    setIsVisible(true);
    
    // Debug logging
    console.log("🔍 Header component mounted with pathname:", pathname);
    console.log("🔍 Header props:", { userEmail, userName, meetingTitle, showTimer });
    
    // Additional check after a short delay to handle any CSS loading issues
    const timer = setTimeout(() => {
      setIsVisible(true);
      console.log("🔍 Header visibility check - ensuring header is visible");
      
      // Force DOM update to ensure header is visible
      const headerElement = document.querySelector('.headerMain');
      if (headerElement) {
        headerElement.style.display = 'block';
        headerElement.style.visibility = 'visible';
        headerElement.style.opacity = '1';
        headerElement.style.zIndex = '1000';
        console.log("🔧 Forced header visibility in DOM");
      } else {
        console.warn("⚠️ Header element not found in DOM");
      }
    }, 100);
    
    // Additional check after CSS is fully loaded
    const cssTimer = setTimeout(() => {
      setIsVisible(true);
      const headerElement = document.querySelector('.headerMain');
      if (headerElement) {
        headerElement.style.display = 'block';
        headerElement.style.visibility = 'visible';
        headerElement.style.opacity = '1';
        console.log("🔧 Final header visibility check after CSS load");
      } else {
        console.warn("⚠️ Header element still not found after CSS load");
      }
    }, 500);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(cssTimer);
    };
  }, [pathname, userEmail, userName, meetingTitle, showTimer]);

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
        style={{
          display: 'block !important',
          visibility: 'visible !important',
          opacity: 1,
          width: '100%',
          background: '#fff',
          borderBottom: '1px solid #e0e0e0',
          padding: '12px 20px',
          zIndex: 1000,
          position: 'relative',
          minHeight: '60px',
          boxSizing: 'border-box',
        }}
        data-testid="header-component"
      >
      {(pathname === "/pre-join" || pathname.includes("pre-join")) && (
        <div className="headerContentOne">
          <DynamicLogo orgId={orgId} alt="Logo" />
          <div className="profileDetailHeader">
            <div className="profileName">
              <span className="emailText">{userEmail}</span>
              <span className="nameText">{userName}</span>
            </div>
            <div className="profileImage">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#00baff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
            </div>
          </div>
        </div>
      )}

      {(pathname === "/joiner-screen" ||
        pathname === "/screen-share" ||
        pathname.includes("/meeting/")) && (
        <div className="headerContentTwo">
          <div className="headerLeftJoinerScreen">
            <DynamicLogo orgId={orgId} alt="Logo" />
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
      
      {/* Fallback header content - always show if no other content matches */}
      {!pathname.includes("/pre-join") && 
       !pathname.includes("/joiner-screen") && 
       !pathname.includes("/screen-share") && 
       !pathname.includes("/meeting/") && (
        <div className="headerContentOne">
          <DynamicLogo orgId={orgId} alt="Logo" />
          <div className="profileDetailHeader">
            <div className="profileName">
              <span className="emailText">{userEmail}</span>
              <span className="nameText">{userName}</span>
            </div>
            <div className="profileImage">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#00baff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
