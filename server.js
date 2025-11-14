import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Set Cross-Origin Isolation headers (REQUIRED for Zoom SDK SharedArrayBuffer support)
// Note: 'require-corp' is required for SharedArrayBuffer, but it blocks external resources
// Google Fonts and other external resources have been removed to comply with this policy
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res, path) => {
    // Ensure all static files also have the required headers
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
}));

// Handle all routes by serving index.html (for React Router client-side routing)
app.get('*', (req, res) => {
  try {
    const html = readFileSync(join(__dirname, 'dist', 'index.html'), 'utf8');
    res.send(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Error serving the application');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📦 Serving files from: ${join(__dirname, 'dist')}`);
});

