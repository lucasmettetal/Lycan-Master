import { useState, useEffect } from "react";
import { Check, ChevronRight, Smartphone, RotateCcw } from "lucide-react";
import { useGame } from "../../context/GameContext";
import type { GameState, Player, PlayerAction } from "../../context/GameContext";
import { ROLES } from "../../../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────────

type StepId = "cupid" | "seer" | "wolves" | "witch";
type StepMode = "manual" | "waiting" | "done";

interface Step {
  id: StepId;
  label: string;
  emoji: string;
}

interface SeerReveal {
  name: string;
  role: string;
  roleData: { name: string; emoji: string; description: string; category: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WOLF_ROLE_IDS = new Set(ROLES.filter((r) => r.category === "wolves").map((r) => r.id));

function buildSteps(game: GameState): Step[] {
  const steps: Step[] = [];
  const hasAliveRole = (id: string) =>
    game.players.some((p) => p.role === id && p.status !== "dead");
  const hasAliveWolf = game.players.some(
    (p) => WOLF_ROLE_IDS.has(p.role ?? "") && p.status !== "dead"
  );

  if (game.phaseNumber === 1 && hasAliveRole("cupid"))
    steps.push({ id: "cupid", label: "Cupidon", emoji: "💘" });
  if (hasAliveRole("seer"))
    steps.push({ id: "seer", label: "Voyante", emoji: "🔮" });
  if (hasAliveWolf)
    steps.push({ id: "wolves", label: "Loups", emoji: "🐺" });
  if (hasAliveRole("witch") && (game.witchPotions?.life || game.witchPotions?.death))
    steps.push({ id: "witch", label: "Sorcière", emoji: "⚗️" });

  return steps;
}

// ── Badge "En attente joueur" ─────────────────────────────────────────────────

function WaitingForPlayer({
  playerName,
  isConnected,
  action,
  onOverride,
}: {
  playerName: string | undefined;
  isConnected: boolean;
  action: PlayerAction | undefined;
  onOverride: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: "rgba(201,160,48,0.06)", border: "1px solid rgba(201,160,48,0.2)" }}
      >
        <div className="relative flex-shrink-0">
          <Smartphone size={18} className="text-[#c9a030]" />
          {isConnected && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs text-[#e8ddd0] font-semibold" style={{ fontFamily: "Cinzel, serif" }}>
            En attente de {playerName ?? "…"}
          </p>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: isConnected ? "#34d399" : "#ef4444" }}>
            {isConnected ? "● Connecté(e)" : "○ Hors ligne"}
          </p>
        </div>
        {action?.status === "resolved" && (
          <span className="text-emerald-400 text-xs font-mono">✓ Résolu</span>
        )}
        {action?.status === "pending" && (
          <span className="text-[9px] text-[#9490a0] font-mono animate-pulse">en cours…</span>
        )}
      </div>

      <button
        onClick={onOverride}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs border transition-all active:scale-95"
        style={{ borderColor: "rgba(201,160,48,0.25)", color: "#9490a0", fontFamily: "Cinzel, serif" }}
      >
        <RotateCcw size={12} />
        Reprendre en mode MJ
      </button>
    </div>
  );
}

// ── Bouton déléguer ───────────────────────────────────────────────────────────

function DelegateButton({
  playerName,
  isConnected,
  onClick,
}: {
  playerName: string | undefined;
  isConnected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full py-2.5 px-3 rounded-xl text-xs border transition-all active:scale-95"
      style={{
        background: isConnected ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.03)",
        borderColor: isConnected ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.1)",
        color: isConnected ? "#34d399" : "#9490a0",
        fontFamily: "Cinzel, serif",
      }}
    >
      <Smartphone size={13} className="flex-shrink-0" />
      <span className="flex-1 text-left">
        Envoyer à {playerName ?? "…"}{" "}
        {!isConnected && <span className="text-[9px] opacity-60">(hors ligne)</span>}
      </span>
      <ChevronRight size={12} />
    </button>
  );
}

