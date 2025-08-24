// ScreenShare.jsx
import React, { useEffect, useRef, useState } from "react";
import Header from "../../Layout/Header/Header";
import ChatSidebar from "../preview/ChatSidebar/ChatSidebar";
import "./ScreenShareStyle.css";
import {
  ChatIcon,
  MicroPhone,
  OffVideoCamera,
  RecordingIcon,
  ShareScreenIcon,
  UnMicroPhone,
  VideoCamera,
} from "../../icon/icon";

/**
 * Props:
 * - clientRef: ref to Zoom client (optional if available from context)
 * - mediaStreamRef: ref to zoom media stream (optional)
 * - selfUserIdRef: ref to local user id (optional)
 * - addNotification(msg): optional function to show notifications
 *
 * If you moved MeetingPage logic into JoinerScreen, pass these refs here.
 */
const ScreenShare = ({
  clientRef,
  mediaStreamRef,
  selfUserIdRef,
  addNotification = (msg) => console.info("[notif]", msg),
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenShare, setIsScreenShare] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isRemoteSharing, setIsRemoteSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef(null);

  // screen share target elements
  const screenShareContainerRef = useRef(null); // <video> element used for local share
  const remoteShareContainerRef = useRef(null); // <canvas> element for remote share

  // simple camera preview to keep previous behaviour
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        console.error("Error accessing camera:", err);
      });

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Helper: Detect WebCodecs support (like MeetingPage.jsx)
  const webCodecsEnabled =
    typeof window.MediaStreamTrackProcessor === "function";

  // START / STOP local screen sharing (like MeetingPage.jsx)
  const handleScreenShare = async () => {
    // mediaStreamRef is expected to be a ref to the zoom media stream
    if (!mediaStreamRef || !mediaStreamRef.current) {
      console.warn("[SCREEN SHARE] mediaStreamRef not available");
      setError("Screen share not available right now.");
      return;
    }

    try {
      if (!isScreenShare) {
        // start local screen share
        if (webCodecsEnabled) {
          // Use video element for sharer if WebCodecs is enabled
          await mediaStreamRef.current.startShareScreen(
            screenShareContainerRef.current
          );
          screenShareContainerRef.current.style.display = "block";
          remoteShareContainerRef.current.style.display = "none";
        } else {
          // Use canvas for sharer if WebCodecs is not enabled
          await mediaStreamRef.current.startShareScreen(
            remoteShareContainerRef.current
          );
          remoteShareContainerRef.current.style.display = "block";
          screenShareContainerRef.current.style.display = "none";
        }
        setIsScreenShare(true);
        addNotification("Screen sharing started");
      } else {
        // stop screen share
        await mediaStreamRef.current.stopShareScreen();
        if (screenShareContainerRef.current)
          screenShareContainerRef.current.style.display = "none";
        if (remoteShareContainerRef.current)
          remoteShareContainerRef.current.style.display = "none";
        setIsScreenShare(false);
        addNotification("Screen sharing stopped");
      }
    } catch (err) {
      console.error("[SCREEN SHARE] error:", err);
      // user canceled or other error
      if (err?.reason === "user deny screen share" || err?.errorCode === 6200) {
        setIsScreenShare(false);
        return;
      }
      setError("Screen share failed: " + (err.message || "Unknown error"));
      setIsScreenShare(false);
    }
  };

  // Handle incoming remote share event(s) (like MeetingPage.jsx)
  useEffect(() => {
    const client = clientRef?.current;
    if (!client || !mediaStreamRef?.current) {
      // If you don't have client yet, wait — caller should pass it later
      return;
    }

    const handleShareStarted = () => setIsScreenShare(true);
    const handleShareStopped = () => {
      setIsScreenShare(false);
      setIsRemoteSharing(false);
    };

    // For viewers: always use canvas for incoming share (like MeetingPage.jsx)
    const handleActiveShareChange = ({ userId, state }) => {
      if (!mediaStreamRef.current) return;
      if (state === "Active") {
        if (remoteShareContainerRef.current) {
          mediaStreamRef.current.startShareView(
            remoteShareContainerRef.current,
            userId
          );
          remoteShareContainerRef.current.style.display = "block";
          screenShareContainerRef.current.style.display = "none";
        }
        setIsRemoteSharing(true);
        addNotification(`Screen sharing started by ${userId}`);
      } else {
        mediaStreamRef.current.stopShareView();
        setIsRemoteSharing(false);
        if (remoteShareContainerRef.current)
          remoteShareContainerRef.current.style.display = "none";
        addNotification("Screen sharing stopped");
      }
    };

    const handleShareReceived = ({ userId }) => {
      if (remoteShareContainerRef.current) {
        mediaStreamRef.current.renderShare(
          remoteShareContainerRef.current,
          userId,
          1280,
          720,
          0,
          0
        );
        remoteShareContainerRef.current.style.display = "block";
        screenShareContainerRef.current.style.display = "none";
      }
    };

    // Use client.on/off instead of mediaStream.on/off (like MeetingPage.jsx)
    client.on("share-content-started", handleShareStarted);
    client.on("share-content-stopped", handleShareStopped);
    client.on("share-content-received", handleShareReceived);
    client.on("active-share-change", handleActiveShareChange);

    // cleanup
    return () => {
      client.off("share-content-started", handleShareStarted);
      client.off("share-content-stopped", handleShareStopped);
      client.off("share-content-received", handleShareReceived);
      client.off("active-share-change", handleActiveShareChange);
    };
  }, [clientRef?.current, mediaStreamRef?.current, addNotification]);

  // If you want annotation controls that call SDK annotation APIs,
  // you can add the start/stop annotation wrappers here (copied from MeetingPage).
  const handleStartAnnotation = async () => {
    try {
      if (!mediaStreamRef.current) return;
      await mediaStreamRef.current.startAnnotation();
      const annotationController =
        mediaStreamRef.current.getAnnotationController();
      await annotationController.setToolType(1); // pen
      await annotationController.setToolWidth(8);
      setIsAnnotating(true);
    } catch (err) {
      console.error("Failed to start annotation", err);
    }
  };

  const stopAnnotation = async () => {
    if (!mediaStreamRef.current) return;
    try {
      await mediaStreamRef.current.stopAnnotation();
      setIsAnnotating(false);
    } catch (err) {
      console.error("Failed to stop annotation", err);
    }
  };

  return (
    <div className="ScreenShare joinerScreen">
      <Header />
      <div className="joinerScreenContainer">
        <div className="joinerScreenBlock">
          <div className="shareScreenBlock">
            <div className="joinersGroupScreens">
              {/* Small participant tiles (dummy for now) */}
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="joinerViewHere">
                  <video
                    // this shows camera preview
                    ref={idx === 0 ? videoRef : null}
                    autoPlay
                    playsInline
                    muted
                    className="previewVideo"
                  />
                  <div className="nameJoinerHere">User {idx + 1}</div>
                </div>
              ))}

              <div className="joinerCount">+20</div>
            </div>

            {/* Local screen-share video element: used to start local share */}
            <div className="screenViewHere">
              <div
                className="screen-share-container"
                style={{
                  display: "block",
                  opacity: isScreenShare ? 1 : 0,
                  visibility: isScreenShare ? "visible" : "hidden",
                  position: isScreenShare ? "relative" : "absolute",
                  top: isScreenShare ? "auto" : "-9999px",
                }}
              >
                <video
                  ref={screenShareContainerRef}
                  id="my-screen-share-content-video"
                  width="1920"
                  height="1080"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    position: "relative",
                  }}
                  autoPlay
                  muted
                />
              </div>

              {/* Remote share canvas - always mounted but hidden when not sharing */}
              <div
                className="remote-share-container"
                style={{
                  display: "block",
                  opacity: isRemoteSharing ? 1 : 0,
                  visibility: isRemoteSharing ? "visible" : "hidden",
                  position: isRemoteSharing ? "relative" : "absolute",
                  top: isRemoteSharing ? "auto" : "-9999px",
                }}
              >
                <canvas
                  ref={remoteShareContainerRef}
                  id="users-screen-share-content-canvas"
                  width="1920"
                  height="1080"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    position: "relative",
                  }}
                />
              </div>

              <div className="nameJoinerHere">Screen / Presenter</div>
            </div>
          </div>

          <div className="joinerSettingBottom">
            <button
              className={`commonJoinderBtn muteBoxSetting ${
                isMute ? "active" : ""
              }`}
              onClick={() => setIsMute(!isMute)}
            >
              {isMute ? <UnMicroPhone /> : <MicroPhone />}
              <span>{isMute ? "Unmute" : "Mute"}</span>
            </button>

            <button
              className={`commonJoinderBtn videoBoxSetting ${
                isVideoOff ? "active" : ""
              }`}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <OffVideoCamera /> : <VideoCamera />}
              <span>{isVideoOff ? "Start Video" : "Stop Video"}</span>
            </button>

            <button
              className={`commonJoinderBtn chatSetting ${
                isChatOpen ? "active" : ""
              }`}
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <span className="messageRound">
                <ChatIcon />
                {isChatOpen && <span></span>}
              </span>
              <span>{isChatOpen ? "Close Chat" : "Open Chat"}</span>
            </button>

            <button
              className={`commonJoinderBtn screenShareSetting ${
                isScreenShare ? "active" : ""
              }`}
              onClick={handleScreenShare}
            >
              <ShareScreenIcon />
              <span>{isScreenShare ? "Stop Share" : "Share Screen"}</span>
            </button>

            <button
              className={`commonJoinderBtn recordingSetting ${
                isRecording ? "active" : ""
              }`}
              onClick={() => setIsRecording(!isRecording)}
            >
              <RecordingIcon />
              <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
            </button>

            <button className="leaveMeetingButton">Leave Meeting</button>
          </div>
        </div>

        <ChatSidebar isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#ff4b5c",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            zIndex: 1000,
            maxWidth: "300px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default ScreenShare;
