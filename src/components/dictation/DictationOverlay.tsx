import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

type Phase = "idle" | "listening" | "processing";

const DOT_COUNT = 10;
const MIN_RADIUS = 2;
const MAX_RADIUS = 3.5;

export default function DictationOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const levelRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const processTickRef = useRef(0);

  useEffect(() => {
    const unsubs = [
      listen("dictation-started", () => {
        setPhase("listening");
        setPartial("");
      }),
      listen("dictation-stopped", () => {
        // Apple speech: wait for dictation-completed
        // Whisper: will get dictation-processing then dictation-completed
      }),
      listen<number>("dictation-audio-level", (e) => {
        levelRef.current = e.payload;
      }),
      listen<string>("dictation-partial-result", (e) => {
        setPartial(e.payload);
      }),
      listen("dictation-processing", () => {
        setPhase("processing");
      }),
      listen("dictation-completed", () => {
        setPhase("idle");
        setPartial("");
      }),
      listen("dictation-error", () => {
        setPhase("idle");
        setPartial("");
      }),
    ];

    return () => {
      unsubs.forEach((p) => p.then((f) => f()));
    };
  }, []);

  // Canvas animation loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const spacing = w / (DOT_COUNT + 1);
    const centerY = h / 2;
    const level = levelRef.current;

    for (let i = 0; i < DOT_COUNT; i++) {
      const x = spacing * (i + 1);

      let scale: number;
      let alpha: number;

      if (phase === "processing") {
        processTickRef.current += 0.002;
        const wave = Math.sin(processTickRef.current * Math.PI * 2 + (i / DOT_COUNT) * Math.PI * 2);
        scale = 0.4 + 0.6 * ((wave + 1) / 2);
        alpha = 0.4 + 0.6 * ((wave + 1) / 2);
      } else {
        const distFromCenter = Math.abs(i - (DOT_COUNT - 1) / 2) / ((DOT_COUNT - 1) / 2);
        const positionWeight = 1 - distFromCenter * 0.6;
        scale = 0.3 + 0.7 * level * positionWeight;
        alpha = 0.3 + 0.7 * level * positionWeight;
      }

      const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * scale;
      ctx.beginPath();
      ctx.arc(x, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [phase]);

  useEffect(() => {
    if (phase === "idle") {
      cancelAnimationFrame(animRef.current);
      processTickRef.current = 0;
      return;
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, draw]);

  if (phase === "idle") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        animation: "dictation-slide-in 200ms ease-out",
      }}
    >
      <style>{`
        @keyframes dictation-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 9999,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "8px 16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: DOT_COUNT * 10, height: 16 }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 500,
            userSelect: "none",
            whiteSpace: "nowrap",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {phase === "processing"
            ? "Processing..."
            : partial || "Listening..."}
        </span>
      </div>
    </div>
  );
}
