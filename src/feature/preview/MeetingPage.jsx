import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ZoomVideo from "@zoom/videosdk";
import { useZoom } from "../preview/ZoomContext";
import MeetingLeft from "./MeetingLeft";
import ChatSidebar from "./ChatSidebar/ChatSidebar";
import "./MeetingPage.css";
import config from "../../config/config.js";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaUsers,
  FaCommentDots,
  FaSignOutAlt,
  FaChevronUp,
  FaCamera,
  FaVolumeUp,
  FaVolumeMute,
  FaSignal,
} from "react-icons/fa";

const MeetingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getClient, cleanup: zoomCleanup, bgMode, setBgMode } = useZoom();

  // State
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState("");
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showModals, setShowModals] = useState({
    participants: false,
    chat: false,
  });
  const [chatInput, setChatInput] = useState("");
  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isRemoteSharing, setIsRemoteSharing] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const screenShareContainerRef = useRef(null);
  const remoteShareContainerRef = useRef(null);
  const [annotationError, setAnnotationError] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("stopped"); // "stopped" | "recording" | "paused"
  const [showRecordingNotice, setShowRecordingNotice] = useState(false);
  const recordingClientRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const notifyUserJoined = async () => {
    try {
      console.log("�� Calling userJoined webhook with:", {
        meetingId: meetingId,
        userId: userName,
        userType: isHost ? "mentor" : "mentee",
      });

      const response = await fetch(
        config.getApiUrl(config.API_ENDPOINTS.USER_JOINED),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meetingId: meetingId,
            userId: userName,
            userType: isHost ? "mentor" : "mentee",
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("✅ User joined webhook sent:", data);
    } catch (err) {
      console.error("❌ Failed to send user joined webhook:", err);
      console.error("❌ Error details:", {
        message: err.message,
        status: err.status,
      });
    }
  };

  const notifyUserLeft = async () => {
    // Prevent calling userLeft during initial join process
    if (isJoining) {
      console.log("🚫 Skipping userLeft webhook during join process");
      return;
    }

    try {
      console.log("🎯 Calling userLeft webhook with:", {
        meetingId: meetingId,
        userId: userName,
      });

      const response = await fetch(
        config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meetingId: meetingId,
            userId: userName,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("✅ User left webhook sent:", data);
    } catch (err) {
      console.error("❌ Failed to send user left webhook:", err);
      console.error("❌ Error details:", {
        message: err.message,
        status: err.status,
      });
    }
  };

  const notifyMeetingEnd = async () => {
    try {
      console.log("🏁 Meeting ended by host:", {
        meetingId: meetingId,
        userId: userName,
      });

      const requestBody = {
        meetingId: meetingId,
        userId: userName,
        userType: "mentor",
        role: "1",
        isMentor: true,
        isHost: true,
        mentorId: userName,
      };

      console.log("📡 Making meeting end API call with:", requestBody);

      const response = await fetch(
        config.getApiUrl(config.API_ENDPOINTS.MEETING_END),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Meeting end API Error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
      } else {
        const data = await response.json();
        console.log("✅ Meeting end API call successful:", data);
      }
    } catch (err) {
      console.error("❌ Failed to notify meeting end:", err);
    }
  };
  // Notification helper (move this above useEffect)

  const addNotification = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => {
      const next = [...prev, { id, msg }];
      return next.slice(-4); // Limit to last 4
    });
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);
  const [networkQuality, setNetworkQuality] = useState({}); // { userId: level }
  const aspectRatioRefs = useRef({}); // { userId: aspectRatio }
  const [showEndMeetingConfirm, setShowEndMeetingConfirm] = useState(false);
  const [showMediaWarning, setShowMediaWarning] = useState(false);
  const [mediaWarningMessage, setMediaWarningMessage] = useState("");

  // Refs
  const clientRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const videoContainerRefs = useRef({});
  const selfUserIdRef = useRef(null);
  const VIDEO_QUALITY = 3; // 1: 360p, 3: 720p

  // Parse URL Params
  const { meetingId, userId } = useParams();
  const { sessionName, userName, role } = React.useMemo(() => {
    const params = new URLSearchParams(location.search);

    // Debug logging
    console.log("🔍 URL Parameters Debug:", {
      meetingId,
      userId,
      searchParams: Object.fromEntries(params.entries()),
      pathname: location.pathname,
      fullUrl: location.href,
    });

    return {
      sessionName: meetingId || "default-session",
      userName: userId || "Guest",
      role: parseInt(params.get("role") || "1", 10),
    };
  }, [location.search, meetingId, userId]);
  const isHost = role === 1;

  // Check SharedArrayBuffer support (critical for Zoom SDK remote video)
  const isProduction = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  const hasSharedArrayBuffer = typeof SharedArrayBuffer === 'function';
  const hasCrossOriginIsolation = crossOriginIsolated;
  console.log(`🔒 SharedArrayBuffer available: ${hasSharedArrayBuffer}`);
  console.log(`🔒 Cross-origin isolated: ${hasCrossOriginIsolation}`);
  
  if (isProduction && !hasSharedArrayBuffer) {
    console.error(`❌ CRITICAL: SharedArrayBuffer not available in production!`);
    console.error(`❌ This will cause remote video to not display.`);
    console.error(`❌ Server needs Cross-Origin-Opener-Policy: same-origin`);
    console.error(`❌ Server needs Cross-Origin-Embedder-Policy: require-corp`);
  }

  const attachVideo = useCallback(
    async (userId) => {
      const container = videoContainerRefs.current[userId];
      if (container && mediaStreamRef.current) {
        try {
          console.log(`🎥 Attaching video for user: ${userId}`);
          const userVideo = await mediaStreamRef.current.attachVideo(
            userId,
            VIDEO_QUALITY
          );
          container.innerHTML = "";
          container.appendChild(userVideo);

          // Immediate check for black tile (after 500ms)
          setTimeout(() => {
            if (container && container.children.length > 0) {
              const videoElement = container.querySelector("video");
              if (videoElement) {
                // Check if video has actual content
                if (
                  videoElement.videoWidth === 0 ||
                  videoElement.videoHeight === 0
                ) {
                  console.log(
                    `🧹 Immediate aggressive cleanup of black tile for user: ${userId}`
                  );
                  container.innerHTML = "";
                  container.style.display = "none";
                  // Remove from DOM completely
                  if (container.parentNode) {
                    container.parentNode.removeChild(container);
                  }
                  // Remove from refs
                  delete videoContainerRefs.current[userId];

                  if (mediaStreamRef.current) {
                    mediaStreamRef.current
                      .detachVideo(userId)
                      .catch((e) =>
                        console.error(`Failed to detach video for ${userId}`, e)
                      );
                  }

                  // Force UI update
                  setParticipants(clientRef.current?.getAllUser() || []);
                }
              }
            }
          }, 500); // Check after 500ms for immediate cleanup

          // Additional timeout to clean up black tiles that don't load
          setTimeout(() => {
            if (container && container.children.length > 0) {
              const videoElement = container.querySelector("video");
              if (videoElement && videoElement.videoWidth === 0) {
                console.log(
                  `🧹 Aggressive cleanup of persistent black tile for user: ${userId}`
                );
                container.innerHTML = "";
                container.style.display = "none";
                // Remove from DOM completely
                if (container.parentNode) {
                  container.parentNode.removeChild(container);
                }
                // Remove from refs
                delete videoContainerRefs.current[userId];

                // Use mediaStreamRef directly to avoid circular dependency
                if (mediaStreamRef.current) {
                  mediaStreamRef.current
                    .detachVideo(userId)
                    .catch((e) =>
                      console.error(`Failed to detach video for ${userId}`, e)
                    );
                }

                // Force UI update
                setParticipants(clientRef.current?.getAllUser() || []);
              }
            }
          }, 2000); // Reduced to 2 seconds for faster cleanup

          // Additional check for video element that doesn't start playing
          setTimeout(() => {
            if (container && container.children.length > 0) {
              const videoElement = container.querySelector("video");
              if (videoElement && videoElement.paused) {
                console.log(
                  `🧹 Aggressive cleanup of non-playing video for user: ${userId}`
                );
                container.innerHTML = "";
                container.style.display = "none";
                // Remove from DOM completely
                if (container.parentNode) {
                  container.parentNode.removeChild(container);
                }
                // Remove from refs
                delete videoContainerRefs.current[userId];

                if (mediaStreamRef.current) {
                  mediaStreamRef.current
                    .detachVideo(userId)
                    .catch((e) =>
                      console.error(`Failed to detach video for ${userId}`, e)
                    );
                }

                // Force UI update
                setParticipants(clientRef.current?.getAllUser() || []);
              }
            }
          }, 2000); // Check after 2 seconds
        } catch (e) {
          console.error(`Failed to attach video for ${userId}`, e);
          // Clean up container if attachment fails
          if (container) {
            container.innerHTML = "";
          }
        }
      }
    },
    [VIDEO_QUALITY]
  );

  const detachVideo = useCallback(async (userId) => {
    if (mediaStreamRef.current) {
      try {
        await mediaStreamRef.current.detachVideo(userId);
      } catch (e) {
        console.error(`Failed to detach video for ${userId}`, e);
      }
    }
  }, []);

  // Complete user removal function - handles all cleanup
  const completeUserRemoval = useCallback((userId) => {
    console.log(`🚫 Complete user removal initiated for: ${userId}`);

    // 1. Clean up video container
    if (videoContainerRefs.current[userId]) {
      console.log(`🧹 Complete cleanup of video container for user: ${userId}`);
      const container = videoContainerRefs.current[userId];
      container.innerHTML = "";
      container.style.display = "none";
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      delete videoContainerRefs.current[userId];
    }

    // 2. Remove from participants list
    setParticipants((prevParticipants) => {
      const updatedParticipants = prevParticipants.filter(
        (p) => p.userId !== userId
      );
      console.log(
        `📊 Complete removal - Participants updated: ${prevParticipants.length} -> ${updatedParticipants.length}`
      );
      return updatedParticipants;
    });

    // 3. Force additional cleanup
    setTimeout(() => {
      // Final check and cleanup
      const remainingContainer = videoContainerRefs.current[userId];
      if (remainingContainer) {
        console.log(
          `🧹 Final cleanup of remaining container for user: ${userId}`
        );
        remainingContainer.innerHTML = "";
        remainingContainer.style.display = "none";
        if (remainingContainer.parentNode) {
          remainingContainer.parentNode.removeChild(remainingContainer);
        }
        delete videoContainerRefs.current[userId];
      }

      // Force final participants update
      setParticipants((prevParticipants) => {
        const finalParticipants = prevParticipants.filter(
          (p) => p.userId !== userId
        );
        console.log(
          `🔄 Complete removal - Final participants count: ${finalParticipants.length}`
        );
        return finalParticipants;
      });
    }, 100);
  }, []);

  // Cleanup function to stop media and leave session
  const cleanupMediaAndLeave = async () => {
    try {
      if (mediaStreamRef.current) {
        await mediaStreamRef.current.stopVideo?.();
        await mediaStreamRef.current.muteAudio?.();
      }
      if (clientRef.current) {
        await clientRef.current.leave();
      }
    } catch (err) {
      // Ignore errors on cleanup
    }
  };

  // Handle refresh detection and automatic redirect
  useEffect(() => {
    // Only set up refresh detection if we have valid meeting info
    if (!sessionName || !userName) {
      return;
    }

    const handleBeforeUnload = () => {
      // Store meeting info in sessionStorage for after refresh
      sessionStorage.setItem(
        "meetingExitInfo",
        JSON.stringify({
          meetingId: sessionName,
          userId: userName,
          role: role,
          timestamp: Date.now(),
        })
      );

      // 🔑 CRITICAL: Force immediate client.leave() to notify Zoom
      try {
        if (
          clientRef.current &&
          clientRef.current.getCurrentUserInfo()?.userId
        ) {
          console.log(
            "🔄 Page unloading - forcing immediate client.leave() to notify Zoom"
          );
          clientRef.current.leave(true); // true => force immediate leave
        }
      } catch (err) {
        console.error("❌ Error leaving meeting on page unload:", err);
      }
    };

    const handleVisibilityChange = () => {
      // Only handle visibility change if we're actually leaving the page
      // Tab switches should NOT cause users to leave the meeting
      if (document.visibilityState === "hidden") {
        // Check if this is likely a page unload vs just a tab switch
        // We'll use a small delay to differentiate between tab switch and page unload
        setTimeout(() => {
          // If the page is still hidden after a short delay, it might be a page unload
          // But we won't force leave here - let the beforeunload and pagehide handlers deal with it
          console.log(
            "🔄 Tab hidden - but not forcing leave (likely just tab switch)"
          );
        }, 100);
      } else if (document.visibilityState === "visible") {
        console.log("🔄 Tab visible again - user returned to meeting tab");
      }
    };

    const handlePageHide = () => {
      // Immediately notify backend that user is leaving due to refresh/page close
      if (clientRef.current && clientRef.current.getCurrentUserInfo()?.userId) {
        console.log("🔄 User leaving page - immediately notifying backend");

        // Try multiple methods to ensure the webhook is called
        const data = JSON.stringify({
          meetingId: sessionName,
          userId: userName,
        });

        // Method 1: sendBeacon (most reliable for page unload)
        if (navigator.sendBeacon) {
          const success = navigator.sendBeacon(
            config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),
            data
          );
          console.log("📡 sendBeacon result:", success);
        }

        // Method 2: Synchronous XMLHttpRequest (fallback)
        try {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            config.getApiUrl(config.API_ENDPOINTS.USER_LEFT),
            false
          );
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.send(data);
          console.log("📡 XMLHttpRequest status:", xhr.status);
        } catch (err) {
          console.error("📡 XMLHttpRequest failed:", err);
        }

        // Method 3: Store in sessionStorage for next page load
        sessionStorage.setItem("pendingUserLeft", data);
      }
    };

    const handleLoad = () => {
      // Check if we have stored meeting info from a refresh
      const storedInfo = sessionStorage.getItem("meetingExitInfo");
      if (storedInfo) {
        try {
          const info = JSON.parse(storedInfo);
          const timeDiff = Date.now() - info.timestamp;

          // Only redirect if the refresh happened within the last 5 seconds
          if (timeDiff < 5000) {
            sessionStorage.removeItem("meetingExitInfo");
            // Prevent automatic rejoin by setting a flag
            sessionStorage.setItem("preventAutoRejoin", "true");
            navigate(
              `/meeting-exit?meetingId=${encodeURIComponent(
                info.meetingId
              )}&userId=${encodeURIComponent(info.userId)}&role=${info.role}`
            );
          } else {
            sessionStorage.removeItem("meetingExitInfo");
          }
        } catch (err) {
          sessionStorage.removeItem("meetingExitInfo");
        }
      }

      // Check for pending user left notification
      const pendingUserLeft = sessionStorage.getItem("pendingUserLeft");
      if (pendingUserLeft) {
        try {
          const data = JSON.parse(pendingUserLeft);
          console.log("📡 Sending pending user left notification:", data);

          // Send the pending notification
          fetch(config.getApiUrl(config.API_ENDPOINTS.USER_LEFT), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: pendingUserLeft,
          })
            .then(() => {
              console.log(
                "✅ Pending user left notification sent successfully"
              );
            })
            .catch((err) => {
              console.error(
                "❌ Failed to send pending user left notification:",
                err
              );
            });

          sessionStorage.removeItem("pendingUserLeft");
        } catch (err) {
          console.error("❌ Failed to parse pending user left data:", err);
          sessionStorage.removeItem("pendingUserLeft");
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("unload", handleBeforeUnload); // Backup unload handler
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("load", handleLoad);

    // Check immediately on mount
    handleLoad();

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("unload", handleBeforeUnload);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("load", handleLoad);
    };
  }, [navigate, sessionName, userName, role]);

  // Main session lifecycle effect
  useEffect(() => {
    const client = getClient();
    clientRef.current = client;

    // Only proceed if we have valid meeting info
    if (!sessionName || !userName) {
      return;
    }

    // Check if we should prevent automatic rejoin (user just left due to refresh)
    const preventAutoRejoin = sessionStorage.getItem("preventAutoRejoin");
    if (preventAutoRejoin === "true") {
      sessionStorage.removeItem("preventAutoRejoin");
      console.log("🚫 Preventing automatic rejoin due to recent refresh");
      return;
    }

    // Fetch devices and set state
    const fetchDevices = async () => {
      try {
        const devices = await ZoomVideo.getDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        const mics = devices.filter((d) => d.kind === "audioinput");
        const speakers = devices.filter((d) => d.kind === "audiooutput");
        setVideoDevices(cams);
        setAudioDevices(mics);
        setSpeakerDevices(speakers);
        if (!selectedCamera && cams[0]) setSelectedCamera(cams[0].deviceId);
        if (!selectedMic && mics[0]) setSelectedMic(mics[0].deviceId);
        if (!selectedSpeaker && speakers[0])
          setSelectedSpeaker(speakers[0].deviceId);
      } catch (err) {
        setError(
          "Failed to fetch devices. Please check your camera and microphone permissions."
        );
      }
    };
    fetchDevices();

    // Listen for device-change event
    client.on("device-change", fetchDevices);

    // Listen for permission-change event
    client.on("permission-change", (payload) => {
      setPermissionError(
        "Camera or microphone permission changed. Please re-authorize in your browser settings."
      );
    });

    const getSignature = async () => {
      try {
        const response = await fetch(
          config.getApiUrl(config.API_ENDPOINTS.GENERATE_SIGNATURE),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionName, role }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.signature;
      } catch (err) {
        setError("Failed to get a valid signature.");
        return null;
      }
    };

    const setupEventListeners = () => {
      client.on("user-added", () => setParticipants(client.getAllUser()));
      client.on("user-removed", () => setParticipants(client.getAllUser()));

      client.on("chat-on-message", (payload) => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: payload.sender.name,
            content: payload.message,
            timestamp: payload.timestamp, // Store the original timestamp, not formatted string
          },
        ]);
      });

      client.on("peer-video-state-change", async (payload) => {
        const { action, userId } = payload;
        if (userId === selfUserIdRef.current) return; // Ignore self events

        console.log(`📹 Video state change for user ${userId}: ${action}`);

        if (action === "Start") {
          // Check if user is still in the meeting before attaching video
          const allUsers = client.getAllUser();
          const user = allUsers.find((u) => u.userId === userId);
          if (!user) {
            console.log(
              `🚫 User ${userId} no longer in meeting - skipping video attachment`
            );
            return;
          }

          console.log(`🎥 User ${userId} started video - attaching`);
          await attachVideo(userId);
        } else if (action === "Stop") {
          console.log(
            `📹 User ${userId} stopped video - complete cleanup initiated`
          );
          await detachVideo(userId);

          // Use the complete user removal function
          completeUserRemoval(userId);
        }

        // Update participants state so UI reflects remote video changes
        setParticipants(client.getAllUser());
      });

      // Add peer-audio-state-change listener to update participants state
      client.on("peer-audio-state-change", (payload) => {
        if (payload && payload.userId) {
          setParticipants((prev) =>
            prev.map((user) =>
              user.userId === payload.userId
                ? { ...user, muted: payload.action === "Muted" }
                : user
            )
          );
        } else {
          setParticipants(client.getAllUser());
        }
      });
      client.on("user-updated", () => {
        setParticipants(client.getAllUser());
      });
    };

    const joinSession = async () => {
      try {
        await client.init("en-US", "Global", {
          patchJsMedia: true,
          enforceVirtualBackground: true,
          virtualBackground: { isSupport: true },
          // Add TURN/STUN server configuration for production environments
          webRTC: {
            iceServers: [
              { urls: 'stun:stun.zoom.us:3478' },
              { urls: 'stun:stun1.zoom.us:3478' },
              { 
                urls: 'turn:turn.zoom.us:3478',
                username: 'zoom',
                credential: 'zoom'
              },
              { 
                urls: 'turn:turn1.zoom.us:3478',
                username: 'zoom',
                credential: 'zoom'
              }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
          }
        });
        const signature = await getSignature();
        if (!signature) return;

        await client.join(sessionName, signature, userName);

        // notify backend that user joined
        await notifyUserJoined();

        // Enable leave on page unload after successful join
        client.leaveOnPageUnload = true;

        mediaStreamRef.current = client.getMediaStream();
        selfUserIdRef.current = client.getCurrentUserInfo().userId;
        setParticipants(client.getAllUser());

        setTimeout(async () => {
          // Start audio
          await mediaStreamRef.current.startAudio();
          setIsAudioOn(true);

          // Start and attach self video with initial background mode
          try {
            let vbOptions = {};
            if (bgMode === "blur") {
              vbOptions = { virtualBackground: { imageUrl: "blur" } };
            } else if (bgMode === "image") {
              vbOptions = {
                virtualBackground: {
                  imageUrl: "/lib/vb-resource/background.jpg",
                },
              };
            }

            await mediaStreamRef.current.startVideo(vbOptions);
            setIsVideoOn(true);
            await attachVideo(selfUserIdRef.current);
          } catch (e) {
            if (e?.errorCode === 6105) {
              // Camera is still starting, show a small message and optionally retry
              setError("Camera is still starting, please wait and try again.");
              // Optionally, retry after 1 second:
              // setTimeout(() => toggleVideo(), 1000);
              return;
            }
            console.error("Failed to start self video", e);
            setError("Could not start camera. Check permissions.");
          }

          // Attach videos for users already in the session
          client.getAllUser().forEach(async (user) => {
            if (user.bVideoOn && user.userId !== selfUserIdRef.current) {
              console.log(
                `🎥 Attaching video for existing user: ${user.userId} (${user.displayName})`
              );
              await attachVideo(user.userId);
            } else if (
              !user.bVideoOn &&
              user.userId !== selfUserIdRef.current
            ) {
              console.log(
                `📹 Skipping video for user without video: ${user.userId} (${user.displayName})`
              );
            }
          });

          // Cloud recording logic
          recordingClientRef.current = client.getRecordingClient();
          // REMOVE: Start recording automatically if host
          // if (isHost && recordingClientRef.current.canStartRecording()) {
          //   const res = await recordingClientRef.current.startCloudRecording();
          //   if (res === "") {
          //     setRecordingStatus("recording");
          //     setShowRecordingNotice(true);
          //   }
          // }
          // If not host, just show the notice if recording is active
          if (
            !isHost &&
            recordingClientRef.current.getCloudRecordingStatus() === "recording"
          ) {
            setShowRecordingNotice(true);
          }
        }, 500); // Small delay to allow React to render containers

        setupEventListeners();
      } catch (err) {
        console.error("Join error:", err);
        setError("Failed to join the session.");
      } finally {
        setIsJoining(false);
      }
    };

    joinSession();

    // Add screen share event listeners
    client.on("passively-stop-share", () => {
      console.log("[SCREEN SHARE] passively-stop-share event triggered");
      setIsSharingScreen(false);
    });

    client.on("active-share-change", (payload) => {
      console.log("[SCREEN SHARE] active-share-change:", {
        state: payload.state,
        userId: payload.userId,
        isLocalUser: payload.userId === selfUserIdRef.current,
      });

      if (!mediaStreamRef.current) {
        console.log("[SCREEN SHARE] ERROR: mediaStreamRef.current is null");
        return;
      }

      if (payload.state === "Active") {
        console.log(
          "[SCREEN SHARE] Starting remote share view for user:",
          payload.userId
        );
        setIsRemoteSharing(true);

        try {
          mediaStreamRef.current.startShareView(
            remoteShareContainerRef.current,
            payload.userId
          );
          console.log("[SCREEN SHARE] Remote share view started successfully");
          addNotification(`Screen sharing started by ${payload.userId}`);
        } catch (error) {
          console.log(
            "[SCREEN SHARE] Error starting remote share view:",
            error
          );
        }
      } else if (payload.state === "Inactive") {
        console.log("[SCREEN SHARE] Stopping remote share view");
        setIsRemoteSharing(false);

        try {
          mediaStreamRef.current.stopShareView();
          console.log("[SCREEN SHARE] Remote share view stopped successfully");
          addNotification("Screen sharing stopped");
        } catch (error) {
          console.log(
            "[SCREEN SHARE] Error stopping remote share view:",
            error
          );
        }
      }
    });

    // Optional: Listen for annotation privilege changes
    client.on(
      "annotation-privilege-change",
      ({ userId, isAnnotationEnabled }) => {
        if (!isAnnotationEnabled && isAnnotating) {
          stopAnnotation();
        }
      }
    );

    // Listen for active speaker changes
    client.on("video-active-change", (payload) => {
      setActiveSpeakerId(payload.userId);
    });

    // User join/leave notifications
    const handleUserAdded = (payload) => {
      payload.forEach((item) => {
        console.log("[USER] User joined:", {
          userId: item.userId,
          displayName: item.displayName,
          isLocal: item.userId === selfUserIdRef.current,
          timestamp: new Date().toISOString(),
          hasVideo: item.bVideoOn,
        });

        // Only show notification for non-local users or if it's not a rejoin
        if (item.userId !== selfUserIdRef.current) {
          addNotification(
            `${item.displayName || item.userId} joined the session.`
          );
        }

        // If user joined without video, don't create a video container
        if (!item.bVideoOn && item.userId !== selfUserIdRef.current) {
          console.log(
            `📹 User ${item.userId} joined without video - skipping video container`
          );
        }

        // Re-register screen share event listeners for new participants
        if (item.userId !== selfUserIdRef.current) {
          console.log(
            "[SCREEN SHARE] Re-registering events for new participant:",
            item.userId
          );
          // Force a re-registration of screen share events
          client.off("active-share-change");
          client.on("active-share-change", (payload) => {
            console.log("[SCREEN SHARE] active-share-change (re-registered):", {
              state: payload.state,
              userId: payload.userId,
              isLocalUser: payload.userId === selfUserIdRef.current,
            });

            if (!mediaStreamRef.current) {
              console.log(
                "[SCREEN SHARE] ERROR: mediaStreamRef.current is null"
              );
              return;
            }

            if (payload.state === "Active") {
              console.log(
                "[SCREEN SHARE] Starting remote share view for user:",
                payload.userId
              );
              setIsRemoteSharing(true);

              // Wait for remote container to be available
              setTimeout(() => {
                if (!remoteShareContainerRef.current) {
                  console.log(
                    "[SCREEN SHARE] ERROR: Remote canvas ref is null"
                  );
                  return;
                }

                try {
                  console.log(
                    "[SCREEN SHARE] Remote canvas element:",
                    remoteShareContainerRef.current
                  );
                  mediaStreamRef.current.startShareView(
                    remoteShareContainerRef.current,
                    payload.userId
                  );
                  console.log(
                    "[SCREEN SHARE] Remote share view started successfully"
                  );
                  addNotification(
                    `Screen sharing started by ${payload.userId}`
                  );
                } catch (error) {
                  console.log(
                    "[SCREEN SHARE] Error starting remote share view:",
                    error
                  );
                }
              }, 100);
            } else if (payload.state === "Inactive") {
              console.log("[SCREEN SHARE] Stopping remote share view");
              setIsRemoteSharing(false);

              try {
                mediaStreamRef.current.stopShareView();
                console.log(
                  "[SCREEN SHARE] Remote share view stopped successfully"
                );
                addNotification("Screen sharing stopped");
              } catch (error) {
                console.log(
                  "[SCREEN SHARE] Error stopping remote share view:",
                  error
                );
              }
            }
          });
        }
      });
      setParticipants(client.getAllUser());
    };
    const handleUserRemoved = (payload) => {
      payload.forEach((item) => {
        console.log("[USER] User left:", {
          userId: item.userId,
          displayName: item.displayName,
          timestamp: new Date().toISOString(),
          isLocal: item.userId === selfUserIdRef.current,
        });

        // Complete user removal - handle like userLeft webhook
        console.log(
          `🚫 Complete removal of user: ${item.userId} (${item.displayName})`
        );

        // Use the complete user removal function
        completeUserRemoval(item.userId);

        // Additional detach video call
        detachVideo(item.userId);

        // Only show notification for non-local users
        if (item.userId !== selfUserIdRef.current) {
          addNotification(
            `${item.displayName || item.userId} left the session.`
          );
        }
      });
      setParticipants(client.getAllUser());
    };
    client.on("user-added", handleUserAdded);
    client.on("user-removed", handleUserRemoved);

    // Connection status handling
    client.on("connection-change", (payload) => {
      console.log("🔗 Connection change:", payload);

      if (payload.state === "Closed") {
        // Only notify if we were actually connected before
        if (client.getCurrentUserInfo()?.userId) {
          notifyUserLeft().catch((err) =>
            console.error("failed to notify user left: ", err)
          );
        }
        addNotification(
          payload.reason === "ended by host"
            ? "The host has ended the meeting."
            : `Session ended: ${payload.reason || "Closed by host or network"}`
        );
        navigate("/meeting-left");
      } else if (payload.state === "Reconnecting") {
        addNotification(`Reconnecting to session...`);
      } else if (payload.state === "Connected") {
        addNotification(`Connected to session.`);
      } else if (payload.state === "Fail") {
        // Only notify if we were actually connected before
        if (client.getCurrentUserInfo()?.userId) {
          notifyUserLeft().catch((err) =>
            console.error("Failed to notify user left:", err)
          );
        }

        addNotification(
          `Session failed: ${payload.reason || payload.errorCode}`
        );
        navigate("/meeting-left");
      }
    });

    // Device plug/unplug and permission changes
    client.on("device-change", fetchDevices);
    client.on("device-permission-change", (payload) => {
      addNotification(`${payload.name} permission is ${payload.state}`);
      if (payload.state === "denied") {
        setMediaWarningMessage(
          `Media error: Your mic is muted in system or browser settings. Please open your settings to unmute and adjust the level.`
        );
        setShowMediaWarning(true);
      }
    });

    // Media failure handling
    client.on("active-media-failed", (payload) => {
      const message = payload.message || payload.code || "Unknown media error";
      addNotification(`Media error: ${message}`);

      // Show warning dialog instead of throwing error
      setMediaWarningMessage(
        `We detected an issue with the microphone that we cannot resolve.\n\n Your mic is muted in system or browser settings.\n\n Please open your settings to unmute and adjust the level..\n\nPlease refresh the page to try to fix it.`
      );
      setShowMediaWarning(true);
    });

    // Audio/video state changes
    client.on("current-audio-change", (payload) => {
      if (payload.action === "Leave") {
        addNotification(`Audio ended: ${payload.source}`);
      } else if (payload.action === "Muted") {
        addNotification(`Audio muted: ${payload.source}`);
        // Show warning for system-level mute
        if (payload.source && payload.source.includes("system")) {
          setMediaWarningMessage(
            `Your microphone has been muted by the system.\n\nPlease check your system audio settings and unmute your microphone.`
          );
          setShowMediaWarning(true);
        }
      }
    });

    // Auto-play audio failure
    client.on("auto-play-audio-failed", () => {
      addNotification(
        `Audio playback blocked. Click anywhere to resume audio.`
      );
    });

    // Network quality indicator
    client.on("network-quality-change", (payload) => {
      setNetworkQuality((prev) => ({
        ...prev,
        [payload.userId]: payload.level,
      }));
    });

    // Dynamic video aspect ratio
    client.on("video-aspect-ratio-change", (payload) => {
      aspectRatioRefs.current[payload.userId] = payload.aspectRatio;
      // Optionally, force a re-render
      // Removed notification for aspect ratio change
      // addNotification(`Aspect ratio changed for user ${payload.userId}`);
    });

    return () => {
      // Clean up all video containers immediately
      Object.keys(videoContainerRefs.current).forEach((userId) => {
        if (videoContainerRefs.current[userId]) {
          console.log(
            `🧹 Cleaning up video container on unmount for user: ${userId}`
          );
          videoContainerRefs.current[userId].innerHTML = "";
        }
      });
      videoContainerRefs.current = {};

      if (clientRef.current) {
        clientRef.current.leave();
      }
      zoomCleanup();
      client.off("user-added", handleUserAdded);
      client.off("user-removed", handleUserRemoved);
      client.off("connection-change");
      client.off("device-change");
      client.off("device-permission-change");
      client.off("active-media-failed");
      client.off("current-audio-change");
      client.off("user-updated");
      client.off("auto-play-audio-failed");
      client.off("network-quality-change");
      client.off("video-aspect-ratio-change");
    };
  }, []);

  const toggleAudio = useCallback(async () => {
    if (mediaStreamRef.current) {
      try {
        if (isAudioOn) {
          await mediaStreamRef.current.muteAudio();
        } else {
          await mediaStreamRef.current.unmuteAudio();
        }
        setIsAudioOn(!isAudioOn);
        // Force update participants to reflect local audio state
        if (clientRef.current) setParticipants(clientRef.current.getAllUser());
        // Manually emit peer-audio-state-change for local user to update UI globally
        if (clientRef.current) {
          const event = new Event("peer-audio-state-change");
          clientRef.current.emit &&
            clientRef.current.emit("peer-audio-state-change", {
              userId: selfUserIdRef.current,
              action: isAudioOn ? "Muted" : "Unmuted",
            });
        }
      } catch (error) {
        console.error("Toggle audio error:", error);
        // Show warning instead of throwing error
        setMediaWarningMessage(
          `Media error: Your mic is muted in system or browser settings. Please open your settings to unmute and adjust the level.`
        );
        setShowMediaWarning(true);
      }
    }
  }, [isAudioOn]);

  const toggleVideo = useCallback(async () => {
    if (!mediaStreamRef.current) return;
    try {
      if (isVideoOn) {
        await mediaStreamRef.current.stopVideo();
        await detachVideo(selfUserIdRef.current);
        setIsVideoOn(false);
      } else {
        await mediaStreamRef.current.startVideo();
        await attachVideo(selfUserIdRef.current);
        setIsVideoOn(true);
      }
      // Force update participants to reflect local video state
      if (clientRef.current) setParticipants(clientRef.current.getAllUser());
      // Manually emit peer-video-state-change for local user to update UI globally
      if (clientRef.current) {
        const event = new Event("peer-video-state-change");
        clientRef.current.emit &&
          clientRef.current.emit("peer-video-state-change", {
            userId: selfUserIdRef.current,
            action: isVideoOn ? "Stop" : "Start",
          });
      }
    } catch (e) {
      console.error("Toggle video error", e);
    }
  }, [isVideoOn, attachVideo, detachVideo]);

  const handleBgChange = async (e) => {
    const newBgMode = e.target.value;
    if (!mediaStreamRef.current) return;
    try {
      // detachVideo is not needed here as startVideo will handle the stream.
      await mediaStreamRef.current.stopVideo();

      let vbOptions = {};
      if (newBgMode === "blur") {
        vbOptions = { virtualBackground: { imageUrl: "blur" } };
      } else if (newBgMode === "image") {
        vbOptions = {
          virtualBackground: { imageUrl: "/lib/vb-resource/background.jpg" },
        };
      }

      await mediaStreamRef.current.startVideo(vbOptions);
      setBgMode(newBgMode);
      setIsVideoOn(true);

      // Add notification for background change
      addNotification(`Virtual background changed to ${newBgMode}`);

      // Re-attach video after changing background
      await attachVideo(selfUserIdRef.current);
    } catch (err) {
      console.error("Error updating VB:", err);
      setError("Failed to switch background.");
      // If it fails, try to restart video without VB
      if (!isVideoOn) {
        await mediaStreamRef.current.startVideo();
        await attachVideo(selfUserIdRef.current);
        setIsVideoOn(true);
      }
    }
  };

  const handleModal = (modal, state) =>
    setShowModals((prev) => ({ ...prev, [modal]: state }));

  const sendChatMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      try {
        await clientRef.current.getChatClient().sendToAll(chatInput);
        setChatInput("");
      } catch (err) {
        console.error("Send chat error:", err);
      }
    },
    [chatInput]
  );

  // Screen share start/stop logic
  const handleScreenShare = async () => {
    console.log(
      "[SCREEN SHARE] handleScreenShare called, isSharingScreen:",
      isSharingScreen
    );

    if (!mediaStreamRef.current) {
      console.log("[SCREEN SHARE] ERROR: mediaStreamRef.current is null");
      return;
    }

    try {
      if (!isSharingScreen) {
        console.log("[SCREEN SHARE] Starting screen share...");
        const el = screenShareContainerRef.current;
        if (!el) {
          console.log("[SCREEN SHARE] ERROR: Screen share element not found");
          setError("Screen share element not found.");
          return;
        }

        // Ensure video element is properly configured with static values
        const videoElement = el;
        console.log("[SCREEN SHARE] Video element initial state:", {
          width: videoElement.width,
          height: videoElement.height,
          offsetWidth: videoElement.offsetWidth,
          offsetHeight: videoElement.offsetHeight,
        });

        // Force static dimensions for consistent behavior
        videoElement.width = 1920;
        videoElement.height = 1080;
        videoElement.style.display = "block";
        videoElement.style.width = "100%";
        videoElement.style.height = "auto";
        videoElement.style.visibility = "visible";
        videoElement.style.position = "relative";

        // Ensure container is visible
        const container = videoElement.parentElement;
        if (container) {
          container.style.display = "block";
          container.style.visibility = "visible";
          container.style.position = "relative";
        }

        // Small delay for DOM update
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("[SCREEN SHARE] Video element after setup:", {
          width: videoElement.width,
          height: videoElement.height,
          offsetWidth: videoElement.offsetWidth,
          offsetHeight: videoElement.offsetHeight,
        });

        const canUseVideoElement =
          mediaStreamRef.current.isStartShareScreenWithVideoElement();
        console.log(
          "[SCREEN SHARE] Can use video element:",
          canUseVideoElement
        );

        if (canUseVideoElement) {
          console.log("[SCREEN SHARE] Using video element for screen share");
          await mediaStreamRef.current.startShareScreen(el);
          console.log("[SCREEN SHARE] Screen share started successfully");
        } else {
          console.log("[SCREEN SHARE] Using canvas element for screen share");
          await mediaStreamRef.current.startShareScreen(el);
          console.log("[SCREEN SHARE] Screen share started successfully");
        }

        setIsSharingScreen(true);
        addNotification("Screen sharing started");
      } else {
        console.log("[SCREEN SHARE] Stopping screen share...");
        await mediaStreamRef.current.stopShareScreen();
        console.log("[SCREEN SHARE] Screen sharing stopped successfully");
        setIsSharingScreen(false);
        addNotification("Screen sharing stopped");
      }
    } catch (err) {
      console.log("[SCREEN SHARE] Error:", {
        reason: err?.reason,
        errorCode: err?.errorCode,
        message: err?.message,
        name: err?.name,
      });

      if (err?.reason === "user deny screen share" || err?.errorCode === 6200) {
        console.log("[SCREEN SHARE] User cancelled screen share");
        setIsSharingScreen(false);
        return;
      }
      setError("Screen share failed.");
      setIsSharingScreen(false);
    }
  };

  // Annotation logic
  const handleStartAnnotation = async () => {
    if (!mediaStreamRef.current) return;
    try {
      await mediaStreamRef.current.startAnnotation();
      const annotationController =
        mediaStreamRef.current.getAnnotationController();
      // Set pen tool as default
      await annotationController.setToolType(1); // Pen
      await annotationController.setToolWidth(8);
      setIsAnnotating(true);
      setAnnotationError("");
    } catch (err) {
      setAnnotationError("Failed to start annotation.");
      setIsAnnotating(false);
    }
  };
  const stopAnnotation = async () => {
    if (!mediaStreamRef.current) return;
    try {
      await mediaStreamRef.current.stopAnnotation();
      setIsAnnotating(false);
    } catch (err) {
      setAnnotationError("Failed to stop annotation.");
    }
  };

  // Recording control functions (host only)
  const startRecording = async () => {
    if (!recordingClientRef.current) return;
    const res = await recordingClientRef.current.startCloudRecording();
    if (res === "") {
      setRecordingStatus("recording");
      setShowRecordingNotice(true);
    }
  };
  const pauseRecording = async () => {
    if (!recordingClientRef.current) return;
    const res = await recordingClientRef.current.pauseCloudRecording();
    if (res === "") setRecordingStatus("paused");
  };
  const resumeRecording = async () => {
    if (!recordingClientRef.current) return;
    const res = await recordingClientRef.current.resumeCloudRecording();
    if (res === "") setRecordingStatus("recording");
  };
  const stopRecording = async () => {
    if (!recordingClientRef.current) return;
    const res = await recordingClientRef.current.stopCloudRecording();
    if (res === "") {
      setRecordingStatus("stopped");
      setShowRecordingNotice(false);
    }
  };

  const handleEndMeeting = async () => {
    setShowEndMeetingConfirm(true);
  };
  const confirmEndMeeting = async () => {
    setShowEndMeetingConfirm(false);
    if (clientRef.current) {
      try {
        // Notify backend that host is ending the meeting
        await notifyMeetingEnd();
        await clientRef.current.leave(true); // Host ends session for all
      } catch (err) {
        setError("Failed to end meeting for all.");
      }
    }
    navigate(
      "/meeting-exit?meetingId=" +
        encodeURIComponent(sessionName) +
        "&userId=" +
        encodeURIComponent(userName) +
        "&role=" +
        role
    );
  };
  const handleLeave = async () => {
    if (clientRef.current) {
      try {
        // notify backend that user is leaving
        await notifyUserLeft();

        await clientRef.current.leave(); // Participant leaves session
      } catch (err) {
        setError("Failed to leave meeting.");
      }
    }
    navigate(
      "/meeting-exit?meetingId=" +
        encodeURIComponent(sessionName) +
        "&userId=" +
        encodeURIComponent(userName) +
        "&role=" +
        role
    );
  };

  if (isJoining) return <div>Joining meeting...</div>;
  // if (error)
  //   return (
  //     // <div className="error-page">
  //     //   Error: {error}{" "}
  //     //   <button onClick={() => navigate("/meeting-left")}>Go Back</button>
  //     // </div>
  //   );

  return (
    <div className="meeting-container">
      <div className="top-bar">Zoom Meeting - {sessionName}</div>

      {/* Screen Share Containers */}
      {/* Always render the screen share container but hide when not sharing */}
      <div
        className="screen-share-container"
        style={{
          display: "block",
          opacity: isSharingScreen ? 1 : 0,
          visibility: isSharingScreen ? "visible" : "hidden",
          position: isSharingScreen ? "relative" : "absolute",
          top: isSharingScreen ? "auto" : "-9999px",
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
      {/* Remote Share Container - Always rendered but hidden when not sharing */}
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
          ref={(el) => {
            remoteShareContainerRef.current = el;
            console.log("[SCREEN SHARE] Remote canvas ref set:", !!el);
          }}
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

      {/* Notification toasts */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 3000 }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              background: "#222",
              color: "#fff",
              padding: 12,
              borderRadius: 8,
              marginBottom: 8,
              boxShadow: "0 2px 8px #0006",
              width: 300,
              position: "relative",
              opacity: 1,
              transition: "opacity 0.4s",
              animation: "fadeInOut 4s",
            }}
          >
            {n.msg}
            <button
              onClick={() =>
                setNotifications((prev) => prev.filter((x) => x.id !== n.id))
              }
              style={{
                position: "absolute",
                top: 4,
                right: 8,
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
              }}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
        <style>{`
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
          }
        `}</style>
      </div>

      {/* Video grid or sidebar */}
      {isSharingScreen ? (
        <div
          className={
            (isSharingScreen ? "video-sidebar" : "video-grid") +
            (participants.length === 1 && !isSharingScreen
              ? " single-participant"
              : "")
          }
        >
          {participants.map((user) => (
            <div
              className={
                "video-tile" +
                (activeSpeakerId &&
                user.userId === activeSpeakerId &&
                !isSharingScreen
                  ? " active-speaker"
                  : "")
              }
              key={user.userId}
            >
              <video-player-container
                ref={(el) => {
                  videoContainerRefs.current[user.userId] = el;
                  // Set aspect ratio if available
                  if (el && aspectRatioRefs.current[user.userId]) {
                    el.style.aspectRatio = aspectRatioRefs.current[user.userId];
                  }
                }}
              ></video-player-container>
              <div className="user-label">
                {user.displayName}
                {/* Network quality icon */}
                {networkQuality[user.userId] !== undefined && (
                  <FaSignal
                    style={{
                      marginLeft: 6,
                      color:
                        networkQuality[user.userId] >= 3
                          ? "#0f0"
                          : networkQuality[user.userId] === 2
                            ? "#ff0"
                            : "#f00",
                    }}
                    title={`Network: ${networkQuality[user.userId]}`}
                  />
                )}
                {(
                  user.userId === selfUserIdRef.current
                    ? isAudioOn
                    : !user.muted
                ) ? (
                  <FaMicrophone
                    style={{ marginLeft: 6, color: "#0f0" }}
                    title="Mic On"
                  />
                ) : (
                  <FaMicrophoneSlash
                    style={{ marginLeft: 6, color: "#f00" }}
                    title="Mic Off"
                  />
                )}
                {(
                  user.userId === selfUserIdRef.current
                    ? 2000000000002020
                    : user.bVideoOn
                ) ? (
                  <FaVideo
                    style={{ marginLeft: 6, color: "#0f0" }}
                    title="Camera On"
                  />
                ) : (
                  <FaVideoSlash
                    style={{ marginLeft: 6, color: "#f00" }}
                    title="Camera Off"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={
            "video-grid " +
            (participants.length === 1
              ? "one-participant"
              : participants.length === 2
                ? "two-participants"
                : "")
          }
        >
          {participants.slice(0, 4).map((user) => (
            <div
              className={
                "video-tile" +
                (activeSpeakerId && user.userId === activeSpeakerId
                  ? " active-speaker"
                  : "")
              }
              key={user.userId}
            >
              <video-player-container
                ref={(el) => {
                  videoContainerRefs.current[user.userId] = el;
                  if (el && aspectRatioRefs.current[user.userId]) {
                    el.style.aspectRatio = aspectRatioRefs.current[user.userId];
                  }
                }}
              ></video-player-container>
              <div className="user-label">
                {user.displayName}
                {networkQuality[user.userId] !== undefined && (
                  <FaSignal
                    style={{
                      marginLeft: 6,
                      color:
                        networkQuality[user.userId] >= 3
                          ? "#0f0"
                          : networkQuality[user.userId] === 2
                            ? "#ff0"
                            : "#f00",
                    }}
                    title={`Network: ${networkQuality[user.userId]}`}
                  />
                )}
                {(
                  user.userId === selfUserIdRef.current
                    ? isAudioOn
                    : !user.muted
                ) ? (
                  <FaMicrophone
                    style={{ marginLeft: 6, color: "#0f0" }}
                    title="Mic On"
                  />
                ) : (
                  <FaMicrophoneSlash
                    style={{ marginLeft: 6, color: "#f00" }}
                    title="Mic Off"
                  />
                )}
                {(
                  user.userId === selfUserIdRef.current
                    ? isVideoOn
                    : user.bVideoOn
                ) ? (
                  <FaVideo
                    style={{ marginLeft: 6, color: "#0f0" }}
                    title="Camera On"
                  />
                ) : (
                  <FaVideoSlash
                    style={{ marginLeft: 6, color: "#f00" }}
                    title="Camera Off"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showRecordingNotice && (
        <div className="recording-notice">
          <span className="recording-dot">●</span> This meeting is being
          recorded.
        </div>
      )}

      <div className="control-bar">
        {/* Mic button with dropdown for mic and speaker selection */}
        <div
          className="control-button video-control-group controlViewBlock">
          <button onClick={toggleAudio}>
            {isAudioOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            className="video-options-toggle"
            onClick={() =>
              setShowVideoOptions(showVideoOptions === "mic" ? null : "mic")
            }
          >
            <FaChevronUp />
          </button>
          {showVideoOptions === "mic" && (
            <div
              className="video-options-menu"
              style={{ left: 0, minWidth: 200 }}
            >
              <label style={{ display: "block", marginBottom: 8 }}>
                Microphone:
                <select
                  value={selectedMic}
                  onChange={async (e) => {
                    setSelectedMic(e.target.value);
                    if (mediaStreamRef.current) {
                      await mediaStreamRef.current.switchMicrophone(
                        e.target.value
                      );
                    }
                  }}
                  style={{ width: "100%" }}
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block" }}>
                Speaker:
                <select
                  value={selectedSpeaker}
                  onChange={async (e) => {
                    setSelectedSpeaker(e.target.value);
                    if (mediaStreamRef.current) {
                      await mediaStreamRef.current.switchSpeaker(
                        e.target.value
                      );
                    }
                  }}
                  style={{ width: "100%" }}
                >
                  {speakerDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {/* Camera button with dropdown for camera and background selection */}
        <div
          className="control-button video-control-group controlViewBlock">
          <button onClick={toggleVideo}>
            {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button
            className="video-options-toggle"
            onClick={() =>
              setShowVideoOptions(showVideoOptions === "video" ? null : "video")
            }
          >
            <FaChevronUp />
          </button>
          {showVideoOptions === "video" && (
            <div
              className="video-options-menu"
              style={{ left: 0, minWidth: 200 }}
            >
              <label style={{ display: "block", marginBottom: 8 }}>
                Camera:
                <select
                  value={selectedCamera}
                  onChange={async (e) => {
                    setSelectedCamera(e.target.value);
                    if (mediaStreamRef.current) {
                      await mediaStreamRef.current.switchCamera(e.target.value);
                    }
                  }}
                  style={{ width: "50%" }}
                >
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block" }}>
                Virtual Background:
                <select
                  value={bgMode}
                  onChange={handleBgChange}
                  style={{ width: "100%" }}
                >
                  <option value="none">None</option>
                  <option value="blur">Blur</option>
                  <option value="image">Image</option>
                </select>
              </label>
            </div>
          )}
        </div>
        {/* The rest of the control bar buttons remain unchanged */}
        <button
          className="control-button"
          onClick={() => handleModal("participants", true)}
        >
          <FaUsers />
        </button>
        <button
          className="control-button"
          onClick={() => handleModal("chat", true)}
        >
          <FaCommentDots />
        </button>
        {/* Screen Share Button */}
        <button className="control-button" onClick={handleScreenShare}>
          {isSharingScreen ? "Stop Share" : "Share Screen"}
        </button>
        {/* Annotation Button (only show if sharing or viewing share) */}
        {(isSharingScreen || isRemoteSharing) &&
          (isAnnotating ? (
            <button className="control-button" onClick={stopAnnotation}>
              Stop Annotation
            </button>
          ) : (
            <button className="control-button" onClick={handleStartAnnotation}>
              Annotate
            </button>
          ))}
        {isHost && (
          <>
            {recordingStatus === "stopped" && (
              <button className="control-button" onClick={startRecording}>
                Start Recording
              </button>
            )}
            {recordingStatus === "recording" && (
              <>
                <button className="control-button" onClick={pauseRecording}>
                  Pause Recording
                </button>
                <button className="control-button" onClick={stopRecording}>
                  Stop Recording
                </button>
              </>
            )}
            {recordingStatus === "paused" && (
              <>
                <button className="control-button" onClick={resumeRecording}>
                  Resume Recording
                </button>
                <button className="control-button" onClick={stopRecording}>
                  Stop Recording
                </button>
              </>
            )}
          </>
        )}
        {isHost ? (
          <button
            className="control-button leave"
            onClick={handleEndMeeting}
            style={{ background: "#e53935", color: "#fff" }}
          >
            <FaSignOutAlt /> End Meeting
          </button>
        ) : (
          <button className="control-button leave" onClick={handleLeave}>
            <FaSignOutAlt /> Leave
          </button>
        )}
      </div>
      <ChatSidebar
        isChatOpen={showModals.chat}
        setIsChatOpen={(state) => handleModal("chat", state)}
        participants={participants}
        chatMessages={chatMessages}
        onSendMessage={(message) => {
          if (message && message.trim()) {
            setChatInput(message);
            sendChatMessage({ preventDefault: () => {} });
          }
        }}
        userName={userName}
      />
      {showModals.participants && (
        <div
          className="modal participants-modal"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100%",
            width: 350,
            background: "#fff",
            boxShadow: "-2px 0 12px #0002",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid #e0e0e0",
            padding: 0,
            animation: "slideInRight 0.3s",
          }}
          onClick={() => handleModal("participants", false)}
        >
          <div
            className="modal-content"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: 0,
              background: "#f8f9fa",
              borderRadius: 0,
              boxShadow: "none",
              minWidth: 0,
              minHeight: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 24px 12px 24px",
                borderBottom: "1px solid #e0e0e0",
                background: "#fff",
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>
                Participants ({participants.length})
              </h3>
              <button
                onClick={() => handleModal("participants", false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  color: "#888",
                  cursor: "pointer",
                  marginLeft: 8,
                }}
                aria-label="Close participants panel"
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
              {participants.map((p, idx) => (
                <div
                  key={p.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: idx % 2 === 0 ? "#fff" : "#f3f4f6",
                    padding: "12px 24px",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 16,
                    minHeight: 56,
                  }}
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
                    {p.displayName?.[0] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "#222",
                        fontSize: 16,
                        wordBreak: "break-all",
                      }}
                    >
                      {p.displayName}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginLeft: 12,
                    }}
                  >
                    {(
                      p.userId === selfUserIdRef.current ? isAudioOn : !p.muted
                    ) ? (
                      <FaMicrophone
                        style={{ color: "#0f0", fontSize: 18 }}
                        title="Mic On"
                      />
                    ) : (
                      <FaMicrophoneSlash
                        style={{ color: "#f00", fontSize: 18 }}
                        title="Mic Off"
                      />
                    )}
                    {(
                      p.userId === selfUserIdRef.current
                        ? isVideoOn
                        : p.bVideoOn
                    ) ? (
                      <FaVideo
                        style={{ color: "#0f0", fontSize: 18 }}
                        title="Camera On"
                      />
                    ) : (
                      <FaVideoSlash
                        style={{ color: "#f00", fontSize: 18 }}
                        title="Camera Off"
                      />
                    )}
                    {networkQuality[p.userId] !== undefined && (
                      <FaSignal
                        style={{
                          color:
                            networkQuality[p.userId] >= 3
                              ? "#0f0"
                              : networkQuality[p.userId] === 2
                                ? "#ff0"
                                : "#f00",
                          fontSize: 18,
                        }}
                        title={`Network: ${networkQuality[p.userId]}`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
      {annotationError && <div className="error-page">{annotationError}</div>}
      {permissionError && (
        <div className="error-page">
          {permissionError}{" "}
          <button onClick={() => setPermissionError("")}>Dismiss</button>
        </div>
      )}
      {showEndMeetingConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "32px 32px 24px 32px",
              boxShadow: "0 4px 24px #0002",
              minWidth: 320,
              maxWidth: "90vw",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 18px 0", fontWeight: 700, fontSize: 22 }}>
              End Meeting?
            </h2>
            <div style={{ color: "#444", marginBottom: 28, fontSize: 16 }}>
              Are you sure you want to end the meeting for all participants?
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                onClick={() => setShowEndMeetingConfirm(false)}
                style={{
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmEndMeeting}
                style={{
                  background: "#e53935",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                End Meeting
              </button>
            </div>
          </div>
        </div>
      )}
      {showMediaWarning && (
        <div
          onClick={() => {
            setShowMediaWarning(false);
            // Try to resume audio when clicking anywhere
            if (mediaStreamRef.current && !isAudioOn) {
              try {
                mediaStreamRef.current.unmuteAudio();
                setIsAudioOn(true);
              } catch (error) {
                console.error("Failed to resume audio:", error);
              }
            }
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#333",
              borderRadius: 12,
              padding: "24px 32px 24px 32px",
              boxShadow: "0 4px 24px #0002",
              minWidth: 400,
              maxWidth: "90vw",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#ff9800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                !
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                Active Media Failed
              </h3>
            </div>
            <div
              style={{
                color: "#ccc",
                fontSize: 14,
                lineHeight: 1.5,
                marginBottom: 24,
                whiteSpace: "pre-line",
              }}
            >
              {mediaWarningMessage}
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => {
                  setShowMediaWarning(false);
                  // Try to resume audio when dismissing the warning
                  if (mediaStreamRef.current && !isAudioOn) {
                    try {
                      mediaStreamRef.current.unmuteAudio();
                      setIsAudioOn(true);
                    } catch (error) {
                      console.error("Failed to resume audio:", error);
                    }
                  }
                }}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid #666",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMediaWarning(false);
                  navigate("/meeting-left");
                }}
                style={{
                  background: "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingPage;
