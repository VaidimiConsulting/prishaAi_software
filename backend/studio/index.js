const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const crypto = require("crypto");

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1-mini";
const DEFAULT_QUALITY = process.env.IMAGE_QUALITY || "low";
const MAX_IMAGES = Math.max(1, parseInt(process.env.MAX_IMAGES || "8", 10));
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const QUALITIES = ["low", "medium", "high"];

const { DATA_DIR, IMG_DIR } = require("../config/paths");
const DB_FILE = path.join(DATA_DIR, "db.json");

/* ------------------------------------------------------------------ */
/* Tiny JSON database (users + chats). No extra install needed.        */
/* ------------------------------------------------------------------ */
let db = { users: [], chats: [] };
try {
  if (fs.existsSync(DB_FILE)) db = { users: [], chats: [], ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
} catch (e) {
  console.error("Could not read db.json, starting fresh:", e.message);
}
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    fs.writeFile(tmp, JSON.stringify(db), (err) => {
      if (err) return console.error("DB save failed:", err.message);
      fs.rename(tmp, DB_FILE, () => {});
    });
  }, 150);
}

// Stable JWT secret: env > saved file > newly generated
function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, ".secret");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  const s = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(f, s);
  return s;
}
const JWT_SECRET = getJwtSecret();

/* ------------------------------------------------------------------ */
/* Router + middleware (mounted at /api/studio by the main server)     */
/* ------------------------------------------------------------------ */
const router = express.Router();

const MAX_UPLOAD_PHOTOS = 4;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Support any image size up to 50MB
});

const photosUpload = upload.fields([
  { name: "photos", maxCount: 20 },
  { name: "photo", maxCount: 20 },
]);

function uploadPhotosMiddleware(req, res, next) {
  photosUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Image size is too large (max 50MB allowed)." });
      }
      return res.status(400).json({ error: err.message || "Image upload failed." });
    }

    const files = [];
    if (req.files) {
      if (Array.isArray(req.files.photos)) files.push(...req.files.photos);
      if (Array.isArray(req.files.photo)) files.push(...req.files.photo);
    }
    if (req.file && !files.includes(req.file)) {
      files.push(req.file);
    }

    if (files.length > MAX_UPLOAD_PHOTOS) {
      return res.status(400).json({ error: "Maximum 4 photos allowed." });
    }

    req.uploadedPhotos = files;
    req.file = files[0] || null;
    next();
  });
}

const uploadSinglePhoto = uploadPhotosMiddleware;

let openaiClient = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to backend/.env before generating images.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      maxRetries: 1,
    });
  }
  return openaiClient;
}

let isWarmedUp = false;
async function warmupOpenAI() {
  if (isWarmedUp || !process.env.OPENAI_API_KEY) return;
  try {
    const client = getClient();
    // Warm up DNS, TCP and TLS connection to OpenAI in background
    await client.models.list().catch(() => {});
    isWarmedUp = true;
  } catch {
    // Ignore background warmup errors
  }
}

// Background warm up on server/module load so 1st prompt is just as fast as 2nd prompt
setTimeout(() => {
  warmupOpenAI();
}, 200);

// very small in-memory rate limiter for login/register
const attempts = new Map();
function authLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 60_000);
  if (list.length >= 15) return res.status(429).json({ error: "Too many attempts. Please wait a minute." });
  list.push(now);
  attempts.set(key, list);
  next();
}

/* ------------------------------------------------------------------ */
/* Auth helpers                                                        */
/* ------------------------------------------------------------------ */
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatar: u.avatar || "",
  provider: u.googleId ? "google" : "email",
});
const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" });

