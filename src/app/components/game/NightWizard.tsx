import { useState, useEffect } from "react";
import { Check, Smartphone, RotateCcw } from "lucide-react";
import { useGame } from "../../context/GameContext";
import type { GameState, Player, PlayerAction } from "../../context/GameContext";
import { ROLES, ROLES_MAP } from "../../../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────────

type StepId = "voleur" | "comedien" | "cupid" | "enfant_sauvage" | "sectaire" | "seer" | "wolves" | "infect_pdl" | "witch" | "gitane" | "renard" | "joueur_flute" | "pyromane" | "salvateur" | "whitewolf";
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
  voleur: {
    img: "/lycan/roles/villageois.png",
    title: "Le Voleur s'éveille",
    narrative: "Il examine les deux cartes cachées et décide s'il en prend une.",
  },
  comedien: {
    img: "/lycan/roles/villageois.png",
    title: "Le Comédien entre en scène",
    narrative: "Il choisit l'un de ses rôles spéciaux pour cette nuit.",
  },
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
  infect_pdl: {
    img: "/lycan/roles/loup-garou.png",
    title: "L'Infect Père des Loups",
    narrative: "Il peut choisir d'infecter la victime plutôt que de la tuer.",
  },
  witch: {
    img: "/lycan/roles/sorciere.png",
    title: "La Sorcière ouvre les yeux",
    narrative: "Elle tient entre ses mains le destin des villageois.",
  },
  enfant_sauvage: {
    img: "/lycan/roles/villageois.png",
    title: "L'Enfant Sauvage entrouvre les yeux",
    narrative: "Il choisit en secret son modèle, celui dont il suivra le destin.",
  },
  sectaire: {
    img: "/lycan/roles/villageois.png",
    title: "L'Abominable Sectaire",
    narrative: "Dans l'obscurité, il révèle son allégeance secrète au Maître du Jeu.",
  },
  gitane: {
    img: "/lycan/roles/villageois.png",
    title: "La Gitane s'éveille",
    narrative: "Elle peut échanger secrètement sa carte avec un autre joueur.",
  },
  renard: {
    img: "/lycan/roles/villageois.png",
    title: "Le Renard ouvre les yeux",
    narrative: "Son flair lui permet de sentir la présence des loups.",
  },
  joueur_flute: {
    img: "/lycan/roles/villageois.png",
    title: "Le Joueur de Flûte s'éveille",
    narrative: "Sa mélodie envoûtante s'empare des âmes endormies.",
  },
  pyromane: {
    img: "/lycan/roles/villageois.png",
    title: "Le Pyromane s'éveille",
    narrative: "Il choisit sa prochaine victime… ou déclenche l'embrasement.",
  },
  salvateur: {
    img: "/lycan/roles/villageois.png",
    title: "Le Salvateur veille",
    narrative: "Il choisit en silence qui il protégera cette nuit.",
  },
  whitewolf: {
    img: "/lycan/roles/loup-garou.png",
    title: "Le Loup-Garou Blanc",
    narrative: "Dans l'ombre, il peut éliminer un des siens pour régner seul.",
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

  if (game.phaseNumber === 1 && hasAliveRole("voleur"))
    steps.push({ id: "voleur", label: "Voleur", emoji: "🃏" });
  if (game.phaseNumber === 1 && hasAliveRole("cupid"))
    steps.push({ id: "cupid", label: "Cupidon", emoji: "💘" });
  if (game.phaseNumber === 1 && hasAliveRole("enfant_sauvage") && !game.wildChildModel)
    steps.push({ id: "enfant_sauvage", label: "Enfant Sauvage", emoji: "🧒" });
  if (game.phaseNumber === 1 && hasAliveRole("sectaire") && !game.sectaireTeam)
    steps.push({ id: "sectaire", label: "Sectaire", emoji: "🧿" });
  if (hasAliveRole("seer"))
    steps.push({ id: "seer", label: "Voyante", emoji: "🔮" });
  if (hasAliveRole("salvateur"))
    steps.push({ id: "salvateur", label: "Salvateur", emoji: "🛡️" });
  if (hasAliveWolf)
    steps.push({ id: "wolves", label: "Loups", emoji: "🐺" });
  if (hasAliveRole("infect_pdl") && !game.infectUsed)
    steps.push({ id: "infect_pdl", label: "Infect PDL", emoji: "☣️" });
  if (hasAliveRole("witch") && (game.witchPotions?.life || game.witchPotions?.death))
    steps.push({ id: "witch", label: "Sorcière", emoji: "⚗️" });
  if (hasAliveRole("gitane") && !game.gitaneUsed)
    steps.push({ id: "gitane", label: "Gitane", emoji: "🔮" });
  if (hasAliveRole("renard") && !game.foxPowerLost)
    steps.push({ id: "renard", label: "Renard", emoji: "🦊" });
  if (hasAliveRole("pyromane"))
    steps.push({ id: "pyromane", label: "Pyromane", emoji: "🔥" });
  if (hasAliveRole("comedien") && (game.comedienRoles ?? []).some((r) => !(game.comedienUsed ?? []).includes(r)))
    steps.push({ id: "comedien", label: "Comédien", emoji: "🎭" });
  if (hasAliveRole("joueur_flute")) {
    const enchanted = game.enchanted ?? [];
    const available = game.players.filter((p) => p.status !== "dead" && p.role !== "joueur_flute" && !enchanted.includes(p.id));
    if (available.length > 0) steps.push({ id: "joueur_flute", label: "Flûte", emoji: "🎵" });
  }
  if (hasAliveRole("loup_blanc") && game.phaseNumber >= 2 && game.phaseNumber % 2 === 0)
    steps.push({ id: "whitewolf", label: "LG Blanc", emoji: "🐺" });

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

// ── Étape Voleur ──────────────────────────────────────────────────────────────

function VoleurStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmVoleurSetup, gmVoleurChoose } = useGame();
  const [phase, setPhase] = useState<"setup" | "choose">(game.voleurCards ? "choose" : "setup");
  const [card1, setCard1] = useState<string | null>(null);
  const [card2, setCard2] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const voleur = game.players.find((p) => p.role === "voleur" && p.status !== "dead");
  const cards = game.voleurCards ?? (card1 && card2 ? [card1, card2] : null);

  const wolfRoles = new Set(ROLES.filter((r) => r.team === "wolves").map((r) => r.id));
  const bothWolves = cards ? cards.every((c) => wolfRoles.has(c)) : false;

  const availableRoles = ROLES.filter((r) => r.playable && r.id !== "voleur" && r.id !== "comedien");

  const handleSetup = async () => {
    if (!card1 || !card2) return;
    setLoading(true);
    await gmVoleurSetup([card1, card2]);
    setPhase("choose");
    setLoading(false);
  };

  const handleChoose = async (roleId: string | null) => {
    setLoading(true);
    await gmVoleurChoose(roleId);
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: "rgba(201,160,48,0.07)", border: "1px solid rgba(201,160,48,0.2)" }}>
          <p className="text-2xl mb-2">🃏</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: "#c9a030" }}>Choix enregistré</p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
          {voleur?.name ?? "?"} — entrez les 2 cartes non distribuées
        </p>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => {
            const val = i === 0 ? card1 : card2;
            const set = i === 0 ? setCard1 : setCard2;
            return (
              <div key={i}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "rgba(201,160,48,0.6)" }}>Carte {i + 1}</p>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {availableRoles.map((r) => (
                    <button key={r.id} onClick={() => set(r.id)}
                      className="flex items-center gap-2 p-2 rounded-lg text-left transition-all border"
                      style={{
                        background: val === r.id ? "rgba(139,28,28,0.18)" : "rgba(11,10,15,0.5)",
                        borderColor: val === r.id ? "rgba(248,113,113,0.4)" : "rgba(201,160,48,0.12)",
                      }}>
                      <span className="text-sm">{r.emoji}</span>
                      <span className="text-xs" style={{ fontFamily: "Cinzel, serif", color: "#c8c0b0" }}>{r.name}</span>
                      {val === r.id && <Check size={12} style={{ color: "#f87171", marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <NightButton onClick={handleSetup} disabled={!card1 || !card2 || loading}>
          {loading ? "..." : "Confirmer les cartes →"}
        </NightButton>
      </div>
    );
  }

  // Phase choose
  const choiceCards = game.voleurCards ?? [card1!, card2!];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {voleur?.name ?? "?"} — choisit sa carte
      </p>
      {bothWolves && (
        <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(139,28,28,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}>
          <p className="text-[10px] font-mono" style={{ color: "#f87171" }}>⚠️ Les 2 cartes sont des Loups — il DOIT en prendre une</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {choiceCards.map((roleId) => {
          const r = ROLES_MAP[roleId];
          return (
            <button key={roleId} onClick={() => handleChoose(roleId)} disabled={loading}
              className="flex items-center gap-3 p-3.5 rounded-xl border transition-all active:scale-95"
              style={{ background: "rgba(139,28,28,0.1)", borderColor: "rgba(248,113,113,0.25)", color: "#e8ddd0", fontFamily: "Cinzel, serif" }}>
              <span className="text-xl">{r?.emoji ?? "?"}</span>
              <span className="text-sm">{r?.name ?? roleId}</span>
            </button>
          );
        })}
        {!bothWolves && (
          <button onClick={() => handleChoose(null)} disabled={loading}
            className="w-full py-3 rounded-xl text-xs border transition-all active:scale-95"
            style={{ borderColor: "rgba(201,160,48,0.15)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
            Garder sa carte actuelle
          </button>
        )}
      </div>
    </div>
  );
}

// ── Étape Comédien ────────────────────────────────────────────────────────────

function ComedienStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmComedienSetRoles, gmComedienChooseRole } = useGame();
  const [setupRoles, setSetupRoles] = useState<string[]>([]);
  const [phase, setPhase] = useState<"setup" | "choose">(game.comedienRoles ? "choose" : "setup");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [chosenRole, setChosenRole] = useState<string | null>(null);

  const comedien = game.players.find((p) => p.role === "comedien" && p.status !== "dead");
  const used = game.comedienUsed ?? [];
  const availableRoles = ROLES.filter((r) => r.playable && r.id !== "comedien" && r.id !== "voleur");
  const comedienRoles = game.comedienRoles ?? setupRoles;
  const remainingRoles = comedienRoles.filter((r) => !used.includes(r));

  const handleSetup = async () => {
    if (setupRoles.length !== 3) return;
    setLoading(true);
    await gmComedienSetRoles(setupRoles);
    setPhase("choose");
    setLoading(false);
  };

  const handleChoose = async (roleId: string) => {
    setLoading(true);
    setChosenRole(roleId);
    await gmComedienChooseRole(roleId);
    setDone(true);
    setLoading(false);
  };

  if (done && chosenRole) {
    const r = ROLES_MAP[chosenRole];
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)" }}>
          <p className="text-2xl mb-2">{r?.emoji ?? "🎭"}</p>
          <p className="text-sm font-semibold" style={{ fontFamily: "Cinzel, serif", color: "#c084fc" }}>{r?.name ?? chosenRole}</p>
          {r?.instructions?.night && (
            <p className="text-[11px] mt-2 leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>{r.instructions.night}</p>
          )}
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
          {comedien?.name ?? "?"} — choisissez 3 rôles spéciaux
        </p>
        <p className="text-[10px] font-mono text-center" style={{ color: "rgba(168,85,247,0.7)" }}>
          {setupRoles.length}/3 sélectionnés
        </p>
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
          {availableRoles.map((r) => {
            const sel = setupRoles.includes(r.id);
            return (
              <button key={r.id} onClick={() => {
                if (sel) setSetupRoles((prev) => prev.filter((x) => x !== r.id));
                else if (setupRoles.length < 3) setSetupRoles((prev) => [...prev, r.id]);
              }}
                className="flex items-center gap-2 p-2 rounded-lg text-left border transition-all"
                style={{
                  background: sel ? "rgba(168,85,247,0.1)" : "rgba(11,10,15,0.5)",
                  borderColor: sel ? "rgba(168,85,247,0.4)" : "rgba(201,160,48,0.1)",
                }}>
                <span className="text-sm">{r.emoji}</span>
                <span className="text-xs" style={{ fontFamily: "Cinzel, serif", color: "#c8c0b0" }}>{r.name}</span>
                {sel && <Check size={12} style={{ color: "#c084fc", marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
        <NightButton onClick={handleSetup} disabled={setupRoles.length !== 3 || loading}>
          {loading ? "..." : "Confirmer les 3 rôles →"}
        </NightButton>
      </div>
    );
  }

  // Phase choose tonight's role
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {comedien?.name ?? "?"} — choisit son rôle de cette nuit
      </p>
      {remainingRoles.length === 0 ? (
        <div className="p-3 rounded-xl text-center" style={{ background: "rgba(11,10,15,0.5)", border: "1px solid rgba(201,160,48,0.12)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tous les rôles ont été utilisés</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {remainingRoles.map((roleId) => {
            const r = ROLES_MAP[roleId];
            return (
              <button key={roleId} onClick={() => handleChoose(roleId)} disabled={loading}
                className="flex items-center gap-3 p-3.5 rounded-xl border transition-all active:scale-95"
                style={{ background: "rgba(168,85,247,0.07)", borderColor: "rgba(168,85,247,0.25)", color: "#e8ddd0", fontFamily: "Cinzel, serif" }}>
                <span className="text-xl">{r?.emoji ?? "?"}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm">{r?.name ?? roleId}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{r?.timing ?? ""}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button onClick={onDone}
        className="w-full py-2.5 rounded-xl text-xs border transition-all active:scale-95"
        style={{ borderColor: "rgba(201,160,48,0.15)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
        Passer cette nuit
      </button>
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

// ── Étape Enfant Sauvage ──────────────────────────────────────────────────────

function EnfantSauvageStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmWildChildSetModel } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const child = game.players.find((p) => p.role === "enfant_sauvage" && p.status !== "dead");

  const handleConfirm = async () => {
    if (!target) return;
    setLoading(true);
    await gmWildChildSetModel(target);
    setDone(true);
    setLoading(false);
  };

  if (done) {
    const model = game.players.find((p) => p.id === target);
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="text-2xl mb-2">🧒</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: "#34d399" }}>
            Modèle : <strong>{model?.name ?? "?"}</strong>
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PlayerPicker
        players={game.players}
        selected={target}
        onSelect={setTarget}
        exclude={child ? [child.id] : []}
        label="Modèle choisi par l'Enfant Sauvage"
      />
      <NightButton onClick={handleConfirm} disabled={!target || loading}>
        {loading ? "Enregistrement..." : "🧒 Confirmer le modèle"}
      </NightButton>
    </div>
  );
}

// ── Étape Sectaire ────────────────────────────────────────────────────────────

function SectaireStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmSectaireChoose } = useGame();
  const [choice, setChoice] = useState<"wolves" | "village" | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = async () => {
    if (!choice) return;
    setLoading(true);
    await gmSectaireChoose(choice);
    setDone(true);
    setLoading(false);
  };

  const sectaire = game.players.find((p) => p.role === "sectaire" && p.status !== "dead");

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: choice === "wolves" ? "rgba(139,28,28,0.15)" : "rgba(16,185,129,0.08)",
          border: `1px solid ${choice === "wolves" ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.25)"}`,
        }}>
          <p className="text-2xl mb-2">{choice === "wolves" ? "🐺" : "🏡"}</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: choice === "wolves" ? "#f87171" : "#34d399" }}>
            {sectaire?.name ?? "?"} a choisi : {choice === "wolves" ? "les Loups" : "le Village"}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {sectaire?.name ?? "?"} choisit son allégeance secrète
      </p>
      <div className="flex gap-3">
        <button onClick={() => setChoice("wolves")}
          className="flex-1 py-4 rounded-xl font-bold text-sm transition-all active:scale-95 border"
          style={{
            background: choice === "wolves" ? "rgba(139,28,28,0.3)" : "rgba(11,10,15,0.5)",
            borderColor: choice === "wolves" ? "rgba(248,113,113,0.6)" : "rgba(201,160,48,0.15)",
            color: choice === "wolves" ? "#f87171" : "#9490a0",
            fontFamily: "Cinzel, serif",
          }}>
          🐺 Loups
        </button>
        <button onClick={() => setChoice("village")}
          className="flex-1 py-4 rounded-xl font-bold text-sm transition-all active:scale-95 border"
          style={{
            background: choice === "village" ? "rgba(16,185,129,0.12)" : "rgba(11,10,15,0.5)",
            borderColor: choice === "village" ? "rgba(52,211,153,0.5)" : "rgba(201,160,48,0.15)",
            color: choice === "village" ? "#34d399" : "#9490a0",
            fontFamily: "Cinzel, serif",
          }}>
          🏡 Village
        </button>
      </div>
      <NightButton onClick={handleConfirm} disabled={!choice || loading}>
        {loading ? "Enregistrement..." : "🧿 Confirmer l'allégeance"}
      </NightButton>
    </div>
  );
}

// ── Étape Pyromane ────────────────────────────────────────────────────────────

function PyromaneStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmPyromaniacSpray, gmPyromaniacPrepareIgnite } = useGame();
  const [action, setAction] = useState<"choose" | "spray" | "ignite">("choose");
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const pyro = game.players.find((p) => p.role === "pyromane" && p.status !== "dead");
  const oiled = game.oiled ?? [];
  const alivePlayers = game.players.filter((p) => p.status !== "dead");

  const handleSpray = async () => {
    if (!target) return;
    setLoading(true);
    await gmPyromaniacSpray(target);
    setDone(true);
    setLoading(false);
  };

  const handleIgnite = async () => {
    setLoading(true);
    await gmPyromaniacPrepareIgnite();
    setDone(true);
    setLoading(false);
  };

  if (done) {
    const sprayedName = action === "spray" ? game.players.find((p) => p.id === target)?.name : null;
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: action === "ignite" ? "rgba(139,28,28,0.18)" : "rgba(201,160,48,0.07)",
          border: `1px solid ${action === "ignite" ? "rgba(248,113,113,0.4)" : "rgba(201,160,48,0.2)"}`,
        }}>
          <p className="text-2xl mb-2">{action === "ignite" ? "💥" : "🔥"}</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: action === "ignite" ? "#f87171" : "#c9a030" }}>
            {action === "ignite"
              ? `Embrasement déclenché — ${oiled.length} joueur${oiled.length > 1 ? "s" : ""} brûleront à l'aube`
              : `${sprayedName ?? "?"} aspergé(e) d'huile`}
          </p>
          {action === "ignite" && oiled.length > 0 && (
            <p className="text-[10px] font-mono mt-1" style={{ color: "rgba(248,113,113,0.6)" }}>
              {oiled.map((id) => game.players.find((p) => p.id === id)?.name ?? "?").join(", ")}
            </p>
          )}
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  // Choose: spray vs ignite
  if (action === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
          {pyro?.name ?? "?"} — que fait-il cette nuit ?
        </p>
        {oiled.length > 0 && (
          <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(201,160,48,0.05)", border: "1px solid rgba(201,160,48,0.12)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(201,160,48,0.6)" }}>Déjà huilés</p>
            <p className="text-xs" style={{ fontFamily: "Cinzel, serif", color: "#c8c0b0" }}>
              {oiled.map((id) => game.players.find((p) => p.id === id)?.name ?? "?").join(", ")}
            </p>
          </div>
        )}
        <button onClick={() => setAction("spray")}
          className="w-full py-3.5 rounded-xl text-sm font-semibold border transition-all active:scale-95"
          style={{ background: "rgba(201,160,48,0.08)", borderColor: "rgba(201,160,48,0.25)", color: "#c9a030", fontFamily: "Cinzel, serif" }}>
          🔥 Asperger un joueur
        </button>
        <button onClick={() => setAction("ignite")} disabled={oiled.length === 0}
          className="w-full py-3.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-30"
          style={{ background: "rgba(139,28,28,0.15)", borderColor: "rgba(248,113,113,0.35)", color: "#f87171", fontFamily: "Cinzel, serif" }}>
          💥 Enflammer ! ({oiled.length} joueur{oiled.length !== 1 ? "s" : ""})
        </button>
      </div>
    );
  }

  // Spray: player picker
  if (action === "spray") {
    return (
      <div className="flex flex-col gap-3">
        <PlayerPicker players={alivePlayers} selected={target} onSelect={setTarget} label="Joueur à asperger (peut être lui-même)" />
        <NightButton onClick={handleSpray} disabled={!target || loading}>
          {loading ? "..." : "🔥 Asperger ce joueur"}
        </NightButton>
        <button onClick={() => { setTarget(null); setAction("choose"); }}
          className="py-2 rounded-xl text-xs border transition-all"
          style={{ borderColor: "rgba(201,160,48,0.15)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
          ← Retour
        </button>
      </div>
    );
  }

  // Ignite: confirmation
  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 rounded-xl" style={{ background: "rgba(139,28,28,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
        <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "#f87171" }}>💥 Périront à l'aube</p>
        {oiled.map((id) => {
          const p = game.players.find((pl) => pl.id === id);
          return (
            <div key={id} className="flex items-center gap-2 py-0.5">
              <span className="text-[10px]">🔥</span>
              <span className="text-xs" style={{ fontFamily: "Cinzel, serif", color: "#c8c0b0" }}>{p?.name ?? "?"}</span>
            </div>
          );
        })}
      </div>
      <NightButton onClick={handleIgnite} disabled={loading}>
        {loading ? "..." : "💥 Confirmer l'embrasement"}
      </NightButton>
      <button onClick={() => setAction("choose")}
        className="py-2 rounded-xl text-xs border transition-all"
        style={{ borderColor: "rgba(201,160,48,0.15)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
        ← Retour
      </button>
    </div>
  );
}

// ── Étape Joueur de Flûte ─────────────────────────────────────────────────────

function JoueurFluteStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmFluteEnchant } = useGame();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const flute = game.players.find((p) => p.role === "joueur_flute" && p.status !== "dead");
  const enchanted = game.enchanted ?? [];
  const available = game.players.filter(
    (p) => p.status !== "dead" && p.id !== flute?.id && !enchanted.includes(p.id)
  );
  const maxSelect = Math.min(2, available.length);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxSelect ? [...prev, id] : prev
    );
  };

  const handleEnchant = async () => {
    setLoading(true);
    await gmFluteEnchant(selected);
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)" }}>
          <p className="text-2xl mb-2">🎵</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: "#c084fc" }}>
            {selected.map((id) => game.players.find((p) => p.id === id)?.name ?? "?").join(" & ")} ensorcelé(e)(s)
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            Total ensorcelés : {(enchanted.length + selected.filter((id) => !enchanted.includes(id)).length)}/{game.players.filter((p) => p.status !== "dead" && p.id !== flute?.id).length}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Joueurs à ensorceler
        </p>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{
          background: selected.length === maxSelect ? "rgba(168,85,247,0.12)" : "rgba(201,160,48,0.05)",
          color: selected.length === maxSelect ? "#c084fc" : "var(--text-muted)",
          border: "1px solid rgba(168,85,247,0.2)",
        }}>
          {selected.length}/{maxSelect}
        </span>
      </div>
      {enchanted.length > 0 && (
        <p className="text-[10px] font-mono text-center" style={{ color: "rgba(168,85,247,0.5)" }}>
          Déjà ensorcelés : {enchanted.map((id) => game.players.find((p) => p.id === id)?.name ?? "?").join(", ")}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {available.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggleSelect(p.id)}
              className="flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.98] border"
              style={{
                background: isSel ? "rgba(168,85,247,0.12)" : "rgba(11,10,15,0.5)",
                borderColor: isSel ? "rgba(168,85,247,0.45)" : "rgba(201,160,48,0.1)",
              }}>
              <div className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0" style={{
                background: isSel ? "rgba(168,85,247,0.25)" : "transparent",
                borderColor: isSel ? "rgba(168,85,247,0.7)" : "rgba(201,160,48,0.2)",
              }}>
                {isSel && <Check size={10} style={{ color: "#c084fc" }} />}
              </div>
              <span className="text-sm" style={{ fontFamily: "Cinzel, serif", color: isSel ? "#e8ddd0" : "#c8c0b0" }}>
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
      <NightButton onClick={handleEnchant} disabled={selected.length === 0 || loading}>
        {loading ? "Envoûtement..." : "🎵 Ensorceler"}
      </NightButton>
    </div>
  );
}

