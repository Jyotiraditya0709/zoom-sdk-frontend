# Zoom Video SDK Frontend with React

A comprehensive React frontend application for Zoom Video SDK integration with virtual backgrounds, screen sharing, and real-time video conferencing capabilities.

## 🚀 Features

- **Real-time Video Conferencing**: Join meetings with audio/video capabilities
- **Virtual Background Support**: Blur background or use custom images
- **Screen Sharing**: Share your screen with remote participants
- **Preview Mode**: Test camera and microphone before joining meetings
- **Responsive Design**: Works on desktop and mobile devices
- **Meeting Controls**: Mute/unmute, start/stop video, leave meeting
- **Participant Management**: View all participants and their status
- **Recording Integration**: Connect with backend for recording processing

## 📋 Prerequisites

- Node.js 18+
- Modern web browser with WebRTC support
- Zoom Video SDK credentials
- Backend server running (for signature generation)

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # Backend URL (for signature generation)
   VITE_BACKEND_URL=http://localhost:4000
   
   # For production, use your deployed backend URL
   # VITE_BACKEND_URL=https://your-backend-domain.com
   ```

3. **Configure Zoom Video SDK:**
   - Get your Zoom Video SDK credentials from the [Zoom Developer Console](https://developers.zoom.us/)
   - Add them to your backend's `.env` file (see backend README)

## 🚀 Running the Application

### Development Mode:
```bash
npm run dev
```

### Production Build:
```bash
npm run build
npm run preview
```

## 🎯 Application Structure

### Core Components

#### **Preview Page** (`/src/feature/preview/`)
- **Camera Preview**: Test your camera before joining meetings
- **Virtual Background Selection**: Choose from blur, custom images, or none
- **Microphone Testing**: Verify audio input
- **Meeting Setup**: Enter session name and role

#### **Meeting Page** (`/src/feature/meeting/`)
- **Video Grid**: Display all participants in a responsive grid
- **Screen Sharing**: Start/stop screen sharing with remote participants
- **Meeting Controls**: Mute, video toggle, leave meeting
- **Participant List**: View all participants and their status
- **Recording Controls**: Start/stop recording (host only)

### Key Features

#### **Virtual Background System**
```javascript
// Virtual background modes
const bgModes = {
  none: null,
  blur: 'blur',
  image: 'custom-image-url'
};

// Apply virtual background
await mediaStream.updateVirtualBackground({
  imageUrl: bgMode === 'blur' ? 'blur' : bgMode
});
```

#### **Screen Sharing**
```javascript
// Start screen sharing
await mediaStream.startShareScreen(videoElement);

// Stop screen sharing  
await mediaStream.stopShareScreen();
```

#### **Video Rendering**
```javascript
// Attach video to DOM element
await mediaStream.attachVideo(userId, videoElement);

// Detach video
await mediaStream.detachVideo(userId);
```

## 🎨 UI Components

### **Video Player Components**
- `<video-player-container>`: Container for Zoom SDK video elements
- `<video-player>`: Custom video element for virtual backgrounds
- `<video>`: Standard HTML5 video for regular streams

### **Meeting Controls**
- **Microphone Toggle**: Mute/unmute audio
- **Camera Toggle**: Start/stop video
- **Screen Share**: Share screen with participants
- **Leave Meeting**: Exit meeting gracefully
- **End Meeting**: Host-only option to end for all

### **Participant Management**
- **Video Grid**: Responsive grid layout for participants
- **Participant Cards**: Individual cards with video and status
- **Screen Share View**: Dedicated area for shared content

## 🔧 Configuration

### **Zoom Video SDK Setup**
```javascript
// Initialize Zoom Video SDK
const client = ZoomVideo.createClient();

await client.init('en-US', 'Global', {
  patchJsMedia: true,
  enforceVirtualBackground: true // Required for virtual backgrounds
});
```

### **Virtual Background Configuration**
```javascript
// Enable virtual background support
const initOptions = {
  enforceVirtualBackground: true,
  patchJsMedia: true
};

// Use video-player elements for virtual backgrounds
<video-player-container>
  <video-player id="local-video"></video-player>
</video-player-container>
```

### **Screen Sharing Setup**
```javascript
// Screen share container (always present, hidden when not sharing)
<div 
  ref={screenShareContainerRef}
  style={{
    display: 'block',
    opacity: isSharingScreen ? 1 : 0,
    visibility: isSharingScreen ? 'visible' : 'hidden'
  }}