// Identify request owner: logged-in user (Bearer token) OR guest device id.
function identify(req, res, next) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      const user = db.users.find((u) => u.id === payload.sub);
      if (user) {
        req.owner = { id: user.id, user };
        return next();
      }
    } catch {
      /* fall through */
    }
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  const guest = req.headers["x-guest-id"];
  if (typeof guest === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(guest)) {
    req.owner = { id: `g_${guest}`, user: null };
    return next();
  }
  res.status(401).json({ error: "Not identified." });
}
function requireUser(req, res, next) {
  if (!req.owner.user) return res.status(401).json({ error: "Please sign in first." });
  next();
}

/* ------------------------------------------------------------------ */
/* Basic routes                                                        */
/* ------------------------------------------------------------------ */
router.get("/config", (req, res) => {
  warmupOpenAI(); // Pre-warm connection when user opens Studio page
  res.json({
    googleClientId: GOOGLE_CLIENT_ID,
    maxImages: MAX_IMAGES,
    defaultQuality: QUALITIES.includes(DEFAULT_QUALITY) ? DEFAULT_QUALITY : "low",
  });
});

/* ------------------------------------------------------------------ */
/* Auth routes                                                         */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/auth/register", authLimiter, async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "This email is already registered. Please log in." });
  }
  const user = {
    id: "u_" + crypto.randomUUID(),
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    avatar: "",
    createdAt: Date.now(),
  };
  db.users.push(user);
  saveDb();
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/auth/login", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.users.find((u) => u.email === email);
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/auth/google", authLimiter, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(400).json({ error: "Google login is not configured (GOOGLE_CLIENT_ID missing in backend/.env)." });
  }
  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: String(req.body.credential || ""),
      audience: GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p || !p.email || p.email_verified === false) {
      return res.status(401).json({ error: "Google account email is not verified." });
    }
    const email = p.email.toLowerCase();
    let user = db.users.find((u) => u.googleId === p.sub || u.email === email);
    if (!user) {
      user = { id: "u_" + crypto.randomUUID(), name: p.name || email.split("@")[0], email, avatar: p.picture || "", createdAt: Date.now() };
      db.users.push(user);
    }
    user.googleId = p.sub;
    if (!user.avatar && p.picture) user.avatar = p.picture;
    saveDb();
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

router.get("/me", identify, requireUser, (req, res) => res.json({ user: publicUser(req.owner.user) }));

router.put("/me", identify, requireUser, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Name cannot be empty." });
  req.owner.user.name = name;
  saveDb();
  res.json({ user: publicUser(req.owner.user) });
});

router.post("/me/avatar", identify, requireUser, upload.single("avatar"), (req, res) => {
  if (!req.file || !/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: "Please choose an image." });
  const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
  const file = `av_${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(IMG_DIR, file), req.file.buffer);
  req.owner.user.avatar = `/files/${file}`;
  saveDb();
  res.json({ user: publicUser(req.owner.user) });
});

/* ------------------------------------------------------------------ */
/* Chat history routes                                                 */
/* ------------------------------------------------------------------ */
const findChat = (req) => db.chats.find((c) => c.id === req.params.id && c.ownerId === req.owner.id);

router.get("/chats", identify, (req, res) => {
  const list = db.chats
    .filter((c) => c.ownerId === req.owner.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, thumb: c.thumb || "" }));
  res.json({ chats: list });
});

router.post("/chats", identify, (req, res) => {
  const chat = {
    id: crypto.randomUUID(),
    ownerId: req.owner.id,
    title: String(req.body.title || "New design").slice(0, 80),
    thumb: "",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  db.chats.push(chat);
  saveDb();
  res.json({ chat: { id: chat.id, title: chat.title, updatedAt: chat.updatedAt, thumb: "" } });
});

router.get("/chats/:id", identify, (req, res) => {
  const chat = findChat(req);
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  res.json({ chat: { id: chat.id, title: chat.title, messages: chat.messages } });
});

router.put("/chats/:id", identify, (req, res) => {
  const chat = findChat(req);
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  if (typeof req.body.title === "string" && req.body.title.trim()) chat.title = req.body.title.trim().slice(0, 80);
  if (Array.isArray(req.body.messages)) {
    chat.messages = req.body.messages.slice(-200);
    const firstPhoto = chat.messages.find((m) => m.role === "user" && (m.photoUrl || (Array.isArray(m.photoUrls) && m.photoUrls[0])));
    chat.thumb = firstPhoto ? (firstPhoto.photoUrl || firstPhoto.photoUrls[0]) : "";
  }
  chat.updatedAt = Date.now();
  saveDb();
  res.json({ ok: true });
});

router.delete("/chats/:id", identify, (req, res) => {
  db.chats = db.chats.filter((c) => !(c.id === req.params.id && c.ownerId === req.owner.id));
  saveDb();
  res.json({ ok: true });
});

router.delete("/chats", identify, (req, res) => {
  db.chats = db.chats.filter((c) => c.ownerId !== req.owner.id);
  saveDb();
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Prompt understanding                                                */
/* ------------------------------------------------------------------ */
const NUM_WORDS = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, chah: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8,
};
const ONLY_RE = new RegExp(
  `\\b(?:sirf|only|just)\\s+(\\d{1,2}|${Object.keys(NUM_WORDS).join("|")})\\b`,
  "i"
);
const COUNT_RE = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(NUM_WORDS).join("|")})\\s*(?:x\\s*)?` +
    `(?:images?|imgs?|photos?|pics?|pictures?|designs?|options?|variations?|variants?|results?|versions?|outputs?|tasveer(?:ein|en)?|foto|pieces?)\\b`,
  "i"
);