// ── Étape Gitane ──────────────────────────────────────────────────────────────

function GitaneStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmGitaneSwap } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [swapped, setSwapped] = useState(false);

  const gitane = game.players.find((p) => p.role === "gitane" && p.status !== "dead");

  const handleSwap = async () => {
    if (!target) return;
    setLoading(true);
    await gmGitaneSwap(target);
    setSwapped(true);
    setDone(true);
    setLoading(false);
  };

  const handleSkip = async () => {
    setDone(true);
  };

  if (done) {
    const swapTarget = game.players.find((p) => p.id === target);
    const targetRoleData = swapTarget ? ROLES_MAP[swapTarget.role ?? ""] : null;
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: swapped ? "rgba(168,85,247,0.1)" : "rgba(99,102,241,0.08)",
          border: `1px solid ${swapped ? "rgba(168,85,247,0.35)" : "rgba(99,102,241,0.2)"}`,
        }}>
          <p className="text-2xl mb-2">{swapped ? "🔮" : "🌙"}</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: swapped ? "#c084fc" : "#c8c0b0" }}>
            {swapped
              ? <><strong style={{ color: "#c084fc" }}>{gitane?.name}</strong> prend le rôle de <strong>{swapTarget?.name}</strong> ({targetRoleData?.name ?? "?"})</>
              : "La Gitane ne permute pas cette nuit"}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {gitane?.name ?? "?"} peut échanger sa carte (optionnel)
      </p>
      <PlayerPicker
        players={game.players}
        selected={target}
        onSelect={setTarget}
        exclude={gitane ? [gitane.id] : []}
        label="Joueur dont récupérer le rôle"
      />
      <NightButton onClick={handleSwap} disabled={!target || loading}>
        {loading ? "Échange..." : "🔮 Permuter les rôles"}
      </NightButton>
      <button onClick={handleSkip}
        className="py-2.5 rounded-xl text-xs border transition-all active:scale-95"
        style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
        Passer — ne pas utiliser le pouvoir
      </button>
    </div>
  );
}

