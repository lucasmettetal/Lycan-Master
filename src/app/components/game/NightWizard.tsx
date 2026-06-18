import { useState, useEffect } from "react";
import { Check, Smartphone, RotateCcw } from "lucide-react";
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

// ── Meta visuelle par étape ────────────────────────────────────────────────────

const STEP_META: Record<StepId, { img: string; title: string; narrative: string }> = {
  cupid: {
    img: "/lycan/roles/cupidon.png",
    title: "Cupidon s'éveille",
    narrative: "Il tend son arc et unit deux âmes pour l'éternité.",
  },
  seer: {
    img: "/lycan/roles/voyante.png",
    title: "La Voyante entrouvre les yeux",
    narrative: "Sa vision perce l'obscurité et révèle les âmes.",
  },
  wolves: {
    img: "/lycan/roles/loup-garou.png",
    title: "Les Loups se réveillent",
    narrative: "Ils se reconnaissent et désignent leur proie dans le silence.",
  },
  witch: {
    img: "/lycan/roles/sorciere.png",
    title: "La Sorcière ouvre les yeux",
    narrative: "Elle tient entre ses mains le destin des villageois.",
  },
};

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

// ── Bouton primaire nuit ───────────────────────────────────────────────────────

function NightButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
      style={{
        background: "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)",
        color: "#f0e8d0",
        fontFamily: "Cinzel, serif",
        border: "1px solid rgba(201,160,48,0.3)",
        boxShadow: "0 4px 18px rgba(139,28,28,0.35)",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </button>
  );
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
        className="flex items-center gap-3 p-3.5 rounded-xl"
        style={{ background: "rgba(201,160,48,0.07)", border: "1px solid rgba(201,160,48,0.2)" }}
      >
        <div className="relative flex-shrink-0">
          <Smartphone size={18} style={{ color: "#c9a030" }} />
          {isConnected && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ fontFamily: "Cinzel, serif", color: "#e8ddd0" }}>
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
        style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}
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
      className="flex items-center gap-2.5 w-full py-3 px-4 rounded-xl text-xs border transition-all active:scale-95"
      style={{
        background: isConnected ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.02)",
        borderColor: isConnected ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)",
        color: isConnected ? "#34d399" : "#9490a0",
        fontFamily: "Cinzel, serif",
      }}
    >
      <Smartphone size={14} className="flex-shrink-0" />
      <span className="flex-1 text-left">
        Envoyer à {playerName ?? "…"}
        {!isConnected && <span className="text-[9px] opacity-60 ml-1">(hors ligne)</span>}
      </span>
      <span className="text-[10px] opacity-60">→</span>
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
        <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {eligible.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.98] border"
            style={{
              background: selected === p.id ? "rgba(139,28,28,0.18)" : "rgba(11,10,15,0.5)",
              borderColor: selected === p.id ? "rgba(139,28,28,0.6)" : "rgba(201,160,48,0.1)",
            }}
          >
            <div
              className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{
                background: selected === p.id ? "rgba(139,28,28,0.3)" : "rgba(30,27,42,0.8)",
                borderColor: selected === p.id ? "rgba(139,28,28,0.6)" : "rgba(201,160,48,0.2)",
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
            {selected === p.id && <Check size={13} style={{ color: "#f87171", flexShrink: 0 }} />}
          </button>
        ))}
        {eligible.length === 0 && (
          <p className="text-[11px] font-mono py-2 text-center" style={{ color: "var(--text-muted)" }}>Aucun joueur disponible</p>
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
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="p-4 rounded-xl text-center w-full" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)" }}>
          <p className="text-2xl mb-2">💘</p>
          <p className="text-sm font-semibold" style={{ fontFamily: "Cinzel, serif", color: "#f9a8d4" }}>
            {linkedNames ? `${linkedNames[0]} & ${linkedNames[1]}` : "Amoureux unis"}
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>liés pour l'éternité</p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  if (mode === "waiting") {
    return <WaitingForPlayer playerName={cupid?.name} isConnected={cupid?.isConnected ?? false}
      action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)} onOverride={handleOverride} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {cupid && <DelegateButton playerName={cupid.name} isConnected={cupid.isConnected} onClick={handleDelegate} />}
      <PlayerPicker players={game.players} selected={lover1}
        onSelect={(id) => { setLover1(id); if (lover2 === id) setLover2(null); }}
        label="Premier amoureux" />
      <PlayerPicker players={game.players} selected={lover2}
        onSelect={(id) => { setLover2(id); if (lover1 === id) setLover1(null); }}
        exclude={lover1 ? [lover1] : []}
        label="Deuxième amoureux" />
      <NightButton onClick={handleLink} disabled={!lover1 || !lover2 || loading}>
        {loading ? "Liaison..." : "💘 Unir ces deux joueurs"}
      </NightButton>
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
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: isWolf ? "rgba(139,28,28,0.18)" : "rgba(201,160,48,0.08)",
          border: `1px solid ${isWolf ? "rgba(139,28,28,0.45)" : "rgba(201,160,48,0.25)"}`,
        }}>
          <p className="text-3xl mb-2">{reveal.roleData?.emoji ?? "❓"}</p>
          <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{reveal.name} est…</p>
          <p className="text-xl font-bold" style={{ fontFamily: "Cinzel Decorative, Cinzel, serif", color: isWolf ? "#f87171" : "#c9a030" }}>
            {reveal.roleData?.name ?? reveal.role}
          </p>
          {isWolf && <p className="text-[10px] text-red-400 font-mono mt-1 animate-pulse">🐺 LOUP-GAROU</p>}
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  if (mode === "waiting") {
    return <WaitingForPlayer playerName={seer?.name} isConnected={seer?.isConnected ?? false}
      action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)} onOverride={handleOverride} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {seer && <DelegateButton playerName={seer.name} isConnected={seer.isConnected} onClick={handleDelegate} />}
      <PlayerPicker players={game.players} selected={target} onSelect={setTarget}
        exclude={seer ? [seer.id] : []} label="Joueur à consulter" />
      <NightButton onClick={handleCheck} disabled={!target || loading}>
        {loading ? "Révélation..." : "🔮 Révéler le rôle"}
      </NightButton>
    </div>
  );
}

