import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, Plus, Crown, History, Trash2, Wifi, WifiOff, Eye } from "lucide-react";
import { LycanLogo } from "./components/brand/LycanLogo";
import { GameProvider, useGame, type GamePhase, type PlayerStatus, type GameMode, type RoleConfig, type AppView, type GameState } from "./context/GameContext";
import { NightWizard } from "./components/game/NightWizard";
import { RulesScreen } from "./components/game/RulesScreen";
import { HunterModal } from "./components/game/HunterModal";
import { PhaseTimer } from "./components/game/PhaseTimer";
import { PlayerActionCard } from "./components/game/PlayerActionCard";
import { InviteQRCode } from "./components/game/InviteQRCode";
import { ROLES, ROLES_MAP } from "../lib/roles";
import { buildPlayerView } from "../lib/gameLogic";

const PHASES: Record<string, {
  label: string; icon: string; iconImg?: string;
  tint: string; headerBg: string; cardBorder: string; accentColor: string;
  actions: string[];
}> = {
  waiting: {
    label: "En attente", icon: "⏳",
    tint: "rgba(11,10,15,0.18)",
    headerBg: "rgba(11,10,15,0.55)",
    cardBorder: "rgba(201,160,48,0.14)",
    accentColor: "rgba(201,160,48,0.85)",
    actions: ["Ajoutez les joueurs", "Sélectionnez les rôles", "Lancez la partie quand tout est prêt"],
  },
  night: {
    label: "Nuit", icon: "🌙", iconImg: "/lycan/ui/icon-phase-night.png",
    tint: "rgba(13,10,42,0.42)",
    headerBg: "rgba(13,10,42,0.62)",
    cardBorder: "rgba(99,102,241,0.22)",
    accentColor: "rgba(165,180,252,0.9)",
    actions: [
      "Réveillez la Voyante — elle désigne un joueur",
      "Réveillez les Loups — ils choisissent une victime",
      "Réveillez la Sorcière — utilise-t-elle une potion ?",
    ],
  },
  day: {
    label: "Jour", icon: "☀️", iconImg: "/lycan/ui/icon-phase-day.png",
    tint: "rgba(42,21,5,0.28)",
    headerBg: "rgba(42,21,5,0.55)",
    cardBorder: "rgba(217,119,6,0.22)",
    accentColor: "rgba(251,191,36,0.9)",
    actions: [
      "Annoncez les événements de la nuit",
      "Les joueurs débattent librement",
      "Proposez un vote si le village est prêt",
    ],
  },
  vote: {
    label: "Vote", icon: "🗳️", iconImg: "/lycan/ui/icon-phase-vote.png",
    tint: "rgba(42,8,16,0.38)",
    headerBg: "rgba(42,8,16,0.62)",
    cardBorder: "rgba(139,28,28,0.28)",
    accentColor: "rgba(248,113,113,0.9)",
    actions: [
      "Chaque joueur vote pour un suspect",
      "Le Capitaine peut modifier son vote en dernier",
      "Clôturez le vote pour révéler l'éliminé",
    ],
  },
  end: {
    label: "Fin de partie", icon: "🏆", iconImg: "/lycan/ui/icon-phase-end.png",
    tint: "rgba(5,25,15,0.3)",
    headerBg: "rgba(5,25,15,0.55)",
    cardBorder: "rgba(16,185,129,0.2)",
    accentColor: "rgba(52,211,153,0.9)",
    actions: ["Révélez tous les rôles", "Annoncez l'équipe victorieuse", "Consultez l'historique"],
  },
};

// ── Assets rôles ──────────────────────────────────────────────────────────────

const ROLE_IMAGES: Record<string, string> = {
  werewolf:   "/lycan/roles/loup-garou.png",
  bigbadwolf: "/lycan/roles/loup-garou.png",
  seer:       "/lycan/roles/voyante.png",
  witch:      "/lycan/roles/sorciere.png",
  hunter:     "/lycan/roles/chasseur.png",
  cupid:      "/lycan/roles/cupidon.png",
  villager:   "/lycan/roles/villageois.png",
  littlegirl: "/lycan/roles/villageois.png",
  elder:      "/lycan/roles/villageois.png",
  captain:    "/lycan/roles/villageois.png",
};