// ── Étape Renard ──────────────────────────────────────────────────────────────

function RenardStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmRenardInspect } = useGame();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ hasWolf: boolean } | null>(null);

  const renard = game.players.find((p) => p.role === "renard" && p.status !== "dead");
  const alivePlayers = game.players.filter((p) => p.status !== "dead");

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleInspect = async () => {
    if (selected.length !== 3) return;
    setLoading(true);
    const res = await gmRenardInspect(selected);
    setResult(res);
    setLoading(false);
  };

  if (result !== null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="p-5 rounded-xl text-center" style={{
          background: result.hasWolf ? "rgba(139,28,28,0.18)" : "rgba(16,185,129,0.08)",
          border: `1px solid ${result.hasWolf ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.25)"}`,
        }}>
          <p className="text-3xl mb-2">{result.hasWolf ? "🐺" : "✅"}</p>
          <p className="text-sm font-semibold" style={{ fontFamily: "Cinzel, serif", color: result.hasWolf ? "#f87171" : "#34d399" }}>
            {result.hasWolf ? "Au moins un loup est dans ce groupe !" : "Aucun loup dans ce groupe"}
          </p>
          {!result.hasWolf && (
            <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
              Le Renard perd définitivement son flair
            </p>
          )}
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {renard?.name ?? "?"} choisit 3 joueurs à inspecter
      </p>
      <div className="text-center">
        <span className="text-xs font-mono px-2 py-1 rounded-full" style={{
          background: selected.length === 3 ? "rgba(201,160,48,0.12)" : "rgba(201,160,48,0.05)",
          color: selected.length === 3 ? "var(--gold)" : "var(--text-muted)",
          border: "1px solid rgba(201,160,48,0.18)",
        }}>
          {selected.length}/3 sélectionnés
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {alivePlayers.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggleSelect(p.id)}
              className="flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.98] border"
              style={{
                background: isSel ? "rgba(201,160,48,0.1)" : "rgba(11,10,15,0.5)",
                borderColor: isSel ? "rgba(201,160,48,0.45)" : "rgba(201,160,48,0.1)",
              }}>
              <div className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0" style={{
                background: isSel ? "rgba(201,160,48,0.2)" : "transparent",
                borderColor: isSel ? "rgba(201,160,48,0.6)" : "rgba(201,160,48,0.2)",
              }}>
                {isSel && <Check size={10} style={{ color: "#c9a030" }} />}
              </div>
              <span className="text-sm" style={{ fontFamily: "Cinzel, serif", color: isSel ? "#e8ddd0" : "#c8c0b0" }}>
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
      <NightButton onClick={handleInspect} disabled={selected.length !== 3 || loading}>
        {loading ? "Inspection..." : "🦊 Inspecter ce groupe"}
      </NightButton>
    </div>
  );
}

