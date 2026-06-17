import { useState } from "react";
import { Check } from "lucide-react";
import { useGame } from "../../context/GameContext";
import type { PlayerAction, PlayerView } from "../../context/GameContext";

// ── Sélecteur générique ────────────────────────────────────────────────────────

function TargetPicker({
  targets,
  allPlayers,
  selected,
  onToggle,
  max,
  label,
}: {
  targets: string[];
  allPlayers: PlayerView["alivePlayers"];
  selected: string[];
  onToggle: (id: string) => void;
  max: number;
  label?: string;
}) {
  const eligible = allPlayers.filter((p) => targets.includes(p.id));
  return (
    <div>
      {label && <p className="text-[9px] font-mono uppercase tracking-widest text-[#9490a0] mb-2">{label}</p>}
      <div className="flex flex-col gap-1.5">
        {eligible.map((p) => {
          const isSelected = selected.includes(p.id);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={p.id}
              onClick={() => !isDisabled && onToggle(p.id)}
              disabled={isDisabled}
              className="flex items-center gap-2.5 p-2.5 rounded-xl w-full text-left transition-all border disabled:opacity-35"
              style={{
                background: isSelected ? "rgba(139,28,28,0.18)" : "#0e0d14",
                borderColor: isSelected ? "rgba(139,28,28,0.65)" : "rgba(201,160,48,0.12)",
              }}
            >
              <div
                className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{
                  background: isSelected ? "rgba(139,28,28,0.3)" : "#1e1b2a",
                  borderColor: isSelected ? "rgba(139,28,28,0.6)" : "rgba(201,160,48,0.25)",
                  color: isSelected ? "#f0e8d0" : "#c9a030",
                  fontFamily: "Cinzel, serif",
                }}
              >
                {isSelected ? <Check size={11} /> : p.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm flex-1" style={{ fontFamily: "Cinzel, serif", color: isSelected ? "#f0e8d0" : "#c8c0b0" }}>
                {p.name}
              </span>
            </button>
          );
        })}
        {eligible.length === 0 && (
          <p className="text-[11px] text-[#9490a0] font-mono py-2 text-center">Aucune cible disponible</p>
        )}
      </div>
    </div>
  );
}

// ── Carte d'action générique ───────────────────────────────────────────────────

