/**
 * designImageService.js
 * AI Studio ki image (data/images/<file>) ka ek copy quote ke liye save karta hai,
 * taaki PDF / admin email me lag sake. Dono ek hi server par hain, to koi download nahi.
 *
 * Safe: sirf "/files/<naam>" path, sirf JPEG/PNG, max 8 MB.
 * Kabhi throw nahi karta: image me dikkat ho to order bina image ke chalta rahta hai.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IMG_DIR } = require('../config/paths');

const DIR = path.join(__dirname, '..', 'design-images');
const MAX_BYTES = 8 * 1024 * 1024;

// "/files/x.jpg" ya "https://site/files/x.jpg" -> "x.jpg" (warna null)
function fileNameFromUrl(raw) {
  try {
    const p = new URL(String(raw), 'http://localhost').pathname;
    const m = /^\/files\/([A-Za-z0-9._-]+)$/.exec(p);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function detectExt(buf) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

/** @returns {Promise<{fileName:string, filePath:string}|null>} */
async function saveDesignImage(rawUrl) {
  try {
    const name = fileNameFromUrl(rawUrl);
    if (!name) return null;
    const src = path.join(IMG_DIR, name);
    if (path.dirname(src) !== IMG_DIR || !fs.existsSync(src)) return null;
    const stat = fs.statSync(src);
    if (stat.size > MAX_BYTES) return null;
    const buf = fs.readFileSync(src);
    const ext = detectExt(buf);
    if (!ext) return null;
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
    const fileName = `design_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(DIR, fileName);
    fs.writeFileSync(filePath, buf);
    return { fileName, filePath };
  } catch (e) {
    console.warn('[DesignImage] Could not save image:', e.message);
    return null;
  }
}

module.exports = { saveDesignImage, fileNameFromUrl };
