import { useRef, useState } from "react";

// Before / After slider
export default function Compare({ before, after }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef(null);
  const dragging = useRef(false);

  const move = (clientX) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div
      className="compare checker"
      ref={boxRef}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
    >
      <img src={after} alt="After" draggable={false} />
      <img src={before} alt="Before" draggable={false} className="cmp-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span className="cmp-tag l">Before</span>
      <span className="cmp-tag r">After</span>
      <div className="cmp-line" style={{ left: `${pos}%` }}><span className="cmp-knob">⇆</span></div>
    </div>
  );
}
