import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "../../lib/tauri";

const DOT_COUNT = 10;
const MIN_R = 2;
const MAX_R = 3.5;

interface Props {
  processing?: boolean;
}

export default function DictationPill({ processing = false }: Props) {
  const [dots, setDots] = useState<number[]>(Array(DOT_COUNT).fill(0));
  const animRef = useRef(0);
  const phase = useRef(0);
  const smoothLevel = useRef(0);

  useEffect(() => {
    const tick = async () => {
      const next = new Array(DOT_COUNT);

      if (processing) {
        // Smooth traveling wave during LLM processing
        phase.current += 0.06;
        for (let i = 0; i < DOT_COUNT; i++) {
          next[i] = (Math.sin(phase.current + i * 0.6) + 1) / 2;
        }
      } else {
        // Poll mic level
        let lv = 0;
        try {
          lv = await invoke<number>("get_dictation_level");
        } catch {
          // ignore
        }

        const level = Math.max(0, Math.min(1, lv));
        // Light smoothing for natural feel
        smoothLevel.current += (level - smoothLevel.current) * 0.5;
        const sl = smoothLevel.current;

        // Advance phase based on audio level — louder = faster wave
        phase.current += 0.05 + sl * 0.15;

        // Traveling sine wave whose amplitude is driven by mic level
        for (let i = 0; i < DOT_COUNT; i++) {
          const wave = (Math.sin(phase.current + i * 0.7) + 1) / 2;
          next[i] = wave * sl;
        }
      }

      setDots(next);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [processing]);

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      onMouseDown={() => getCurrentWindow().startDragging()}
    >
      <div
        className="flex items-center justify-center overflow-hidden border border-white/[0.14] bg-[#131927d4] backdrop-blur-2xl select-none"
        style={{ height: 28, borderRadius: 14, padding: "0 12px", gap: 3 }}
      >
        {dots.map((d, i) => {
          const r = MIN_R + d * (MAX_R - MIN_R);
          const size = r * 2;
          return (
            <div
              key={i}
              className="rounded-full shrink-0"
              style={{
                width: size,
                height: size,
                opacity: 0.3 + d * 0.7,
                backgroundColor: processing ? "rgba(154, 176, 77, 0.9)" : "white",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
