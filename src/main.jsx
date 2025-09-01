import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

// Register service worker for cross-origin isolation (required for Zoom SDK remote video)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cross-origin-isolation-sw.js')
      .then(registration => {
        console.log('🔒 Cross-origin isolation service worker registered:', registration);
      })
      .catch(error => {
        console.error('❌ Failed to register cross-origin isolation service worker:', error);
      });
  });
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
