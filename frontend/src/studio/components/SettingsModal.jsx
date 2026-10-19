import { useRef, useState } from "react";
import { X, Camera, LogOut, LogIn, Trash2, Sun, Moon, Zap, Gauge, Sparkles } from "lucide-react";
import { api, absUrl } from "../api";

const QUALITY_OPTS = [
  { id: "low", label: "Fast", icon: Zap },
  { id: "medium", label: "Balanced", icon: Gauge },
  { id: "high", label: "Best", icon: Sparkles },
];

export default function SettingsModal({ user, onClose, onUserChange, onLogin, onLogout, prefs, setPrefs, maxImages, onClearHistory }) {
  const [name, setName] = useState(user?.name || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function saveName() {
    setBusy(true);
    setMsg("");
    try {
      const d = await api("/api/studio/me", { method: "PUT", body: { name } });
      onUserChange(d.user);
      setMsg("Profile saved ✓");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    setBusy(true);
    try {
      const d = await api("/api/studio/me/avatar", { method: "POST", form });
      onUserChange(d.user);
      setMsg("Photo updated ✓");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const initial = (user?.name || "G").trim()[0]?.toUpperCase();

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="settings-body">
          <section className="set-sec">
            <h3>Profile</h3>
            {user ? (
              <>
                <div className="profile-row">
                  <div className="avatar xl">
                    {user.avatar ? <img src={absUrl(user.avatar)} alt="" referrerPolicy="no-referrer" /> : initial}
                    <button className="avatar-edit" onClick={() => fileRef.current?.click()} aria-label="Change photo">
                      <Camera size={14} />
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
                  </div>
                  <div className="profile-fields">
                    <label className="lbl">Name</label>
                    <div className="inline-field">
                      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                      <button className="btn primary sm" onClick={saveName} disabled={busy || !name.trim() || name === user.name}>Save</button>
                    </div>
                    <label className="lbl">Email</label>
                    <input value={user.email} readOnly className="readonly" />
                    <span className="tiny">Login: {user.provider === "google" ? "Google" : "Email & password"}</span>
                  </div>
                </div>
                {msg && <div className="tiny ok">{msg}</div>}
              </>
            ) : (
              <div className="guest-card">
                <div className="avatar xl">G</div>
                <div>
                  <b>Guest mode</b>
                  <p className="tiny">Login karein taaki history aur profile har device pe save rahe.</p>
                  <button className="btn primary sm" onClick={onLogin}><LogIn size={15} /> Login / Sign up</button>
                </div>
              </div>
            )}
          </section>

          <section className="set-sec">
            <h3>Preferences</h3>
            <label className="lbl">Theme</label>
            <div className="seg">
              <button className={prefs.theme === "dark" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "dark" })}><Moon size={14} /> Dark</button>
              <button className={prefs.theme === "light" ? "on" : ""} onClick={() => setPrefs({ ...prefs, theme: "light" })}><Sun size={14} /> Light</button>
            </div>
            <label className="lbl">Default speed / quality</label>
            <div className="seg">
              {QUALITY_OPTS.map(({ id, label, icon: Icon }) => (
                <button key={id} className={prefs.quality === id ? "on" : ""} onClick={() => setPrefs({ ...prefs, quality: id })}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <label className="lbl">Default number of images</label>
            <div className="seg wrap">
              {Array.from({ length: Math.min(maxImages, 8) }, (_, i) => i + 1).map((n) => (
                <button key={n} className={prefs.count === n ? "on" : ""} onClick={() => setPrefs({ ...prefs, count: n })}>{n}</button>
              ))}
            </div>
            <span className="tiny">Prompt me "3 images" likhoge to wahi count use hoga.</span>
          </section>

          <section className="set-sec">
            <h3>Data</h3>
            <button className="btn danger" onClick={onClearHistory}><Trash2 size={15} /> Saari history delete karein</button>
          </section>

          {user && (
            <section className="set-sec">
              <h3>Account</h3>
              <button className="btn ghost" onClick={onLogout}><LogOut size={15} /> Logout</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