// "give me 3 images" / "do image" / "5 designs" / "sirf 1" -> count. null if user didn't say.
function parseCount(text) {
  if (!text) return null;
  const onlyM = ONLY_RE.exec(text);
  if (onlyM) {
    const raw = onlyM[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUM_WORDS[raw];
    if (n >= 1) return n;
  }
  const m = COUNT_RE.exec(text);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUM_WORDS[raw];
  return n >= 1 ? n : null;
}

const BG_REMOVE_RES = [
  /\b(remove|removed|removing|hata\w*|delete|erase|cut\s?out|nikal\w*|clear|kaat\w*)\b[^.\n]{0,25}\b(background|backdrop|bg|peeche\s+ka)\b/i,
  /\b(background|backdrop|bg)\b\s*(ko\s*|ka\s*)?\b(remove|removal|hata\w*|delete|erase|nikal\w*|transparent|kaat\w*)/i,
  /\b(without|no)\s+(a\s+)?(background|bg)\b/i,
  /\btransparent\s+(background|bg)\b/i,
  /\bbg\s*remove\b/i,
];
const wantsBgRemoval = (t) => BG_REMOVE_RES.some((re) => re.test(t || ""));

function buildPrompt(userPrompt, hasPhoto, transparent) {
  if (!hasPhoto) {
    return `${userPrompt}\n\nFollow this request exactly. Do not add extra objects, text, logos or watermarks that were not asked for.`;
  }
  const rules = [
    "You are a precise image editor. Apply ONLY the instruction below to the provided photo.",
    `INSTRUCTION: """${userPrompt}"""`,
    "STRICT RULES:",
    "- Change only what the instruction explicitly mentions. Everything else must stay pixel-faithful to the original: same objects, layout, camera angle, framing, lighting, colors and proportions.",
    "- Do NOT add any new object, person, furniture, decoration, text, logo, watermark, border or effect that was not requested.",
    "- If the instruction removes something, remove it completely and leave nothing new in its place (no replacement items, no invented background details).",
    "- If the instruction describes an interior style or decor, restyle only the decor/finishes requested while keeping the room's structure, walls, windows and perspective unchanged.",
  ];
  if (transparent) {
    rules.push(
      "- BACKGROUND REMOVAL: keep only the main subject exactly as it is, with clean edges, and make the ENTIRE background fully transparent. Do not add any new background, floor, shadow, gradient or color."
    );
  }
  return rules.join("\n");
}

function pickSize(aspect) {
  const a = Number(aspect);
  if (!a || !isFinite(a)) return "1024x1024";
  if (a > 1.2) return "1536x1024";
  if (a < 0.83) return "1024x1536";
  return "1024x1024";
}

/* ------------------------------------------------------------------ */
/* Image generation                                                    */
/* ------------------------------------------------------------------ */
function extFromMime(m) {
  if (/png/.test(m)) return "png";
  if (/webp/.test(m)) return "webp";
  return "jpg";
}

const INPUT_FIDELITY = process.env.INPUT_FIDELITY || "low";
const IMAGE_TIMEOUT_SEC = Math.max(10, parseInt(process.env.IMAGE_TIMEOUT_SEC || "300", 10));

// In-memory jobs storage (cleaned up after 30 minutes)
const jobs = new Map();
const JOB_LIFETIME_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_LIFETIME_MS) {
      jobs.delete(id);
    }
  }
}, 60 * 1000);

