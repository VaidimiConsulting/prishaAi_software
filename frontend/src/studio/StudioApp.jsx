import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Mic, ArrowUp, X, Download, Menu, SquarePen, Camera, ImageIcon, Trash2, Settings, Square, Pencil,
  Maximize2, Zap, Gauge, Sparkles, Minus, LogIn, Wand2, Eraser, Paintbrush, Sofa, Search, RefreshCw,
  CornerUpLeft, Share2, Columns2, PanelLeftClose, PanelLeft, Check, DownloadCloud, Calculator, IndianRupee,
} from "lucide-react";
import logo from "./assets/logo.png";
import { api, absUrl, getToken, setToken, generateStream, prepareImage } from "./api";
import AuthModal from "./components/AuthModal";
import SettingsModal from "./components/SettingsModal";
import CameraModal from "./components/CameraModal";
import Compare from "./components/Compare";

const PREFS_KEY = "prisha_prefs";
const CHIPS = ["Modern Minimalist", "Traditional Indian", "Luxury Contemporary", "Industrial", "Scandinavian", "Bohemian"];
const EXAMPLES = [
  { icon: Eraser, title: "Remove background", text: "Remove the background completely" },
  { icon: Paintbrush, title: "Change wall colour", text: "Change only the wall colour to sage green" },
  { icon: Sofa, title: "Restyle the room", text: "Modern minimalist style interior design, 3 images" },
  { icon: Wand2, title: "Create from text", text: "Luxury bedroom with warm wooden panelling, 2 images" },
];
const QUALITY = [
  { id: "low", label: "Fast", icon: Zap },
  { id: "medium", label: "Balanced", icon: Gauge },
  { id: "high", label: "Best", icon: Sparkles },
];
const MAX_PHOTOS = 4;
const isMobile = () => window.matchMedia("(max-width: 899px)").matches;

const loadPrefs = () => {
  const d = { theme: "dark", quality: "low", count: 1, collapsed: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return d;
  }
};

function groupChats(chats) {
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = sod(new Date());
  const g = { Today: [], Yesterday: [], "Last 7 days": [], Older: [] };
  for (const c of chats) {
    const t = sod(new Date(c.updatedAt));
    if (t >= today) g.Today.push(c);
    else if (t >= today - 86400000) g.Yesterday.push(c);
    else if (t >= today - 6 * 86400000) g["Last 7 days"].push(c);
    else g.Older.push(c);
  }
  return Object.entries(g).filter(([, v]) => v.length);
}

