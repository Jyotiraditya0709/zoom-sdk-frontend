import React, { useEffect, useRef, useState } from "react";
import ZoomVideo from "@zoom/videosdk";
import { useNavigate, useLocation } from "react-router-dom";
import "./PreJoin.css";
import {
  MicroPhone,
  OffVideoCamera,
  PolygonIcon,
  RightArrow,
  UnMicroPhone,
  VideoCamera,
} from "../../icon/icon";
import Header from "../../Layout/Header/Header";
import { useZoom } from "./ZoomContext";
import config from "../../config/config";

// Persistent module-level tracks
let localVideoTrack = null;
let localAudioTrack = null;

// Utility to safely start a video track with retries and error suppression
async function safeStartVideoTrack(track, videoEl, vbOptions = {}, retries = 3, delay = 300) {
  if (!track || !videoEl) return;

  try {
    videoEl.srcObject = null;
    if (videoEl.load) videoEl.load();
  } catch { }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((res) => setTimeout(res, delay));
      // Pass vbOptions if provided
      if (Object.keys(vbOptions).length > 0) {
        await track.start(videoEl, vbOptions);
      } else {
        await track.start(videoEl);
      }
      return;
    } catch (err) {
      const msg = err?.message || "";
      
      if (
        msg.includes("play() request was interrupted") ||
        msg.includes("Timeout starting video source")
      ) {
        console.warn(`Attempt ${attempt} to start video failed:`, msg);
        if (attempt === retries) throw err;
        continue;
      }
      
      throw err;
    }
  }
}

