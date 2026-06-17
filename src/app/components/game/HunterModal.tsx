import { useState } from "react";
import { useGame } from "../../context/GameContext";
import type { GameState } from "../../context/GameContext";

export function HunterModal({ game }: { game: GameState }) {
  const { gmHunterShoot } = useGame();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hunterId = game.pendingHunterActions[0];
  const hunter = game.players.find((p) => p.id === hunterId);
  const aliveTargets = game.players.filter((p) => p.status !== "dead" && p.id !== hunterId);

  if (!hunter) return null;

  const handleConfirm = async () => {
    if (!selectedTarget || loading) return;
    setLoading(true);
    try {
      await gmHunterShoot(hunterId, selectedTarget);
      setSelectedTarget(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay non-dismissible (pas de clic en dehors)
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center px-5"
      style={{ background: "rgba(10,5,5,0.92)", backdropFilter: "blur(4px)" }}
    >
      {/* Panneau */}
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "#16141f", border: "1.5px solid rgba(249,115,22,0.5)", boxShadow: "0 0 40px rgba(249,115,22,0.15)" }}
      >
        {/* En-tête */}
        <div
          className="px-5 pt-5 pb-4 text-center"
          style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.1) 0%, transparent 100%)" }}
        >
          <p className="text-3xl mb-2">🏹</p>
          <h2 className="text-base font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>
            Dernier tir du Chasseur
          </h2>
          <p className="text-xs text-[#f97316] mt-1 font-mono">{hunter.name} est mort(e)</p>
          <p className="text-xs text-[#c8c0b0]/70 mt-2 leading-snug" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Le Chasseur doit désigner une victime avant de tomber.
          </p>
        </div>

        <div className="px-4 pb-5">
          {/* Sélection de la cible */}
          <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-2">Choisir une cible</p>

          {aliveTargets.length === 0 ? (
            <p className="text-sm text-[#9490a0] text-center py-4" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              Aucun joueur vivant disponible.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {aliveTargets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedTarget(p.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all"
                  style={{
                    background: selectedTarget === p.id ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selectedTarget === p.id ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{
                      background: selectedTarget === p.id ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)",
                      color: selectedTarget === p.id ? "#f97316" : "#9490a0",
                      fontFamily: "Cinzel, serif",
                    }}
                  >
                    {p.name[0].toUpperCase()}
                  </div>
                  <span
                    className="text-sm"
                    style={{
                      color: selectedTarget === p.id ? "#e8ddd0" : "#c8c0b0",
                      fontFamily: "Crimson Pro, Georgia, serif",
                    }}
                  >
                    {p.name}
                  </span>
                  {selectedTarget === p.id && (
                    <span className="ml-auto text-[#f97316] text-base">🎯</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Bouton confirmer */}
          <button
            onClick={handleConfirm}
            disabled={!selectedTarget || loading}
            className="w-full mt-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selectedTarget && !loading ? "rgba(249,115,22,0.85)" : "rgba(249,115,22,0.3)",
              color: "#fff",
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.05em",
            }}
          >
            {loading ? "Tir en cours…" : "🏹 Confirmer le tir"}
          </button>

          {game.pendingHunterActions.length > 1 && (
            <p className="text-[10px] text-[#9490a0] font-mono text-center mt-2">
              {game.pendingHunterActions.length - 1} tir(s) supplémentaire(s) en attente
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