function Skeleton({ aspect }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tile skeleton" style={{ aspectRatio: aspect }}>
      <div className="shimmer" />
      <span className="skel-label"><span className="pulse-dot" /> Generating design...</span>
      {elapsed >= 60 && (
        <span className="skel-hint">Photo edit me 1-3 minute lag sakte hain, wait karein</span>
      )}
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState({ googleClientId: "", maxImages: 8, defaultQuality: "low" });
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState(null); // {id, value}
  const [pending, setPending] = useState([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [lightbox, setLightbox] = useState(null); // {url,name,before,mode}
  const [listening, setListening] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState(null); // "msgIndex-imgIndex" of the chosen image
  const [ignoreContext, setIgnoreContext] = useState(false);

  const ctx = useMemo(() => {
    // If a result tile is selected (the tick), use only that image's url.
    if (selected) {
      const [mIdx, itmIdx] = selected.split("-").map(Number);
      const msg = messages[mIdx];
      const item = msg?.items?.[itmIdx];
      if (typeof item === "string") {
        return [{ url: item, aspect: msg.aspect || 1 }];
      }
    }

    // Else take the latest assistant message that has images.
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && Array.isArray(msg.items) && msg.items.length > 0) {
        const hasSuccess = msg.items.some((it) => typeof it === "string");
        if (!hasSuccess) continue;

        const prevUser = messages[i - 1];
        const prevPhotos = Array.isArray(prevUser?.photoUrls) && prevUser.photoUrls.length > 0
          ? prevUser.photoUrls
          : (prevUser?.photoUrl ? [prevUser.photoUrl] : []);

        const photoCount = msg.photoCount || (prevPhotos.length > 0 ? prevPhotos.length : 1);
        const perPhoto = msg.perPhoto || Math.max(1, Math.floor(msg.items.length / Math.max(1, photoCount)));
        const countToExamine = Math.min(Math.max(1, photoCount), 4);

        const list = [];
        for (let p = 0; p < countToExamine; p++) {
          const slice = msg.items.slice(p * perPhoto, (p + 1) * perPhoto);
          const firstSuccess = slice.find((it) => typeof it === "string");
          if (firstSuccess) {
            list.push({ url: firstSuccess, aspect: msg.aspect || 1 });
          }
        }
        if (list.length > 0) {
          return list.slice(0, 4);
        }
      }
    }
    return [];
  }, [selected, messages]);

  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const abortRef = useRef(null);
  const recogRef = useRef(null);
  const activeRef = useRef(null);
  const toastTimer = useRef(null);
  activeRef.current = activeId;

  const quality = prefs.quality || config.defaultQuality;
  const setPrefs = (p) => {
    setPrefsState(p);
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  };
  const SpeechRec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const showToast = (t, ms = 2200) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  };

  // Price calculator kholo (same server). Image ke saath => wo image calculator ke pehle page par aati hai.
  function openCalculator(imageUrl) {
    let link = "/";
    if (imageUrl) {
      let p = imageUrl;
      try { p = new URL(imageUrl, window.location.origin).pathname; } catch { /* keep as is */ }
      link = `/?ai_image=${encodeURIComponent(p)}`;
    }
    window.open(link, "_blank");
  }

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  /* ---------- boot ---------- */
  const loadChats = useCallback(async () => {
    try {
      const d = await api("/api/studio/chats");
      setChats(d.chats);
    } catch (e) {
      if (e.status === 401 && getToken()) {
        setToken("");
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    api("/api/studio/config").catch(() => null).then((c) => c && c.maxImages && setConfig(c));
    if (new URLSearchParams(window.location.search).get("from") === "calculator") {
      showToast("Design banao, phir image select karke 'Get price estimate' dabao", 6000);
      window.history.replaceState({}, "", window.location.pathname);
    }
    (async () => {
      if (getToken()) {
        try {
          setUser((await api("/api/studio/me")).user);
        } catch {
          setToken("");
        }
      }
      loadChats();
    })();
  }, [loadChats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 130) + "px";
  }, [input]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newChat();
      } else if (e.key === "Escape") {
        setLightbox(null);
        setModal(null);
        setAddMenu(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggleSidebar() {
    if (isMobile()) setSidebarOpen((v) => !v);
    else setPrefs({ ...prefs, collapsed: !prefs.collapsed });
  }

  /* ---------- photo handling ---------- */
  async function handlePhotoFiles(files) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f && f.type?.startsWith("image/"));
    if (list.length === 0) return;
    setAddMenu(false);
    setError("");

    if (pending.length >= MAX_PHOTOS) {
      showToast("Maximum 4 photos allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const availableSlots = MAX_PHOTOS - pending.length;
    const acceptedFiles = list.slice(0, availableSlots);
    const hasExcess = list.length > availableSlots;

    const preparedList = await Promise.all(
      acceptedFiles.map(async (file) => {
        const { file: f, aspect } = await prepareImage(file);
        const resolved = f || file;
        return {
          id: crypto.randomUUID(),
          file: resolved,
          aspect: aspect || 1,
          preview: URL.createObjectURL(resolved),
        };
      })
    );

    setPending((old) => {
      const slotsLeft = MAX_PHOTOS - old.length;
      if (slotsLeft <= 0) {
        preparedList.forEach((p) => URL.revokeObjectURL(p.preview));
        return old;
      }
      const toAdd = preparedList.slice(0, slotsLeft);
      preparedList.slice(slotsLeft).forEach((p) => URL.revokeObjectURL(p.preview));
      return [...old, ...toAdd];
    });

    if (fileRef.current) fileRef.current.value = "";

    if (hasExcess) {
      showToast("Maximum 4 photos allowed");
    }
  }

  function removePhoto(index) {
    setPending((old) => {
      const target = old[index];
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return old.filter((_, i) => i !== index);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearPending() {
    setPending((old) => {
      old.forEach((p) => {
        if (p?.preview) URL.revokeObjectURL(p.preview);
      });
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPaste(e) {
    const items = [...(e.clipboardData?.items || [])];
    const imgFiles = items
      .filter((i) => i.type && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter(Boolean);
    if (imgFiles.length > 0) {
      e.preventDefault();
      handlePhotoFiles(imgFiles);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f && f.type?.startsWith("image/"));
    if (files.length > 0) handlePhotoFiles(files);
  }

  const fetchBlob = async (url) => (await fetch(absUrl(url))).blob();

  async function handleUseAsInput(url) {
    try {
      const blob = await fetchBlob(url);
      await handlePhotoFiles([new File([blob], "previous-result." + (blob.type.includes("png") ? "png" : "jpg"), { type: blob.type })]);
      setLightbox(null);
      taRef.current?.focus();
      showToast("Image input me add ho gayi — ab likho kya badalna hai");
    } catch {
      showToast("Image load nahi ho payi");
    }
  }

  async function downloadImage(url, name) {
    try {
      const blob = await fetchBlob(url);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(absUrl(url), "_blank");
    }
  }

  async function downloadAll(items, base, png) {
    const list = items.filter((x) => typeof x === "string");
    for (let i = 0; i < list.length; i++) {
      await downloadImage(list[i], `${base}-${i + 1}.${png ? "png" : "jpg"}`);
      await new Promise((r) => setTimeout(r, 350));
    }
    showToast(`${list.length} image download ho gayi`);
  }

  async function shareImage(url) {
    try {
      const blob = await fetchBlob(url);
      const file = new File([blob], "design." + (blob.type.includes("png") ? "png" : "jpg"), { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Prisha Interiors design" });
      else await navigator.share({ url: new URL(url, window.location.origin).href, title: "Prisha Interiors design" });
    } catch {
      /* user cancelled */
    }
  }

  /* ---------- voice ---------- */
  function toggleMic() {
    if (!SpeechRec) return;
    if (listening) return recogRef.current?.stop();
    const r = new SpeechRec();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (ev) => setInput((p) => (p ? p + " " : "") + ev.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  }

  /* ---------- chats ---------- */
  function newChat() {
    setSelected(null);
    setActiveId(null);
    setMessages([]);
    setError("");
    clearPending();
    setInput("");
    setSidebarOpen(false);
    setIgnoreContext(false);
  }

  async function openChat(id) {
    setSelected(null);
    setSidebarOpen(false);
    setIgnoreContext(false);
    if (id === activeId) return;
    try {
      const d = await api(`/api/studio/chats/${id}`);
      setActiveId(id);
      setMessages(d.chat.messages || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteChat(e, id) {
    e.stopPropagation();
    await api(`/api/studio/chats/${id}`, { method: "DELETE" }).catch(() => {});
    setChats((c) => c.filter((x) => x.id !== id));
    if (id === activeId) newChat();
  }

  async function commitRename() {
    if (!renaming) return;
    const { id, value } = renaming;
    setRenaming(null);
    const title = value.trim();
    if (!title) return;
    setChats((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
    api(`/api/studio/chats/${id}`, { method: "PUT", body: { title } }).catch(() => {});
  }

  async function clearAllHistory() {
    if (!window.confirm("Saari history delete ho jayegi. Pakka?")) return;
    await api("/api/studio/chats", { method: "DELETE" }).catch(() => {});
    setChats([]);
    newChat();
    setModal(null);
  }

  /* ---------- generate ---------- */
  async function runGenerate(prompt, photos) {
    if (generating) return;
    setError("");
    setSelected(null);

    let chatId = activeId;
    if (!chatId) {
      try {
        const d = await api("/api/studio/chats", { method: "POST", body: { title: prompt.slice(0, 48) } });
        chatId = d.chat.id;
        setChats((c) => [d.chat, ...c]);
        setActiveId(chatId);
        activeRef.current = chatId;
      } catch (e) {
        setError(e.message);
        return;
      }
    }

    const photoList = Array.isArray(photos) ? photos : (photos ? [photos] : []);
    const firstPreview = photoList[0]?.preview || "";
    const previewUrls = photoList.map((p) => p.preview);
    const userMsg = {
      role: "user",
      text: prompt,
      photoUrl: firstPreview,
      photoUrls: previewUrls,
    };
    const asstMsg = {
      role: "assistant",
      items: null,
      aspect: photoList[0]?.aspect ? Math.round(photoList[0].aspect * 100) / 100 : 1,
    };
    let msgs = [...messages, userMsg, asstMsg];
    const asstIdx = msgs.length - 1;
    const userIdx = asstIdx - 1;
    const commit = () => activeRef.current === chatId && setMessages(msgs);
    const patchAsst = (fn) => {
      msgs = msgs.map((m, i) => (i === asstIdx ? fn(m) : m));
      commit();
    };
    commit();

    setGenerating(chatId);
    const controller = new AbortController();
    abortRef.current = controller;

    const form = new FormData();
    if (photoList.length > 0) {
      for (const p of photoList) {
        if (p && p.file) {
          let sendFile = p.file;
          if (sendFile.size > 600 * 1024) {
            try {
              const prep = await prepareImage(sendFile);
              if (prep.file) sendFile = prep.file;
            } catch { /* proceed */ }
          }
          form.append("photos", sendFile);
        }
      }
      form.append("aspect", String(photoList[0]?.aspect || 1));
    }
    form.append("prompt", prompt);
    form.append("count", String(prefs.count || 1));
    form.append("quality", quality);

    try {
      await generateStream(
        form,
        (ev) => {
          if (ev.type === "meta") {
            const serverUrls = ev.photoUrls || (ev.photoUrl ? [ev.photoUrl] : []);
            msgs = msgs.map((m, i) =>
              i === userIdx
                ? {
                    ...m,
                    photoUrl: ev.photoUrl || m.photoUrl,
                    photoUrls: serverUrls.length > 0 ? serverUrls : m.photoUrls,
                  }
                : m
            );
            patchAsst((m) => ({
              ...m,
              items: Array(ev.count).fill(null),
              transparent: ev.transparent,
              perPhoto: ev.perPhoto,
              photoCount: ev.photoCount,
            }));
          } else if (ev.type === "image") {
            patchAsst((m) => ({ ...m, items: m.items.map((it, i) => (i === ev.index ? ev.url : it)) }));
          } else if (ev.type === "error") {
            patchAsst((m) => ({ ...m, items: m.items.map((it, i) => (i === ev.index ? { error: ev.message } : it)) }));
          }
        },
        controller.signal
      );
    } catch (err) {
      const stopped = err.name === "AbortError";
      patchAsst((m) => ({ ...m, items: (m.items || [null]).map((it) => it || { error: stopped ? "Stopped" : err.message }) }));
    } finally {
      photoList.forEach((p) => {
        if (p?.preview && p.preview.startsWith("blob:")) {
          URL.revokeObjectURL(p.preview);
        }
      });
      patchAsst((m) => ({ ...m, items: (m.items || [null]).map((it) => it || { error: "No result" }) }));
      setGenerating(null);
      abortRef.current = null;
      const clean = msgs.map((m) => ({
        ...m,
        photoUrl: m.photoUrl?.startsWith("blob:") ? "" : m.photoUrl,
        photoUrls: Array.isArray(m.photoUrls) ? m.photoUrls.filter((u) => !u.startsWith("blob:")) : m.photoUrls,
      }));
      api(`/api/studio/chats/${chatId}`, { method: "PUT", body: { messages: clean } }).then(loadChats).catch(() => {});
    }
  }

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt) return setError("Pehle likhein ki aapko kya chahiye.");

    let photosToSend = pending;
    if (photosToSend.length === 0 && ctx.length > 0 && !ignoreContext) {
      try {
        const downloaded = await Promise.all(
          ctx.map(async (c, idx) => {
            const blob = await fetchBlob(c.url);
            const ext = blob.type.includes("png") || c.url.endsWith(".png") ? "png" : "jpg";
            const rawFile = new File([blob], `previous-${idx + 1}.${ext}`, {
              type: blob.type || (ext === "png" ? "image/png" : "image/jpeg"),
            });
            const { file: prepFile, aspect } = await prepareImage(rawFile);
            const resolved = prepFile || rawFile;
            return {
              id: crypto.randomUUID(),
              file: resolved,
              aspect: aspect || c.aspect || 1,
              preview: URL.createObjectURL(resolved),
            };
          })
        );
        photosToSend = downloaded;
      } catch {
        showToast("Pichli image download nahi ho payi");
        return;
      }
    }

    setInput("");
    setPending([]);
    setIgnoreContext(false);
    if (fileRef.current) fileRef.current.value = "";
    runGenerate(prompt, photosToSend);
  }

  async function regenerate(asstIndex) {
    const u = messages[asstIndex - 1];
    if (!u || u.role !== "user") return;
    const urls = Array.isArray(u.photoUrls) && u.photoUrls.length > 0 ? u.photoUrls : (u.photoUrl ? [u.photoUrl] : []);
    let photos = [];
    if (urls.length > 0) {
      try {
        photos = await Promise.all(
          urls.map(async (url, idx) => {
            const blob = await fetchBlob(url);
            const f = new File([blob], `photo-${idx + 1}.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type });
            return { id: crypto.randomUUID(), file: f, aspect: messages[asstIndex].aspect || 1, preview: url };
          })
        );
      } catch {
        return showToast("Original photo load nahi hui");
      }
    }
    runGenerate(u.text, photos);
  }

  function reusePrompt(m) {
    setInput(m.text);
    taRef.current?.focus();
    showToast("Prompt box me aa gaya");
  }

  /* ---------- auth ---------- */
  function onAuthed({ token, user: u }) {
    setToken(token);
    setUser(u);
    setModal(null);
    setActiveId(null);
    setMessages([]);
    loadChats();
  }
  function logout() {
    setToken("");
    setUser(null);
    setModal(null);
    setActiveId(null);
    setMessages([]);
    setChats([]);
    loadChats();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, search]);
  const grouped = useMemo(() => groupChats(filtered), [filtered]);
  const activeTitle = chats.find((c) => c.id === activeId)?.title || "New design";
  const busy = generating !== null;
  const initial = (user?.name || "G").trim()[0]?.toUpperCase();

  function addChip(s) {
    setInput((p) => (p.trim() ? `${p.trim()}, ${s}` : `${s} style interior design`));
    taRef.current?.focus();
  }

  return (
    <div
      className={`app ${prefs.collapsed ? "collapsed" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={onDrop}
    >
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      {/* ================= Sidebar ================= */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sb-head">
          <img src={logo} alt="Prisha Interiors" className="sb-logo" />
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Close sidebar" title="Sidebar band karein"><PanelLeftClose size={19} /></button>
        </div>

        <button className="new-chat" onClick={newChat}><SquarePen size={17} /> New chat <kbd>Ctrl K</kbd></button>

        {true && (
          <button className="calc-link" onClick={() => openCalculator()} title="Seedha price calculator kholein">
            <Calculator size={16} /> Price Calculator
          </button>
        )}

        <label className="sb-search">
          <Search size={15} />
          <input placeholder="History search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} aria-label="Clear"><X size={14} /></button>}
        </label>

        <div className="sb-scroll">
          {chats.length === 0 && <p className="sb-empty">Abhi koi history nahi.<br />Pehla design banayein ✨</p>}
          {chats.length > 0 && grouped.length === 0 && <p className="sb-empty">Kuch nahi mila</p>}
          {grouped.map(([label, list]) => (
            <div key={label}>
              <div className="sb-label">{label}</div>
              {list.map((c) => (
                <div key={c.id} className={`chat-item ${c.id === activeId ? "active" : ""}`} onClick={() => renaming?.id !== c.id && openChat(c.id)}>
                  {c.thumb ? <img src={absUrl(c.thumb)} alt="" className="ci-thumb" loading="lazy" /> : <span className="ci-thumb ph"><ImageIcon size={14} /></span>}
                  {renaming?.id === c.id ? (
                    <input
                      className="ci-edit"
                      autoFocus
                      value={renaming.value}
                      onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="ci-title">{c.title}</span>
                  )}
                  <span className="ci-btns">
                    <button onClick={(e) => { e.stopPropagation(); setRenaming({ id: c.id, value: c.title }); }} aria-label="Rename" title="Rename"><Pencil size={13} /></button>
                    <button className="del" onClick={(e) => deleteChat(e, c.id)} aria-label="Delete" title="Delete"><Trash2 size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sb-foot">
          <button className="profile-btn" onClick={() => setModal(user ? "settings" : "auth")}>
            <span className="avatar">{user?.avatar ? <img src={absUrl(user.avatar)} alt="" referrerPolicy="no-referrer" /> : initial}</span>
            <span className="pb-text">
              <b>{user ? user.name : "Guest"}</b>
              <small>{user ? user.email : "Login karein"}</small>
            </span>
            {!user && <LogIn size={16} className="pb-ic" />}
          </button>
          <button className="icon-btn" onClick={() => setModal("settings")} aria-label="Settings" title="Settings"><Settings size={19} /></button>
        </div>
      </aside>

      {/* ================= Main ================= */}
      <div className="main">
        <header className="topbar">
          <button className={`icon-btn ${prefs.collapsed ? "" : "hide-desktop"}`} onClick={toggleSidebar} aria-label="Menu" title="Sidebar">
            {prefs.collapsed && !isMobile() ? <PanelLeft size={20} /> : <Menu size={20} />}
          </button>
          <div className="tb-title">{activeTitle}</div>
          {(
            <button className="icon-btn" onClick={() => openCalculator()} aria-label="Price Calculator" title="Price Calculator"><Calculator size={18} /></button>
          )}
          <button className="icon-btn" onClick={() => setModal("settings")} aria-label="Settings" title="Settings"><Settings size={18} /></button>
          <button className="icon-btn" onClick={newChat} aria-label="New chat" title="New chat"><SquarePen size={18} /></button>
        </header>

        <main className="stream" ref={scrollRef}>
          <div className="stream-inner">
            {messages.length === 0 && (
              <div className="hero">
                <img src={logo} alt="" className="hero-logo" />
                <h1>AI Interior Design Studio</h1>
                <p>Photo add karein aur jo chahiye likhein — jitni images bolenge utni milengi, bilkul waisi jaisi aapne kaha.</p>
                <div className="examples">
                  {EXAMPLES.map(({ icon: Icon, title, text }) => (
                    <button key={title} className="example" onClick={() => { setInput(text); taRef.current?.focus(); }}>
                      <Icon size={18} />
                      <b>{title}</b>
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="row user" key={i}>
                  <div className="bubble user-b">
                    {Array.isArray(m.photoUrls) && m.photoUrls.length > 1 ? (
                      <div className="u-photos-grid">
                        {m.photoUrls.map((url, pIdx) => (
                          <img
                            key={pIdx}
                            src={absUrl(url)}
                            alt={`Uploaded ${pIdx + 1}`}
                            className="u-photo"
                            onClick={() => setLightbox({ url, name: `original-${pIdx + 1}` })}
                          />
                        ))}
                      </div>
                    ) : (m.photoUrl || (Array.isArray(m.photoUrls) && m.photoUrls[0])) ? (
                      <img
                        src={absUrl(m.photoUrl || m.photoUrls[0])}
                        alt="Uploaded"
                        className="u-photo"
                        onClick={() => setLightbox({ url: m.photoUrl || m.photoUrls[0], name: "original" })}
                      />
                    ) : null}
                    <p>{m.text}</p>
                    <button className="mini-act" onClick={() => reusePrompt(m)} title="Prompt dobara use karein"><CornerUpLeft size={13} /> Reuse</button>
                  </div>
                </div>
              ) : (
                <div className="row asst" key={i}>
                  <div className="results">
                    {m.items === null ? (
                      <div className="typing"><span /><span /><span /></div>
                    ) : (
                      <>
                        <div className={`grid n${Math.min(m.items.length, 4)}`}>
                          {m.items.map((it, idx) => {
                            const prevUser = messages[i - 1];
                            const prevPhotos = Array.isArray(prevUser?.photoUrls) && prevUser.photoUrls.length > 0
                              ? prevUser.photoUrls
                              : (prevUser?.photoUrl ? [prevUser.photoUrl] : []);
                            const pCount = m.photoCount || prevPhotos.length || 0;
                            const pIdx = m.perPhoto ? Math.floor(idx / m.perPhoto) : (idx % (prevPhotos.length || 1));
                            const before = prevPhotos.length > 0 ? prevPhotos[pIdx % prevPhotos.length] : "";
                            const name = `prisha-${i}-${idx + 1}`;
                            return it === null ? (
                              <Skeleton key={idx} aspect={m.aspect || 1} />
                            ) : typeof it === "string" ? (
                              <div className={`tile checker ${selected === `${i}-${idx}` ? "selected" : ""}`} key={idx}>
                                <img src={absUrl(it)} alt={`Result ${idx + 1}`} loading="lazy" onClick={() => setLightbox({ url: it, name, before, mode: "single", transparent: m.transparent })} />
                                {(
                                  <button
                                    className={`tile-select ${selected === `${i}-${idx}` ? "on" : ""}`}
                                    onClick={() => setSelected(selected === `${i}-${idx}` ? null : `${i}-${idx}`)}
                                    title={selected === `${i}-${idx}` ? "Select hataein" : "Is image ko select karein"}
                                    aria-label="Select image"
                                  >
                                    <Check size={15} />
                                  </button>
                                )}
                                <div className="tile-actions">
                                  <button onClick={() => setLightbox({ url: it, name, before, mode: "single", transparent: m.transparent })} title="Full view"><Maximize2 size={14} /></button>
                                  <button onClick={() => handleUseAsInput(it)} title="Is image ko edit karein"><Pencil size={14} /></button>
                                  <button onClick={() => downloadImage(it, `${name}.${m.transparent ? "png" : "jpg"}`)} title="Download"><Download size={14} /></button>
                                </div>
                                {m.items.length > 1 && (
                                  <span className="tile-tag">
                                    {pCount > 1 ? `Photo ${pIdx + 1}` : `#${idx + 1}`}
                                  </span>
                                )}
                                {selected === `${i}-${idx}` && (
                                  <button className="tile-price" onClick={() => openCalculator(it)}>
                                    <IndianRupee size={15} /> Get price estimate
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="tile err" key={idx} style={{ aspectRatio: m.aspect || 1 }}><p>{it.error}</p></div>
                            );
                          })}
                        </div>
                        {m.items.every((x) => x !== null) && (
                          <div className="msg-actions">
                            <button onClick={() => regenerate(i)} disabled={busy}><RefreshCw size={14} /> Regenerate</button>
                            {m.items.filter((x) => typeof x === "string").length > 1 && (
                              <button onClick={() => downloadAll(m.items, `prisha-${i}`, m.transparent)}><DownloadCloud size={14} /> Download all</button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </main>

        {/* ================= Composer ================= */}
        <div className="composer-wrap">
          <div className="composer-inner">
            {error && <div className="inline-error">{error}<button onClick={() => setError("")}><X size={13} /></button></div>}

            <div className="chips">
              {CHIPS.map((s) => (
                <button key={s} className="chip" onClick={() => addChip(s)}>{s}</button>
              ))}
            </div>

            <div className="composer">
              {pending.length > 0 && (
                <div className="pending-strip">
                  <div className="pending-thumbs">
                    {pending.map((p, idx) => (
                      <div key={p.id || idx} className="pending-thumb">
                        <img src={p.preview} alt={`Selected ${idx + 1}`} />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          aria-label={`Remove photo ${idx + 1}`}
                          title="Remove photo"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {pending.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        className="pending-add-btn"
                        onClick={() => fileRef.current?.click()}
                        aria-label="Add photo"
                        title="Add another photo"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                  <span className="pending-count-badge" title="Selected photos count">
                    {pending.length}/{MAX_PHOTOS}
                  </span>
                </div>
              )}

              {pending.length === 0 && ctx.length > 0 && (
                !ignoreContext ? (
                  <div className="ctx-row">
                    <div className="ctx-thumbs">
                      {ctx.map((c, idx) => (
                        <img key={idx} src={absUrl(c.url)} alt={`Context ${idx + 1}`} />
                      ))}
                    </div>
                    <span className="ctx-text">
                      {ctx.length === 1 ? "Is image par hi kaam hoga (pichla result)" : `Ye ${ctx.length} images par kaam hoga`}
                    </span>
                    <button type="button" className="ctx-btn" onClick={() => setIgnoreContext(true)}>
                      Naya banao
                    </button>
                  </div>
                ) : (
                  <div className="ctx-row">
                    <button type="button" className="ctx-btn" onClick={() => setIgnoreContext(false)}>
                      ↩ Pichli image par edit karo
                    </button>
                  </div>
                )
              )}

              <textarea
                ref={taRef}
                rows={1}
                value={input}
                placeholder={
                  pending.length > 0
                    ? "Kya badalna hai? (remove background / wall green / 3 images)"
                    : ctx.length > 0 && !ignoreContext
                    ? "Is image me aur kya badalna hai?"
                    : "Photo add karein ya seedha describe karein…"
                }
                onChange={(e) => setInput(e.target.value)}
                onPaste={onPaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) handleSend();
                  }
                }}
              />

              <div className="c-row">
                <div className="c-left">
                  <div className="plus-wrap">
                    {addMenu && (
                      <div className="add-menu">
                        <button
                          onClick={() => {
                            setAddMenu(false);
                            if (pending.length >= MAX_PHOTOS) {
                              showToast("Maximum 4 photos allowed");
                            } else {
                              setModal("camera");
                            }
                          }}
                        >
                          <Camera size={16} /> Camera se photo
                        </button>
                        <button
                          onClick={() => {
                            setAddMenu(false);
                            if (pending.length >= MAX_PHOTOS) {
                              showToast("Maximum 4 photos allowed");
                            } else {
                              fileRef.current?.click();
                            }
                          }}
                        >
                          <ImageIcon size={16} /> Gallery / File
                        </button>
                      </div>
                    )}
                    <button
                      className="round-btn"
                      onClick={() => {
                        if (pending.length >= MAX_PHOTOS) {
                          showToast("Maximum 4 photos allowed");
                        } else {
                          setAddMenu((v) => !v);
                        }
                      }}
                      disabled={pending.length >= MAX_PHOTOS}
                      aria-label="Add photo"
                      title={pending.length >= MAX_PHOTOS ? "Maximum 4 photos allowed" : "Add photo"}
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => handlePhotoFiles(e.target.files)}
                  />

                  <div className="stepper" title="Kitni images chahiye (prompt me likhoge to wahi use hoga)">
                    <button onClick={() => setPrefs({ ...prefs, count: Math.max(1, (prefs.count || 1) - 1) })} aria-label="Fewer"><Minus size={14} /></button>
                    <span><b>{prefs.count || 1}</b><i className="hide-sm"> img</i></span>
                    <button onClick={() => setPrefs({ ...prefs, count: Math.min(config.maxImages, (prefs.count || 1) + 1) })} aria-label="More"><Plus size={14} /></button>
                  </div>

                  <div className="seg tiny-seg" title="Speed vs quality">
                    {QUALITY.map(({ id, label, icon: Icon }) => (
                      <button key={id} className={quality === id ? "on" : ""} onClick={() => setPrefs({ ...prefs, quality: id })} title={label}>
                        <Icon size={13} /> <span className="hide-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="c-right">
                  {SpeechRec && !busy && !input.trim() && (
                    <button className={`round-btn ${listening ? "rec" : ""}`} onClick={toggleMic} aria-label="Voice"><Mic size={17} /></button>
                  )}
                  {busy ? (
                    <button className="send stop" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square size={14} fill="currentColor" /></button>
                  ) : (
                    <button className="send" onClick={handleSend} disabled={!input.trim()} aria-label="Send"><ArrowUp size={19} /></button>
                  )}
                </div>
              </div>
            </div>
            <p className="foot-note">Jo likhoge wahi hoga, extra kuch add nahi hoga · Enter = send · Shift+Enter = nayi line</p>
          </div>
        </div>
      </div>

      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
      {dragOver && <div className="drop-overlay"><ImageIcon size={36} /> Photo yahan chhodein</div>}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
            {lightbox.before && (
              <div className="seg tiny-seg">
                <button className={lightbox.mode !== "compare" ? "on" : ""} onClick={() => setLightbox({ ...lightbox, mode: "single" })}>After</button>
                <button className={lightbox.mode === "compare" ? "on" : ""} onClick={() => setLightbox({ ...lightbox, mode: "compare" })}><Columns2 size={13} /> Before / After</button>
              </div>
            )}
            <span className="grow" />
            {lightbox.name !== "original" && (
              <button className="lb-price" onClick={() => openCalculator(lightbox.url)}><IndianRupee size={15} /> Get price estimate</button>
            )}
            {lightbox.name !== "original" && <button className="icon-btn" onClick={() => handleUseAsInput(lightbox.url)} title="Edit this"><Pencil size={19} /></button>}
            {navigator.share && <button className="icon-btn" onClick={() => shareImage(lightbox.url)} title="Share"><Share2 size={19} /></button>}
            <button className="icon-btn" onClick={() => downloadImage(lightbox.url, lightbox.name + (lightbox.url.endsWith(".png") ? ".png" : ".jpg"))} title="Download"><Download size={19} /></button>
            <button className="icon-btn" onClick={() => setLightbox(null)} title="Close"><X size={22} /></button>
          </div>
          <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
            {lightbox.mode === "compare" && lightbox.before ? (
              <Compare before={absUrl(lightbox.before)} after={absUrl(lightbox.url)} />
            ) : (
              <img src={absUrl(lightbox.url)} alt="" className="checker" />
            )}
          </div>
        </div>
      )}

      {modal === "camera" && <CameraModal onClose={() => setModal(null)} onCapture={(f) => { handlePhotoFiles([f]); setModal(null); }} />}
      {modal === "auth" && <AuthModal googleClientId={config.googleClientId} onClose={() => setModal(null)} onAuthed={onAuthed} />}
      {modal === "settings" && (
        <SettingsModal
          user={user}
          onClose={() => setModal(null)}
          onUserChange={setUser}
          onLogin={() => setModal("auth")}
          onLogout={logout}
          prefs={{ ...prefs, quality }}
          setPrefs={setPrefs}
          maxImages={config.maxImages}
          onClearHistory={clearAllHistory}
        />
      )}
    </div>
  );
}