// ── Sélecteur de joueur ────────────────────────────────────────────────────────

function PlayerPicker({
  players,
  selected,
  onSelect,
  exclude = [],
  label,
}: {
  players: Player[];
  selected: string | null;
  onSelect: (id: string) => void;
  exclude?: string[];
  label?: string;
}) {
  const eligible = players.filter((p) => p.status !== "dead" && !exclude.includes(p.id));
  return (
    <div>
      {label && (
        <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-2">{label}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {eligible.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all active:scale-98 border"
            style={{
              background: selected === p.id ? "rgba(139,28,28,0.2)" : "#0e0d14",
              borderColor: selected === p.id ? "rgba(139,28,28,0.7)" : "rgba(201,160,48,0.12)",
            }}
          >
            <div
              className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{
                background: selected === p.id ? "rgba(139,28,28,0.3)" : "#1e1b2a",
                borderColor: selected === p.id ? "rgba(139,28,28,0.6)" : "rgba(201,160,48,0.25)",
                color: selected === p.id ? "#f0e8d0" : "#c9a030",
                fontFamily: "Cinzel, serif",
              }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <span
              className="text-sm font-medium flex-1"
              style={{ fontFamily: "Cinzel, serif", color: selected === p.id ? "#f0e8d0" : "#c8c0b0" }}
            >
              {p.name}
            </span>
            {selected === p.id && <Check size={14} className="text-red-400 flex-shrink-0" />}
          </button>
        ))}
        {eligible.length === 0 && (
          <p className="text-[11px] text-[#9490a0] font-mono py-2 text-center">Aucun joueur disponible</p>
        )}
      </div>
    </div>
  );
}

// ── Étape Cupidon ─────────────────────────────────────────────────────────────

function CupidStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmCupidLink, gmCreatePlayerAction, gmCancelPlayerAction } = useGame();
  const [mode, setMode] = useState<StepMode>("manual");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [lover1, setLover1] = useState<string | null>(null);
  const [lover2, setLover2] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linkedNames, setLinkedNames] = useState<[string, string] | null>(null);

  const cupid = game.players.find((p) => p.role === "cupid" && p.status !== "dead");

  // Surveiller la résolution de l'action par le joueur
  useEffect(() => {
    if (mode !== "waiting" || !pendingActionId) return;
    const action = game.pendingPlayerActions?.find((a) => a.id === pendingActionId);
    if (action?.status === "resolved" && action.result) {
      const { lover1Id, lover2Id } = action.result as { lover1Id: string; lover2Id: string };
      const n1 = game.players.find((p) => p.id === lover1Id)?.name ?? "?";
      const n2 = game.players.find((p) => p.id === lover2Id)?.name ?? "?";
      setLinkedNames([n1, n2]);
      setLinked(true);
      setMode("done");
    }
  }, [game.pendingPlayerActions, pendingActionId, mode]);

  const handleDelegate = async () => {
    if (!cupid) return;
    setLoading(true);
    try {
      const actionId = await gmCreatePlayerAction({
        playerId: cupid.id,
        type: "cupid_choose_lovers",
        title: "Choisir les amoureux",
        description: "Désigne exactement deux joueurs à unir par l'amour éternel.",
        targets: game.players.filter((p) => p.status !== "dead" && p.id !== cupid.id).map((p) => p.id),
        minTargets: 2,
        maxTargets: 2,
      });
      setPendingActionId(actionId);
      setMode("waiting");
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (pendingActionId) await gmCancelPlayerAction(pendingActionId);
    setPendingActionId(null);
    setMode("manual");
  };

  const handleLink = async () => {
    if (!lover1 || !lover2) return;
    setLoading(true);
    await gmCupidLink(lover1, lover2);
    const n1 = game.players.find((p) => p.id === lover1)?.name ?? "?";
    const n2 = game.players.find((p) => p.id === lover2)?.name ?? "?";
    setLinkedNames([n1, n2]);
    setLinked(true);
    setMode("done");
    setLoading(false);
  };

  if (linked || mode === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="text-4xl">💘</div>
        <p className="text-sm text-[#c9a030] font-semibold text-center" style={{ fontFamily: "Cinzel, serif" }}>
          {linkedNames ? `${linkedNames[0]} et ${linkedNames[1]} sont liés pour l'éternité` : "Amoureux unis"}
        </p>
        <button onClick={onDone} className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}>
          Suivant →
        </button>
      </div>
    );
  }

  if (mode === "waiting") {
    return (
      <WaitingForPlayer
        playerName={cupid?.name}
        isConnected={cupid?.isConnected ?? false}
        action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)}
        onOverride={handleOverride}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
        Cupidon ouvre les yeux. Choisissez deux joueurs à unir par l'amour éternel.
      </p>
      {cupid && (
        <DelegateButton
          playerName={cupid.name}
          isConnected={cupid.isConnected}
          onClick={handleDelegate}
        />
      )}
      <PlayerPicker players={game.players} selected={lover1}
        onSelect={(id) => { setLover1(id); if (lover2 === id) setLover2(null); }}
        label="Premier amoureux" />
      <PlayerPicker players={game.players} selected={lover2}
        onSelect={(id) => { setLover2(id); if (lover1 === id) setLover1(null); }}
        exclude={lover1 ? [lover1] : []}
        label="Deuxième amoureux" />
      <button
        onClick={handleLink}
        disabled={!lover1 || !lover2 || loading}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95 disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}
      >
        {loading ? "Liaison..." : "💘 Unir ces deux joueurs"}
      </button>
    </div>
  );
}

