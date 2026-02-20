import { useState, useRef, useEffect } from "react";

const BEATS = [
  { id: "1a", label: "Establish",        script: "Color Palette Maker...",                                                   zoom: 1.0, dur: 0.35, fx: 50, fy: 50, tr: "ease-in-out" },
  { id: "1b", label: "Value prop",       script: "...extracts meaningful color palettes directly from your images.",         zoom: 1.1, dur: 0.35, fx: 50, fy: 50, tr: "ease-in-out" },
  { id: "2a", label: "Drop zone focus",  script: "Just upload a photo",                                                      zoom: 1.3, dur: 0.0,  fx: 50, fy: 25, tr: "CUT"         },
  { id: "2b", label: "Processing beat",  script: "The app runs K-means clustering to identify the dominant colors...",       zoom: 1.1, dur: 0.4,  fx: 50, fy: 40, tr: "ease-out"    },
  { id: "2c", label: "Reveal",           script: "...and displays the palette instantly.",                                   zoom: 1.0, dur: 0.35, fx: 50, fy: 50, tr: "ease-in-out" },
  { id: "3a", label: "Swatches appear",  script: "The dominant colors appear as swatches...",                                zoom: 1.2, dur: 0.3,  fx: 50, fy: 70, tr: "ease-in"     },
  { id: "3b", label: "Hex detail",       script: "...each tagged with its hex value.",                                       zoom: 1.6, dur: 0.2,  fx: 30, fy: 75, tr: "ease-in"     },
  { id: "4a", label: "K selector",       script: "Adjust the number of colors",                                              zoom: 1.4, dur: 0.0,  fx: 50, fy: 20, tr: "CUT"         },
  { id: "4b", label: "K values",         script: "5, 7, or 9 -- for more or less granularity.",                              zoom: 1.5, dur: 0.0,  fx: 50, fy: 20, tr: "HOLD"        },
  { id: "4c", label: "Silent beat",      script: "[ no narration -- let the visual speak ]",                                 zoom: 1.2, dur: 0.4,  fx: 50, fy: 60, tr: "ease-out"    },
  { id: "5a", label: "Swatch click",     script: "Click any swatch to sample...",                                            zoom: 1.4, dur: 0.0,  fx: 25, fy: 75, tr: "CUT"         },
  { id: "5b", label: "Library",          script: "...reorder your image library...",                                         zoom: 1.2, dur: 0.35, fx: 75, fy: 50, tr: "ease-in-out" },
  { id: "5c", label: "Export",           script: "...and export the full palette as JSON, ready for your design workflow.",  zoom: 1.3, dur: 0.3,  fx: 80, fy: 85, tr: "ease-in"     },
  { id: "6a", label: "Pull back",        script: "Built with React, Node...",                                                zoom: 1.1, dur: 0.5,  fx: 50, fy: 50, tr: "ease-out"    },
  { id: "6b", label: "Full stack close", script: "...and a Python OpenCV pipeline for smart region detection.",              zoom: 1.0, dur: 0.35, fx: 50, fy: 50, tr: "ease-out"    },
];

const TRANSITIONS = ["CUT", "HOLD", "linear", "ease", "ease-in", "ease-out", "ease-in-out"];

const BEZIERS = {
  "linear":      [0.0,  0.0,  1.0,  1.0],
  "ease":        [0.25, 0.1,  0.25, 1.0],
  "ease-in":     [0.42, 0.0,  1.0,  1.0],
  "ease-out":    [0.0,  0.0,  0.58, 1.0],
  "ease-in-out": [0.42, 0.0,  0.58, 1.0],
};

const secColor = (id) => {
  if (id[0] === "1") return "#818cf8";
  if (id[0] === "2") return "#34d399";
  if (id[0] === "3") return "#fb923c";
  if (id[0] === "4") return "#f472b6";
  if (id[0] === "5") return "#60a5fa";
  return "#a78bfa";
};

const trColor = (t) => t === "CUT" ? "#f87171" : t === "HOLD" ? "#c084fc" : "#93c5fd";
const zColor  = (z) => z <= 1.1 ? "#4ade80" : z <= 1.3 ? "#facc15" : z <= 1.5 ? "#fb923c" : "#f87171";