// ── Composants partagés ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlayerStatus }) {
  const map: Record<PlayerStatus, { label: string; cls: string }> = {
    alive: { label: "Vivant", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
    dead: { label: "Mort", cls: "text-red-400 border-red-400/30 bg-red-400/10" },
    protected: { label: "Protégé", cls: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
    infected: { label: "Infecté", cls: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  };
  const { label, cls } = map[status] ?? map.alive;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase tracking-wider flex-shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function Avatar({ name, status, isCapitaine }: { name: string; status: PlayerStatus; isCapitaine: boolean }) {
  const dead = status === "dead";
  return (
    <div
      className={`relative w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 border transition-all ${dead ? "bg-[#1a1018] border-red-400/15 text-red-400/50" : "bg-[#1e1b2a] border-[#c9a030]/30 text-[#c9a030]"}`}
      style={{ fontFamily: "Cinzel, serif" }}
    >
      {dead ? "💀" : name.slice(0, 2).toUpperCase()}
      {isCapitaine && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a030] rounded-full flex items-center justify-center">
          <Crown size={8} className="text-[#0b0a0f]" />
        </div>
      )}
    </div>
  );
}

function RoleThumb({ name, status, isCapitaine, role, size = 40 }: {
  name: string; status: PlayerStatus; isCapitaine: boolean; role?: string | null; size?: number;
}) {
  const img = role ? (ROLE_IMAGES[role] ?? null) : null;
  if (!img) return <Avatar name={name} status={status} isCapitaine={isCapitaine} />;

  const dead = status === "dead";
  const radius = size >= 38 ? "rounded-xl" : "rounded-lg";
  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden ${radius}`}
      style={{
        width: size, height: size,
        border: `1px solid ${dead ? "rgba(255,80,80,0.2)" : "rgba(201,160,48,0.35)"}`,
        filter: dead ? "grayscale(70%) brightness(0.55)" : undefined,
      }}
    >
      <img
        src={img}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
      />
      {isCapitaine && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a030] rounded-full flex items-center justify-center z-10">
          <Crown size={8} className="text-[#0b0a0f]" />
        </div>
      )}
    </div>
  );
}

function getPublicAppUrl(): string {
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return window.location.origin;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0" style={{ border: "1px solid var(--gold-dim)", color: "var(--gold)" }}>
      <ArrowLeft size={15} />
    </button>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl font-semibold uppercase transition-all active:scale-[0.98] disabled:opacity-40"
      style={{
        fontFamily: "var(--font-title)",
        color: "var(--text-primary)",
        fontSize: "0.875rem",
        letterSpacing: "0.12em",
        padding: "16px 24px",
        background: disabled ? "rgba(50,20,20,0.4)" : "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)",
        border: "1px solid rgba(201,160,48,0.3)",
        boxShadow: disabled ? "none" : "0 4px 18px rgba(139,28,28,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </button>
  );
}

function GoldOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl uppercase transition-all active:scale-[0.98]"
      style={{
        fontFamily: "var(--font-title)",
        color: "var(--gold)",
        fontSize: "0.875rem",
        letterSpacing: "0.08em",
        padding: "14px 24px",
        background: "rgba(11,10,15,0.5)",
        border: "1px solid rgba(201,160,48,0.35)",
      }}
    >
      {children}
    </button>
  );
}

function DarkCard({ children, red }: { children: React.ReactNode; red?: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{
      background: red ? "rgba(30,8,8,0.75)" : "rgba(11,10,15,0.68)",
      border: `1px solid ${red ? "rgba(139,28,28,0.35)" : "rgba(201,160,48,0.16)"}`,
      backdropFilter: "blur(6px)",
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mx-5 mb-3 p-3 rounded-xl flex items-start gap-2" style={{ background: "var(--red-wolf-dim)", border: "1px solid rgba(139,28,28,0.5)" }}>
      <span className="text-red-400 text-xs flex-1" style={{ fontFamily: "var(--font-body)" }}>{message}</span>
      <button onClick={onDismiss} className="text-[#9490a0] text-xs ml-2 flex-shrink-0">✕</button>
    </div>
  );
}

// ── Écran : Accueil ────────────────────────────────────────────────────────────

function HomeScreen() {
  const { navigate, state } = useGame();

  return (
    <div className="relative overflow-hidden flex flex-col items-center" style={{ minHeight: "100%", background: "var(--bg-deep)" }}>

      {/* ── Fond : illustration village nocturne ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/lycan/village-night.png"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
        />
        {/* Assombrissement haut léger pour lisibilité du logo */}
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.35) 0%, rgba(11,10,15,0) 100%)" }} />
        {/* Fondu bas réduit — zone boutons */}
        <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0) 0%, rgba(11,10,15,0.55) 50%, var(--bg-deep) 95%)" }} />
        {/* Halo de pleine lune */}
        <div className="absolute left-1/2 top-[4%] -translate-x-1/2 h-[280px] w-[280px] rounded-full" style={{ background: "radial-gradient(circle, var(--gold-glow) 0%, rgba(201,160,48,0.04) 50%, transparent 70%)" }} />
        {/* Vignette latérale légère */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(125% 95% at 50% 35%, transparent 55%, rgba(11,10,15,0.45) 100%)" }} />
      </div>

      {/* ── Indicateur connexion ── */}
      <div className="absolute top-4 right-5 flex items-center gap-1.5 z-10">
        {state.connected
          ? <><Wifi size={11} className="text-emerald-400" /><span className="text-[9px] text-emerald-400 font-mono">Connecté</span></>
          : <><WifiOff size={11} style={{ color: "var(--text-muted)" }} /><span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Hors ligne</span></>
        }
      </div>

      {/* ── Logo + titre ── */}
      <div className="flex flex-col items-center mt-12 gap-3 z-10 px-6">
        <LycanLogo size={120} />

        <h1
          className="mt-1 text-center font-bold leading-none"
          style={{ fontFamily: "var(--font-display)", color: "var(--gold)", fontSize: "2.4rem", textShadow: "0 2px 24px rgba(0,0,0,0.9), 0 0 40px rgba(201,160,48,0.2)", letterSpacing: "0.04em" }}
        >
          Lycan Master
        </h1>

        <img src="/lycan/ui/separator.png" alt="" aria-hidden="true" style={{ width: 180, height: "auto", opacity: 0.75 }} />

        <p className="text-center text-[11px] uppercase tracking-[0.4em]" style={{ fontFamily: "var(--font-title)", color: "var(--text-muted)" }}>
          Assistant du Maître du Jeu
        </p>
      </div>

      {/* ── Boutons ── */}
      <div className="w-full flex flex-col gap-3 px-6 mt-10 mb-12 z-10">
        <button
          onClick={() => navigate("create")}
          className="w-full rounded-xl font-semibold uppercase transition-all active:scale-[0.98]"
          style={{
            fontFamily: "var(--font-title)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            letterSpacing: "0.14em",
            padding: "17px 24px",
            background: "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)",
            border: "1px solid rgba(201,160,48,0.32)",
            boxShadow: "0 4px 22px rgba(139,28,28,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          Créer une partie
        </button>

        <button
          onClick={() => navigate("join")}
          className="w-full rounded-xl font-medium uppercase transition-all active:scale-[0.98]"
          style={{
            fontFamily: "var(--font-title)",
            color: "var(--gold)",
            fontSize: "0.9rem",
            letterSpacing: "0.12em",
            padding: "16px 24px",
            background: "rgba(11,10,15,0.55)",
            border: "1px solid rgba(201,160,48,0.35)",
          }}
        >
          Rejoindre une partie
        </button>

        <button
          onClick={() => navigate("rules")}
          className="w-full uppercase transition-all active:opacity-70"
          style={{
            fontFamily: "var(--font-title)",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            letterSpacing: "0.22em",
            padding: "12px 24px",
            background: "transparent",
            border: "none",
          }}
        >
          Règles et rôles
        </button>
      </div>

      {/* ── Footer ── */}
      <p
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[11px] uppercase tracking-[0.3em] whitespace-nowrap"
        style={{ fontFamily: "var(--font-mono)", color: "rgba(148,144,160,0.55)" }}
      >
        Sous la pleine lune
      </p>
    </div>
  );
}

// ── Écran : Créer ──────────────────────────────────────────────────────────────

const MODES: { id: GameMode; label: string; desc: string }[] = [
  { id: "beginner", label: "Débutant", desc: "Idéal pour les nouveaux joueurs. Rôles simples, sans pouvoirs complexes." },
  { id: "classic", label: "Classique", desc: "La version standard du jeu avec les rôles et pouvoirs principaux." },
  { id: "expert", label: "Expert", desc: "Pour joueurs confirmés. Rôles avancés et stratégie poussée." },
  { id: "custom", label: "Personnalisé", desc: "Configurez librement vos rôles et règles pour une partie unique." },
];

function CreateScreen() {
  const { navigate, state, setDraft, setError, gmCreate } = useGame();
  const { draft } = state;
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      await gmCreate(draft.name, draft.playerCount, draft.mode);
      navigate("players");
    } catch (e: unknown) {
      setError((e as Error).message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-full" style={{ background: "var(--bg-deep)" }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/lobby-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.6) 0%, rgba(11,10,15,0) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.52)" }} />
      </div>

      <div className="relative z-10 px-5 py-6">

        {/* En-tête */}
        <div className="flex items-center gap-3 mb-7">
          <BackButton onClick={() => navigate("home")} />
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>Créer une partie</h2>
        </div>

        {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

        {/* Formulaire */}
        <div className="rounded-2xl p-5 flex flex-col gap-5" style={{ background: "rgba(11,10,15,0.72)", border: "1px solid rgba(201,160,48,0.15)", backdropFilter: "blur(6px)" }}>

          {/* Nom */}
          <div>
            <SectionLabel>Nom de la partie</SectionLabel>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ name: e.target.value })}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ fontFamily: "var(--font-body)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,160,48,0.2)", color: "var(--text-primary)" }}
              placeholder="Soirée des Loups..."
            />
          </div>

          {/* Compteur joueurs */}
          <div>
            <SectionLabel>Nombre de joueurs</SectionLabel>
            <div className="flex items-center">
              <button
                onClick={() => setDraft({ playerCount: Math.max(4, draft.playerCount - 1) })}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-light transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,160,48,0.2)", color: "var(--gold)" }}
              >−</button>
              <div className="flex-1 text-center">
                <span className="font-bold leading-none" style={{ fontFamily: "var(--font-title)", color: "var(--gold)", fontSize: "2.4rem" }}>{draft.playerCount}</span>
                <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>joueurs</p>
              </div>
              <button
                onClick={() => setDraft({ playerCount: Math.min(24, draft.playerCount + 1) })}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-light transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,160,48,0.2)", color: "var(--gold)" }}
              >+</button>
            </div>
          </div>

          {/* Mode de jeu */}
          <div>
            <SectionLabel>Mode de jeu</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDraft({ mode: m.id })}
                  className="py-3 rounded-xl text-xs font-medium transition-all active:scale-95"
                  style={{
                    fontFamily: "var(--font-title)",
                    letterSpacing: "0.05em",
                    background: draft.mode === m.id ? "linear-gradient(180deg, #b52828 0%, #8b1c1c 100%)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${draft.mode === m.id ? "rgba(201,160,48,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: draft.mode === m.id ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: draft.mode === m.id ? "0 2px 12px rgba(139,28,28,0.3)" : "none",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed mt-3 px-1" style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-muted)" }}>
              {MODES.find((m) => m.id === draft.mode)?.desc}
            </p>
          </div>
        </div>

        {/* Bouton continuer */}
        <div className="mt-5">
          <PrimaryButton onClick={handleContinue} disabled={loading || !draft.name.trim()}>
            {loading ? "Création..." : "Continuer →"}
          </PrimaryButton>
        </div>

      </div>
    </div>
  );
}

// ── Écran : Joueurs ────────────────────────────────────────────────────────────

function PlayersScreen() {
  const { navigate, state, gmAddPlayer, gmRemovePlayer, gmAddTestPlayers, setError } = useGame();
  const [newName, setNewName] = useState("");
  const [addingTest, setAddingTest] = useState(false);
  const [showStaticQR, setShowStaticQR] = useState(false);

  const players = state.game?.players ?? [];
  const gameId = state.game?.id;
  const sessionUrl = gameId ? `${getPublicAppUrl()}/?join=${gameId}` : "";
  const staticUrl = `${getPublicAppUrl()}/?join`;

  const addPlayer = async () => {
    if (!newName.trim()) return;
    try {
      await gmAddPlayer(newName.trim());
      setNewName("");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="relative min-h-full" style={{ background: "var(--bg-deep)" }}>
      {/* ── Fond : taverne du village ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/lycan/lobby-night.png"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }}
        />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.4) 0%, rgba(11,10,15,0) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.3)" }} />
      </div>

      {/* ── Contenu ── */}
      <div className="relative z-10 px-5 py-6">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <BackButton onClick={() => navigate("create")} />
          <span className="text-xs uppercase tracking-[0.3em] px-4 py-1.5 rounded-full" style={{ fontFamily: "var(--font-mono)", color: "var(--gold)", background: "rgba(11,10,15,0.6)", border: "1px solid var(--gold-dim)" }}>
            Salon
          </span>
          <div className="w-8" />
        </div>

        {/* Code / nom de la partie */}
        {state.game?.name && (
          <div className="flex flex-col items-center mb-6">
            <p className="text-xs uppercase tracking-[0.32em] mb-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-muted)" }}>
              Partie en cours
            </p>
            <p className="text-3xl font-bold tracking-[0.15em]" style={{ fontFamily: "var(--font-display)", color: "var(--gold)", textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}>
              {state.game.name}
            </p>
            {gameId && (
              <p className="text-[10px] mt-1 font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>id : {gameId}</p>
            )}
          </div>
        )}

        {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

        {/* Villageois rassemblés */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
            Villageois rassemblés
          </h2>
          <span className="text-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {players.length} / {state.game?.playerCount ?? "?"}
          </span>
        </div>

        {/* Liste des joueurs */}
        <div className="flex flex-col gap-2 mb-4">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(11,10,15,0.65)", border: "1px solid rgba(201,160,48,0.15)" }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold flex-shrink-0"
                style={{ background: "rgba(11,10,15,0.8)", color: "var(--gold)", border: "1px solid rgba(201,160,48,0.25)", fontFamily: "var(--font-title)" }}>
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-sm truncate" style={{ fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>{p.name}</span>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: p.isConnected ? "#3f9d57" : "rgba(148,144,160,0.35)", boxShadow: p.isConnected ? "0 0 6px rgba(63,157,87,0.6)" : "none" }} />
                <button onClick={() => gmRemovePlayer(p.id)} className="w-7 h-7 rounded flex items-center justify-center transition-colors active:scale-90" style={{ color: "rgba(248,113,113,0.45)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-center py-6 text-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              Aucun joueur encore
            </p>
          )}
        </div>

        {/* Ajouter un joueur */}
        <div className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
            style={{ fontFamily: "var(--font-body)", background: "rgba(11,10,15,0.65)", border: "1px solid rgba(201,160,48,0.2)", color: "var(--text-primary)" }}
            placeholder="Nom du joueur..."
          />
          <button onClick={addPlayer} className="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: "linear-gradient(135deg, var(--red-wolf), #6b1414)" }}>
            <Plus size={18} style={{ color: "var(--primary-foreground)" }} />
          </button>
        </div>

        {/* QR code dynamique de partie */}
        {gameId && (
          <div className="mb-3">
            <InviteQRCode mode="session" sessionCode={gameId} inviteUrl={sessionUrl} />
          </div>
        )}

        {/* Section QR permanent */}
        <div className="mb-4">
          {!showStaticQR ? (
            <button
              onClick={() => setShowStaticQR(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: "rgba(11,10,15,0.45)",
                border: "1px dashed rgba(201,160,48,0.12)",
                color: "rgba(200,192,176,0.35)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              🖨 Afficher le QR permanent à imprimer
            </button>
          ) : (
            <div>
              <InviteQRCode mode="static" inviteUrl={staticUrl} />
              <button
                onClick={() => setShowStaticQR(false)}
                className="mt-2 w-full text-center text-[9px] font-mono"
                style={{ color: "rgba(200,192,176,0.22)", letterSpacing: "0.08em" }}
              >
                Masquer
              </button>
            </div>
          )}
        </div>

        {/* Joueurs de test */}
        {(
          <button
            disabled={addingTest}
            onClick={async () => {
              console.log("[Test] Clic Ajouter joueurs test");
              setAddingTest(true);
              try {
                await gmAddTestPlayers();
              } catch (e: unknown) {
                setError((e as Error).message ?? "Erreur ajout joueurs test");
              } finally {
                setAddingTest(false);
              }
            }}
            className="w-full mb-4 py-2.5 rounded-xl flex items-center justify-center gap-2 border border-dashed transition-all active:scale-95 text-xs font-mono tracking-wide disabled:opacity-40"
            style={{ borderColor: "rgba(201,160,48,0.18)", color: "var(--text-muted)" }}
          >
            {addingTest ? "⏳ Ajout en cours…" : "🧪 Créer joueurs de test (Alice–Frank)"}
          </button>
        )}

        <PrimaryButton onClick={() => navigate("roles")}>Lancer les rôles →</PrimaryButton>
      </div>
    </div>
  );
}

// ── Écran : Rôles ──────────────────────────────────────────────────────────────

type RoleCategory = "wolves" | "village" | "special";

function RolesScreen() {
  const { navigate, state, gmSetRoles, gmStart, setError } = useGame();
  const playerCount = state.game?.players.length ?? 0;
  const [roles, setRoles] = useState(() =>
    ROLES.map((r) => ({ ...r, count: r.defaultCount }))
  );
  const [activeCategory, setActiveCategory] = useState<RoleCategory>("wolves");
  const [loading, setLoading] = useState(false);

  const totalSelected = roles.reduce((s, r) => s + r.count, 0);
  const isComplete = totalSelected === playerCount && playerCount > 0;

  const updateCount = (id: string, delta: number) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, count: Math.max(0, r.count + delta) } : r)));
  };

  const categories: { id: RoleCategory; label: string; emoji: string }[] = [
    { id: "wolves", label: "Loups", emoji: "🐺" },
    { id: "village", label: "Village", emoji: "🏡" },
    { id: "special", label: "Spéciaux", emoji: "✨" },
  ];

  const handleValidate = async () => {
    setLoading(true);
    try {
      const roleConfig: RoleConfig[] = roles.filter((r) => r.count > 0).map((r) => ({ id: r.id, count: r.count }));
      await gmSetRoles(roleConfig);
      await gmStart();
      navigate("dashboard");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = roles.filter((r) => r.category === activeCategory);

  return (
    <div className="relative min-h-full" style={{ background: "var(--bg-deep)" }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/lobby-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.38)" }} />
      </div>
      <div className="relative z-10 px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate("players")} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>Composition des rôles</h2>
        </div>
        <div className={`px-3 py-1 rounded-full font-mono text-xs border flex-shrink-0 transition-colors ${isComplete ? "border-emerald-400/50 text-emerald-400 bg-emerald-400/10" : ""}`}
          style={!isComplete ? { borderColor: "var(--gold-dim)", color: "var(--gold)" } : {}}>
          {totalSelected}/{playerCount}
        </div>
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      {/* Onglets de catégorie */}
      <div className="flex gap-2 mb-5">
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border"
            style={{ fontFamily: "var(--font-title)", background: activeCategory === cat.id ? "var(--red-wolf-dim)" : "transparent", borderColor: activeCategory === cat.id ? "rgba(139,28,28,0.75)" : "var(--gold-subtle)", color: activeCategory === cat.id ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: "0.03em", fontSize: "11px" }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Liste des rôles */}
      <div className="flex flex-col gap-2 mb-5">
        {filtered.map((role) => (
          <div key={role.id} className="p-3.5 rounded-xl flex items-center gap-3 transition-all"
            style={{
              background: !role.playable ? "rgba(255,255,255,0.02)" : role.count > 0 ? "var(--red-wolf-dim)" : "var(--bg-card)",
              border: `1px solid ${!role.playable ? "rgba(255,255,255,0.06)" : role.count > 0 ? "rgba(139,28,28,0.38)" : "var(--gold-subtle)"}`,
              opacity: !role.playable ? 0.5 : 1,
            }}>
            <div className="text-2xl flex-shrink-0 w-8 text-center">{role.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>{role.name}</p>
                {!role.playable && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>Bientôt</span>
                )}
              </div>
              <p className="text-xs leading-snug mt-0.5" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>{role.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => updateCount(role.id, -1)} disabled={!role.playable}
                className="w-7 h-7 rounded-full flex items-center justify-center text-base leading-none transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: "1px solid var(--gold-dim)", color: "var(--gold)" }}>−</button>
              <span className="w-5 text-center font-mono text-sm" style={{ color: "var(--text-primary)" }}>{!role.playable ? "–" : role.count}</span>
              <button onClick={() => updateCount(role.id, 1)} disabled={!role.playable}
                className="w-7 h-7 rounded-full flex items-center justify-center text-base leading-none transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: "1px solid var(--gold-dim)", color: "var(--gold)" }}>+</button>
            </div>
          </div>
        ))}
      </div>

      <PrimaryButton onClick={handleValidate} disabled={!isComplete || loading}>
        {loading ? "Lancement..." : "⚔ Lancer la partie"}
      </PrimaryButton>
      </div>
    </div>
  );
}

// ── DEV : Vue joueur simulée (invisible en production) ───────────────────────

function SimulatedPlayerModal({ game, playerId, onClose }: {
  game: GameState;
  playerId: string;
  onClose: () => void;
}) {
  const pv = buildPlayerView(game, playerId);
  if (!pv) return null;
  const { player, instruction, phase, phaseNumber, currentVotes } = pv;
  const phaseLabel = phase === "night" ? `🌙 Nuit ${phaseNumber}` : phase === "day" ? `☀️ Jour ${phaseNumber}` : phase === "vote" ? `🗳️ Vote` : "⏳ En attente";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#0b0a0f", border: "2px dashed rgba(201,160,48,0.4)", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ background: "rgba(201,160,48,0.06)", borderBottom: "1px solid rgba(201,160,48,0.15)" }}>
          <div>
            <p className="text-[8px] text-[#c9a030] font-mono uppercase tracking-widest mb-0.5">🧪 Vue simulée — MJ uniquement</p>
            <p className="text-sm font-bold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>{player.name}</p>
            <p className="text-[9px] text-[#9490a0] font-mono">{phaseLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9490a0] border border-[#9490a0]/25 text-xl leading-none">×</button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3">
          {player.status === "dead" ? (
            <div className="rounded-xl p-4 flex flex-col items-center gap-2" style={{ background: "#16141f", border: "1px solid rgba(255,0,0,0.2)" }}>
              <div className="text-3xl">💀</div>
              <p className="text-base font-bold text-red-400" style={{ fontFamily: "Cinzel, serif" }}>Tu es mort(e)</p>
            </div>
          ) : player.role ? (
            <div className="rounded-xl p-4 flex flex-col items-center gap-2" style={{ background: "linear-gradient(160deg, #1c1040, #0e0824)", border: "1px solid rgba(201,160,48,0.4)" }}>
              <div className="text-3xl">{player.roleData?.emoji ?? "❓"}</div>
              <p className="text-base font-bold text-[#c9a030]" style={{ fontFamily: "Cinzel, serif" }}>{player.roleData?.name ?? player.role}</p>
              <p className="text-xs text-[#9490a0] text-center" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{player.roleData?.description}</p>
              {player.isCapitaine && <span className="text-[9px] text-[#c9a030] font-mono">⚔️ Capitaine</span>}
            </div>
          ) : (
            <div className="rounded-xl p-4 flex flex-col items-center gap-2" style={{ background: "#16141f", border: "1px solid rgba(201,160,48,0.15)" }}>
              <div className="text-3xl">⏳</div>
              <p className="text-base text-[#c9a030]" style={{ fontFamily: "Cinzel, serif" }}>Rôle non attribué</p>
            </div>
          )}

          <div className="p-3 rounded-xl" style={{ background: "#16141f", border: "1px solid rgba(139,28,28,0.28)" }}>
            <p className="text-[8px] text-[#8b1c1c] font-mono uppercase tracking-wider mb-1">Consigne actuelle</p>
            <p className="text-xs text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{instruction}</p>
          </div>

          {phase === "vote" && currentVotes.length > 0 && player.status !== "dead" && (
            <div>
              <p className="text-[8px] text-[#9490a0] font-mono uppercase tracking-widest mb-2">Votes visibles</p>
              {currentVotes.filter((t) => t.status !== "dead" && t.id !== player.id).map((target) => (
                <div key={target.id} className="mb-1 flex items-center justify-between p-2 rounded-lg" style={{ background: "#16141f", border: "1px solid rgba(201,160,48,0.1)" }}>
                  <span className="text-xs text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>{target.name}</span>
                  <span className="text-xs font-mono text-[#c9a030]">{target.votes} voix</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-[8px] text-[#9490a0]/50 font-mono pt-1">Aucune action n'est envoyée depuis cette vue</p>
        </div>
      </div>
    </div>
  );
}

// ── Écran : Tableau de bord MJ ────────────────────────────────────────────────

function DashboardScreen() {
  const { navigate, state, gmNextPhase, gmResolveVote, gmEliminate, gmSetCaptain, gmEndGame, setError } = useGame();
  const [simPlayerId, setSimPlayerId] = useState<string | null>(null);
  const [voteResolving, setVoteResolving] = useState(false);
  const [confirmNoVote, setConfirmNoVote] = useState(false);
  const game = state.game;

  if (!game) return <div className="flex items-center justify-center min-h-full text-[#9490a0]">Chargement...</div>;

  const phase = game.phase as GamePhase;
  const phaseInfo = PHASES[phase] ?? PHASES.waiting;
  const alivePlayers = game.players.filter((p) => p.status !== "dead");

  const handleNextPhase = async () => {
    try {
      await gmNextPhase();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  // Calcule le résultat du vote actuel (votes des vivants uniquement)
  const voteResult = (() => {
    if (phase !== "vote") return null;
    const aliveIds = new Set(game.players.filter((p) => p.status !== "dead").map((p) => p.id));
    const capitaineId = game.players.find((p) => p.isCapitaine)?.id;
    const counts: Record<string, number> = {};
    for (const [voterId, targetId] of Object.entries(game.votesByPlayer ?? {})) {
      if (!aliveIds.has(voterId)) continue;
      counts[targetId] = (counts[targetId] ?? 0) + (voterId === capitaineId ? 2 : 1);
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return { type: "no_votes" as const };
    const maxVotes = Math.max(...entries.map(([, v]) => v));
    const top = entries.filter(([, v]) => v === maxVotes);
    if (top.length > 1) {
      return {
        type: "tie" as const,
        players: top.map(([id, votes]) => ({ id, votes, name: game.players.find((p) => p.id === id)?.name ?? id })),
      };
    }
    const [winnerId, winnerVotes] = top[0];
    return { type: "winner" as const, playerId: winnerId, playerName: game.players.find((p) => p.id === winnerId)?.name ?? winnerId, votes: winnerVotes };
  })();

  const handleResolveVote = async (overrideWinnerId?: string | null) => {
    if (overrideWinnerId !== undefined) {
      // Cas confirmation "pas d'élimination"
      setConfirmNoVote(false);
      setVoteResolving(true);
      try { await gmResolveVote(null); } catch (e: unknown) { setError((e as Error).message); } finally { setVoteResolving(false); }
      return;
    }
    if (!voteResult) return;
    if (voteResult.type === "tie") {
      setError(`Égalité entre : ${voteResult.players.map((p) => p.name).join(", ")}. Départagez manuellement puis relancez.`);
      return;
    }
    if (voteResult.type === "no_votes") {
      setConfirmNoVote(true);
      return;
    }
    setVoteResolving(true);
    try { await gmResolveVote(voteResult.playerId); } catch (e: unknown) { setError((e as Error).message); } finally { setVoteResolving(false); }
  };

  const handleEliminate = async (playerId: string) => {
    const player = game.players.find((p) => p.id === playerId);
    if (!player || !confirm(`Éliminer ${player.name} ?`)) return;
    try {
      await gmEliminate(playerId, phase === "vote" ? "vote" : "night");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const handleSetCaptain = async (playerId: string) => {
    try {
      await gmSetCaptain(playerId);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const phaseImages: Record<string, string> = {
    night: "/lycan/night-phase.png",
    vote: "/lycan/vote-day.png",
    end: "/lycan/victory-village.png",
  };
  const bgImage = phaseImages[phase as string] ?? null;

  return (
    <div className="relative min-h-full pb-6" style={{ background: "var(--bg-deep)" }}>

      {/* ── Background image (phase-specific) ── */}
      {bgImage && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src={bgImage}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
          <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.28)" }} />
          <div className="absolute inset-0" style={{ background: phaseInfo.tint }} />
        </div>
      )}

      <div className="relative z-10">
        {/* Modal Chasseur — bloque l'interface jusqu'au tir */}
        {game.pendingHunterActions?.length > 0 && <HunterModal game={game} />}

        {/* DEV : Vue joueur simulée */}
        {import.meta.env.DEV && simPlayerId && (
          <SimulatedPlayerModal game={game} playerId={simPlayerId} onClose={() => setSimPlayerId(null)} />
        )}

        {/* Bannière de victoire */}
        {phase === "end" && game.winner && (
          <div className="px-5 pt-5 pb-0">
            <div className="p-5 rounded-2xl text-center" style={{
              background: game.winner === "wolves" ? "rgba(139,28,28,0.35)" : "rgba(16,185,129,0.15)",
              border: `1px solid ${game.winner === "wolves" ? "rgba(139,28,28,0.6)" : "rgba(16,185,129,0.4)"}`,
              boxShadow: game.winner === "wolves" ? "0 0 30px rgba(139,28,28,0.2)" : "0 0 30px rgba(16,185,129,0.1)",
            }}>
              <p className="text-3xl mb-2">{game.winner === "wolves" ? "🐺" : "🏡"}</p>
              <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: game.winner === "wolves" ? "#f87171" : "#34d399" }}>
                {game.winner === "wolves" ? "Les Loups-Garous ont gagné !" : "Le Village a gagné !"}
              </p>
            </div>
          </div>
        )}

        {/* En-tête de phase */}
        <div className="px-5 pt-5 pb-4 rounded-b-2xl" style={{ background: phaseInfo.headerBg, backdropFilter: "blur(8px)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                {phaseInfo.iconImg
                  ? <img src={phaseInfo.iconImg} alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
                  : <span>{phaseInfo.icon}</span>}
                {phaseInfo.label}
                {phase !== "end" && phase !== "waiting" && (
                  <span className="text-sm font-mono" style={{ color: phaseInfo.accentColor }}>#{game.phaseNumber}</span>
                )}
              </h2>
              <p className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>Code · {game.id}</p>
            </div>
            <button onClick={() => navigate("history")} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all active:scale-90"
              style={{ border: `1px solid ${phaseInfo.cardBorder}`, color: "var(--text-muted)" }}>
              <History size={11} />
              <span className="text-[10px] font-mono">Journal</span>
            </button>
          </div>

          {phase !== "night" && (
            <div className="rounded-xl p-3.5" style={{ background: "rgba(11,10,15,0.4)", border: `1px solid ${phaseInfo.cardBorder}` }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2.5" style={{ color: phaseInfo.accentColor, opacity: 0.75 }}>À faire maintenant</p>
              <div className="flex flex-col gap-1.5">
                {phaseInfo.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-[9px] font-mono w-3 flex-shrink-0 mt-0.5" style={{ color: phaseInfo.accentColor }}>{i + 1}.</span>
                    <p className="text-xs leading-snug" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

        {/* ── Phase nuit : NightWizard plein écran ── */}
        {phase === "night" ? (
          <div className="px-5 pt-5 pb-6">
            <NightWizard onResolve={() => {}} phaseNumber={game.phaseNumber} />
          </div>
        ) : (
          <>
            {/* Timer de phase */}
            {(phase === "day" || phase === "vote") && <PhaseTimer game={game} />}

            {/* Liste des joueurs */}
            <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Joueurs ({alivePlayers.length} vivants)</p>
            <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>MJ seulement</span>
          </div>

          <div className="flex flex-col gap-2">
            {game.players.map((p) => {
              const roleInfo = p.role ? ROLES_MAP[p.role] : null;
              const isLover = game.cupidLovers?.includes(p.id);
              const isDead = p.status === "dead";
              return (
                <div key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: isDead ? "rgba(11,10,15,0.45)" : "rgba(11,10,15,0.65)",
                    border: `1px solid ${isDead ? "rgba(255,80,80,0.1)" : isLover ? "rgba(236,72,153,0.3)" : phaseInfo.cardBorder}`,
                    opacity: isDead ? 0.55 : 1,
                  }}>
                  <RoleThumb name={p.name} status={p.status} isCapitaine={p.isCapitaine} role={p.role} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>{p.name}</p>
                      {isLover && <span className="text-xs flex-shrink-0">💘</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {roleInfo ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                          style={{ background: "rgba(201,160,48,0.1)", color: "var(--gold)", border: "1px solid rgba(201,160,48,0.15)" }}>
                          {roleInfo.emoji} {roleInfo.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: p.isConnected ? "#3f9d57" : "rgba(148,144,160,0.3)" }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <StatusBadge status={p.status} />
                    {p.status === "alive" && (
                      <>
                        <button onClick={() => handleSetCaptain(p.id)} title="Capitaine" className="w-7 h-7 rounded flex items-center justify-center transition-colors active:scale-90"
                          style={{ color: "var(--gold)", opacity: 0.55 }}>
                          <Crown size={12} />
                        </button>
                        <button onClick={() => handleEliminate(p.id)} title="Éliminer" className="w-7 h-7 rounded flex items-center justify-center transition-colors active:scale-90"
                          style={{ color: "rgba(248,113,113,0.5)" }}>
                          💀
                        </button>
                      </>
                    )}
                    {import.meta.env.DEV && (
                      <button onClick={() => setSimPlayerId(p.id)} title="Vue joueur simulée" className="w-6 h-6 rounded flex items-center justify-center ml-0.5"
                        style={{ color: "var(--text-muted)", opacity: 0.35 }}>
                        <Eye size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions de phase */}
        <div className="px-5 flex flex-col gap-2.5">
          {phase === "day" && (
            <PrimaryButton onClick={handleNextPhase}>🗳️ Lancer le vote →</PrimaryButton>
          )}
          {phase === "vote" && (
            <>
              {(() => {
                const aliveCount = game.players.filter(p => p.status !== "dead").length;
                const votedCount = Object.keys(game.votesByPlayer ?? {}).length;
                const allVoted = votedCount >= aliveCount && aliveCount > 0;
                return (
                  <p className="text-center text-[10px] font-mono" style={{ color: allVoted ? "rgba(52,211,153,0.8)" : "var(--text-muted)" }}>
                    {allVoted ? "✓ Tous les joueurs ont voté" : `${votedCount} / ${aliveCount} joueurs ont voté`}
                  </p>
                );
              })()}
              <GoldOutlineButton onClick={() => navigate("vote")}>📊 Voir les votes</GoldOutlineButton>
              {confirmNoVote ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-mono text-center" style={{ color: "var(--text-muted)" }}>Aucun vote enregistré. Passer sans élimination ?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmNoVote(false)} className="flex-1 py-2.5 rounded-xl text-xs border transition-all"
                      style={{ borderColor: "var(--gold-subtle)", color: "var(--text-muted)", fontFamily: "var(--font-title)" }}>
                      Annuler
                    </button>
                    <button onClick={() => handleResolveVote(null)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "var(--red-wolf-dim)", color: "var(--text-primary)", fontFamily: "var(--font-title)" }}>
                      🌙 Passer sans tuer
                    </button>
                  </div>
                </div>
              ) : (
                <PrimaryButton onClick={() => handleResolveVote()} disabled={voteResolving}>
                  {voteResolving
                    ? "Résolution..."
                    : voteResult?.type === "winner"
                    ? `⚖️ Éliminer ${voteResult.playerName} (${voteResult.votes} vote${voteResult.votes > 1 ? "s" : ""})`
                    : voteResult?.type === "tie"
                    ? "⚠️ Égalité — choisir"
                    : "⚖️ Résoudre le vote"}
                </PrimaryButton>
              )}
            </>
          )}
          {phase === "waiting" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl p-4" style={{ background: "rgba(201,160,48,0.05)", border: "1px solid rgba(201,160,48,0.14)" }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--gold)" }}>
                  ⚔️ Désigner le Capitaine
                </p>
                <p className="text-[10px] mb-3" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Les joueurs votent à l'oral. Tape le joueur élu.
                </p>
                <div className="flex flex-col gap-1.5">
                  {alivePlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSetCaptain(p.id)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] border"
                      style={{
                        background: p.isCapitaine ? "rgba(201,160,48,0.1)" : "rgba(11,10,15,0.5)",
                        borderColor: p.isCapitaine ? "rgba(201,160,48,0.4)" : "rgba(201,160,48,0.07)",
                      }}
                    >
                      <Crown size={12} style={{ color: p.isCapitaine ? "var(--gold)" : "rgba(201,160,48,0.2)", flexShrink: 0 }} />
                      <span className="text-sm flex-1" style={{ fontFamily: "var(--font-title)", color: p.isCapitaine ? "var(--gold)" : "var(--text-secondary)" }}>
                        {p.name}
                      </span>
                      {p.isCapitaine && (
                        <span className="text-[9px] font-mono" style={{ color: "var(--gold)" }}>CAPITAINE</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <PrimaryButton onClick={handleNextPhase}>
                🌙 Passer à la 1ère Nuit →
              </PrimaryButton>
            </div>
          )}
          {phase !== "end" && (
            <div className="flex gap-2 mt-1">
              <button onClick={() => gmEndGame("village")} className="flex-1 py-2.5 rounded-xl text-[11px] border transition-all active:scale-95"
                style={{ borderColor: "var(--gold-subtle)", color: "var(--gold)", fontFamily: "var(--font-title)" }}>
                🏡 Village gagne
              </button>
              <button onClick={() => gmEndGame("wolves")} className="flex-1 py-2.5 rounded-xl text-[11px] border transition-all active:scale-95"
                style={{ borderColor: "rgba(139,28,28,0.35)", color: "var(--text-primary)", fontFamily: "var(--font-title)", background: "var(--red-wolf-dim)" }}>
                🐺 Loups gagnent
              </button>
            </div>
          )}
          {phase === "end" && (
            <div className="flex flex-col gap-2.5 mt-2">
              <PrimaryButton onClick={() => navigate("create")}>⚔ Nouvelle partie</PrimaryButton>
              <GoldOutlineButton onClick={() => navigate("home")}>← Retour à l'accueil</GoldOutlineButton>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Écran : Vue Joueur ────────────────────────────────────────────────────────

function PlayerViewScreen() {
  const { navigate, state, playerVote } = useGame();
  const pv = state.playerView;
  const [myVote, setMyVote] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [screenHidden, setScreenHidden] = useState(false);
  const [cardHidden, setCardHidden] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaurer le vote du joueur depuis l'état jeu (résiste au rechargement/reconnexion)
  useEffect(() => {
    const playerId = pv?.player?.id;
    if (!playerId || !state.game) return;
    if (pv.phase === "vote") {
      setMyVote(state.game.votesByPlayer?.[playerId] ?? null);
    } else {
      setMyVote(null);
    }
  }, [pv?.phase, pv?.player?.id]);

  if (!pv) {
    return (
      <div className="relative min-h-full flex flex-col items-center justify-center gap-4 px-5" style={{ background: "var(--bg-deep)" }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img src="/lycan/village-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
          <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.42)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LycanLogo size={80} />
          <p className="text-sm font-mono text-center" style={{ color: "var(--text-muted)" }}>En attente des données du Maître du Jeu...</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--gold)" }} />
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--gold)", animationDelay: "0.2s" }} />
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--gold)", animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  const { player, instruction, phase, phaseNumber, gameName, currentVotes, winner } = pv;
  const phaseLabel = phase === "night" ? `🌙 Nuit ${phaseNumber}` : phase === "day" ? `☀️ Jour ${phaseNumber}` : phase === "vote" ? `🗳️ Vote` : phase === "end" ? "🏆 Fin de partie" : "⏳ En attente";

  const isDiscreetMode = phase === "night" && player.status !== "dead";
  const roleInfo = player.role ? ROLES_MAP[player.role] : null;

  // ── Écran noir complet (masquer) ──
  if (screenHidden) {
    return (
      <div
        className="relative min-h-full flex flex-col items-center justify-center gap-2"
        style={{ background: "#000000", touchAction: "none" }}
        onPointerDown={() => { longPressRef.current = setTimeout(() => setScreenHidden(false), 700); }}
        onPointerUp={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
        onPointerCancel={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
      >
        <p style={{ color: "rgba(70,65,80,0.5)", fontSize: "10px", fontFamily: "var(--font-mono)", letterSpacing: "0.15em" }}>ÉCRAN MASQUÉ</p>
        <p style={{ color: "rgba(70,65,80,0.28)", fontSize: "9px", fontFamily: "var(--font-mono)" }}>Appuie longuement pour revenir</p>
      </div>
    );
  }

  // ── Mode discrétion nuit ──
  if (isDiscreetMode) {
    return (
      <div className="relative min-h-full flex flex-col pb-6" style={{ background: "#050408" }}>
        {/* Header ultra-discret */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div style={{ width: 32 }} />
          <div className="text-center">
            <p style={{ color: "rgba(120,115,135,0.3)", fontSize: "9px", fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }}>{gameName}</p>
            <p style={{ color: "rgba(120,115,135,0.22)", fontSize: "8px", fontFamily: "var(--font-mono)", marginTop: 2 }}>NUIT {phaseNumber}</p>
          </div>
          <button
            onClick={() => setScreenHidden(true)}
            style={{ color: "rgba(120,115,135,0.28)", fontSize: "9px", fontFamily: "var(--font-mono)", padding: "4px 8px", border: "1px solid rgba(120,115,135,0.1)", borderRadius: 8 }}
          >
            masquer
          </button>
        </div>

        <div className="flex-1 flex flex-col px-5 gap-5">
          {/* Nom du joueur très atténué */}
          <p className="text-center" style={{ color: "rgba(200,192,176,0.2)", fontSize: "14px", fontFamily: "var(--font-title)", letterSpacing: "0.06em" }}>
            {player.name}{player.isCapitaine ? " ⚔" : ""}
          </p>

          {/* Rôle — maintenir pour révéler */}
          <div
            className="rounded-2xl flex flex-col items-center justify-center gap-3 select-none"
            onPointerDown={() => setReveal(true)}
            onPointerUp={() => setReveal(false)}
            onPointerCancel={() => setReveal(false)}
            onPointerLeave={() => setReveal(false)}
            style={{ background: "rgba(12,10,18,0.95)", border: "1px solid rgba(201,160,48,0.05)", padding: "28px 16px", userSelect: "none", touchAction: "none", minHeight: 130 }}
          >
            {reveal && roleInfo ? (
              <>
                <span style={{ fontSize: "30px" }}>{roleInfo.emoji}</span>
                <p style={{ color: "rgba(201,160,48,0.65)", fontSize: "15px", fontFamily: "var(--font-display)", textAlign: "center" }}>{roleInfo.name}</p>
                <p style={{ color: "rgba(200,192,176,0.35)", fontSize: "10px", fontFamily: "var(--font-body)", fontStyle: "italic", textAlign: "center", lineHeight: 1.4 }}>{roleInfo.description}</p>
              </>
            ) : (
              <>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(201,160,48,0.04)", border: "1px solid rgba(201,160,48,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "16px", opacity: 0.25 }}>?</span>
                </div>
                <p style={{ color: "rgba(200,192,176,0.18)", fontSize: "10px", fontFamily: "var(--font-title)", letterSpacing: "0.12em" }}>RÔLE MASQUÉ</p>
                <p style={{ color: "rgba(150,145,160,0.12)", fontSize: "8px", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>Maintiens appuyé pour révéler</p>
              </>
            )}
          </div>

          {/* Résultat Voyante (nuit discrète) */}
          {pv.resolvedActions && pv.resolvedActions.length > 0 && (() => {
            const last = pv.resolvedActions[pv.resolvedActions.length - 1];
            if (last.type === "seer_choose_target" && last.result) {
              const r = last.result as { targetName: string; roleData: { name: string; emoji: string; category: string } | null };
              const isWolf = r.roleData?.category === "wolves";
              return (
                <div className="rounded-xl p-3" style={{ background: isWolf ? "rgba(139,28,28,0.1)" : "rgba(201,160,48,0.04)", border: `1px solid ${isWolf ? "rgba(139,28,28,0.2)" : "rgba(201,160,48,0.08)"}` }}>
                  <p style={{ color: isWolf ? "rgba(248,113,113,0.5)" : "rgba(201,160,48,0.35)", fontSize: "9px", fontFamily: "var(--font-mono)", letterSpacing: "0.15em", marginBottom: 4 }}>🔮 résultat de ta vision</p>
                  <p style={{ color: isWolf ? "rgba(248,113,113,0.6)" : "rgba(201,160,48,0.55)", fontSize: "13px", fontFamily: "var(--font-body)", fontStyle: "italic" }}>
                    {r.targetName} est <strong>{r.roleData?.name ?? "inconnu"}</strong>{isWolf && " 🐺"}
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Actions nocturnes ou attente */}
          {pv.pendingActions && pv.pendingActions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p style={{ color: "rgba(150,145,160,0.25)", fontSize: "9px", fontFamily: "var(--font-mono)", textAlign: "center", letterSpacing: "0.2em" }}>ACTION REQUISE</p>
              {pv.pendingActions.map((action) => (
                <PlayerActionCard key={action.id} action={action} playerView={pv} discreet />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 mt-2">
              <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(120,115,135,0.18)" }} />
              <p style={{ color: "rgba(150,145,160,0.18)", fontSize: "11px", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textAlign: "center" }}>Garde les yeux fermés</p>
              <p style={{ color: "rgba(150,145,160,0.1)", fontSize: "9px", fontFamily: "var(--font-mono)", textAlign: "center" }}>Attends le signal du Maître du Jeu</p>
            </div>
          )}
        </div>

        {/* Bouton masquer bas de page */}
        <div className="px-5 pt-4">
          <button
            onClick={() => setScreenHidden(true)}
            style={{ width: "100%", padding: "12px", borderRadius: 12, background: "rgba(12,10,18,0.7)", border: "1px solid rgba(120,115,135,0.07)", color: "rgba(120,115,135,0.2)", fontSize: "9px", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
          >
            Masquer l'écran
          </button>
        </div>
      </div>
    );
  }

  const handleVote = async (targetId: string) => {
    if (phase !== "vote") return;
    setMyVote(targetId);
    await playerVote(targetId);
  };

  const maxVotes = currentVotes.length > 0 ? Math.max(...currentVotes.map((p) => p.votes)) : 0;

  const phaseImages: Record<string, string> = {
    night: "/lycan/night-phase.png",
    day: "/lycan/village-night.png",
    vote: "/lycan/vote-day.png",
    end: "/lycan/victory-village.png",
    waiting: "/lycan/lobby-night.png",
  };
  const bgImage = phaseImages[phase as string] ?? "/lycan/village-night.png";

  const roleImg = player.role ? (ROLE_IMAGES[player.role as string] ?? null) : null;

  return (
    <div className="relative min-h-full flex flex-col pb-8" style={{ background: "var(--bg-deep)" }}>

      {/* ── Background image (phase-specific) ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src={bgImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.32)" }} />
        <div className="absolute inset-0" style={{ background: PHASES[phase as string]?.tint ?? "rgba(11,10,15,0.1)" }} />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <BackButton onClick={() => navigate("home")} />
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>{gameName}</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: PHASES[phase as string]?.accentColor ?? "var(--gold)" }}>{phaseLabel}</p>
          </div>
          <button
            onClick={() => navigate("rules")}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ border: "1px solid var(--gold-dim)", color: "var(--gold)" }}
            title="Règles & rôles"
          >
            <span style={{ fontSize: "13px" }}>?</span>
          </button>
        </div>

        {/* Nom du joueur */}
        <div className="text-center mb-5 px-5">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-1" style={{ color: "var(--text-muted)" }}>Tu joues en tant que</p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>{player.name}</h2>
          {player.isCapitaine && <span className="text-[10px] font-mono" style={{ color: "var(--gold)" }}>⚔️ Capitaine</span>}
        </div>

        {/* Carte rôle / mort / attente */}
        {player.status !== "dead" && player.role && phase !== "end" && (
          <div className="mx-5 mb-2 flex justify-end">
            <button
              onClick={() => setCardHidden((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all active:scale-90"
              style={{ border: "1px solid rgba(201,160,48,0.12)", color: "rgba(200,192,176,0.35)", fontSize: "9px", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
            >
              <Eye size={10} />
              {cardHidden ? "afficher" : "masquer"}
            </button>
          </div>
        )}
        {player.status === "dead" ? (
          <div className="mx-5 py-8 px-6 rounded-2xl flex flex-col items-center gap-4" style={{ background: "rgba(11,10,15,0.72)", border: "1px solid rgba(255,0,0,0.22)" }}>
            <div className="text-6xl">💀</div>
            <p className="text-xl font-bold text-red-400" style={{ fontFamily: "var(--font-title)" }}>Tu es mort(e)</p>
            <p className="text-sm text-center" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>Reste silencieux·se. Ne révèle pas ton rôle.</p>
          </div>
        ) : player.role && cardHidden ? (
          <button
            className="mx-5 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition-all"
            onClick={() => setCardHidden(false)}
            style={{ border: "1px solid rgba(201,160,48,0.08)", background: "rgba(11,10,15,0.72)", padding: "36px 16px", width: "calc(100% - 40px)" }}
          >
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(201,160,48,0.04)", border: "1px solid rgba(201,160,48,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Eye size={14} style={{ color: "rgba(201,160,48,0.2)" }} />
            </div>
            <p style={{ color: "rgba(200,192,176,0.2)", fontSize: "10px", fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>CARTE MASQUÉE</p>
            <p style={{ color: "rgba(150,145,160,0.12)", fontSize: "8px", fontFamily: "var(--font-mono)" }}>Appuie pour voir ton rôle</p>
          </button>
        ) : player.role ? (
          <div className="mx-5 rounded-2xl overflow-hidden relative"
            style={{ border: "1px solid var(--gold-dim)", boxShadow: "0 0 40px rgba(139,28,28,0.2), 0 0 0 1px var(--gold-subtle)" }}>

            {/* Illustration (style carte de tarot) */}
            {roleImg ? (
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1 / 1", maxHeight: "260px" }}>
                <img
                  src={roleImg}
                  alt={player.roleData?.name ?? player.role ?? ""}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                />
                <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(0deg, rgba(14,8,36,1) 0%, transparent 100%)" }} />
                <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold-dim), transparent)" }} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-10"
                style={{ background: "linear-gradient(160deg, rgba(28,16,64,0.95), rgba(14,8,36,0.95))" }}>
                <span className="text-7xl">{player.roleData?.emoji ?? "❓"}</span>
              </div>
            )}

            {/* Infos de rôle */}
            <div className="px-5 pb-5 pt-3 flex flex-col gap-3"
              style={{ background: "linear-gradient(160deg, rgba(14,8,36,0.98) 0%, rgba(11,10,15,0.98) 100%)" }}>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>
                  {player.roleData?.name ?? player.role}
                </h3>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-secondary)", opacity: 0.85 }}>
                  "{player.roleData?.description}"
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold-dim))" }} />
                <div className="w-1 h-1 rounded-full" style={{ background: "var(--gold-dim)" }} />
                <div className="w-10 h-px" style={{ background: "linear-gradient(270deg, transparent, var(--gold-dim))" }} />
              </div>
              <div className="flex justify-center">
                <div className="px-3 py-1.5 rounded-lg" style={{ background: "var(--gold-subtle)", border: "1px solid var(--gold-dim)" }}>
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--gold)" }}>
                    Camp : {player.roleData?.category === "wolves" ? "🐺 Loups" : player.roleData?.category === "village" ? "🏡 Village" : "✨ Spécial"}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold-dim), transparent)" }} />
          </div>
        ) : (
          <div className="mx-5 py-8 px-6 rounded-2xl flex flex-col items-center gap-4" style={{ background: "rgba(11,10,15,0.72)", border: "1px solid var(--gold-subtle)" }}>
            <div className="text-6xl">⏳</div>
            <p className="text-xl font-bold" style={{ fontFamily: "var(--font-title)", color: "var(--gold)" }}>En attente</p>
            <p className="text-sm text-center" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>Le Maître du Jeu n'a pas encore lancé la partie.</p>
          </div>
        )}

        {/* Bannière de victoire */}
        {phase === "end" && winner && (
          <div className="mx-5 mt-4 p-5 rounded-2xl text-center" style={{
            background: winner === "wolves" ? "rgba(139,28,28,0.35)" : "rgba(16,185,129,0.15)",
            border: `1px solid ${winner === "wolves" ? "rgba(139,28,28,0.6)" : "rgba(16,185,129,0.4)"}`,
            boxShadow: winner === "wolves" ? "0 0 30px rgba(139,28,28,0.2)" : "0 0 30px rgba(16,185,129,0.1)",
          }}>
            <p className="text-3xl mb-2">{winner === "wolves" ? "🐺" : "🏡"}</p>
            <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: winner === "wolves" ? "#f87171" : "#34d399" }}>
              {winner === "wolves" ? "Les Loups ont gagné !" : "Le Village a gagné !"}
            </p>
            <p className="text-xs mt-2" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>
              Vous pouvez révéler vos rôles.
            </p>
          </div>
        )}

        {/* Consigne actuelle */}
        <div className="mx-5 mt-4 p-4 rounded-xl" style={{ background: "rgba(11,10,15,0.6)", border: "1px solid rgba(201,160,48,0.15)", backdropFilter: "blur(4px)" }}>
          <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--gold)" }}>Consigne du MJ</p>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>{instruction}</p>
        </div>

        {/* Zone de vote */}
        {phase === "vote" && player.status !== "dead" && currentVotes.length > 0 && (
          <div className="mx-5 mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {myVote ? "✓ Vote enregistré" : "Voter contre"}
              </p>
              {(() => {
                const aliveCount = currentVotes.filter(p => p.status !== "dead").length;
                const votedCount = Object.keys(state.game?.votesByPlayer ?? {}).length;
                return (
                  <p className="text-[9px] font-mono" style={{ color: votedCount === aliveCount ? "rgba(52,211,153,0.7)" : "var(--text-muted)" }}>
                    {votedCount}/{aliveCount} ont voté
                  </p>
                );
              })()}
            </div>
            {player.isCapitaine && (
              <p className="text-[9px] font-mono mb-2" style={{ color: "var(--gold)", opacity: 0.6 }}>
                ⚔️ Ton vote compte double
              </p>
            )}
            <div className="flex flex-col gap-2">
              {currentVotes.filter((p) => p.status !== "dead" && p.id !== player.id).map((target) => {
                const totalVotes = currentVotes.reduce((s, p) => s + p.votes, 0);
                const pct = totalVotes > 0 ? (target.votes / totalVotes) * 100 : 0;
                const isLeader = target.votes > 0 && target.votes === maxVotes;
                const voted = myVote === target.id;
                return (
                  <div key={target.id} className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${voted ? "rgba(139,28,28,0.55)" : "var(--gold-subtle)"}` }}>
                    <div className="flex items-center gap-3 p-3"
                      style={{ background: isLeader ? "rgba(139,28,28,0.25)" : "rgba(11,10,15,0.6)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1.5" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>{target.name}</p>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: isLeader ? "var(--red-wolf)" : "var(--gold)" }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-mono w-4 text-center" style={{ color: "var(--text-primary)" }}>{target.votes}</span>
                        <button onClick={() => handleVote(target.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 border"
                          style={{
                            fontFamily: "var(--font-title)",
                            fontSize: "11px",
                            background: voted ? "var(--red-wolf-dim)" : "transparent",
                            borderColor: voted ? "rgba(139,28,28,0.5)" : "var(--gold-dim)",
                            color: voted ? "#f87171" : "var(--gold)",
                          }}>
                          {voted ? "✓" : "Voter"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions privées */}
        {pv.pendingActions && pv.pendingActions.length > 0 && (
          <div className="mx-5 mt-4 flex flex-col gap-3">
            {pv.pendingActions.map((action) => (
              <PlayerActionCard key={action.id} action={action} playerView={pv} />
            ))}
          </div>
        )}

        {/* Résultat Voyante */}
        {pv.resolvedActions && pv.resolvedActions.length > 0 && (() => {
          const last = pv.resolvedActions[pv.resolvedActions.length - 1];
          if (last.type === "seer_choose_target" && last.result) {
            const r = last.result as { targetName: string; roleData: { name: string; emoji: string; category: string } | null };
            const isWolf = r.roleData?.category === "wolves";
            return (
              <div className="mx-5 mt-3 p-3 rounded-xl"
                style={{ background: isWolf ? "rgba(139,28,28,0.12)" : "var(--gold-subtle)", border: `1px solid ${isWolf ? "rgba(139,28,28,0.35)" : "var(--gold-dim)"}` }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: isWolf ? "#f87171" : "var(--gold)" }}>
                  🔮 Résultat de ta vision
                </p>
                <p className="text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
                  {r.targetName} est <strong style={{ color: isWolf ? "#f87171" : "var(--gold)" }}>{r.roleData?.name ?? "inconnu"}</strong>
                  {isWolf && " 🐺"}
                </p>
              </div>
            );
          }
          return null;
        })()}

        {phase !== "end" && pv.pendingActions?.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--gold)" }} />
            <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>En attente du Maître du Jeu...</p>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--gold)", animationDelay: "0.3s" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Écran : Vote (vue MJ) ─────────────────────────────────────────────────────

function VoteScreen() {
  const { navigate, state, gmEliminate, gmNextPhase } = useGame();
  const game = state.game;

  if (!game) return null;

  const players = game.players.filter((p) => p.status !== "dead");
  const totalVotes = players.reduce((s, p) => s + p.votes, 0);
  const maxVotes = Math.max(0, ...players.map((p) => p.votes));
  const leaders = players.filter((p) => p.votes === maxVotes && maxVotes > 0);

  const handleEliminate = async (playerId: string) => {
    const player = game.players.find((p) => p.id === playerId);
    if (!player || !confirm(`Éliminer ${player.name} par le vote ?`)) return;
    await gmEliminate(playerId, "vote");
    await gmNextPhase();
    navigate("dashboard");
  };

  return (
    <div className="relative min-h-full" style={{ background: "var(--bg-deep)" }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/vote-day.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.4) 0%, rgba(11,10,15,0) 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(0deg, var(--bg-deep) 0%, rgba(11,10,15,0.4) 60%, transparent 100%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.28)" }} />
      </div>

      <div className="relative z-10 px-5 py-6">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate("dashboard")} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>Vote du village</h2>
            <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""} exprimé{totalVotes !== 1 ? "s" : ""}</p>
          </div>
          <div className="px-3 py-1 rounded-full border" style={{ background: "var(--red-wolf-dim)", borderColor: "rgba(139,28,28,0.5)" }}>
            <p className="text-[10px] font-mono animate-pulse" style={{ color: "#f87171" }}>● EN COURS</p>
          </div>
        </div>

        {leaders.length > 0 && (
          <div className="mb-4 p-4 rounded-xl" style={{ background: "var(--red-wolf-dim)", border: "1px solid rgba(139,28,28,0.45)" }}>
            <p className="text-[10px] font-mono mb-2 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>⚠️ En tête</p>
            <div className="flex flex-col gap-2">
              {leaders.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold" style={{ fontFamily: "var(--font-title)", color: "#f87171" }}>{l.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{l.votes} voix</span>
                    <button onClick={() => handleEliminate(l.id)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all active:scale-95 border"
                      style={{ borderColor: "rgba(139,28,28,0.5)", color: "#f87171", background: "rgba(139,28,28,0.2)" }}>
                      Éliminer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-6">
          {players.map((p) => {
            const pct = totalVotes > 0 ? (p.votes / totalVotes) * 100 : 0;
            const isLeader = p.votes > 0 && p.votes === maxVotes;
            const roleInfo = p.role ? ROLES_MAP[p.role] : null;
            return (
              <div key={p.id} className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isLeader ? "rgba(139,28,28,0.55)" : "var(--gold-subtle)"}` }}>
                <div className="flex items-center gap-3 p-3"
                  style={{ background: isLeader ? "rgba(139,28,28,0.25)" : "rgba(11,10,15,0.6)" }}>
                  <RoleThumb name={p.name} status={p.status} isCapitaine={p.isCapitaine} role={p.role} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>{p.name}</p>
                      {roleInfo && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>{roleInfo.emoji}</span>}
                      {isLeader && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0"
                          style={{ background: "rgba(139,28,28,0.3)", color: "#f87171" }}>
                          En tête
                        </span>
                      )}
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: isLeader ? "var(--red-wolf)" : "var(--gold)" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono w-5 text-center" style={{ color: "var(--text-primary)" }}>{p.votes}</span>
                    {p.isCapitaine && <span className="text-[8px] font-mono" style={{ color: "var(--gold)" }}>×2</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <GoldOutlineButton onClick={() => navigate("dashboard")}>← Retour au tableau de bord</GoldOutlineButton>
      </div>
    </div>
  );
}

// ── Écran : Rejoindre ─────────────────────────────────────────────────────────

function JoinScreen() {
  const { navigate, state, playerJoin, setError } = useGame();
  const [gameId, setGameId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<{ gameId: string } | null>(null);
  const [tokenResetMsg, setTokenResetMsg] = useState<string | null>(null);
  const [codeFromQR, setCodeFromQR] = useState<string | null>(null);

  useEffect(() => {
    // Route path : /join/CODE (legacy)
    const match = window.location.pathname.match(/\/join\/([A-Z0-9]+)/i);
    if (match) {
      setGameId(match[1].toUpperCase());
      setCodeFromQR(match[1].toUpperCase());
    } else {
      // Query params : ?join=CODE ou ?code=CODE (QR code) ou ?join sans valeur (QR permanent)
      const params = new URLSearchParams(window.location.search);
      const joinVal = params.get("join"); // "" si ?join sans valeur, valeur sinon, null si absent
      const codeVal = params.get("code");
      const rawCode = (joinVal && joinVal !== "true") ? joinVal : (codeVal ?? null);
      if (rawCode) {
        setGameId(rawCode.toUpperCase());
        setCodeFromQR(rawCode.toUpperCase());
      }
    }
    // Vérifier si une session existante est sauvegardée
    try {
      const raw = localStorage.getItem("lycan_session");
      if (raw) {
        const s = JSON.parse(raw) as { gameId: string; playerToken: string };
        if (s.gameId) setSavedSession(s);
      }
    } catch { /* ignore */ }
  }, []);

  const handleJoin = async () => {
    if (!gameId.trim() || !playerName.trim()) return;
    setLoading(true);
    try {
      await playerJoin(gameId.trim().toUpperCase(), playerName.trim());
      navigate("player");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-full flex flex-col" style={{ background: "var(--bg-deep)" }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/village-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.38)" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-full px-5 py-6">
        <div className="flex items-center gap-3 mb-8">
          <BackButton onClick={() => navigate("home")} />
          <span className="text-[9px] uppercase tracking-[0.3em] px-3 py-1 rounded-full"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "rgba(11,10,15,0.5)", border: "1px solid var(--gold-subtle)" }}>
            Rejoindre une partie
          </span>
        </div>

        {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

        {savedSession && (
          <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--gold-subtle)", border: "1px solid var(--gold-dim)" }}>
            <span className="text-lg">📱</span>
            <div className="flex-1">
              <p className="text-xs font-mono" style={{ color: "var(--gold)" }}>Session {savedSession.gameId} trouvée</p>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Reconnexion automatique en cours…</p>
            </div>
            <button
              onClick={() => { localStorage.removeItem("lycan_session"); setSavedSession(null); }}
              className="text-[10px] font-mono underline"
              style={{ color: "var(--text-muted)" }}
            >
              Effacer
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center gap-5">
          <div className="flex flex-col items-center mb-2 gap-3">
            <LycanLogo size={72} />
            {codeFromQR ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(201,160,48,0.5)" }}>
                  Tu rejoins la partie
                </p>
                <p className="text-2xl tracking-[0.2em] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>
                  {codeFromQR}
                </p>
              </div>
            ) : (
              <p className="text-sm font-mono text-center" style={{ color: "var(--text-muted)" }}>
                Entre le code donné par le Maître du Jeu
              </p>
            )}
          </div>

          <DarkCard>
            <div className="mb-4">
              <SectionLabel>Code de la partie</SectionLabel>
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
                className="w-full rounded-xl px-4 py-3 text-xl text-center tracking-[0.3em] font-mono uppercase focus:outline-none transition-colors"
                style={{ background: "var(--bg-deep)", border: "1px solid var(--gold-dim)", color: "var(--gold)" }}
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            <div>
              <SectionLabel>Ton prénom</SectionLabel>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                style={{ background: "var(--bg-deep)", border: "1px solid var(--gold-subtle)", color: "var(--text-primary)", fontFamily: "var(--font-body)" }}
                placeholder="Ton prénom..."
              />
            </div>
          </DarkCard>

          <PrimaryButton onClick={handleJoin} disabled={!gameId.trim() || !playerName.trim() || loading}>
            {loading ? "Connexion..." : "🔗 Rejoindre la partie"}
          </PrimaryButton>

          {import.meta.env.DEV && (
            <div className="flex flex-col items-center gap-1 mt-2">
              <button
                onClick={() => {
                  localStorage.removeItem("lycan_session");
                  setSavedSession(null);
                  setTokenResetMsg("Token local réinitialisé pour le test.");
                  setTimeout(() => setTokenResetMsg(null), 3000);
                }}
                className="text-[10px] font-mono underline underline-offset-2"
                style={{ color: "var(--text-muted)" }}
              >
                🧪 Réinitialiser mon token joueur local
              </button>
              {tokenResetMsg && <p className="text-[9px] font-mono" style={{ color: "#34d399" }}>{tokenResetMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Écran : Historique ────────────────────────────────────────────────────────

function HistoryScreen() {
  const { navigate, state } = useGame();
  const [filter, setFilter] = useState<"all" | "night" | "day" | "vote" | "power">("all");

  const history = state.game?.history ?? [];

  const filters = [
    { id: "all" as const, label: "Tout" },
    { id: "night" as const, label: "Nuit" },
    { id: "day" as const, label: "Jour" },
    { id: "vote" as const, label: "Votes" },
    { id: "power" as const, label: "Pouvoirs" },
  ];

  const filtered = filter === "all" ? history : history.filter((e) => e.type === filter);

  const eventStyle: Record<string, { icon: string; cls: string }> = {
    night: { icon: "🌙", cls: "text-indigo-300 border-indigo-400/30 bg-indigo-400/10" },
    day: { icon: "☀️", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
    vote: { icon: "🗳️", cls: "text-red-400 border-red-400/30 bg-red-400/10" },
    power: { icon: "✨", cls: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  };

  return (
    <div className="relative min-h-full" style={{ background: "var(--bg-deep)" }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/village-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.4) 0%, rgba(11,10,15,0) 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(0deg, var(--bg-deep) 0%, rgba(11,10,15,0.4) 60%, transparent 100%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.28)" }} />
      </div>

      <div className="relative z-10 px-5 py-6">
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => navigate("dashboard")} />
          <span className="text-[9px] uppercase tracking-[0.3em] px-3 py-1 rounded-full"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "rgba(11,10,15,0.5)", border: "1px solid var(--gold-subtle)" }}>
            Journal de partie
          </span>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono transition-all border"
              style={{
                background: filter === f.id ? "rgba(201,160,48,0.12)" : "rgba(11,10,15,0.45)",
                borderColor: filter === f.id ? "rgba(201,160,48,0.45)" : "var(--gold-subtle)",
                color: filter === f.id ? "var(--gold)" : "var(--text-muted)",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm py-8 font-mono" style={{ color: "var(--text-muted)" }}>Aucun événement encore</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-px" style={{ background: "var(--gold-subtle)" }} />
            <div className="flex flex-col gap-4">
              {filtered.map((event) => {
                const cfg = eventStyle[event.type] ?? eventStyle.day;
                return (
                  <div key={event.id} className="flex gap-3.5 items-start">
                    <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 text-sm ${cfg.cls}`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0 pt-1 pb-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "var(--gold)" }}>{event.phase}</span>
                        <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)", opacity: 0.6 }}>{event.time}</span>
                      </div>
                      <p className="text-sm leading-snug" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>{event.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6">
          <GoldOutlineButton onClick={() => navigate("dashboard")}>← Retour au tableau de bord</GoldOutlineButton>
        </div>
      </div>
    </div>
  );
}

// ── Navigation entre écrans ────────────────────────────────────────────────────

const SCREEN_LABELS: Record<AppView, string> = {
  home: "Accueil",
  create: "Créer",
  players: "Joueurs",
  roles: "Rôles",
  dashboard: "Tableau MJ",
  player: "Ma Vue",
  vote: "Votes",
  history: "Historique",
  join: "Rejoindre",
  rules: "Règles & rôles",
};

function AppInner() {
  const { state, navigate } = useGame();
  const { view } = state;

  // Auto-navigate to JoinScreen si ?join ou ?code présent dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ((params.has("join") || params.has("code")) && view === "home") {
      navigate("join");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderScreen = () => {
    switch (view) {
      case "home": return <HomeScreen />;
      case "create": return <CreateScreen />;
      case "players": return <PlayersScreen />;
      case "roles": return <RolesScreen />;
      case "dashboard": return <DashboardScreen />;
      case "player": return <PlayerViewScreen />;
      case "vote": return <VoteScreen />;
      case "history": return <HistoryScreen />;
      case "join": return <JoinScreen />;
      case "rules": return <RulesScreen />;
    }
  };

  const gmScreens: AppView[] = ["home", "create", "players", "roles", "dashboard", "vote", "history"];
  const playerScreens: AppView[] = ["home", "join", "player"];
  const visibleDots = state.isGM ? gmScreens : playerScreens;

  // Production (build web ou APK Android) : plein écran, aucun élément de debug
  if (import.meta.env.PROD) {
    return (
      <div
        className="h-full overflow-y-auto"
        style={{ background: "var(--bg-deep)" }}
      >
        {renderScreen()}
      </div>
    );
  }

  // Dev uniquement : cadre téléphone simulé + navigation rapide + label
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: "radial-gradient(ellipse at 50% 35%, #1c1228 0%, #05040a 70%)" }}>
      {/* Points de navigation latéraux (dev uniquement) */}
      <div className="fixed left-5 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-50">
        {visibleDots.map((s) => (
            <button key={s} onClick={() => navigate(s)} title={SCREEN_LABELS[s]} className="group relative flex items-center">
              <div className={`w-2 h-2 rounded-full transition-all duration-200 ${view === s ? "bg-[#c9a030] scale-150" : "bg-[#c9a030]/25 hover:bg-[#c9a030]/55"}`} />
              <span className="absolute left-5 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-[#c9a030] whitespace-nowrap bg-[#16141f] border border-[#c9a030]/20 rounded px-2 py-0.5">
                {SCREEN_LABELS[s]}
              </span>
            </button>
          ))}
      </div>

      {/* Cadre téléphone simulé (dev uniquement) */}
      <div className="relative rounded-[44px] overflow-hidden flex-shrink-0"
        style={{ width: "390px", height: "844px", background: "#0b0a0f", border: "1px solid rgba(201,160,48,0.22)", boxShadow: "0 0 0 8px #0e0d14, 0 0 0 9px rgba(201,160,48,0.1), 0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(139,28,28,0.12)" }}>
        {/* Barre de statut simulée */}
        <div className="flex items-center justify-between px-7 pt-3.5 pb-1.5" style={{ background: "rgba(0,0,0,0.5)" }}>
          <span className="text-[11px] text-[#e8ddd0]/55 font-mono">22:47</span>
          <div className="w-28 h-5 bg-black rounded-full" />
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#e8ddd0]/45 font-mono">●●●</span>
            <span className="text-[9px] text-[#e8ddd0]/45 font-mono ml-1">🔋</span>
          </div>
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto" style={{ height: "calc(844px - 44px)", scrollbarWidth: "none" }}>
          {renderScreen()}
        </div>
      </div>

      {/* Label écran actuel (dev uniquement) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2">
        <div className="px-4 py-1.5 rounded-full border" style={{ background: "rgba(11,10,15,0.85)", borderColor: "rgba(201,160,48,0.2)" }}>
          <span className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest">{SCREEN_LABELS[view]}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