>
  <video id="screen-share-video" />
</div>
```

## 🎯 Meeting Flow

### **1. Preview Phase**
1. User opens application
2. Camera preview starts automatically
3. User can test microphone and camera
4. User selects virtual background (none/blur/custom)
5. User enters session name and role
6. User clicks "Join Meeting"

### **2. Meeting Phase**
1. User joins meeting with selected settings
2. Virtual background is applied automatically
3. User can see other participants
4. User can start screen sharing
5. User can control audio/video
6. User can leave meeting

### **3. Screen Sharing**
1. User clicks "Share Screen" button
2. Screen share container becomes visible
3. Video element gets proper dimensions
4. Screen share starts and is sent to remote participants
5. Remote participants receive `active-share-change` event
6. Screen share is displayed to all participants

## 🎨 Styling

### **CSS Architecture**
- **Component-specific CSS**: Each component has its own CSS file
- **Responsive Design**: Mobile-first approach
- **Zoom SDK Integration**: Custom styling for video elements
- **Virtual Background**: Special styling for video-player elements

### **Key CSS Classes**
```css
/* Video containers */
.video-player-container { /* Zoom SDK required container */ }
.video-player { /* Custom video element for virtual backgrounds */ }

/* Screen sharing */
.screen-share-container { /* Always present, conditionally visible */ }
.screen-share-video { /* Video element for screen sharing */ }

/* Meeting controls */
.meeting-controls { /* Bottom control bar */ }
.participant-grid { /* Responsive video grid */ }
```

## 🔍 Debugging

### **Common Issues**

#### **Virtual Background Not Working**
```javascript
// Ensure enforceVirtualBackground is enabled
await client.init('en-US', 'Global', {
  enforceVirtualBackground: true
});

// Use video-player elements
<video-player-container>
  <video-player id="local-video"></video-player>
</video-player-container>
```

#### **Screen Share Not Visible to Remote Participants**
```javascript
// Ensure video element has dimensions before starting share
videoElement.width = 1920;
videoElement.height = 1080;
videoElement.style.display = 'block';

// Add delay for DOM update
await new Promise(resolve => setTimeout(resolve, 100));
```

#### **Video Element Not Rendering**
```javascript
// Check if element exists and has proper dimensions
if (videoElement && videoElement.offsetWidth > 0) {
  await mediaStream.attachVideo(userId, videoElement);
}
```

### **Console Logging**
The application includes comprehensive logging for debugging:
- Webhook events and processing
- Screen share lifecycle
- Video attachment/detachment
- Participant join/leave events

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │───▶│  Zoom Video SDK │───▶│  Backend API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Preview Page   │    │  Meeting Page   │    │  Signature Gen  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Virtual Bg      │    │ Screen Sharing  │
└─────────────────┘    └─────────────────┘
```

## 🔧 Development

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### **File Structure**
```
src/
├── feature/
│   ├── preview/           # Preview page components
│   │   ├── preview.jsx    # Main preview component
│   │   ├── Preview.css    # Preview styles
│   │   └── ZoomContext.jsx # Context for bg mode
│   └── meeting/           # Meeting page components
│       ├── MeetingPage.jsx # Main meeting component
│       └── MeetingPage.css # Meeting styles
├── items/                 # Shared components
├── main.jsx              # App entry point
└── index.css             # Global styles
```

### **State Management**
- **React Context**: For sharing virtual background mode
- **useState**: For local component state
- **useEffect**: For side effects and cleanup
- **useRef**: For DOM element references

## 🚨 Error Handling

The application includes comprehensive error handling:
- **Network errors**: Graceful fallback for API calls
- **Media errors**: User-friendly messages for camera/mic issues
- **SDK errors**: Proper cleanup and error recovery
- **Screen share errors**: Retry logic for failed screen sharing

## 🔮 Future Enhancements

- **Chat Integration**: Real-time messaging between participants
- **File Sharing**: Share files during meetings
- **Recording UI**: Visual indicators for recording status
- **Advanced Virtual Backgrounds**: AI-powered background removal
- **Meeting Analytics**: Track meeting metrics and engagement
- **Accessibility**: Screen reader support and keyboard navigation
- **PWA Support**: Progressive Web App capabilities
- **Offline Mode**: Basic functionality without internet

## 📝 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the [Zoom Video SDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- Review the backend README for API integration
- Check console logs for debugging information