// ── Étape Voyante ─────────────────────────────────────────────────────────────

function SeerStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmSeerCheck, gmCreatePlayerAction, gmCancelPlayerAction } = useGame();
  const [mode, setMode] = useState<StepMode>("manual");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [reveal, setReveal] = useState<SeerReveal | null>(null);
  const [loading, setLoading] = useState(false);

  const seer = game.players.find((p) => p.role === "seer" && p.status !== "dead");

  // Surveiller la résolution de l'action par le joueur
  useEffect(() => {
    if (mode !== "waiting" || !pendingActionId) return;
    const action = game.pendingPlayerActions?.find((a) => a.id === pendingActionId);
    if (action?.status === "resolved" && action.result) {
      const { targetName, role, roleData } = action.result as {
        targetName: string; role: string;
        roleData: { name: string; emoji: string; description: string; category: string } | null;
      };
      setReveal({ name: targetName, role, roleData });
      setMode("done");
    }
  }, [game.pendingPlayerActions, pendingActionId, mode]);

  const handleDelegate = async () => {
    if (!seer) return;
    setLoading(true);
    try {
      const actionId = await gmCreatePlayerAction({
        playerId: seer.id,
        type: "seer_choose_target",
        title: "Vision nocturne",
        description: "Désigne un joueur pour révéler son rôle.",
        targets: game.players.filter((p) => p.status !== "dead" && p.id !== seer.id).map((p) => p.id),
        minTargets: 1,
        maxTargets: 1,
      });
      setPendingActionId(actionId);
      setMode("waiting");
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (pendingActionId) await gmCancelPlayerAction(pendingActionId);
    setPendingActionId(null);
    setMode("manual");
    setReveal(null);
  };

  const handleCheck = async () => {
    if (!target) return;
    setLoading(true);
    try {
      const res = await gmSeerCheck(target);
      setReveal(res);
      setMode("done");
    } finally {
      setLoading(false);
    }
  };

  if (reveal && mode === "done") {
    const isWolf = reveal.roleData?.category === "wolves";
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="text-4xl">{reveal.roleData?.emoji ?? "❓"}</div>
        <div
          className="w-full p-4 rounded-xl text-center"
          style={{
            background: isWolf ? "rgba(139,28,28,0.2)" : "rgba(201,160,48,0.08)",
            border: `1px solid ${isWolf ? "rgba(139,28,28,0.5)" : "rgba(201,160,48,0.25)"}`,
          }}
        >
          <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-1">{reveal.name} est…</p>
          <p className="text-xl font-bold" style={{ fontFamily: "Cinzel Decorative, Cinzel, serif", color: isWolf ? "#f87171" : "#c9a030" }}>
            {reveal.roleData?.name ?? reveal.role}
          </p>
          {isWolf && <p className="text-xs text-red-400 font-mono mt-1 animate-pulse">🐺 LOUP-GAROU</p>}
        </div>
        <button onClick={onDone} className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}>
          Suivant →
        </button>
      </div>
    );
  }

  if (mode === "waiting") {
    return (
      <WaitingForPlayer
        playerName={seer?.name}
        isConnected={seer?.isConnected ?? false}
        action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)}
        onOverride={handleOverride}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
        La Voyante ({seer?.name}) ouvre les yeux. Choisissez un joueur pour révéler son rôle.
      </p>
      {seer && (
        <DelegateButton
          playerName={seer.name}
          isConnected={seer.isConnected}
          onClick={handleDelegate}
        />
      )}
      <PlayerPicker players={game.players} selected={target} onSelect={setTarget}
        exclude={seer ? [seer.id] : []} label="Joueur à consulter" />
      <button
        onClick={handleCheck}
        disabled={!target || loading}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95 disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}
      >
        {loading ? "Révélation..." : "🔮 Révéler le rôle"}
      </button>
    </div>
  );
}