const PreJoin = () => {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const meetingId = params.get("meetingId");
    const userId = params.get("userId");
    const agenda = params.get("agenda");
    const status = params.get("status");
    const userTypeParam = params.get("userType");
    const roleParam = params.get("role");

    if (meetingId && userId) {
      setSessionName(meetingId);
      setUserName(userId);

      if (userTypeParam) {
        setUserType(userTypeParam);
      }

      if (roleParam) {
        setRole(roleParam);
      }

      console.log("�� Pre-filled meeting data:", {
        meetingId,
        userId,
        agenda,
        status,
        userType: userTypeParam,
        role: roleParam,
      });
    }
  }, [location.search]);

  // Separate useEffect to handle agenda initialization from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const agenda = params.get("agenda");
    const meetingId = params.get("meetingId");
    const status = params.get("status");

    // Set agenda data from URL parameters immediately for better UX
    if (agenda && meetingId) {
      setAgendaData({
        agenda: decodeURIComponent(agenda),
        meetingId: meetingId,
        startTime: null,
        endTime: null,
        meetingStatus: status || "pending",
      });
      console.log("✅ Agenda set from URL parameters:", decodeURIComponent(agenda));
    }
  }, [location.search]);

  const navigate = useNavigate();

  const videoRef = useRef(null);

  const {
    selectedCamera,
    setSelectedCamera,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    sessionName,
    setSessionName,
    userName,
    setUserName,
    bgMode,
    setBgMode,
    cleanup: contextCleanup,
    updateContext,
  } = useZoom();

  // Add local state for role
  const [role, setRole] = useState("1"); // 1 = host, 0 = attendee
  const [userType, setUserType] = useState(""); // mentor or mentee

  // ========== State for selected options ==========
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]); // mic array
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState("");
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestPhase, setMicTestPhase] = useState("idle"); // idle | recording | ready | playing
  const [micTestPlaybackTimeout, setMicTestPlaybackTimeout] = useState(null);
  const [micTestCountdown, setMicTestCountdown] = useState(4);
  const microPhoneTesterRef = useRef(null);

  // Custom microphone test using Web Audio API
  const [customMicTest, setCustomMicTest] = useState({
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    audioUrl: null,
    stream: null
  });

  // Add missing state variables
  const [isMute, setIsMute] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Add permission state tracking
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  
  // Add permission dialog state
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDialogMessage, setPermissionDialogMessage] = useState("");

  // Add agenda state
  const [agendaData, setAgendaData] = useState(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState("");

  // Add recording consent state
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);

  const client = useRef(null);

  // ========== Permission Dialog Functions ==========
  // Shows a modal dialog when camera/microphone permissions are denied
  // Similar to the media warning modal in JoinerScreen.jsx
  const showPermissionError = (message) => {
    setPermissionDialogMessage(message);
    setShowPermissionDialog(true);
  };

  const requestPermissions = async () => {
    try {
      setShowPermissionDialog(false);
      setError("");
      
      // Request both camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());

      // Update permission states
      setHasCameraPermission(true);
      setHasMicPermission(true);
      
      // Fetch devices again after getting permissions
      const devices = await ZoomVideo.getDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");

      setVideoDevices(cams);
      setAudioDevices(mics);
      setSpeakerDevices(speakers);

      if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);

      console.log("✅ Permissions granted successfully");
      
    } catch (err) {
      console.error("❌ Permission request failed:", err);
      
      let errorMessage = "⚠️ Either Camera or Microphone Access Needed\n\nTo join the meeting, please click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the 🔒 lock icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "⚠️ Either Camera or Microphone Access Needed\n\nTo join the meeting, please click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the 🔒 lock icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera or microphone found. Please connect your devices and try again.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera or microphone is already in use by another application. Please close other apps and try again.";
      }
      
      showPermissionError(errorMessage);
    }
  };





  // Fetch agenda data from database
  const fetchAgendaData = async (meetingId, userId) => {
    if (!meetingId || !userId) return;
    
    // Don't fetch agenda data for default values
    if (meetingId === "meeting-test" || userId === "Guest") return;

    setAgendaLoading(true);
    setAgendaError("");

    // Check if agenda is available in URL parameters as fallback
    const urlParams = new URLSearchParams(location.search);
    const urlAgenda = urlParams.get("agenda");

    try {
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        config.getApiUrl(
          `${config.API_ENDPOINTS.GET_MEETING_INFO}/${meetingId}/${userId}`
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("⚠️ Meeting not found, using URL agenda or default");
          const agendaToUse = urlAgenda;
          setAgendaData({
            agenda: agendaToUse,
            meetingId: meetingId,
            startTime: null,
            endTime: null,
            meetingStatus: "pending",
          });
          return;
        }
        
        // For 403 errors, don't throw - just use fallback data
        if (response.status === 403) {
          console.warn("⚠️ User not authorized, using URL agenda or default");
          const agendaToUse = urlAgenda;
          setAgendaData({
            agenda: agendaToUse,
            meetingId: meetingId,
            startTime: null,
            endTime: null,
            meetingStatus: "pending",
          });
          return;
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.IsSuccess && data.Data) {
        setAgendaData({
          agenda: data.Data.agenda || "No agenda available",
          meetingId: data.Data.meetingId,
          startTime: data.Data.startTime,
          endTime: data.Data.endTime,
          meetingStatus: data.Data.meetingStatus,
          mentorName: data.Data.mentorName,
          menteeName: data.Data.menteeName,
          mentorId: data.Data.mentorId,
          menteeId: data.Data.menteeId,
        });
        console.log("✅ Agenda data fetched:", data.Data);
      } else {
        throw new Error(data.Message || "Failed to fetch agenda data");
      }
    } catch (err) {
      console.error("❌ Failed to fetch agenda data:", err);

      // Handle specific error types
      if (err.name === "AbortError") {
        setAgendaError("Request timeout - please check your connection");
      } else if (err.message.includes("Failed to fetch")) {
        setAgendaError("Network error - please check your connection");
      } else {
        setAgendaError("Failed to load agenda data");
      }

      // Use URL agenda parameter if available, otherwise use default
      const agendaToUse = urlAgenda || "";
      
      // If we have URL agenda, don't show error since we have fallback data
      if (urlAgenda) {
        setAgendaError("");
        console.log("✅ Using agenda from URL parameters:", urlAgenda);
      }

      setAgendaData({
        agenda: agendaToUse,
        meetingId: meetingId,
        startTime: null,
        endTime: null,
        meetingStatus: "pending",
      });
    } finally {
      setAgendaLoading(false);
    }
  };

  // ===== Fetch devices =====
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Request permissions first with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        clearTimeout(timeoutId);

        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());

        const devices = await ZoomVideo.getDevices();

        const cams = devices.filter((d) => d.kind === "videoinput");
        const mics = devices.filter((d) => d.kind === "audioinput");
        const speakers = devices.filter((d) => d.kind === "audiooutput");

        setVideoDevices(cams);
        setAudioDevices(mics);
        setSpeakerDevices(speakers);

        if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
        if (mics.length > 0) setSelectedMic(mics[0].deviceId);
        if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);

        // Set initial permission states
        setHasCameraPermission(true);
        setHasMicPermission(true);
        setIsVideoOff(false); // Camera should be ON by default
        setIsMute(false); // Mic should be ON by default
        setIsInitializing(false); // Component is now initialized

      } catch (err) {
        console.error("Error fetching devices:", err);
        
        // Handle specific error types
        if (err.name === 'AbortError') {
          setError("Device initialization timed out. Please check your camera/microphone permissions and try refreshing the page.");
        } else if (err.name === 'NotAllowedError') {
          showPermissionError("⚠️ Either Camera or Microphone Access Needed\n\nTo join the meeting, please click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the 🔒 lock icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.");
        } else if (err.name === 'NotFoundError') {
          setError("No camera or microphone found. Please connect your devices and try again.");
        } else if (err.name === 'NotReadableError') {
          setError("Camera or microphone is already in use by another application. Please close other apps and try again.");
        } else {
          setError("Failed to fetch devices. Please check your camera/microphone.");
        }
        setIsInitializing(false); // Component is now initialized even if there's an error
      }
    };
    fetchDevices();
  }, []);

  // Fetch agenda data when component mounts
  useEffect(() => {
    if (sessionName && userName) {
      fetchAgendaData(sessionName, userName);
    }
  }, [sessionName, userName]);

  // Set default background based on user type
  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    if (userType === "mentor") {
      if (isMobile) {
        console.warn("🚫 Virtual background disabled on mobile for mentors");
        setBgMode("none");
      } else {
        // Set Tetr background as default for mentors on desktop
        console.log("✅ Setting Tetr background for mentor (userType:", userType, ", bgMode: image)");
        setBgMode("image");
      }
    } else if (userType === "mentee") {
      // Set None as default for mentees
      console.log("✅ Setting no background for mentee (userType:", userType, ", bgMode: none)");
      setBgMode("none");
    }
  }, [userType, setBgMode]);

  // ========== Cleanup function ==========
  // Removed duplicate cleanup, use contextCleanup instead

  // ========== Start Preview Camera and Mic ==========
  const startPreview = async () => {
    setIsLoading(true);
    setError("");
    try {
      await contextCleanup();
      client.current = ZoomVideo.createClient();
      await client.current.init("en-US", "Global", {
        patchJsMedia: true,
        enforceVirtualBackground: true,
        virtualBackground: {
          isSupport: true,
        },
      });



      // Create and start video track (only if video is not off)
      if (!isVideoOff && selectedCamera) {
        // Always create a new video track for device changes
        if (localVideoTrack) {
          try {
            await localVideoTrack.stop();
          } catch (err) {
            console.warn("Video track stop warning:", err.message);
          }
          localVideoTrack = null;
        }

        localVideoTrack = ZoomVideo.createLocalVideoTrack(selectedCamera);

        // Always use the video-player element for virtual backgrounds
        const videoElement = document.querySelector("#local-preview-video");

        if (!videoElement) {
          throw new Error(`Video element not found for background mode: ${bgMode}`);
        }

        // Apply virtual background options when starting the track
        let vbOptions = {};
        if (bgMode === "blur") {
          vbOptions = { imageUrl: "blur" };
          console.log("🎨 Applying blur background");
        } else if (bgMode === "image") {
          vbOptions = { imageUrl: "/lib/vb-resource/background.jpg" };
          console.log("🎨 Applying Tetr background image:", vbOptions.imageUrl);
        } else {
          console.log("🎨 No virtual background applied (bgMode:", bgMode, ")");
        }

        // Use safeStartVideoTrack to handle timeout errors
        await safeStartVideoTrack(localVideoTrack, videoElement, vbOptions);
        
        // If no virtual background, explicitly clear it
        if (Object.keys(vbOptions).length === 0) {
          await localVideoTrack.updateVirtualBackground(undefined);
        }
      }

      // Create and start audio track (only if mic is not muted)
      if (!isMute && selectedMic) {
        // Always create a new audio track for device changes
        if (localAudioTrack) {
          try {
            await localAudioTrack.stop();
          } catch (err) {
            console.warn("Audio track stop warning:", err.message);
          }
          localAudioTrack = null;
        }

        localAudioTrack = ZoomVideo.createLocalAudioTrack(selectedMic);
        await localAudioTrack.start();
        await localAudioTrack.unmute();
      }

    } catch (err) {
      // Suppress the "play() request was interrupted" warning for the user
      if (
        err?.message?.includes(
          "The play() request was interrupted by a new load request"
        ) ||
        err?.message?.includes("https://goo.gl/LdLk22")
      ) {
        // Only log to console, do not set user-facing error
        console.warn("Preview warning:", err.message);
        return;
      }

      // Handle specific Zoom SDK errors
      if (err.message?.includes("VideoAlreadyStartedError")) {
        console.warn("Video already started, continuing...");
        return;
      }

      if (err.message?.includes("AudioAlreadyStartedError")) {
        console.warn("Audio already started, continuing...");
        return;
      }

      // Handle timeout errors specifically
      if (err.message?.includes("Timeout starting video source")) {
        console.warn("Video source timeout, but continuing with preview...");
        setError("Camera is taking longer than expected to start. Please wait or try refreshing the page.");
        return;
      }

      if (err.name === "NotReadableError") {
        setError(
          "Camera or microphone is already in use by another application. Please close other apps and try again."
        );
      } else {
        setError("Failed to start preview: " + (err.reason || err.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ========== Update Virtual Background on Change ==========
  useEffect(() => {
    let isUpdating = false;
    let updateTimeout = null;

    const updateVB = async () => {
      if (!localVideoTrack || isVideoOff || isUpdating) return;

      isUpdating = true;

      try {
        // Only stop if the track is started (SDK may not expose isStarted, so try-catch is safest)
        try {
          await localVideoTrack.stop();
        } catch (err) {
          if (err.message && err.message.includes("VideoNotStartedError")) {
            // Ignore, just proceed
          } else {
            throw err;
          }
        }

        // Always use the video-player element for virtual backgrounds
        const videoElement = document.querySelector("#local-preview-video");

        if (!videoElement) {
          throw new Error(`Video element not found for background mode: ${bgMode}`);
        }

        // Apply virtual background options when starting the track
        let vbOptions = {};
        if (bgMode === "blur") {
          vbOptions = { imageUrl: "blur" };
          console.log("🔄 Updating to blur background");
        } else if (bgMode === "image") {
          vbOptions = { imageUrl: "/lib/vb-resource/background.jpg" };
          console.log("🔄 Updating to Tetr background image:", vbOptions.imageUrl);
        } else {
          console.log("🔄 Clearing virtual background (bgMode:", bgMode, ")");
        }

        if (Object.keys(vbOptions).length > 0) {
          await localVideoTrack.start(videoElement, vbOptions);
        } else {
          await localVideoTrack.start(videoElement);
          await localVideoTrack.updateVirtualBackground(undefined);
        }
      } catch (err) {
        if (err.message && err.message.includes("VideoNotStartedError")) {
          // Try to start the video anyway
          try {
            const videoElement = bgMode === "none" ? videoRef.current : document.querySelector("#local-preview-video");

            if (bgMode === "none") {
              await localVideoTrack.start(videoElement);
              await localVideoTrack.updateVirtualBackground(undefined);
            } else if (bgMode === "blur") {
              await localVideoTrack.start(videoElement, { imageUrl: "blur" });
            } else if (bgMode === "image") {
              await localVideoTrack.start(videoElement, {
                imageUrl: "/lib/vb-resource/background.jpg",
              });
            }
          } catch (e) {
            setError(
              "Failed to update virtual background: " + (e.reason || e.message)
            );
          }
          return;
        }
        console.error("Virtual background update error:", err);
        if (err.message?.includes("Cannot start video with virtual background")) {
          setError("Virtual background not supported. Please try refreshing the page or check your browser compatibility.");
        } else if (err.message?.includes("virtual background")) {
          console.warn("Virtual background not supported, falling back to normal video");
          // Fallback to normal video without virtual background
          try {
            await localVideoTrack.start(videoElement);
            await localVideoTrack.updateVirtualBackground(undefined);
          } catch (fallbackErr) {
            setError("Failed to start video: " + (fallbackErr.reason || fallbackErr.message));
          }
        } else {
          setError(
            "Failed to update virtual background: " + (err.reason || err.message)
          );
        }
      } finally {
        isUpdating = false;
      }
    };

    // Debounce rapid background mode changes
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    updateTimeout = setTimeout(() => {
      // Only run if the video element is mounted, bgMode changes, and video is not off
      if (videoRef.current && !isVideoOff) {
        updateVB();
      }
    }, 100); // Small delay to batch rapid changes

    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  }, [bgMode, isVideoOff]);

  useEffect(() => {
    if (selectedCamera && selectedMic && hasCameraPermission && hasMicPermission) {
      // Minimal delay to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        startPreview();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, selectedMic, hasCameraPermission, hasMicPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up microphone test if active
      if (microPhoneTesterRef.current) {
        try {
          microPhoneTesterRef.current.stop();
          microPhoneTesterRef.current = null;
        } catch (err) {
          console.error("Error cleaning up microphone test:", err);
        }
      }

      // Clean up speaker test if active
      if (speakerTesterRef.current) {
        try {
          speakerTesterRef.current.destroy();
          speakerTesterRef.current = null;
        } catch (err) {
          console.error("Error cleaning up speaker test:", err);
        }
      }

      // Clear any timeouts
      if (micTestPlaybackTimeout) {
        clearTimeout(micTestPlaybackTimeout);
      }

      // Clean up context
      contextCleanup();
    };
  }, [contextCleanup, micTestPlaybackTimeout]);

  // ========== Join Meeting Handler ==========
  const handleJoin = async () => {
    // Check recording consent first
    if (!recordingConsent) {
      setShowConsentError(true);
      return;
    }

    // Clear any previous consent error
    setShowConsentError(false);

    // Stop the preview tracks to release the camera and microphone
    if (localVideoTrack) {
      await localVideoTrack.stop();
    }
    if (localAudioTrack) {
      await localAudioTrack.stop();
    }
    // Clean up module-level variables
    localVideoTrack = null;
    localAudioTrack = null;

    // Update context with current selections before joining
    updateContext({
      selectedCamera,
      selectedMic,
      selectedSpeaker,
      bgMode,
      userName,
      sessionName
    });

    // The context will be updated with the latest user/session name from the input fields
    await contextCleanup(); // Clean up any other context-related resources

    // Get meeting data from URL parameters
    const params = new URLSearchParams(location.search);
    const meetingId = params.get("meetingId");
    const userId = params.get("userId");

    // Get the proper names from agenda data
    const mentorName = agendaData?.mentorName || '';
    const menteeName = agendaData?.menteeName || '';

    if (meetingId && userId) {
      // Navigate to meeting with URL parameters and device selections including camera/mic states
      // Also pass the names to avoid showing IDs on video tiles
      const nameParams = new URLSearchParams();
      if (mentorName) nameParams.append('mentorName', mentorName);
      if (menteeName) nameParams.append('menteeName', menteeName);
      
      const nameQueryString = nameParams.toString();
      const separator = nameQueryString ? '&' : '';
      
      navigate(`/meeting/${meetingId}/${userId}?role=${role}&camera=${selectedCamera}&mic=${selectedMic}&speaker=${selectedSpeaker}&bgMode=${bgMode}&videoOff=${isVideoOff}&mute=${isMute}${separator}${nameQueryString}`);
    } else {
      // Fallback to old format
      const nameParams = new URLSearchParams();
      if (mentorName) nameParams.append('mentorName', mentorName);
      if (menteeName) nameParams.append('menteeName', menteeName);
      
      const nameQueryString = nameParams.toString();
      const separator = nameQueryString ? '&' : '';
      
      navigate(
        `/meeting?session=${encodeURIComponent(
          sessionName
        )}&user=${encodeURIComponent(userName)}&role=${role}&camera=${selectedCamera}&mic=${selectedMic}&speaker=${selectedSpeaker}&bgMode=${bgMode}&videoOff=${isVideoOff}&mute=${isMute}${separator}${nameQueryString}`
      );
    }
  };

  // ========== Enhanced Mic Testing Feature ==========
  const handleMicTest = async () => {
    // Stop any running speaker test before starting mic test
    if (isSpeakerTesting && speakerTesterRef.current) {
      try {
        speakerTesterRef.current.destroy();
        speakerTesterRef.current = null;
        setIsSpeakerTesting(false);
        console.log("🔇 Speaker test stopped (mic test starting)");
      } catch (err) {
        console.error("Error stopping speaker test before mic test:", err);
      }
    }

    // Check if microphone permission is granted
    if (!hasMicPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasMicPermission(true);
      } catch (err) {
        showPermissionError("⚠️ Either Camera or Microphone Access Needed\n\nTo join the meeting, please click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the 🔒 lock icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.");
        return;
      }
    }

    if (!localAudioTrack) {
      setError("Please start preview first");
      return;
    }

    // If already testing, stop the test
    if (microPhoneTesterRef.current) {
      try {
        microPhoneTesterRef.current.stop();
        microPhoneTesterRef.current = null;
        setIsMicTesting(false);
        setMicLevel(0);
        setMicTestPhase("idle");
        if (micTestPlaybackTimeout) {
          clearTimeout(micTestPlaybackTimeout);
          setMicTestPlaybackTimeout(null);
        }
      } catch (err) {
        console.error("Error stopping microphone test:", err);
      }
      return;
    }

    try {
      setIsMicTesting(true);
      setMicTestPhase("recording");
      setError(""); // Clear any previous errors

      // Use Web Audio API for reliable recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop audio level monitoring
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
        }

        setCustomMicTest(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          stream: null
        }));

        setMicTestPhase("ready");
        setMicTestCountdown(0);
        console.log("✅ Recording completed, ready for playback");

        // Automatically play back after 1 second
        setTimeout(() => {
          handleCustomPlayback(audioUrl);
        }, 1000);
      };

      // Start recording
      mediaRecorder.start();
      setCustomMicTest(prev => ({ ...prev, mediaRecorder, audioChunks: [], stream }));
      console.log("🎤 Started recording microphone test");

      // Set initial mic level to show it's working
      setMicLevel(10);

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setMicTestCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Automatically stop recording after 4 seconds
            if (mediaRecorder.state === "recording") {
              console.log("🛑 Stopping recording automatically after 4 seconds");
              mediaRecorder.stop();
              stream.getTracks().forEach(track => track.stop());
            }
            return 0;
          }
          // Simulate mic level changes during countdown for testing
          if (mediaRecorder.state === "recording") {
            setMicLevel(prev => Math.min(100, prev + Math.floor(Math.random() * 20)));
          }
          return prev - 1;
        });
      }, 1000);

      // Monitor audio levels
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        // Check if we're still recording (either by phase or mediaRecorder state)
        if (mediaRecorder && mediaRecorder.state === "recording") {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const level = Math.round((average / 255) * 100);
          setMicLevel(level);
          console.log("🎤 Mic level:", level, "raw average:", average);
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

    } catch (err) {
      console.error("❌ Error testing microphone:", err);

      // Provide more specific error messages
      let errorMessage = "Failed to test microphone";
      if (err.name === "NotAllowedError") {
        errorMessage = "⚠️ Either Camera or Microphone Access Needed\n\nTo join the meeting, please click \"Allow\" in the permission popup at the top of your browser.\n\nIf you don't see the popup:\n\nClick the icon next to the address bar\nGo to Site settings → Permissions\nSet Camera and Microphone to Allow\n\nTo apply the settings reload the page.";
        showPermissionError(errorMessage);
        return;
      } else if (err.name === "NotFoundError") {
        errorMessage = "Microphone not found. Please check your microphone connection.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Microphone is already in use by another application.";
      } else if (err.message) {
        errorMessage = `Microphone test failed: ${err.message}`;
      }

      setError(errorMessage);
      setIsMicTesting(false);
      setMicLevel(0);
      setMicTestPhase("idle");
    }
  };

  // ========== Play Recording Feature ==========
  const handlePlayRecording = async () => {
    if (!microPhoneTesterRef.current || micTestPhase !== "ready") {
      return;
    }

    try {
      setMicTestPhase("playing");

      // Play the recorded audio
      await microPhoneTesterRef.current.playRecording();

      // Set a timeout to reset the state after playback
      const timeout = setTimeout(() => {
        setMicTestPhase("idle");
        setIsMicTesting(false);
        setMicLevel(0);
        microPhoneTesterRef.current = null;
      }, 3000); // Assume 3 seconds for playback

      setMicTestPlaybackTimeout(timeout);

    } catch (err) {
      console.error("❌ Error playing recording:", err);
      setMicTestPhase("ready");
    }
  };

  // ========== Custom Playback Function ==========
  const handleCustomPlayback = (audioUrl) => {
    try {
      setMicTestPhase("playing");
      console.log("🎵 Starting custom playback...");

      const audio = new Audio(audioUrl);
      audio.onended = () => {
        console.log("✅ Playback completed");
        setMicTestPhase("idle");
        setIsMicTesting(false);
        setMicLevel(0);
        setMicTestCountdown(4);
        setCustomMicTest(prev => ({ ...prev, audioUrl: null }));
      };

      audio.onerror = (err) => {
        console.error("❌ Playback error:", err);
        setError("Failed to play recording");
        setMicTestPhase("ready");
      };

      audio.play();
      console.log("✅ Custom playback started successfully");

    } catch (err) {
      console.error("❌ Error in custom playback:", err);
      setError("Failed to play recording");
      setMicTestPhase("ready");
    }
  };

  // ========== Speaker Test ==========
  const [isSpeakerTesting, setIsSpeakerTesting] = useState(false);
  const speakerTesterRef = useRef(null);

  const handleSpeakerTest = () => {
    // Stop any running mic test before starting speaker test
    if (isMicTesting && microPhoneTesterRef.current) {
      try {
        microPhoneTesterRef.current.stop();
        microPhoneTesterRef.current = null;
        setIsMicTesting(false);
        setMicLevel(0);
        setMicTestPhase("idle");
        console.log("🎤 Mic test stopped (speaker test starting)");
      } catch (err) {
        console.error("Error stopping mic test before speaker test:", err);
      }
    }

    if (!localAudioTrack) {
      setError("Please start preview first");
      return;
    }

    // If already testing, stop the test
    if (isSpeakerTesting && speakerTesterRef.current) {
      try {
        speakerTesterRef.current.destroy();
        speakerTesterRef.current = null;
        setIsSpeakerTesting(false);
        console.log("🔇 Speaker test stopped");
      } catch (err) {
        console.error("Error stopping speaker test:", err);
      }
      return;
    }

    // Start speaker test
    try {
      speakerTesterRef.current = localAudioTrack.testSpeaker({
        speakerId: selectedSpeaker,
        onAnalyseFrequency: (v) => {
          // We don't need to track speaker output level
        },
      });
      setIsSpeakerTesting(true);
      console.log("🔊 Speaker test started");
    } catch (err) {
      console.error("Error testing speaker:", err);
      setError("Failed to test speaker");
    }
  };

  // Show simple loading during initialization
  if (isInitializing) {
    return (
      <div className="mainMeetingContainer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading preview...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mainMeetingContainer">
      {/* Header Component */}
      <Header
        userEmail={`${userName}@example.com`}
        userName={
          agendaData && (agendaData.mentorName || agendaData.menteeName)
            ? (agendaData.mentorId === userName 
                ? (agendaData.mentorName || agendaData.mentorId)
                : (agendaData.menteeName || agendaData.menteeId))
            : userName
        }
        meetingTitle={
          agendaData?.agenda ||
          "Personal Interview Round"
        }
        showTimer={false}
      />
      <div className="videoCallContainer">
        <div className="videoCallDetailBlock">
          <div className="meetingDetailWrapper">
            {/* LEFT PREVIEW */}
            <div className="leftMeetingDetail">
              <div className="videoBoxPreJoin">
                <video-player-container
                  className="local-preview-container"
                  style={{ width: "100%", height: "100%", background: "black" }}
                >
                  {/* Always use video-player for virtual backgrounds */}
                  <video-player
                    ref={videoRef}
                    id="local-preview-video"
                    style={{ width: "100%", height: "100%" }}
                  ></video-player>
                  <div className="buttonZoomSetting">
                    <button
                      onClick={async () => {
                        try {
                          if (isMute) {
                            // Unmute - start audio track
                            if (!localAudioTrack) {
                              localAudioTrack = ZoomVideo.createLocalAudioTrack(selectedMic);
                            }
                            await localAudioTrack.start();
                            await localAudioTrack.unmute();
                            setIsMute(false);
                          } else {
                            // Mute - stop audio track
                            if (localAudioTrack) {
                              await localAudioTrack.stop();
                              localAudioTrack = null;
                            }
                            setIsMute(true);
                          }
                        } catch (err) {
                          console.error("Error toggling audio:", err);
                          // Don't show user-facing errors for audio toggle failures
                          // These are often expected when audio is not started
                        }
                      }}
                    >
                      {isMute ? <UnMicroPhone /> : <MicroPhone />}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (isVideoOff) {
                            // Turn camera back on - recreate the track
                            if (!localVideoTrack) {
                              localVideoTrack =
                                ZoomVideo.createLocalVideoTrack(selectedCamera);
                            }
                            // Determine the correct video element based on background mode
                            const videoElement = bgMode === "none" ? videoRef.current : document.querySelector("#local-preview-video");

                            if (bgMode === "none") {
                              await localVideoTrack.start(videoElement);
                            } else if (bgMode === "blur") {
                              await localVideoTrack.start(videoElement, { imageUrl: "blur" });
                            } else if (bgMode === "image") {
                              await localVideoTrack.start(videoElement, {
                                imageUrl: "/lib/vb-resource/background.jpg",
                              });
                            }
                          } else {
                            // Turn camera off - completely release the track
                            if (localVideoTrack) {
                              await localVideoTrack.stop();

                              // Clear the video element
                              if (videoRef.current) {
                                videoRef.current.srcObject = null;
                              }

                              // Stop all tracks in the media stream to release camera
                              if (localVideoTrack.mediaStream) {
                                localVideoTrack.mediaStream
                                  .getTracks()
                                  .forEach((track) => {
                                    track.stop();
                                  });
                              }

                              // Release the track completely
                              localVideoTrack = null;
                            }
                          }
                          setIsVideoOff(!isVideoOff);
                        } catch (err) {
                          console.error("Error toggling video:", err);
                          // Don't show user-facing errors for video toggle failures
                          // These are often expected when video is not started
                        }
                      }}
                    >
                      {isVideoOff ? <OffVideoCamera /> : <VideoCamera />}
                    </button>
                  </div>
                </video-player-container>
              </div>
              {isLoading && <div className="loading">Loading...</div>}

              <div className="bottomControls">
                <div className="bottomControlsLeft">
                  <div className="instructions">< PolygonIcon />Check your mic and camera from icons shown above.</div>
                  <div className="instructions">< PolygonIcon /> Test your audio/ video and ensure you have a stable internet connection.</div>
                </div>
                <div className="bottomControlsRight mobHide">
                  <div className="buttonGroup">
                    <button
                      className={`commonTextBtn testMicrophone ${micTestPhase === "recording" ? "recording" :
                          micTestPhase === "playing" ? "playing" : ""
                        }`}
                      onClick={handleMicTest}
                      disabled={!hasMicPermission || isSpeakerTesting}
                    >
                      {micTestPhase === "recording" && <span className="recording-dot"></span>}
                      {micTestPhase === "playing" && <span className="playing-dot"></span>}
                      {micTestPhase === "recording"
                        ? `Recording... (${micTestCountdown}s)`
                        : micTestPhase === "playing"
                          ? "Playing..."
                          : "Test Microphone"}
                    </button>

                    <button
                      className={`commonTextBtn testSpeaker ${isSpeakerTesting ? "testing" : ""
                        }`}
                      onClick={handleSpeakerTest}
                      disabled={isMicTesting}
                    >
                      {isSpeakerTesting ? "Stop Speaker Test" : "Test Speaker"}
                    </button>
                  </div>

                  {/* <div className="mic-level-container">
                    <div className="mic-level-label">
                      <span>Mic Level</span>
                      <span className={`mic-level-value ${micLevel === 0 ? 'silent' : ''}`}>
                        {micLevel > 0 ? `${micLevel} dB` : 'Silent'}
                      </span>
                    </div>
                    <progress
                      id="mic-input-level"
                      value={micLevel}
                      max={100}
                      style={{ width: '120px' }}
                    ></progress>
                  </div> */}
                </div>


              </div>
            </div>

            {/* RIGHT SETTINGS */}
            <div className="rightMeetingDetail">
              <h2>Ready to Join?</h2>

              <div>
                <div className="commonDetail">
                  <span>Joinee: </span>
                  <p style={{textTransform: "capitalize"}}>{
                    agendaData && (agendaData.mentorName || agendaData.menteeName)
                      ? (agendaData.mentorId === userName 
                          ? (agendaData.mentorName || agendaData.mentorId)
                          : (agendaData.menteeName || agendaData.menteeId))
                      : userName
                  }</p>
                </div>
                <div className="commonDetail">
                  <span>Agenda: </span>
                  {agendaLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: "#666", fontStyle: "italic" }}>Loading agenda...</span>
                    </div>
                  ) : agendaError ? (
                    <p className="lineClamp" style={{ color: "#dc2626" }}>
                      ⚠️ {agendaError}
                    </p>
                  ) : agendaData ? (
                    <p className="lineClamp">
                      {agendaData.agenda || "No agenda available"}
                    </p>
                  ) : (
                    <p
                      className="lineClamp"
                      style={{ color: "#666", fontStyle: "italic" }}
                    >
                      Meeting Session - General discussion and collaboration
                    </p>
                  )}
                </div>


              </div>

              <div className="colGap12 settingOptionGroup mobHide">
                {/* Camera */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mic */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                  >
                    {speakerDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Background */}
                <div className="dropdownWrapper">
                  <select
                    className="dropdownMeeting"
                    value={bgMode}
                    onChange={(e) => setBgMode(e.target.value)}
                  >
                    {userType === "mentor" ? (
                      // Only Tetr Background for mentors
                      <option value="image">Tetr Background</option>
                    ) : (
                      // Only None and Blur for mentees
                      <>
                        <option value="none">No Virtual Background</option>
                        <option value="blur">Blur</option>
                      </>
                    )}
                  </select>
                </div>
              </div>


              <div className="agreeText">
                <input
                  type="checkbox"
                  checked={recordingConsent}
                  onChange={(e) => {
                    setRecordingConsent(e.target.checked);
                    // Clear consent error when user checks the box
                    if (e.target.checked) {
                      setShowConsentError(false);
                    }
                  }}
                />
                By participating, I give my consent to this session being recorded and stored for future reference.
              </div>
              {showConsentError && (
                <div className="warning-message" style={{
                  color: "#dc2626",
                  fontSize: "14px",
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span>⚠️</span>
                  <span>You must agree to recording to join the session.</span>
                </div>
              )}

              <button
                className="joinMeeting"
                onClick={handleJoin}
                disabled={isLoading || !selectedCamera || !selectedMic}
              >
                {isLoading ? (
                  "Starting..."
                ) : (
                  <>
                    Join Meeting <RightArrow />
                  </>
                )}
              </button>


            </div>
          </div>

          {/* Bottom Controls */}
        </div>
      </div>

      {/* Permission Dialog Modal */}
      {showPermissionDialog && (
        <div
          onClick={() => {
            setShowPermissionDialog(false);
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
                Permission Required
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
              {permissionDialogMessage}
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              {/* <button
                onClick={() => {
                  setShowPermissionDialog(false);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #666",
                  color: "#ccc",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button> */}
              {/* <button
                onClick={requestPermissions}
                style={{
                  background: "#007bff",
                  border: "none",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Retry
              </button> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreJoin;


