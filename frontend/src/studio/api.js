// Ek hi server: API same origin par hai (dev me Vite proxy se)
export const API_URL = "";

const TOKEN_KEY = "prisha_token";
const GUEST_KEY = "prisha_guest_id";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export function getGuestId() {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

// Turn "/files/x.jpg" into a full URL that works from any device
export const absUrl = (u) => u || "";

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : { "X-Guest-Id": getGuestId() };
}

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = { ...authHeaders() };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload });
  } catch {
    throw new Error("Server se connect nahi ho paya. Server chal raha hai?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong.");
    err.status = res.status;
    throw err;
  }
  return data;
}

// Streams generation results (one JSON object per line)
export async function generateStream(form, onEvent, signal) {
  let res;
  try {
    res = await fetch(API_URL + "/api/studio/generate", { method: "POST", headers: authHeaders(), body: form, signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Server se connect nahi ho paya. Server chal raha hai?");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Generation failed.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          /* ignore bad line */
        }
      }
    }
  }
}

// Shrink and normalize photos on the client before upload:
// Instant upload (<0.2s) and 7-8s generation regardless of uploaded file size (1MB to 50MB+)
export async function prepareImage(file, maxDim = 1024) {
  if (!file) return { file: null, aspect: 1 };

  const canvasToResult = async (source, w, h) => {
    if (!w || !h) return null;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, cw, ch);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return null;
    const cleanName = (file.name || "room").replace(/\.[^/.]+$/, "") + ".jpg";
    return {
      file: new File([blob], cleanName, { type: "image/jpeg" }),
      aspect: cw / ch,
    };
  };

  // 1. Try createImageBitmap (fastest, runs off main thread)
  try {
    const bmp = await createImageBitmap(file);
    const res = await canvasToResult(bmp, bmp.width, bmp.height);
    bmp.close?.();
    if (res) return res;
  } catch {
    /* fallback to Image element */
  }

  // 2. Fallback: Image element (works for all standard browsers & image formats)
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const res = await canvasToResult(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    URL.revokeObjectURL(url);
    if (res) return res;
  } catch {
    /* fallback */
  }

  // 3. Fallback: return original file
  return { file, aspect: 1 };
}

let gisPromise = null;
export function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("Google script load nahi hui (internet check karein)."));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}