// ── Étape Salvateur ───────────────────────────────────────────────────────────

function SalvateurStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmSalvatorProtect } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [protected_, setProtected] = useState(false);

  const salvateur = game.players.find((p) => p.role === "salvateur" && p.status !== "dead");
  const lastProtected = game.lastSalvatorTarget ?? null;

  const handleProtect = async () => {
    if (!target) return;
    setLoading(true);
    await gmSalvatorProtect(target);
    setProtected(true);
    setLoading(false);
  };

  if (protected_) {
    const protectedPlayer = game.players.find((p) => p.id === target);
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <p className="text-2xl mb-2">🛡️</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: "#34d399" }}>
            {protectedPlayer?.name ?? "?"} est protégé(e) cette nuit
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {lastProtected && (
        <div className="px-3 py-2 rounded-lg text-[10px] font-mono" style={{ background: "rgba(201,160,48,0.06)", border: "1px solid rgba(201,160,48,0.15)", color: "var(--text-muted)" }}>
          ⚠️ Ne peut pas reprotéger : {game.players.find((p) => p.id === lastProtected)?.name ?? "?"}
        </div>
      )}
      <PlayerPicker
        players={game.players}
        selected={target}
        onSelect={setTarget}
        exclude={salvateur ? (lastProtected ? [lastProtected] : []) : []}
        label="Joueur à protéger cette nuit"
      />
      <NightButton onClick={handleProtect} disabled={!target || loading}>
        {loading ? "Enregistrement..." : "🛡️ Protéger ce joueur"}
      </NightButton>
    </div>
  );
}