function Curve({ tr, color, size = 24 }) {
  const b = BEZIERS[tr];
  if (!b) return <div style={{ width: size, height: size }} />;
  const [x1, y1, x2, y2] = b;
  const d = "M 0," + size + " C " + (x1*size) + "," + ((1-y1)*size) + " " + (x2*size) + "," + ((1-y2)*size) + " " + size + ",0";
  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ display: "block", flexShrink: 0 }}>
      <line x1="0" y1={size} x2={size} y2="0" stroke="#ffffff15" strokeWidth="1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Minimap({ beat, ac, onUpdate }) {
  const ref = useRef(null);
  const W = 180, H = 100;
  const vw = (1 / beat.zoom) * 100;
  const rx = Math.max(0, Math.min(100 - vw, beat.fx - vw / 2));
  const ry = Math.max(0, Math.min(100 - vw, beat.fy - vw / 2));

  const handleClick = (e) => {
    e.stopPropagation();
    const r = ref.current.getBoundingClientRect();
    const nx = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
    const ny = Math.round(Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)));
    onUpdate(nx, ny);
  };

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4b5563", marginBottom: 6, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.1em" }}>Focus Map (click to set)</div>
      <div ref={ref} onClick={handleClick} style={{ width: W, height: H, borderRadius: 6, border: "1px solid " + ac + "55", background: "#0a0a18", position: "relative", cursor: "crosshair", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "33%", top: 0, bottom: 0, width: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", left: "66%", top: 0, bottom: 0, width: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", top: "33%", left: 0, right: 0, height: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", top: "66%", left: 0, right: 0, height: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", left: rx + "%", top: ry + "%", width: vw + "%", height: vw + "%", border: "1.5px solid " + ac, background: ac + "18", borderRadius: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: beat.fx + "%", top: beat.fy + "%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: ac, boxShadow: "0 0 6px " + ac, pointerEvents: "none" }} />
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4b5563", textAlign: "center", marginTop: 4 }}>{beat.fx}% / {beat.fy}%</div>
    </div>
  );
}