// ── Étape Loups (MJ uniquement) ───────────────────────────────────────────────

function WolvesStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmWolvesTarget, gmWolvesNoKill } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [decided, setDecided] = useState(false);

  const wolfIds = new Set(
    game.players.filter((p) => p.role === "werewolf" || p.role === "bigbadwolf").map((p) => p.id)
  );

  const handleDecide = async (kill: boolean) => {
    setLoading(true);
    if (kill && target) await gmWolvesTarget(target);
    else await gmWolvesNoKill();
    setDecided(true);
    setLoading(false);
  };

  if (decided) {
    const victim = target ? game.players.find((p) => p.id === target) : null;
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="text-4xl">{victim ? "🎯" : "🌙"}</div>
        <p className="text-sm text-[#c8c0b0] text-center" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          {victim ? `Les Loups ciblent ${victim.name}` : "Les Loups ne tuent personne cette nuit"}
        </p>
        <button onClick={onDone} className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}>
          Suivant →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
        Les Loups ouvrent les yeux et désignent leur victime en silence.
      </p>
      <PlayerPicker players={game.players} selected={target} onSelect={setTarget}
        exclude={[...wolfIds]} label="Victime désignée" />
      <div className="flex gap-2">
        <button
          onClick={() => handleDecide(true)}
          disabled={!target || loading}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}
        >
          {loading ? "..." : "🎯 Confirmer la cible"}
        </button>
        <button
          onClick={() => handleDecide(false)}
          disabled={loading}
          className="px-4 py-3 rounded-xl text-sm border transition-all active:scale-95"
          style={{ borderColor: "rgba(201,160,48,0.3)", color: "#9490a0", fontFamily: "Cinzel, serif" }}
        >
          Aucun
        </button>
      </div>
    </div>
  );
}

// ── Étape Sorcière ────────────────────────────────────────────────────────────

function WitchStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmWitchSave, gmWitchKill, gmCreatePlayerAction, gmCancelPlayerAction } = useGame();
  const [mode, setMode] = useState<StepMode>("manual");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [lifeUsed, setLifeUsed] = useState(false);
  const [deathTarget, setDeathTarget] = useState<string | null>(null);
  const [deathUsed, setDeathUsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { witchPotions, nightActions } = game;
  const victimId = nightActions?.wolvesTarget;
  const victim = victimId ? game.players.find((p) => p.id === victimId) : null;
  const witch = game.players.find((p) => p.role === "witch" && p.status !== "dead");

  // Surveiller la résolution de l'action par la Sorcière
  useEffect(() => {
    if (mode !== "waiting" || !pendingActionId) return;
    const action = game.pendingPlayerActions?.find((a) => a.id === pendingActionId);
    if (action?.status === "resolved") {
      setMode("done");
      onDone();
    }
  }, [game.pendingPlayerActions, pendingActionId, mode, onDone]);

  const handleDelegate = async () => {
    if (!witch) return;
    setLoading(true);
    try {
      const actionId = await gmCreatePlayerAction({
        playerId: witch.id,
        type: "witch_choose_potions",
        title: "Utiliser tes potions",
        description: "Choisis d'utiliser ta potion de vie, de mort, les deux, ou aucune.",
        targets: game.players.filter((p) => p.status !== "dead").map((p) => p.id),
        minTargets: 0,
        maxTargets: 1,
        context: {
          wolvesTargetId: victimId ?? null,
          wolvesTargetName: victim?.name ?? null,
          witchPotions: { ...witchPotions },
        },
      });
      setPendingActionId(actionId);
      setMode("waiting");
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (pendingActionId) await gmCancelPlayerAction(pendingActionId);
    setPendingActionId(null);
    setMode("manual");
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await gmWitchSave();
      setLifeUsed(true);
    } catch (e: unknown) {
      console.error("[WitchStep] handleSave:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleKill = async () => {
    if (!deathTarget) return;
    setLoading(true);
    try {
      await gmWitchKill(deathTarget);
      setDeathUsed(true);
    } catch (e: unknown) {
      console.error("[WitchStep] handleKill:", e);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "waiting") {
    return (
      <WaitingForPlayer
        playerName={witch?.name}
        isConnected={witch?.isConnected ?? false}
        action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)}
        onOverride={handleOverride}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
        La Sorcière ouvre les yeux et peut utiliser ses potions.
      </p>

      {witch && (
        <DelegateButton
          playerName={witch.name}
          isConnected={witch.isConnected}
          onClick={handleDelegate}
        />
      )}

      {/* Potion de vie — visible si disponible OU déjà utilisée cette nuit */}
      {(witchPotions?.life || lifeUsed) && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest mb-2">🧪 Potion de vie</p>
          {lifeUsed ? (
            <p className="text-xs text-emerald-400 font-mono">✓ {victim?.name ?? "victime"} sera sauvé(e) cette nuit</p>
          ) : victim ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#c8c0b0] flex-1" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                Les Loups ciblent <strong className="text-red-400">{victim.name}</strong>. Sauver ?
              </p>
              <button onClick={handleSave} disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-all"
                style={{ fontFamily: "Cinzel, serif" }}>
                {loading ? "..." : "Sauver"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#9490a0] font-mono">Les Loups n'ont pas ciblé de victime</p>
          )}
        </div>
      )}

      {/* Potion de mort — visible si disponible OU déjà utilisée cette nuit */}
      {(witchPotions?.death || deathUsed) && (
        <div className="p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.06)", border: "1px solid rgba(139,28,28,0.2)" }}>
          <p className="text-[9px] text-red-400 font-mono uppercase tracking-widest mb-2">💀 Potion de mort</p>
          {deathUsed ? (
            <p className="text-xs text-red-400 font-mono">
              ✓ Potion utilisée sur {game.players.find((p) => p.id === deathTarget)?.name ?? "cible"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <PlayerPicker players={game.players} selected={deathTarget} onSelect={setDeathTarget}
                exclude={witch ? [witch.id] : []}
                label="Tuer quelqu'un (optionnel)" />
              {deathTarget && (
                <button onClick={handleKill} disabled={loading}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-all"
                  style={{ fontFamily: "Cinzel, serif" }}>
                  {loading ? "..." : "💀 Utiliser la potion de mort"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={onDone} disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#f0e8d0] transition-all active:scale-95"
        style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)", fontFamily: "Cinzel, serif" }}>
        Suivant →
      </button>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function NightWizard({ onResolve }: { onResolve: () => void }) {
  const { state, gmResolveNight } = useGame();
  const game = state.game!;
  const [stepIndex, setStepIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Gelé au montage : buildSteps ne doit pas retirer dynamiquement une étape active
  // (ex : Sorcière utilise les deux potions → witchPotions vides → étape disparaît → currentStep undefined → crash)
  const [steps] = useState(() => buildSteps(game));
  const currentStep = steps[stepIndex];

  const advance = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setAllDone(true);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await gmResolveNight();
      onResolve();
    } catch (e: unknown) {
      console.error("[NightWizard] handleResolve:", e);
      setResolving(false);
    }
  };

  if (allDone) {
    const victimId = game.nightActions?.wolvesTarget;
    const victim = victimId ? game.players.find((p) => p.id === victimId) : null;
    const witchSaved = game.nightActions?.witchSaved;
    const witchKillId = game.nightActions?.witchKillTarget;
    const witchKillPlayer = witchKillId ? game.players.find((p) => p.id === witchKillId) : null;

    return (
      <div className="p-4 rounded-2xl flex flex-col gap-4" style={{ background: "#0e0d14", border: "1px solid rgba(201,160,48,0.2)" }}>
        <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest">Résumé de la nuit</p>

        {victim ? (
          <div className="flex items-center gap-2">
            <span className="text-base">{witchSaved ? "🧪" : "💀"}</span>
            <p className="text-sm text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              {witchSaved
                ? <><strong className="text-emerald-400">{victim.name}</strong> sauvé(e) par la Sorcière</>
                : <><strong className="text-red-400">{victim.name}</strong> tué(e) par les Loups</>
              }
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#9490a0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            🌙 Les Loups n'ont tué personne
          </p>
        )}

        {witchKillPlayer && (
          <div className="flex items-center gap-2">
            <span className="text-base">☠️</span>
            <p className="text-sm text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              <strong className="text-red-400">{witchKillPlayer.name}</strong> tué(e) par la potion de mort
            </p>
          </div>
        )}

        <button
          onClick={handleResolve}
          disabled={resolving}
          className="w-full py-4 rounded-xl font-semibold uppercase text-sm tracking-widest transition-all active:scale-95 disabled:opacity-40"
          style={{
            fontFamily: "Cinzel, serif",
            background: "linear-gradient(135deg, #8b1c1c 0%, #6b1414 100%)",
            color: "#f0e8d0",
            boxShadow: "0 0 24px rgba(139,28,28,0.35)",
            letterSpacing: "0.1em",
          }}
        >
          {resolving ? "Résolution..." : "☀️ Résoudre la nuit"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(201,160,48,0.18)" }}>
      {/* Stepper */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#0e0d14" }}>
        <span className="text-base">{currentStep.emoji}</span>
        <p className="text-sm font-semibold text-[#e8ddd0] flex-1" style={{ fontFamily: "Cinzel, serif" }}>
          {currentStep.label}
        </p>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className="w-5 h-5 rounded-full border flex items-center justify-center text-[8px] font-mono transition-colors"
              style={{
                background: i === stepIndex ? "rgba(139,28,28,0.3)" : i < stepIndex ? "rgba(16,185,129,0.2)" : "transparent",
                borderColor: i === stepIndex ? "rgba(139,28,28,0.7)" : i < stepIndex ? "rgba(16,185,129,0.5)" : "rgba(201,160,48,0.2)",
                color: i === stepIndex ? "#f0e8d0" : i < stepIndex ? "#34d399" : "#9490a0",
              }}
            >
              {i < stepIndex ? <Check size={9} /> : i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Contenu de l'étape */}
      <div className="p-4" style={{ background: "#12111a" }}>
        {currentStep.id === "cupid" && <CupidStep game={game} onDone={advance} />}
        {currentStep.id === "seer" && <SeerStep game={game} onDone={advance} />}
        {currentStep.id === "wolves" && <WolvesStep game={game} onDone={advance} />}
        {currentStep.id === "witch" && <WitchStep game={game} onDone={advance} />}
      </div>
    </div>
  );
}