// ── Étape Infect PDL ──────────────────────────────────────────────────────────

function InfectStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmInfectTarget } = useGame();
  const [decided, setDecided] = useState(false);
  const [infected, setInfected] = useState(false);
  const [loading, setLoading] = useState(false);

  const victimId = game.nightActions?.wolvesTarget;
  const victim = victimId ? game.players.find((p) => p.id === victimId) : null;

  const handleInfect = async () => {
    if (!victimId) return;
    setLoading(true);
    await gmInfectTarget(victimId);
    setInfected(true);
    setDecided(true);
    setLoading(false);
  };

  const handlePass = async () => {
    setLoading(true);
    await gmInfectTarget(null);
    setDecided(true);
    setLoading(false);
  };

  if (decided) {
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: infected ? "rgba(139,28,28,0.15)" : "rgba(99,102,241,0.08)",
          border: `1px solid ${infected ? "rgba(139,28,28,0.4)" : "rgba(99,102,241,0.2)"}`,
        }}>
          <p className="text-2xl mb-2">{infected ? "☣️" : "🌙"}</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: infected ? "#f87171" : "#c8c0b0" }}>
            {infected ? `${victim?.name ?? "?"} sera infecté(e) cette nuit` : "Infection non utilisée ce soir"}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 rounded-xl" style={{ background: "rgba(139,28,28,0.08)", border: "1px solid rgba(139,28,28,0.2)" }}>
        <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>Victime des Loups</p>
        <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: "#c8c0b0" }}>
          {victim ? <><span style={{ color: "#f87171", fontWeight: 600 }}>{victim.name}</span> est ciblé(e)</> : "Aucune victime désignée"}
        </p>
      </div>
      {victim ? (
        <>
          <p className="text-xs text-center" style={{ fontFamily: "Cinzel, serif", color: "var(--text-muted)" }}>
            Infecter ou laisser mourir ?
          </p>
          <div className="flex gap-2">
            <button onClick={handleInfect} disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "rgba(139,28,28,0.2)", borderColor: "rgba(248,113,113,0.4)", color: "#f87171", fontFamily: "Cinzel, serif" }}>
              {loading ? "..." : "☣️ Infecter"}
            </button>
            <button onClick={handlePass} disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm border transition-all active:scale-95"
              style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
              Laisser mourir
            </button>
          </div>
        </>
      ) : (
        <NightButton onClick={onDone}>Passer →</NightButton>
      )}
    </div>
  );
}