function AnimatedMap({ beat, prevBeat, ac }) {
  const [phase, setPhase] = useState("end");
  const W = 320, H = 180;

  useEffect(() => {
    setPhase("start");
    const t = setTimeout(() => setPhase("end"), 32);
    return () => clearTimeout(t);
  }, [beat.id]);

  const from = prevBeat || beat;
  const b = phase === "end" ? beat : from;
  const vw = (1 / b.zoom) * 100;
  const rx = Math.max(0, Math.min(100 - vw, b.fx - vw / 2));
  const ry = Math.max(0, Math.min(100 - vw, b.fy - vw / 2));

  const isCut  = beat.tr === "CUT";
  const isHold = beat.tr === "HOLD";
  const cssTr  = (isCut || isHold) ? "none" : beat.tr;
  const cssDur = (isCut || isHold) ? 0 : beat.dur;

  const replay = (e) => {
    e.stopPropagation();
    setPhase("start");
    setTimeout(() => setPhase("end"), 32);
  };

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Animated Preview</div>
        <button onClick={replay} style={{ fontFamily: "monospace", fontSize: 9, color: "#6b7280", background: "none", border: "1px solid #2d2d4e", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}>replay</button>
      </div>
      <div style={{ width: W, height: H, borderRadius: 6, border: "1px solid " + ac + "55", background: "#0a0a18", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "33%", top: 0, bottom: 0, width: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", left: "66%", top: 0, bottom: 0, width: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", top: "33%", left: 0, right: 0, height: 1, background: "#ffffff10" }} />
        <div style={{ position: "absolute", top: "66%", left: 0, right: 0, height: 1, background: "#ffffff10" }} />
        <div style={{
          position: "absolute",
          left: rx + "%", top: ry + "%",
          width: vw + "%", height: vw + "%",
          border: "2px solid " + ac,
          background: ac + "22",
          borderRadius: 3,
          transition: phase === "end" ? (cssTr + " " + cssDur + "s") : "none",
        }} />
        <div style={{
          position: "absolute",
          left: b.fx + "%", top: b.fy + "%",
          transform: "translate(-50%,-50%)",
          width: 10, height: 10,
          borderRadius: "50%",
          background: ac,
          boxShadow: "0 0 10px " + ac,
          transition: phase === "end" ? (cssTr + " " + cssDur + "s") : "none",
        }} />
        <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "monospace", fontSize: 9, color: ac + "aa" }}>
          {beat.zoom}x / {beat.tr} / {beat.dur}s
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [beats, setBeats] = useState(BEATS.map(b => Object.assign({}, b)));
  const [cur, setCur] = useState(0);
  const prevBeatRef = useRef(null);

  const next = () => { prevBeatRef.current = beats[cur]; setCur(c => Math.min(c + 1, beats.length - 1)); };
  const prev = () => { prevBeatRef.current = beats[cur]; setCur(c => Math.max(c - 1, 0)); };
  const upd  = (i, key, val) => setBeats(bs => bs.map((b, j) => j === i ? Object.assign({}, b, { [key]: val }) : b));

  const beat = beats[cur];
  const ac = secColor(beat.id);

  const renderCard = (b, i, active) => (
    <div key={b.id} style={{
      padding: active ? "22px 28px" : "10px 16px",
      borderRadius: 10,
      background: "#0d0d1a",
      border: "1px solid " + (active ? ac + "55" : "#1a1a2e"),
      opacity: active ? 1 : 0.4,
      marginBottom: 10,
      position: "relative",
      boxSizing: "border-box",
    }}>
      {active && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: ac, borderRadius: "10px 0 0 10px" }} />}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: active ? 14 : 4 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: secColor(b.id), fontWeight: 700 }}>{b.id}</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{b.label}</span>
        </div>
        {!active && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Curve tr={b.tr} color={trColor(b.tr)} size={16} />
            <span style={{ fontFamily: "monospace", fontSize: 10, color: trColor(b.tr) }}>{b.tr}</span>
          </div>
        )}
      </div>

      {/* Script */}
      <p style={{ margin: "0 0 18px 0", fontSize: active ? 26 : 14, color: "#f1f5f9", lineHeight: 1.45, fontFamily: "Georgia, serif" }}>{b.script}</p>

      {/* Camera controls — active only */}
      {active && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Left column: focus map + transition selector + animated preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Minimap beat={b} ac={secColor(b.id)} onUpdate={(nx, ny) => { upd(i, "fx", nx); upd(i, "fy", ny); }} />

            {/* Transition selector */}
            <div onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Transition</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Curve tr={b.tr} color={trColor(b.tr)} size={26} />
                <select value={b.tr} onChange={e => upd(i, "tr", e.target.value)} style={{ fontFamily: "monospace", fontSize: 12, background: "#0f0f1a", color: trColor(b.tr), border: "1px solid #374151", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>
                  {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <AnimatedMap beat={b} prevBeat={prevBeatRef.current} ac={secColor(b.id)} />
          </div>

          {/* Steppers — stacked vertically to the right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "flex-start" }} onClick={e => e.stopPropagation()}>
            {[
              { label: "Zoom",     key: "zoom", min: 1.0, max: 3.0, step: 0.1,  unit: "x", val: b.zoom },
              { label: "Duration", key: "dur",  min: 0,   max: 2.0, step: 0.05, unit: "s", val: b.dur  },
              { label: "Focus X",  key: "fx",   min: 0,   max: 100, step: 5,    unit: "%", val: b.fx   },
              { label: "Focus Y",  key: "fy",   min: 0,   max: 100, step: 5,    unit: "%", val: b.fy   },
            ].map(({ label, key, min, max, step, unit, val }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => upd(i, key, Math.max(min, parseFloat((val - step).toFixed(2))))} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #2d2d4e", background: "#0f0f1a", color: "#9ca3af", fontSize: 14, cursor: "pointer", padding: 0 }}>-</button>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: key === "zoom" ? zColor(val) : "#e2e8f0", minWidth: 48, textAlign: "center" }}>{val}{unit}</span>
                  <button onClick={() => upd(i, key, Math.min(max, parseFloat((val + step).toFixed(2))))} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #2d2d4e", background: "#0f0f1a", color: "#9ca3af", fontSize: 14, cursor: "pointer", padding: 0 }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div onClick={next} style={{ minHeight: "100vh", background: "#08080f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: 24, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#374151", letterSpacing: "0.15em", textTransform: "uppercase" }}>Color Palette Maker -- Camera Script</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>{cur + 1} / {beats.length}</span>
        </div>

        {/* Main layout: cards left, nav right */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Cards column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {cur > 0 && renderCard(beats[cur - 1], cur - 1, false)}
            {renderCard(beat, cur, true)}
            {cur < beats.length - 1 && renderCard(beats[cur + 1], cur + 1, false)}
          </div>

          {/* Nav column */}
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, flexShrink: 0 }}>
            <button
              onClick={() => { prevBeatRef.current = null; setCur(0); }}
              style={{ padding: "10px 22px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#0f0f1a", color: "#9ca3af", fontFamily: "monospace", fontSize: 13, cursor: "pointer", textAlign: "center" }}>
              start
            </button>
            <button
              onClick={prev} disabled={cur === 0}
              style={{ padding: "10px 22px", borderRadius: 6, border: "1px solid " + (cur === 0 ? "#1a1a2e" : "#2d2d4e"), background: "#0f0f1a", color: cur === 0 ? "#272736" : "#9ca3af", fontFamily: "monospace", fontSize: 13, cursor: cur === 0 ? "not-allowed" : "pointer", textAlign: "center" }}>
              prev
            </button>
            <button
              onClick={next} disabled={cur === beats.length - 1}
              style={{ padding: "10px 22px", borderRadius: 6, border: "1px solid " + (cur === beats.length - 1 ? "#1a1a2e" : "#2d2d4e"), background: "#0f0f1a", color: cur === beats.length - 1 ? "#272736" : "#9ca3af", fontFamily: "monospace", fontSize: 13, cursor: cur === beats.length - 1 ? "not-allowed" : "pointer", textAlign: "center" }}>
              next
            </button>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#1f2937", textAlign: "center", marginTop: 4 }}>or click<br/>anywhere</div>
          </div>

        </div>
      </div>
    </div>
  );
}
