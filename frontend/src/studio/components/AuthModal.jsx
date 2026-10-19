import { useEffect, useRef, useState } from "react";
import { X, Mail, Lock, User } from "lucide-react";
import { api, loadGoogleScript } from "../api";

export default function AuthModal({ googleClientId, onClose, onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (resp) => {
            setError("");
            setBusy(true);
            try {
              const data = await api("/api/studio/auth/google", { method: "POST", body: { credential: resp.credential } });
              onAuthed(data);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 300,
        });
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api(mode === "login" ? "/api/studio/auth/login" : "/api/studio/auth/register", {
        method: "POST",
        body: form,
      });
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal auth-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 className="modal-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="modal-sub">Apni designs aur history har device pe save rakhein.</p>

        <div className="seg auth-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Login</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Sign up</button>
        </div>

        {googleClientId ? (
          <div className="google-wrap">
            <div ref={googleRef} />
            <div className="or"><span>or use email</span></div>
          </div>
        ) : (
          <p className="hint-box">
            Google/Gmail login ke liye <code>backend/.env</code> me <code>GOOGLE_CLIENT_ID</code> daalein (README dekhein).
          </p>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <User size={16} />
              <input placeholder="Full name" value={form.name} onChange={set("name")} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <Mail size={16} />
            <input type="email" placeholder="Email" value={form.email} onChange={set("email")} autoComplete="email" required />
          </label>
          <label className="field">
            <Lock size={16} />
            <input
              type="password"
              placeholder="Password (min 6)"
              value={form.password}
              onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary wide" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
        <button className="link-btn" onClick={onClose}>Guest ke roop me continue karein</button>
      </div>
    </div>
  );
}