async function callImageApi(client, { photo, prompt, size, quality, transparent }, signal) {
  const base = {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: size || "1024x1024",
    quality: quality || "low",
    output_format: transparent ? "png" : "jpeg",
  };
  if (transparent) {
    base.background = "transparent";
  } else {
    base.output_compression = 80;
  }

  const run = async (extra) => {
    if (photo) {
      const image = await toFile(photo.buffer, photo.name, { type: photo.mime });
      return client.images.edit(
        { ...base, ...extra, image },
        { signal, timeout: IMAGE_TIMEOUT_SEC * 1000 }
      );
    }
    return client.images.generate(
      { ...base, ...extra },
      { signal, timeout: IMAGE_TIMEOUT_SEC * 1000 }
    );
  };

  try {
    const extra = photo && IMAGE_MODEL === "gpt-image-1" ? { input_fidelity: INPUT_FIDELITY } : {};
    return await run(extra);
  } catch (err) {
    const msg = String(err && err.message);
    if (err.status === 400 && /input_fidelity|output_compression|output_format|background|unknown|unsupported/i.test(msg)) {
      const minimal = { ...base };
      delete minimal.output_compression;
      delete minimal.input_fidelity;
      if (photo) {
        const image = await toFile(photo.buffer, photo.name, { type: photo.mime });
        return client.images.edit(
          { ...minimal, image },
          { signal, timeout: IMAGE_TIMEOUT_SEC * 1000 }
        );
      }
      return client.images.generate(
        minimal,
        { signal, timeout: IMAGE_TIMEOUT_SEC * 1000 }
      );
    }
    throw err;
  }
}