export function PlayerActionCard({
  action,
  playerView,
}: {
  action: PlayerAction;
  playerView: PlayerView;
}) {
  const { playerResolveAction } = useGame();
  const [selected, setSelected] = useState<string[]>([]);
  const [witchSave, setWitchSave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allPlayers = playerView.alivePlayers;
  const context = action.context as Record<string, unknown> | null;

  const accentColor = {
    seer_choose_target: "#a855f7",
    cupid_choose_lovers: "#ec4899",
    witch_choose_potions: "#10b981",
    hunter_choose_target: "#f97316",
    day_vote: "#c9a030",
  }[action.type] ?? "#c9a030";

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canConfirm = (): boolean => {
    if (submitted || loading) return false;
    switch (action.type) {
      case "seer_choose_target": return selected.length === 1;
      case "cupid_choose_lovers": return selected.length === 2;
      case "witch_choose_potions": return true; // peut ne rien faire
      case "hunter_choose_target": return selected.length === 1;
      case "day_vote": return selected.length === 1;
      default: return false;
    }
  };

  const buildPayload = (): Record<string, unknown> => {
    switch (action.type) {
      case "seer_choose_target": return { targetId: selected[0] };
      case "cupid_choose_lovers": return { lover1Id: selected[0], lover2Id: selected[1] };
      case "witch_choose_potions": return {
        save: witchSave,
        killTargetId: selected[0] ?? null,
      };
      case "hunter_choose_target": return { targetId: selected[0] };
      case "day_vote": return { targetId: selected[0] };
      default: return {};
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm()) return;
    setLoading(true);
    try {
      await playerResolveAction(action.id, buildPayload());
      setSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="p-4 rounded-2xl"
        style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}35` }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: accentColor }}>
          ✓ Action envoyée
        </p>
        <p className="text-sm text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          {action.title} — en attente de confirmation du MJ.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-2xl flex flex-col gap-3"
      style={{
        background: "#16141f",
        border: `1.5px solid ${accentColor}45`,
        boxShadow: `0 0 20px ${accentColor}0a`,
      }}
    >
      {/* En-tête */}
      <div className="flex items-start gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}35` }}
        >
          {{ seer_choose_target: "🔮", cupid_choose_lovers: "💘", witch_choose_potions: "⚗️", hunter_choose_target: "🏹", day_vote: "🗳️" }[action.type]}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>
            {action.title}
          </p>
          <p className="text-[11px] text-[#c8c0b0]/70 leading-snug mt-0.5" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            {action.description}
          </p>
        </div>
      </div>

      {/* Contenu spécifique par type */}
      {action.type === "seer_choose_target" && (
        <TargetPicker
          targets={action.targets}
          allPlayers={allPlayers}
          selected={selected}
          onToggle={toggle}
          max={1}
          label="Joueur à consulter"
        />
      )}

      {action.type === "cupid_choose_lovers" && (
        <div className="flex flex-col gap-2">
          <TargetPicker
            targets={action.targets}
            allPlayers={allPlayers}
            selected={selected}
            onToggle={toggle}
            max={2}
            label="Choisir deux amoureux (2 requis)"
          />
          {selected.length === 2 && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)" }}>
              <span className="text-sm">💘</span>
              <p className="text-xs text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                {allPlayers.find(p => p.id === selected[0])?.name} et{" "}
                {allPlayers.find(p => p.id === selected[1])?.name} seront liés pour l'éternité
              </p>
            </div>
          )}
        </div>
      )}

      {action.type === "witch_choose_potions" && (
        <div className="flex flex-col gap-3">
          {/* Victime des Loups */}
          {context?.wolvesTargetName && (
            <div className="p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.1)", border: "1px solid rgba(139,28,28,0.25)" }}>
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400 mb-1">Victime des Loups cette nuit</p>
              <p className="text-sm text-red-300 font-semibold" style={{ fontFamily: "Cinzel, serif" }}>
                {String(context.wolvesTargetName)}
              </p>
            </div>
          )}

          {/* Potion de vie */}
          {(context?.witchPotions as { life?: boolean } | undefined)?.life !== false && (
            <div className="p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 mb-2">🧪 Potion de vie</p>
              {context?.wolvesTargetName ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#c8c0b0] flex-1" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                    Sauver <strong className="text-emerald-400">{String(context.wolvesTargetName)}</strong> ?
                  </p>
                  <button
                    onClick={() => setWitchSave(!witchSave)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                    style={{
                      background: witchSave ? "rgba(16,185,129,0.2)" : "transparent",
                      borderColor: witchSave ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.3)",
                      color: witchSave ? "#34d399" : "#6ee7b7",
                      fontFamily: "Cinzel, serif",
                    }}
                  >
                    {witchSave ? "✓ Sauver" : "Sauver"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#9490a0] font-mono">Les Loups n'ont pas ciblé de victime</p>
              )}
            </div>
          )}

          {/* Potion de mort */}
          {(context?.witchPotions as { death?: boolean } | undefined)?.death !== false && (
            <div className="p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.06)", border: "1px solid rgba(139,28,28,0.2)" }}>
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400 mb-2">💀 Potion de mort</p>
              <TargetPicker
                targets={action.targets}
                allPlayers={allPlayers}
                selected={selected}
                onToggle={(id) => setSelected(selected.includes(id) ? [] : [id])}
                max={1}
                label="Tuer quelqu'un (optionnel)"
              />
            </div>
          )}
        </div>
      )}

      {action.type === "hunter_choose_target" && (
        <TargetPicker
          targets={action.targets}
          allPlayers={[
            ...allPlayers,
            // Le chasseur est mort : inclure les joueurs morts dans la liste si besoin (non, cible = vivants)
          ]}
          selected={selected}
          onToggle={toggle}
          max={1}
          label="Choisir ta cible"
        />
      )}

      {action.type === "day_vote" && (
        <TargetPicker
          targets={action.targets}
          allPlayers={allPlayers}
          selected={selected}
          onToggle={toggle}
          max={1}
          label="Voter contre"
        />
      )}

      {/* Bouton confirmer */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm()}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canConfirm() ? `${accentColor}cc` : `${accentColor}30`,
          color: "#fff",
          fontFamily: "Cinzel, serif",
          letterSpacing: "0.05em",
        }}
      >
        {loading ? "Envoi..." : (
          action.type === "witch_choose_potions"
            ? (witchSave || selected.length > 0 ? "Confirmer mes choix" : "Ne rien faire")
            : "Confirmer"
        )}
      </button>
    </div>
  );
}
