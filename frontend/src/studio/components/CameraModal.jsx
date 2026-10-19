import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        setErr("Camera access nahi mila. Browser permission check karein.");
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((blob) => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal camera-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Photo click karein</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {err ? <p className="form-error" style={{ margin: 20 }}>{err}</p> : <video ref={videoRef} autoPlay playsInline muted className="camera-video" />}
        {!err && (
          <button className="capture-btn" onClick={capture} aria-label="Capture"><Camera size={22} /></button>
        )}
      </div>
    </div>
  );
}
