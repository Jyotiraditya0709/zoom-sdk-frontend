# Microphone Testing Feature Guide

## Overview

The enhanced microphone testing feature allows users to test their microphone before joining a meeting. It provides real-time visual feedback, manual recording and playback control, and comprehensive error handling.

## Features

### ✅ User Story Implementation

The microphone testing feature implements the following workflow:

1. **Prompt for microphone access** - Automatically requests microphone permissions if not granted
2. **Manual recording** - Starts recording immediately when button is clicked
3. **Real-time volume visualization** - Progress bar shows live microphone input levels
4. **Manual playback** - User clicks separate button to play the recording
5. **Visual feedback** - Shows recording status and microphone levels
6. **Clean UI** - No text messages, just visual indicators

### 🎯 Key Features

- **Permission Management**: Automatically handles microphone permission requests
- **Real-time Level Monitoring**: Shows microphone input levels in real-time
- **Manual Control**: Separate buttons for recording and playback
- **Visual Indicators**: Animated dots and color-coded button states
- **Error Handling**: Comprehensive error messages for different failure scenarios
- **Automatic Cleanup**: Proper cleanup of resources when component unmounts

## How It Works

### 1. Permission Check
```javascript
// Check if microphone permission is granted
if (!hasMicPermission) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    setHasMicPermission(true);
  } catch (err) {
    setError("Microphone permission is required to test audio. Please allow microphone access.");
    return;
  }
}
```

### 2. Manual Recording
```javascript
// Start microphone test with manual playback control
microPhoneTesterRef.current = localAudioTrack.testMicrophone({
  microphoneId: selectedMic,
  speakerId: selectedSpeaker,
  recordAndPlay: false, // Don't auto-play, let user control
  onAnalyseFrequency: (v) => {
    setMicLevel(Math.round(v * 100));
  },
  onStartRecording: () => {
    setMicTestPhase("recording");
  },
  onStopRecording: () => {
    setMicTestPhase("ready");
  },
});
```

### 3. Manual Playback
```javascript
// Play the recorded audio
const handlePlayRecording = async () => {
  if (!microPhoneTesterRef.current || micTestPhase !== "ready") {
    return;
  }

  try {
    setMicTestPhase("playing");
    await microPhoneTesterRef.current.playRecording();
    
    // Reset after playback
    setTimeout(() => {
      setMicTestPhase("idle");
      setIsMicTesting(false);
      setMicLevel(0);
      microPhoneTesterRef.current = null;
    }, 3000);
  } catch (err) {
    console.error("Error playing recording:", err);
    setMicTestPhase("ready");
  }
};
```

### 4. Visual States

The UI changes based on the current state:

- **Idle**: Default state with "Test Microphone" button
- **Recording**: Red button with pulsing animation and "Recording..." text
- **Ready**: Shows "Stop Test" button and "Play Recording" button
- **Playing**: Green button with "Playing..." text
- **Disabled**: Grayed out when permissions not granted or preview not started

## UI Components

### Button States
```css
.testMicrophone.recording {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
  animation: pulse 1.5s infinite;
}

.testMicrophone.playing {
  background: #28a745;
  border-color: #28a745;
  color: white;
}

.playRecording {
  background: #28a745;
  border-color: #28a745;
  color: white;
}
```

### Progress Bar
```css
#mic-input-level::-webkit-progress-value {
  background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
  border-radius: 3px;
  transition: width 0.3s ease;
}
```

### Visual Indicators
- **Recording Dot**: Red blinking dot during recording
- **Playing Dot**: Green pulsing dot during playback
- **Level Bar**: Gradient progress bar showing real-time microphone input level

## User Workflow

### Step-by-Step Process

1. **Click "Test Microphone"**
   - Button turns red with "Recording..." text
   - Red blinking dot appears
   - Progress bar shows real-time microphone levels
   - Recording starts immediately

2. **Speak into microphone**
   - Progress bar adjusts according to voice volume
   - Real-time feedback on microphone input