// ── Étape LG Blanc ────────────────────────────────────────────────────────────

function WhiteWolfStep({ game, onDone }: { game: GameState; onDone: () => void }) {
  const { gmWhitewolfKill } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [decided, setDecided] = useState(false);

  const lb = game.players.find((p) => p.role === "loup_blanc" && p.status !== "dead");
  const wolves = game.players.filter((p) => {
    if (p.status === "dead") return false;
    if (p.id === lb?.id) return false;
    return ROLES_MAP[p.role ?? ""]?.team === "wolves";
  });

  const handleKill = async (kill: boolean) => {
    setLoading(true);
    if (kill && target) await gmWhitewolfKill(target);
    else await gmWhitewolfKill(null);
    setDecided(true);
    setLoading(false);
  };

  if (decided) {
    const victim = target ? game.players.find((p) => p.id === target) : null;
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl text-center" style={{
          background: victim ? "rgba(139,28,28,0.15)" : "rgba(99,102,241,0.08)",
          border: `1px solid ${victim ? "rgba(139,28,28,0.4)" : "rgba(99,102,241,0.2)"}`,
        }}>
          <p className="text-2xl mb-2">{victim ? "🩸" : "🌙"}</p>
          <p className="text-sm" style={{ fontFamily: "Cinzel, serif", color: victim ? "#f87171" : "#c8c0b0" }}>
            {victim ? <><span style={{ color: "#f87171", fontWeight: 600 }}>{victim.name}</span> sera éliminé(e)</> : "Le LG Blanc passe son tour"}
          </p>
        </div>
        <NightButton onClick={onDone}>Suivant →</NightButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
        {lb?.name} peut éliminer un loup
      </p>
      {wolves.length > 0 ? (
        <>
          <PlayerPicker players={wolves} selected={target} onSelect={setTarget} label="Loup à éliminer" />
          <div className="flex gap-2">
            <button onClick={() => handleKill(true)} disabled={!target || loading}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "rgba(139,28,28,0.2)", borderColor: "rgba(248,113,113,0.4)", color: "#f87171", fontFamily: "Cinzel, serif" }}>
              {loading ? "..." : "🩸 Éliminer"}
            </button>
            <button onClick={() => handleKill(false)} disabled={loading}
              className="px-4 py-3 rounded-xl text-sm border transition-all active:scale-95"
              style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
              Passer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)", fontFamily: "Cinzel, serif" }}>Aucun autre loup disponible</p>
          <NightButton onClick={onDone}>Passer →</NightButton>
        </>
      )}
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

          {game.nightActions?.pyromaniacIgniting && (game.oiled ?? []).length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
              <span className="text-xl">💥</span>
              <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
                Embrasement : <strong style={{ color: "#f87171" }}>{(game.oiled ?? []).map((id) => game.players.find((p) => p.id === id)?.name ?? "?").join(", ")}</strong> brûleront
              </p>
            </div>
          )}

          {(() => {
            const whitewolfKillId = game.nightActions?.whitewolfTarget;
            const whitewolfKillPlayer = whitewolfKillId ? game.players.find((p) => p.id === whitewolfKillId) : null;
            if (!whitewolfKillPlayer) return null;
            return (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(139,28,28,0.1)", border: "1px solid rgba(139,28,28,0.22)" }}>
                <span className="text-xl">🩸</span>
                <p className="text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif", color: "#c8c0b0" }}>
                  <strong style={{ color: "#f87171" }}>{whitewolfKillPlayer.name}</strong> éliminé(e) par le LG Blanc
                </p>
              </div>
            );
          })()}
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
        {currentStep.id === "voleur" && <VoleurStep game={game} onDone={advance} />}
        {currentStep.id === "comedien" && <ComedienStep game={game} onDone={advance} />}
        {currentStep.id === "enfant_sauvage" && <EnfantSauvageStep game={game} onDone={advance} />}
        {currentStep.id === "sectaire" && <SectaireStep game={game} onDone={advance} />}
        {currentStep.id === "seer" && <SeerStep game={game} onDone={advance} />}
        {currentStep.id === "salvateur" && <SalvateurStep game={game} onDone={advance} />}
        {currentStep.id === "wolves" && <WolvesStep game={game} onDone={advance} />}
        {currentStep.id === "infect_pdl" && <InfectStep game={game} onDone={advance} />}
        {currentStep.id === "witch" && <WitchStep game={game} onDone={advance} />}
        {currentStep.id === "gitane" && <GitaneStep game={game} onDone={advance} />}
        {currentStep.id === "renard" && <RenardStep game={game} onDone={advance} />}
        {currentStep.id === "pyromane" && <PyromaneStep game={game} onDone={advance} />}
        {currentStep.id === "joueur_flute" && <JoueurFluteStep game={game} onDone={advance} />}
        {currentStep.id === "whitewolf" && <WhiteWolfStep game={game} onDone={advance} />}
      </div>
    </div>
  );
}
