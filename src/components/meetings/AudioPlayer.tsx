import { useRef, useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import Icon from "../shared/Icon";

interface Props {
  audioPath: string;
  durationSeconds?: number | null;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioPath, durationSeconds }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [error, setError] = useState<string | null>(null);

  const src = convertFileSrc(audioPath);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => {
      if (el.duration && isFinite(el.duration)) {
        setDuration(el.duration);
      }
    };
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setError(`Failed to load audio`);
      console.error("[AudioPlayer] error loading:", src, el.error);
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [src]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(
        () => setPlaying(true),
        (err) => {
          console.error("[AudioPlayer] play failed:", err);
          setError("Playback failed");
        },
      );
    }
  }, [playing]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = audioRef.current;
      const bar = barRef.current;
      if (!el || !bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      el.currentTime = ratio * duration;
    },
    [duration],
  );

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  if (error) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <Icon name="mic" size={14} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors hover:bg-accent/20"
      >
        <Icon name={playing ? "pause" : "play"} size={14} />
      </button>

      <div
        ref={barRef}
        onClick={seek}
        className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-border"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
        {fmtTime(current)} / {fmtTime(duration)}
      </span>
    </div>
  );
}
