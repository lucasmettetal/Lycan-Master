import { useEffect, useRef, useState } from "react";
import { useGame } from "../../context/GameContext";
import type { GameState } from "../../context/GameContext";

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function PhaseTimer({ game }: { game: GameState }) {
  const { gmTimerStart, gmTimerPause, gmTimerReset, gmTimerAdd } = useGame();
  const t = game.phaseTimer ?? { duration: 300, remaining: 300, startedAt: null, running: false };

  // Computed display: if running, tick locally from startedAt
  const [display, setDisplay] = useState(t.remaining);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (t.running && t.startedAt) {
      const elapsed = (Date.now() - t.startedAt) / 1000;
      setDisplay(Math.max(0, t.remaining - elapsed));

      tickRef.current = setInterval(() => {
        const e = (Date.now() - t.startedAt!) / 1000;
        setDisplay(Math.max(0, t.remaining - e));
      }, 250);
    } else {
      setDisplay(t.remaining);
    }

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [t.running, t.startedAt, t.remaining]);

  const isAlert = display <= 10 && display > 0;
  const isExpired = display <= 0;
  const progress = t.duration > 0 ? Math.max(0, Math.min(1, display / t.duration)) : 0;

  const handleStartPause = async () => {
    if (t.running) await gmTimerPause();
    else await gmTimerStart();
  };

  return (
    <div
      className="mx-5 mb-4 p-4 rounded-2xl transition-all"
      style={{
        background: isAlert ? "rgba(239,68,68,0.08)" : isExpired ? "rgba(239,68,68,0.04)" : "rgba(201,160,48,0.04)",
        border: `1px solid ${isAlert ? "rgba(239,68,68,0.4)" : isExpired ? "rgba(239,68,68,0.15)" : "rgba(201,160,48,0.15)"}`,
        boxShadow: isAlert ? "0 0 20px rgba(239,68,68,0.1)" : "none",
      }}
    >
      {/* Titre */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: isAlert ? "#ef4444" : "#9490a0" }}>
          ⏱ Timer de phase
        </p>
        {isExpired && t.running === false && (
          <span className="text-[9px] font-mono text-[#ef4444] animate-pulse">Temps écoulé !</span>
        )}
      </div>

      {/* Affichage MM:SS */}
      <p
        className="text-4xl font-mono text-center mb-3 tabular-nums transition-colors"
        style={{
          fontFamily: "Cinzel, serif",
          color: isAlert ? "#ef4444" : isExpired ? "#9490a0" : "#e8ddd0",
          letterSpacing: "0.08em",
          textShadow: isAlert ? "0 0 20px rgba(239,68,68,0.4)" : "none",
        }}
      >
        {formatTime(display)}
      </p>

      {/* Barre de progression */}
      <div className="h-1 rounded-full mb-4" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${progress * 100}%`,
            background: isAlert
              ? "linear-gradient(90deg, #ef4444, #f97316)"
              : "linear-gradient(90deg, #8b1c1c, #c9a030)",
          }}
        />
      </div>

      {/* Contrôles */}
      <div className="flex gap-2">
        {/* Start / Pause */}
        <button
          onClick={handleStartPause}
          className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
          style={{
            background: t.running ? "rgba(239,68,68,0.18)" : "rgba(201,160,48,0.18)",
            border: `1px solid ${t.running ? "rgba(239,68,68,0.4)" : "rgba(201,160,48,0.4)"}`,
            color: t.running ? "#ef4444" : "#c9a030",
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.04em",
          }}
        >
          {t.running ? "⏸ Pause" : "▶ Start"}
        </button>

        {/* Reset */}
        <button
          onClick={() => gmTimerReset()}
          className="px-3 py-2 rounded-xl text-xs transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9490a0" }}
          title="Réinitialiser"
        >
          ↺
        </button>

        {/* +1 min */}
        <button
          onClick={() => gmTimerAdd(60)}
          className="px-3 py-2 rounded-xl text-[10px] font-mono transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9490a0" }}
          title="+1 minute"
        >
          +1m
        </button>
      </div>
    </div>
  );
}
