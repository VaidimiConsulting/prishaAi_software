/**
 * server.js — Prisha Interiors (ek hi server: Calculator + AI Studio)
 *
 *   /            -> Price Calculator
 *   /admin       -> Admin panel (rates)
 *   /studio/     -> AI Design Studio
 *   /api/...     -> calculator API
 *   /api/studio  -> AI Studio API
 *
 * DEV:        npm run dev   (root se)  -> http://localhost:5173
 * PRODUCTION: npm run build -> npm start -> http://localhost:3001
 */

require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { adminAuth } = require('./middleware/auth');
const { IMG_DIR } = require('./config/paths');

const ordersRouter      = require('./routes/orders');
const priceConfigRouter = require('./routes/priceConfig');
const studioRouter      = require('./studio');
const { ensureSchema }  = require('./config/migrate');

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // cPanel / nginx ke peeche sahi IP milne ke liye

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: isProd ? false : '*' }));
app.use(express.json({ limit: '2mb' }));

// ── Calculator API ──────────────────────────────────────────────
app.use('/api/orders', ordersRouter);
app.use('/generated-pdfs', express.static(path.join(__dirname, 'generated-pdfs')));
app.get('/api/orders/pdf/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'generated-pdfs', filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'PDF file not found' });
  }
});
app.use('/api/admin/price-config', adminAuth, priceConfigRouter);

// ── AI Studio API + generated images ────────────────────────────
app.use('/api/studio', studioRouter);
app.use('/files', express.static(IMG_DIR, { maxAge: '30d', immutable: true }));
app.use('/design-images', express.static(path.join(__dirname, 'design-images')));

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY) })
);

// ── Built React frontend (npm run build -> backend/public) ──────
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// /studio -> AI Studio page, baaki sab -> Calculator (/admin bhi isi me hai)
app.get(/^\/studio(\/.*)?$/, (req, res) => res.sendFile(path.join(publicDir, 'studio', 'index.html')));
app.get(/^(?!\/api|\/files|\/design-images|\/generated-pdfs).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Start server ────────────────────────────────────────────────
ensureSchema();

app.listen(PORT, () => {
  const base = isProd ? `http://localhost:${PORT}` : 'http://localhost:5173';
  console.log(`\n✅ Prisha Interiors running (server port ${PORT})`);
  console.log(`   Calculator : ${base}/`);
  console.log(`   AI Studio  : ${base}/studio/`);
  console.log(`   Admin      : ${base}/admin`);
  console.log(`   Admin login: ${process.env.ADMIN_USER || 'admin'} / ${process.env.ADMIN_PASS || 'admin@123'}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('   ⚠️  OPENAI_API_KEY .env me nahi hai — AI Studio image nahi bana payega.');
  } else {
    try {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      client.models.list().catch(() => {});
    } catch { /* ignore */ }
  }
  console.log('');
});