// ── Étape Loups ───────────────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: victim ? "rgba(139,28,28,0.18)" : "rgba(99,102,241,0.1)",
          border: `1px solid ${victim ? "rgba(139,28,28,0.4)" : "rgba(99,102,241,0.25)"}`,
        }}>
          <p className="text-3xl mb-2">{victim ? "🎯" : "🌙"}</p>
          <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
            {victim ? <><span style={{ color: "#f87171", fontWeight: 600 }}>{victim.name}</span> est ciblé(e)</> : "Les Loups ne tuent personne cette nuit"}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PlayerPicker players={game.players} selected={target} onSelect={setTarget}
        exclude={[...wolfIds]} label="Victime désignée" />
      <div className="flex gap-2">
        <button
          onClick={() => handleDecide(true)}
          disabled={!target || loading}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)",
            color: "#f0e8d0",
            fontFamily: "Cinzel, serif",
            border: "1px solid rgba(201,160,48,0.3)",
          }}
        >
          {loading ? "..." : "🎯 Confirmer"}
        </button>
        <button
          onClick={() => handleDecide(false)}
          disabled={loading}
          className="px-4 py-3 rounded-xl text-sm border transition-all active:scale-95"
          style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}
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
    try { await gmWitchSave(); setLifeUsed(true); }
    catch (e: unknown) { console.error("[WitchStep] handleSave:", e); }
    finally { setLoading(false); }
  };

  const handleKill = async () => {
    if (!deathTarget) return;
    setLoading(true);
    try { await gmWitchKill(deathTarget); setDeathUsed(true); }
    catch (e: unknown) { console.error("[WitchStep] handleKill:", e); }
    finally { setLoading(false); }
  };

  if (mode === "waiting") {
    return <WaitingForPlayer playerName={witch?.name} isConnected={witch?.isConnected ?? false}
      action={game.pendingPlayerActions?.find((a) => a.id === pendingActionId)} onOverride={handleOverride} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {witch && <DelegateButton playerName={witch.name} isConnected={witch.isConnected} onClick={handleDelegate} />}

      {(witchPotions?.life || lifeUsed) && (
        <div className="p-3.5 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "#34d399" }}>🧪 Potion de vie</p>
          {lifeUsed ? (
            <p className="text-xs font-mono" style={{ color: "#34d399" }}>✓ {victim?.name ?? "victime"} sera sauvé(e)</p>
          ) : victim ? (
            <div className="flex items-center gap-2">
              <p className="text-xs flex-1" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
                Les Loups ciblent <strong style={{ color: "#f87171" }}>{victim.name}</strong>. Sauver ?
              </p>
              <button onClick={handleSave} disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.35)", fontFamily: "Cinzel, serif" }}>
                {loading ? "..." : "Sauver"}
              </button>
            </div>
          ) : (
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Les Loups n'ont pas ciblé de victime</p>
          )}
        </div>
      )}

      {(witchPotions?.death || deathUsed) && (
        <div className="p-3.5 rounded-xl" style={{ background: "rgba(139,28,28,0.06)", border: "1px solid rgba(139,28,28,0.2)" }}>
          <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "#f87171" }}>💀 Potion de mort</p>
          {deathUsed ? (
            <p className="text-xs font-mono" style={{ color: "#f87171" }}>
              ✓ Utilisée sur {game.players.find((p) => p.id === deathTarget)?.name ?? "cible"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <PlayerPicker players={game.players} selected={deathTarget} onSelect={setDeathTarget}
                exclude={witch ? [witch.id] : []} label="Tuer quelqu'un (optionnel)" />
              {deathTarget && (
                <button onClick={handleKill} disabled={loading}
                  className="w-full py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", fontFamily: "Cinzel, serif" }}>
                  {loading ? "..." : "💀 Utiliser la potion de mort"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <NightButton onClick={onDone} disabled={loading}>Passer →</NightButton>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function NightWizard({ onResolve, phaseNumber = 1 }: { onResolve: () => void; phaseNumber?: number }) {
  const { state, gmResolveNight } = useGame();
  const game = state.game!;
  const [intro, setIntro] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [resolving, setResolving] = useState(false);

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

  // ── Écran de résumé ──
  if (allDone) {
    const victimId = game.nightActions?.wolvesTarget;
    const victim = victimId ? game.players.find((p) => p.id === victimId) : null;
    const witchSaved = game.nightActions?.witchSaved;
    const witchKillId = game.nightActions?.witchKillTarget;
    const witchKillPlayer = witchKillId ? game.players.find((p) => p.id === witchKillId) : null;

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Résumé de la nuit</p>
          <div className="w-12 h-px mx-auto" style={{ background: "rgba(201,160,48,0.25)" }} />
        </div>

        <div className="flex flex-col gap-2">
          {victim ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: witchSaved ? "rgba(16,185,129,0.08)" : "rgba(139,28,28,0.12)", border: `1px solid ${witchSaved ? "rgba(16,185,129,0.2)" : "rgba(139,28,28,0.3)"}` }}>
              <span className="text-xl">{witchSaved ? "🧪" : "💀"}</span>
              <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
                {witchSaved
                  ? <><strong style={{ color: "#34d399" }}>{victim.name}</strong> sauvé(e) par la Sorcière</>
                  : <><strong style={{ color: "#f87171" }}>{victim.name}</strong> tué(e) par les Loups</>}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <span className="text-xl">🌙</span>
              <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>Les Loups n'ont tué personne cette nuit</p>
            </div>
          )}

          {witchKillPlayer && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.1)", border: "1px solid rgba(139,28,28,0.25)" }}>
              <span className="text-xl">☠️</span>
              <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
                <strong style={{ color: "#f87171" }}>{witchKillPlayer.name}</strong> tué(e) par la potion de mort
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleResolve}
          disabled={resolving}
          className="w-full py-4 rounded-xl font-semibold uppercase text-sm tracking-widest transition-all active:scale-95 disabled:opacity-40"
          style={{
            fontFamily: "Cinzel, serif",
            background: "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)",
            color: "#f0e8d0",
            border: "1px solid rgba(201,160,48,0.3)",
            boxShadow: "0 4px 24px rgba(139,28,28,0.4)",
            letterSpacing: "0.1em",
          }}
        >
          {resolving ? "Résolution..." : "☀️ Réveiller le village"}
        </button>
      </div>
    );
  }

  // ── Écran intro "Le village s'endort" ──
  if (intro) {
    return (
      <div className="flex flex-col gap-5">
        {/* Hero image nuit */}
        <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: 220 }}>
          <img
            src="/lycan/night-phase.png"
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(11,10,15,0.95) 0%, rgba(13,10,42,0.3) 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] mb-1" style={{ color: "rgba(165,180,252,0.7)" }}>
              Nuit {phaseNumber}
            </p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>
              Le village s'endort
            </p>
            <p className="text-sm italic mt-2" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "rgba(200,192,176,0.8)" }}>
              Fermez les yeux. La nuit enveloppe Thiercelieux.
            </p>
          </div>
        </div>

        {/* Rôles qui vont jouer cette nuit */}
        {steps.length > 0 && (
          <div className="flex items-center justify-center gap-3">
            {steps.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(201,160,48,0.2)" }}>
                  <img src={STEP_META[s.id].img} alt={s.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                </div>
                <p className="text-[8px] font-mono" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <NightButton onClick={() => setIntro(false)}>
          🌙 Lancer la nuit →
        </NightButton>
      </div>
    );
  }

  if (!currentStep) return null;

  const meta = STEP_META[currentStep.id];

  return (
    <div className="flex flex-col gap-4">

      {/* Progression */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-mono transition-all"
              style={{
                background: i === stepIndex ? "rgba(139,28,28,0.3)" : i < stepIndex ? "rgba(16,185,129,0.15)" : "transparent",
                borderColor: i === stepIndex ? "rgba(139,28,28,0.7)" : i < stepIndex ? "rgba(16,185,129,0.45)" : "rgba(201,160,48,0.18)",
                color: i === stepIndex ? "#f0e8d0" : i < stepIndex ? "#34d399" : "#9490a0",
              }}
            >
              {i < stepIndex ? <Check size={9} /> : s.emoji}
            </div>
            {i < steps.length - 1 && (
              <div className="w-4 h-px" style={{ background: i < stepIndex ? "rgba(16,185,129,0.35)" : "rgba(201,160,48,0.12)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Carte rôle hero */}
      <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: 200 }}>
        <img
          src={meta.img}
          alt={currentStep.label}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
        />
        {/* Dégradé bas → nom du rôle lisible */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(11,10,15,0.95) 0%, rgba(11,10,15,0.1) 60%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(13,10,42,0.25)" }} />

        {/* Texte en bas de la carte */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <p className="text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>
            {meta.title}
          </p>
          <p className="text-xs mt-1 italic" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "rgba(200,192,176,0.85)" }}>
            {meta.narrative}
          </p>
        </div>
      </div>

      {/* Contenu de l'étape */}
      <div>
        {currentStep.id === "cupid" && <CupidStep game={game} onDone={advance} />}
        {currentStep.id === "seer" && <SeerStep game={game} onDone={advance} />}
        {currentStep.id === "wolves" && <WolvesStep game={game} onDone={advance} />}
        {currentStep.id === "witch" && <WitchStep game={game} onDone={advance} />}
      </div>
    </div>
  );
}