3. **Click "Stop Test"**
   - Recording stops
   - Button changes to "Stop Test"
   - "Play Recording" button appears

4. **Click "Play Recording"**
   - Button turns green with "Playing..." text
   - Green pulsing dot appears
   - Recorded audio plays back
   - Returns to idle state after playback

## Error Handling

The feature handles various error scenarios:

### Permission Errors
- `NotAllowedError`: User denied microphone access
- `NotFoundError`: No microphone device found
- `NotReadableError`: Microphone in use by another application

### Network/Browser Errors
- Playback not supported in certain browsers
- Connection issues
- SDK initialization failures

## Usage Examples

### Basic Usage
```jsx
{/* Test Microphone Button */}
<button
  className={`commonTextBtn testMicrophone ${
    micTestPhase === "recording" ? "recording" : 
    micTestPhase === "playing" ? "playing" : ""
  }`}
  onClick={handleMicTest}
  disabled={!hasMicPermission || !localAudioTrack}
>
  {micTestPhase === "recording" && <span className="recording-dot"></span>}
  {micTestPhase === "playing" && <span className="playing-dot"></span>}
  {micTestPhase === "recording" ? "Recording..." : 
   micTestPhase === "playing" ? "Playing..." : 
   micTestPhase === "ready" ? "Stop Test" : 
   "Test Microphone"}
</button>

{/* Play Recording Button (only show when ready) */}
{micTestPhase === "ready" && (
  <button
    className="commonTextBtn playRecording"
    onClick={handlePlayRecording}
  >
    <span className="playing-dot"></span>
    Play Recording
  </button>
)}

{/* Microphone level indicator */}
<progress
  id="mic-input-level"
  value={micLevel}
  max={100}
  style={{ width: '100%' }}
></progress>
```

## Browser Compatibility

### Supported Browsers
- Chrome 66+
- Firefox 60+
- Safari 12+
- Edge 79+

### Known Limitations
- Some browsers may not support audio playback in certain contexts
- Safari requires HTTPS for microphone access
- Mobile browsers may have different permission flows

## Troubleshooting

### Common Issues

1. **"Microphone permission denied"**
   - Solution: Click the microphone icon in the browser address bar and allow access

2. **"Microphone not found"**
   - Solution: Check microphone connection and try refreshing the page

3. **"Microphone in use by another application"**
   - Solution: Close other applications using the microphone (Zoom, Teams, etc.)

4. **"Playback not supported"**
   - Solution: This is normal in some browsers. The recording still works for testing.

### Debug Information
The feature includes console logging for debugging:
```javascript
console.log("🎤 Started recording microphone test");
console.log("✅ Recording completed, ready for playback");
console.error("❌ Error testing microphone:", err);
```

## Future Enhancements

Potential improvements for future versions:

1. **Custom Recording Duration**: Allow users to set recording length
2. **Audio Visualization**: Real-time waveform display
3. **Multiple Device Testing**: Test different microphones
4. **Audio Quality Metrics**: Provide feedback on audio quality
5. **Save Recordings**: Option to save test recordings locally

## Technical Implementation

### State Management
```javascript
const [isMicTesting, setIsMicTesting] = useState(false);
const [micLevel, setMicLevel] = useState(0);
const [micTestPhase, setMicTestPhase] = useState("idle"); // idle | recording | ready | playing
const [micTestPlaybackTimeout, setMicTestPlaybackTimeout] = useState(null);
const microPhoneTesterRef = useRef(null);
```

### Cleanup
```javascript
useEffect(() => {
  return () => {
    if (microPhoneTesterRef.current) {
      microPhoneTesterRef.current.stop();
      microPhoneTesterRef.current = null;
    }
    if (micTestPlaybackTimeout) {
      clearTimeout(micTestPlaybackTimeout);
    }
  };
}, [micTestPlaybackTimeout]);
```

This implementation provides a clean, user-friendly microphone testing experience with manual control over recording and playback, real-time volume visualization, and no distracting text messages.