router.post("/generate", identify, uploadPhotosMiddleware, async (req, res) => {
  const userPrompt = String(req.body.prompt || "").trim();
  if (!userPrompt) return res.status(400).json({ error: "Please write what you want." });

  const uploadedFiles = req.uploadedPhotos || (req.file ? [req.file] : []);
  if (uploadedFiles.length > MAX_UPLOAD_PHOTOS) {
    return res.status(400).json({ error: "Maximum 4 photos allowed." });
  }

  let client;
  try {
    client = getClient();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const photoCount = uploadedFiles.length;
  // How many images? Prompt wins ("3 images"), then the UI selector, else 1.
  let count = parseCount(userPrompt);
  if (count === null) count = parseInt(req.body.count, 10) || 1;
  count = Math.max(1, count);

  let perPhoto = count;
  let total = photoCount > 0 ? photoCount * perPhoto : perPhoto;
  let limited = false;
  if (total > MAX_IMAGES) {
    limited = true;
    if (photoCount > 0) {
      perPhoto = Math.max(1, Math.floor(MAX_IMAGES / photoCount));
      total = photoCount * perPhoto;
    } else {
      perPhoto = MAX_IMAGES;
      total = MAX_IMAGES;
    }
  }

  const quality = QUALITIES.includes(req.body.quality) ? req.body.quality : DEFAULT_QUALITY;
  const transparent = wantsBgRemoval(userPrompt);
  const hasPhoto = photoCount > 0;
  const prompt = buildPrompt(userPrompt, hasPhoto, transparent);
  const size = pickSize(req.body.aspect);

  // Optimize uploaded photo(s) regardless of original dimensions or file size
  const photos = [];
  const photoUrls = [];

  for (const file of uploadedFiles) {
    let buf = file.buffer;
    let mime = file.mimetype || "image/jpeg";
    try {
      buf = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();
      mime = "image/jpeg";
    } catch (sharpErr) {
      console.warn("Sharp optimization fallback:", sharpErr.message);
    }

    const f = `in_${crypto.randomUUID()}.jpg`;
    await fs.promises.writeFile(path.join(IMG_DIR, f), buf);
    photoUrls.push(`/files/${f}`);
    photos.push({ buffer: buf, name: file.originalname || "room.jpg", mime });
  }

  const photoUrl = photoUrls[0] || "";
  const jobId = crypto.randomUUID();
  const controller = new AbortController();

  const results = Array.from({ length: total }, (_, i) => ({
    status: "pending",
    photoIndex: photoCount > 0 ? Math.floor(i / perPhoto) : 0,
  }));

  const job = {
    id: jobId,
    ownerId: req.owner.id,
    total,
    perPhoto,
    photoCount,
    photoUrls,
    transparent,
    limited,
    results,
    done: false,
    controller,
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);

  // Respond immediately with JSON (avoids Hostinger 120s timeout)
  res.json({
    jobId,
    count: total,
    perPhoto,
    photoCount,
    photoUrls,
    photoUrl,
    transparent,
    limited,
  });

  // Run OpenAI calls in background
  const t0 = Date.now();
  console.log(`[Studio] Starting background job ${jobId} for ${total} image(s) (${photoCount} photo(s) x ${perPhoto} per photo)...`);

  Promise.all(
    Array.from({ length: total }, async (_, index) => {
      const photoIndex = photoCount > 0 ? Math.floor(index / perPhoto) : 0;
      const photo = photos.length > 0 ? photos[photoIndex] : null;
      const itemT0 = Date.now();
      try {
        const r = await callImageApi(
          client,
          { photo, prompt, size, quality, transparent },
          controller.signal
        );
        const b64 = r.data && r.data[0] && r.data[0].b64_json;
        if (!b64) throw new Error("No image returned.");
        const f = `out_${crypto.randomUUID()}.${transparent ? "png" : "jpg"}`;
        await fs.promises.writeFile(path.join(IMG_DIR, f), Buffer.from(b64, "base64"));
        job.results[index] = {
          status: "done",
          photoIndex,
          url: `/files/${f}`,
        };
        console.log(`[Studio] Job ${jobId} item #${index + 1} done in ${((Date.now() - itemT0) / 1000).toFixed(1)}s`);
      } catch (err) {
        const msg = controller.signal.aborted ? "Stopped" : (err.message || "Generation failed.");
        job.results[index] = {
          status: "error",
          photoIndex,
          message: msg,
        };
        console.error(`[Studio] Job ${jobId} item #${index + 1} error:`, err.message);
      }
    })
  ).finally(() => {
    job.done = true;
    console.log(`[Studio] Job ${jobId} finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  });
});

router.get("/jobs/:id", identify, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.ownerId !== req.owner.id) {
    return res.status(404).json({ error: "Job not found." });
  }
  res.json({ done: job.done, results: job.results });
});

router.post("/jobs/:id/cancel", identify, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.ownerId !== req.owner.id) {
    return res.status(404).json({ error: "Job not found." });
  }
  job.controller.abort();
  job.results = job.results.map((r) =>
    r.status === "pending" ? { ...r, status: "error", message: "Stopped" } : r
  );
  job.done = true;
  res.json({ ok: true });
});

module.exports = router;
