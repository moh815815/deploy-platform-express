/**
 * Deploy Platform — Express + Multer Edition
 *
 * Install:  npm install
 * Run:      node server.js   (or: npm start)
 * Dev:      npm run dev      (hot-reload via nodemon)
 *
 * Differences vs pure-Node version:
 *  ✅ express      → clean routing, middleware, error handling
 *  ✅ multer       → battle-tested multipart/file-upload handling
 *  ✅ cors         → one-liner CORS middleware
 *  ✅ dotenv       → .env support for tokens (NETLIFY_TOKEN, etc.)
 *  ✅ express.json → built-in JSON body parser (no manual Buffer.concat)
 */

'use strict';

require('dotenv').config();

const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');
const os       = require('os');
const fs       = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT       = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'deploy-uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_SIZE   = 100 * 1024 * 1024; // 100 MB

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Multer storage ───────────────────────────────────────────────────────────
// Preserves original filename sanitised, stores in UPLOAD_DIR with UUID prefix
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req,  file, cb) => {
    const id   = crypto.randomUUID();
    // Preserve compound extension: archive.tar.gz → .tar.gz
    const base = path.basename(file.originalname);
    const dot  = base.indexOf('.');
    const ext  = dot === -1 ? '.bin' : base.slice(dot);
    cb(null, id + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  // Accept any file type — the client/user decides what to deploy
});

// ─── Platform Definitions ─────────────────────────────────────────────────────
const PLATFORMS = {
  netlify: {
    name: 'Netlify', emoji: '🔺', color: '#00ad9f', domain: 'netlify.app',
    steps : ['Parsing project...', 'Optimizing assets...', 'Deploying to CDN...', 'Setting up SSL...', 'Live!'],
    timing: [800, 1200, 1500, 800, 400],
  },
  vercel: {
    name: 'Vercel', emoji: '▲', color: '#ffffff', domain: 'vercel.app',
    steps : ['Analyzing framework...', 'Building project...', 'Uploading to Edge...', 'Assigning domain...', 'Ready!'],
    timing: [600, 2000, 1000, 600, 300],
  },
  github: {
    name: 'GitHub Pages', emoji: '🐙', color: '#8957e5', domain: 'github.io',
    steps : ['Creating repo...', 'Pushing files...', 'Enabling Pages...', 'Building site...', 'Published!'],
    timing: [1000, 1500, 800, 1200, 400],
  },
  surge: {
    name: 'Surge.sh', emoji: '⚡', color: '#f75c00', domain: 'surge.sh',
    steps : ['Connecting...', 'Uploading files...', 'Publishing...', 'Done!'],
    timing: [400, 1800, 600, 300],
  },
  cloudflare: {
    name: 'Cloudflare Pages', emoji: '🌤', color: '#f48120', domain: 'pages.dev',
    steps : ['Authenticating...', 'Uploading assets...', 'Deploying globally...', 'Purging cache...', 'Live on Edge!'],
    timing: [700, 1600, 1200, 500, 300],
  },
  render: {
    name: 'Render', emoji: '🟢', color: '#46e3b7', domain: 'onrender.com',
    steps : ['Cloning...', 'Installing deps...', 'Building...', 'Starting service...', 'Running!'],
    timing: [500, 2500, 2000, 800, 400],
  },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function simulateDeploy(platform, fileName, sendEvent) {
  const config = PLATFORMS[platform];
  if (!config) return { success: false, error: 'Unknown platform' };

  const slug = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'project';

  const deployUrl = `${slug}-${crypto.randomBytes(3).toString('hex')}.${config.domain}`;

  for (let i = 0; i < config.steps.length; i++) {
    const progress = Math.round(((i + 1) / config.steps.length) * 100);
    sendEvent({ platform, type: 'progress', step: config.steps[i], progress });
    await sleep(config.timing[i]);
  }

  if (Math.random() > 0.05) {
    sendEvent({ platform, type: 'done', url: deployUrl, progress: 100 });
    return { success: true, url: deployUrl, platform };
  }
  sendEvent({ platform, type: 'error', message: 'Deploy failed — please try again' });
  return { success: false, error: 'Deploy failed' };
}

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));   // JSON bodies (small — just IDs and config)
app.use(express.static(PUBLIC_DIR));       // Serve frontend

// ── GET /api/platforms ────────────────────────────────────────────────────────
app.get('/api/platforms', (_req, res) => {
  const list = Object.entries(PLATFORMS).map(([id, p]) => ({
    id, name: p.name, emoji: p.emoji, color: p.color, domain: p.domain,
  }));
  res.json(list);
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Extract the UUID portion of the saved filename as the fileId
  const savedBasename = path.basename(req.file.filename);
  const dot           = savedBasename.indexOf('.');
  const fileId        = dot === -1 ? savedBasename : savedBasename.slice(0, dot);

  console.log(
    `[UPLOAD] ${req.file.originalname}  ` +
    `${(req.file.size / 1048576).toFixed(2)} MB  →  ${fileId}`
  );

  res.json({
    success : true,
    fileId,
    fileName: req.file.originalname,
    size    : req.file.size,
  });
});

// ── POST /api/deploy  (SSE stream) ────────────────────────────────────────────
app.post('/api/deploy', async (req, res) => {
  const { fileId, fileName, platforms: selectedPlatforms } = req.body;

  if (!fileId || !Array.isArray(selectedPlatforms) || !selectedPlatforms.length) {
    return res.status(400).json({ error: 'Missing fileId or platforms array' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type'     : 'text/event-stream',
    'Cache-Control'    : 'no-cache',
    'Connection'       : 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Helper: write only if connection still open
  const sendEvent = data => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Clean up if client disconnects early
  req.on('close', () => res.end());

  sendEvent({ type: 'start', platforms: selectedPlatforms });

  try {
    const results = await Promise.all(
      selectedPlatforms.map(p => simulateDeploy(p, fileName || 'project', sendEvent))
    );
    sendEvent({ type: 'complete', results });
  } catch (err) {
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

// ── Multer error handler ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max size: ${MAX_SIZE / 1048576} MB` });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  🚀 Deploy Platform (Express) — Running  ║
║  http://localhost:${PORT}                    ║
╚══════════════════════════════════════════╝

  Endpoints:
    GET  /api/platforms  →  list all platforms
    POST /api/upload     →  upload file (multipart)
    POST /api/deploy     →  start deploy (SSE stream)
    GET  /*              →  serve frontend SPA

  Environment:
    PORT=${PORT}
    UPLOAD_DIR=${UPLOAD_DIR}
    NETLIFY_TOKEN=${process.env.NETLIFY_TOKEN ? '✅ set' : '❌ not set (simulation mode)'}
    VERCEL_TOKEN=${process.env.VERCEL_TOKEN  ? '✅ set' : '❌ not set (simulation mode)'}
  `);
});
