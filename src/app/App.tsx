import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Plus, QrCode, Crown, History, Trash2, Wifi, WifiOff, Eye } from "lucide-react";
import { GameProvider, useGame, type GamePhase, type PlayerStatus, type GameMode, type RoleConfig, type AppView, type GameState } from "./context/GameContext";
import { NightWizard } from "./components/game/NightWizard";
import { RulesScreen } from "./components/game/RulesScreen";
import { HunterModal } from "./components/game/HunterModal";
import { PhaseTimer } from "./components/game/PhaseTimer";
import { PlayerActionCard } from "./components/game/PlayerActionCard";
import { ROLES, ROLES_MAP } from "../lib/roles";
import { buildPlayerView } from "../lib/gameLogic";

const PHASES: Record<string, { label: string; icon: string; gradient: string; actions: string[] }> = {
  waiting: {
    label: "En attente",
    icon: "⏳",
    gradient: "linear-gradient(160deg, #0d0a2a 0%, #1a1035 100%)",
    actions: ["Ajoutez les joueurs", "Sélectionnez les rôles", "Lancez la partie quand tout est prêt"],
  },
  night: {
    label: "Nuit",
    icon: "🌙",
    gradient: "linear-gradient(160deg, #0d0a2a 0%, #1a1035 100%)",
    actions: [
      "Réveillez la Voyante — elle désigne un joueur",
      "Réveillez les Loups — ils choisissent une victime",
      "Réveillez la Sorcière — utilise-t-elle une potion ?",
    ],
  },
  day: {
    label: "Jour",
    icon: "☀️",
    gradient: "linear-gradient(160deg, #1a0d05 0%, #2a1505 100%)",
    actions: [
      "Annoncez les événements de la nuit",
      "Les joueurs débattent librement",
      "Proposez un vote si le village est prêt",
    ],
  },
  vote: {
    label: "Vote",
    icon: "🗳️",
    gradient: "linear-gradient(160deg, #1a0810 0%, #2a0f1a 100%)",
    actions: [
      "Chaque joueur vote pour un suspect",
      "Le Capitaine peut modifier son vote en dernier",
      "Clôturez le vote pour révéler l'éliminé",
    ],
  },
  end: {
    label: "Fin de partie",
    icon: "🏆",
    gradient: "linear-gradient(160deg, #0a1a0a 0%, #0f2a0f 100%)",
    actions: ["Révélez tous les rôles", "Annoncez l'équipe victorieuse", "Consultez l'historique"],
  },
};

// ── Composants partagés ────────────────────────────────────────────────────────

function LycanLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" stroke="#c9a030" strokeWidth="0.8" opacity="0.35" />
      <circle cx="50" cy="50" r="38" stroke="#c9a030" strokeWidth="0.4" opacity="0.2" />
      <path d="M60 16 C42 16, 27 31, 27 50 C27 69, 42 84, 60 84 C50 78, 44 65, 44 50 C44 35, 50 22, 60 16 Z" fill="#c9a030" />
      <path d="M52 30 L57 17 L64 30 Z" fill="#c9a030" />
      <path d="M54 29 L57 19 L62 29 Z" fill="#0b0a0f" opacity="0.55" />
      <circle cx="73" cy="27" r="1.6" fill="#c9a030" opacity="0.85" />
      <circle cx="79" cy="43" r="0.9" fill="#c9a030" opacity="0.6" />
      <circle cx="71" cy="60" r="1.4" fill="#c9a030" opacity="0.75" />
      <circle cx="82" cy="36" r="0.7" fill="#c9a030" opacity="0.45" />
      <circle cx="76" cy="54" r="0.6" fill="#c9a030" opacity="0.4" />
      <circle cx="44" cy="50" r="2.8" fill="#8b1c1c" />
      <circle cx="44" cy="50" r="1.3" fill="#ff3333" />
    </svg>
  );
}

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
      className="w-full py-4 rounded-xl font-semibold uppercase text-sm tracking-widest transition-all active:scale-95 disabled:opacity-40"
      style={{ fontFamily: "var(--font-title)", background: "linear-gradient(135deg, var(--red-wolf) 0%, #6b1414 100%)", color: "var(--text-primary)", boxShadow: disabled ? "none" : "0 0 24px var(--red-wolf-glow), inset 0 1px 0 rgba(255,255,255,0.07)", letterSpacing: "0.1em" }}
    >
      {children}
    </button>
  );
}

function GoldOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl text-sm transition-all active:scale-95 border"
      style={{ fontFamily: "var(--font-title)", borderColor: "var(--gold-dim)", color: "var(--gold)", background: "transparent", letterSpacing: "0.06em" }}
    >
      {children}
    </button>
  );
}

function DarkCard({ children, red }: { children: React.ReactNode; red?: boolean }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: `1px solid ${red ? "var(--red-wolf-dim)" : "var(--gold-glow)"}`, boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 var(--gold-subtle)" }}>
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
  const stars = useMemo(
    () => Array.from({ length: 32 }, (_, i) => ({ id: i, w: ((i * 7 + 3) % 3) * 0.5 + 0.7, top: ((i * 17 + 11) % 88) + 4, left: ((i * 23 + 7) % 96) + 2, opacity: ((i * 13 + 5) % 5) * 0.07 + 0.06 })),
    []
  );

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-between" style={{ minHeight: "100%", background: "radial-gradient(ellipse at 50% 20%, #1a0f2e 0%, var(--bg-deep) 60%)" }}>
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((s) => <div key={s.id} className="absolute rounded-full" style={{ width: s.w, height: s.w, top: `${s.top}%`, left: `${s.left}%`, opacity: s.opacity, background: "var(--gold)" }} />)}
      </div>

      {/* Indicateur de connexion */}
      <div className="absolute top-4 right-5 flex items-center gap-1.5 z-10">
        {state.connected
          ? <><Wifi size={11} className="text-emerald-400" /><span className="text-[9px] text-emerald-400 font-mono">Connecté</span></>
          : <><WifiOff size={11} style={{ color: "var(--text-muted)" }} /><span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Hors ligne</span></>
        }
      </div>

      <div className="flex flex-col items-center mt-14 gap-5 z-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "var(--gold-glow)", transform: "scale(2.2)" }} />
          <LycanLogo size={108} />
        </div>
        <div className="text-center">
          <h1 className="text-[32px] font-bold uppercase leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--gold)", letterSpacing: "0.18em", textShadow: "0 0 28px rgba(201,160,48,0.3)" }}>Lycan</h1>
          <h1 className="text-[32px] font-bold uppercase leading-tight -mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--gold)", letterSpacing: "0.18em", textShadow: "0 0 28px rgba(201,160,48,0.3)" }}>Master</h1>
          <p className="text-[10px] mt-2 tracking-[0.25em] uppercase font-mono" style={{ color: "var(--text-muted)" }}>Assistant du Maître du Jeu</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-accent/40" />
          <span className="text-[11px]" style={{ color: "var(--gold)", opacity: 0.55 }}>🐺</span>
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-accent/40" />
        </div>
        <p className="text-sm text-center leading-relaxed max-w-[240px]" style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-secondary)", opacity: 0.75 }}>
          "Animez vos soirées Loup-Garou."
        </p>
      </div>

      <div className="w-full flex flex-col gap-3 px-6 mb-10 z-10">
        <PrimaryButton onClick={() => navigate("create")}>⚔ Créer une partie</PrimaryButton>
        <GoldOutlineButton onClick={() => navigate("join")}>🔗 Rejoindre une partie</GoldOutlineButton>
        <button onClick={() => navigate("rules")} className="w-full py-3 text-sm transition-all active:scale-95" style={{ fontFamily: "var(--font-title)", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          📖 Règles et rôles
        </button>
      </div>
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
    <div className="min-h-full px-5 py-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-8">
        <BackButton onClick={() => navigate("home")} />
        <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Créer une partie</h2>
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      <DarkCard>
        <div className="mb-5">
          <SectionLabel>Nom de la partie</SectionLabel>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            className="w-full bg-[#0b0a0f] border border-[#c9a030]/20 rounded-xl px-4 py-3 text-[#e8ddd0] text-sm focus:outline-none focus:border-[#c9a030]/45 transition-colors"
            style={{ fontFamily: "Crimson Pro, Georgia, serif" }}
            placeholder="Nom de la partie..."
          />
        </div>

        <div className="mb-5">
          <SectionLabel>Nombre de joueurs</SectionLabel>
          <div className="flex items-center gap-4">
            <button onClick={() => setDraft({ playerCount: Math.max(4, draft.playerCount - 1) })} className="w-10 h-10 rounded-full border border-[#c9a030]/30 text-[#c9a030] flex items-center justify-center text-xl font-light transition-all active:scale-90">−</button>
            <span className="flex-1 text-center text-[42px] font-bold text-[#c9a030] leading-none" style={{ fontFamily: "Cinzel, serif" }}>{draft.playerCount}</span>
            <button onClick={() => setDraft({ playerCount: Math.min(24, draft.playerCount + 1) })} className="w-10 h-10 rounded-full border border-[#c9a030]/30 text-[#c9a030] flex items-center justify-center text-xl font-light transition-all active:scale-90">+</button>
          </div>
          <p className="text-center text-[10px] text-[#9490a0] mt-1 font-mono uppercase tracking-widest">joueurs</p>
        </div>

        <div>
          <SectionLabel>Mode de jeu</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setDraft({ mode: m.id })} className="py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 border"
                style={{ fontFamily: "Cinzel, serif", background: draft.mode === m.id ? "rgba(139,28,28,0.28)" : "transparent", borderColor: draft.mode === m.id ? "rgba(139,28,28,0.75)" : "rgba(201,160,48,0.2)", color: draft.mode === m.id ? "#f0e8d0" : "#9490a0", letterSpacing: "0.04em" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </DarkCard>

      <div className="rounded-xl p-4 my-4" style={{ background: "rgba(139,28,28,0.08)", border: "1px solid rgba(139,28,28,0.2)" }}>
        <p className="text-xs text-[#c8c0b0]/80 leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
          {MODES.find((m) => m.id === draft.mode)?.desc}
        </p>
      </div>

      <PrimaryButton onClick={handleContinue} disabled={loading || !draft.name.trim()}>
        {loading ? "Création..." : "Continuer →"}
      </PrimaryButton>
    </div>
  );
}

// ── Écran : Joueurs ────────────────────────────────────────────────────────────

function PlayersScreen() {
  const { navigate, state, gmAddPlayer, gmRemovePlayer, gmAddTestPlayers, setError } = useGame();
  const [newName, setNewName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [addingTest, setAddingTest] = useState(false);

  const players = state.game?.players ?? [];
  const gameId = state.game?.id;

  const addPlayer = async () => {
    if (!newName.trim()) return;
    try {
      await gmAddPlayer(newName.trim());
      setNewName("");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const copyLink = async () => {
    if (!gameId) return;
    const url = `${window.location.origin}/join/${gameId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  };

  return (
    <div className="min-h-full px-5 py-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate("create")} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Joueurs</h2>
          <p className="text-[10px] text-[#9490a0] font-mono">
            {players.length} joueur{players.length !== 1 ? "s" : ""} — {players.filter((p) => p.isConnected).length} connecté{players.filter((p) => p.isConnected).length !== 1 ? "s" : ""}
          </p>
        </div>
        {gameId && (
          <div className="px-2 py-1 rounded-lg font-mono text-[10px] text-[#c9a030] border border-[#c9a030]/30 bg-[#c9a030]/5 flex-shrink-0">
            {gameId}
          </div>
        )}
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      {/* Lien d'invitation */}
      <button onClick={copyLink} className="w-full mb-3 py-3 rounded-xl flex items-center justify-center gap-2 border border-dashed transition-all active:scale-95" style={{ borderColor: "rgba(201,160,48,0.3)", color: linkCopied ? "#4ade80" : "#c9a030" }}>
        <QrCode size={16} />
        <span className="text-xs font-mono tracking-wide">{linkCopied ? "✓ Lien copié !" : "Copier le lien d'invitation"}</span>
      </button>

      {/* DEV : créer joueurs de test */}
      {import.meta.env.DEV && (
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
          style={{ borderColor: "rgba(201,160,48,0.18)", color: "#9490a0" }}
        >
          {addingTest ? "⏳ Ajout en cours…" : "🧪 Créer joueurs de test (Alice–Frank)"}
        </button>
      )}

      {/* Liste des joueurs */}
      <div className="flex flex-col gap-2 mb-4">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#16141f", border: "1px solid rgba(201,160,48,0.1)" }}>
            <div className="w-9 h-9 rounded-full bg-[#1e1b2a] border border-[#c9a030]/30 flex items-center justify-center text-[#c9a030] text-xs font-semibold flex-shrink-0" style={{ fontFamily: "Cinzel, serif" }}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#e8ddd0] font-medium truncate" style={{ fontFamily: "Cinzel, serif" }}>{p.name}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-1.5 h-1.5 rounded-full ${p.isConnected ? "bg-emerald-400" : "bg-[#9490a0]"}`} />
              <span className={`text-[10px] font-mono ${p.isConnected ? "text-emerald-400" : "text-[#9490a0]"}`}>
                {p.isConnected ? "Connecté" : "Hors ligne"}
              </span>
              <button onClick={() => gmRemovePlayer(p.id)} className="w-6 h-6 rounded flex items-center justify-center text-[#9490a0] hover:text-red-400 transition-colors ml-1">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-center text-[#9490a0] text-sm py-6 font-mono">Aucun joueur encore — ajoutez-en ci-dessous</p>
        )}
      </div>

      {/* Ajouter un joueur */}
      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          className="flex-1 bg-[#16141f] border border-[#c9a030]/20 rounded-xl px-4 py-3 text-[#e8ddd0] text-sm focus:outline-none focus:border-[#c9a030]/45 transition-colors"
          style={{ fontFamily: "Crimson Pro, Georgia, serif" }}
          placeholder="Nom du joueur..."
        />
        <button onClick={addPlayer} className="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90" style={{ background: "linear-gradient(135deg, #8b1c1c, #6b1414)" }}>
          <Plus size={18} className="text-[#f0e8d0]" />
        </button>
      </div>

      <PrimaryButton onClick={() => navigate("roles")}>Passer aux rôles →</PrimaryButton>
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
    <div className="min-h-full px-5 py-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-4">
        <BackButton onClick={() => navigate("players")} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Rôles</h2>
        </div>
        <div className={`px-3 py-1 rounded-full font-mono text-xs border flex-shrink-0 transition-colors ${isComplete ? "border-emerald-400/50 text-emerald-400 bg-emerald-400/10" : "border-[#c9a030]/40 text-[#c9a030]"}`}>
          {totalSelected}/{playerCount}
        </div>
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2 mb-4">
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border"
            style={{ fontFamily: "Cinzel, serif", background: activeCategory === cat.id ? "rgba(139,28,28,0.28)" : "transparent", borderColor: activeCategory === cat.id ? "rgba(139,28,28,0.75)" : "rgba(201,160,48,0.2)", color: activeCategory === cat.id ? "#f0e8d0" : "#9490a0", letterSpacing: "0.03em", fontSize: "11px" }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {filtered.map((role) => (
          <div key={role.id} className="p-3.5 rounded-xl flex items-center gap-3 transition-all"
            style={{
              background: !role.playable ? "rgba(255,255,255,0.02)" : role.count > 0 ? "rgba(139,28,28,0.1)" : "#16141f",
              border: `1px solid ${!role.playable ? "rgba(255,255,255,0.06)" : role.count > 0 ? "rgba(139,28,28,0.38)" : "rgba(201,160,48,0.12)"}`,
              opacity: !role.playable ? 0.5 : 1,
            }}>
            <div className="text-2xl flex-shrink-0 w-8 text-center">{role.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#e8ddd0] truncate" style={{ fontFamily: "Cinzel, serif" }}>{role.name}</p>
                {!role.playable && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#9490a0" }}>Bientôt</span>
                )}
              </div>
              <p className="text-xs text-[#9490a0] leading-snug mt-0.5" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{role.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => updateCount(role.id, -1)} disabled={!role.playable}
                className="w-7 h-7 rounded-full border border-[#c9a030]/30 text-[#c9a030] flex items-center justify-center text-base leading-none transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed">−</button>
              <span className="w-5 text-center text-[#e8ddd0] font-mono text-sm">{!role.playable ? "–" : role.count}</span>
              <button onClick={() => updateCount(role.id, 1)} disabled={!role.playable}
                className="w-7 h-7 rounded-full border border-[#c9a030]/30 text-[#c9a030] flex items-center justify-center text-base leading-none transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
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
  const [showNightWizard, setShowNightWizard] = useState(false);
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
    const counts: Record<string, number> = {};
    for (const [voterId, targetId] of Object.entries(game.votesByPlayer ?? {})) {
      if (!aliveIds.has(voterId)) continue;
      counts[targetId] = (counts[targetId] ?? 0) + 1;
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

  return (
    <div className="min-h-full pb-6 relative" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      {/* Modal Chasseur — bloque l'interface jusqu'au tir */}
      {game.pendingHunterActions?.length > 0 && <HunterModal game={game} />}

      {/* DEV : Vue joueur simulée */}
      {import.meta.env.DEV && simPlayerId && (
        <SimulatedPlayerModal game={game} playerId={simPlayerId} onClose={() => setSimPlayerId(null)} />
      )}

      {/* Bannière de victoire */}
      {phase === "end" && game.winner && (
        <div className="px-5 pt-5 pb-0">
          <div className="p-4 rounded-2xl text-center" style={{
            background: game.winner === "wolves" ? "rgba(139,28,28,0.25)" : "rgba(16,185,129,0.12)",
            border: `1px solid ${game.winner === "wolves" ? "rgba(139,28,28,0.6)" : "rgba(16,185,129,0.4)"}`,
          }}>
            <p className="text-2xl mb-1">{game.winner === "wolves" ? "🐺" : "🏡"}</p>
            <p className="text-lg font-bold" style={{ fontFamily: "Cinzel, serif", color: game.winner === "wolves" ? "#f87171" : "#34d399" }}>
              {game.winner === "wolves" ? "Les Loups-Garous ont gagné !" : "Le Village a gagné !"}
            </p>
          </div>
        </div>
      )}

      {/* En-tête de phase */}
      <div className="px-5 pt-6 pb-5" style={{ background: phaseInfo.gradient }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-0.5">Phase actuelle</p>
            <h2 className="text-2xl font-bold text-[#e8ddd0] flex items-center gap-2" style={{ fontFamily: "Cinzel, serif" }}>
              {phaseInfo.icon} {phaseInfo.label}
              {phase !== "end" && phase !== "waiting" && <span className="text-lg text-[#c9a030]">#{game.phaseNumber}</span>}
            </h2>
            <p className="text-[10px] text-[#c9a030] font-mono mt-0.5">Code : {game.id}</p>
          </div>
          <button onClick={() => navigate("history")} className="flex items-center gap-1.5 border border-[#9490a0]/25 rounded-lg px-2.5 py-1.5 text-[#9490a0] transition-all active:scale-90">
            <History size={11} />
            <span className="text-[10px] font-mono">Journal</span>
          </button>
        </div>

        {/* Actions nocturnes : wizard dédié */}
        {phase === "night" ? (
          <button
            onClick={() => setShowNightWizard(!showNightWizard)}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border"
            style={{
              fontFamily: "Cinzel, serif",
              background: showNightWizard ? "rgba(139,28,28,0.25)" : "rgba(13,10,42,0.5)",
              borderColor: showNightWizard ? "rgba(139,28,28,0.6)" : "rgba(201,160,48,0.25)",
              color: showNightWizard ? "#f0e8d0" : "#c9a030",
              letterSpacing: "0.06em",
            }}
          >
            {showNightWizard ? "▲ Fermer le guide nocturne" : "🌙 Ouvrir le guide nocturne"}
          </button>
        ) : (
          <div className="rounded-xl p-3.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,160,48,0.14)" }}>
            <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest mb-2.5">Actions maintenant</p>
            <div className="flex flex-col gap-2">
              {phaseInfo.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full border border-[#c9a030]/35 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[8px] text-[#c9a030] font-mono">{i + 1}</span>
                  </div>
                  <p className="text-xs text-[#c8c0b0]/80 leading-snug" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{action}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      {/* Night Wizard (affiché sous l'en-tête si phase nuit) */}
      {phase === "night" && showNightWizard && (
        <div className="px-5 pt-4">
          <NightWizard onResolve={() => { setShowNightWizard(false); }} />
        </div>
      )}

      {/* Timer de phase (affiché pendant le jour et le vote) */}
      {(phase === "day" || phase === "vote") && <PhaseTimer game={game} />}

      {/* Liste des joueurs */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest">Joueurs ({alivePlayers.length} vivants)</p>
          <span className="text-[9px] text-[#9490a0] font-mono">MJ seulement</span>
        </div>

        <div className="flex flex-col gap-2">
          {game.players.map((p) => {
            const roleInfo = p.role ? ROLES_MAP[p.role] : null;
            const isLover = game.cupidLovers?.includes(p.id);
            return (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${p.status === "dead" ? "opacity-45" : ""}`}
                style={{ background: "#16141f", border: `1px solid ${p.status === "dead" ? "rgba(255,0,0,0.08)" : isLover ? "rgba(236,72,153,0.25)" : "rgba(201,160,48,0.1)"}` }}>
                <Avatar name={p.name} status={p.status} isCapitaine={p.isCapitaine} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#e8ddd0] truncate" style={{ fontFamily: "Cinzel, serif" }}>{p.name}</p>
                    {isLover && <span className="text-xs flex-shrink-0">💘</span>}
                  </div>
                  <p className="text-xs text-[#9490a0] italic truncate" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                    {roleInfo ? `${roleInfo.emoji} ${roleInfo.name}` : "Rôle non attribué"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${p.isConnected ? "bg-emerald-400" : "bg-[#9490a0]"}`} />
                  <StatusBadge status={p.status} />
                  {p.status === "alive" && (
                    <div className="flex gap-1 ml-1">
                      <button onClick={() => handleSetCaptain(p.id)} title="Désigner Capitaine" className="w-6 h-6 rounded flex items-center justify-center text-[#c9a030]/60 hover:text-[#c9a030] transition-colors">
                        <Crown size={11} />
                      </button>
                      <button onClick={() => handleEliminate(p.id)} title="Éliminer" className="w-6 h-6 rounded flex items-center justify-center text-[#9490a0] hover:text-red-400 transition-colors">
                        💀
                      </button>
                    </div>
                  )}
                  {import.meta.env.DEV && (
                    <button onClick={() => setSimPlayerId(p.id)} title="Vue joueur simulée (DEV)" className="w-6 h-6 rounded flex items-center justify-center text-[#9490a0]/40 hover:text-[#c9a030] transition-colors ml-0.5">
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
            <GoldOutlineButton onClick={() => navigate("vote")}>📊 Voir les votes</GoldOutlineButton>
            {confirmNoVote ? (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-[#9490a0] font-mono text-center">Aucun vote enregistré. Passer sans élimination ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmNoVote(false)} className="flex-1 py-2.5 rounded-xl text-xs border transition-all" style={{ borderColor: "rgba(201,160,48,0.2)", color: "#9490a0", fontFamily: "Cinzel, serif" }}>
                    Annuler
                  </button>
                  <button onClick={() => handleResolveVote(null)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: "rgba(139,28,28,0.3)", color: "#f0e8d0", fontFamily: "Cinzel, serif" }}>
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
          <p className="text-center text-[10px] text-[#9490a0] font-mono py-2">
            En attente du lancement de la partie…
          </p>
        )}
        {phase !== "end" && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => gmEndGame("village")} className="flex-1 py-2.5 rounded-xl text-[11px] border transition-all active:scale-95" style={{ borderColor: "rgba(201,160,48,0.2)", color: "#c9a030", fontFamily: "Cinzel, serif" }}>
              🏡 Village gagne
            </button>
            <button onClick={() => gmEndGame("wolves")} className="flex-1 py-2.5 rounded-xl text-[11px] border transition-all active:scale-95" style={{ borderColor: "rgba(139,28,28,0.35)", color: "#f0e8d0", fontFamily: "Cinzel, serif", background: "rgba(139,28,28,0.15)" }}>
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
    </div>
  );
}

// ── Écran : Vue Joueur ────────────────────────────────────────────────────────

function PlayerViewScreen() {
  const { navigate, state, playerVote } = useGame();
  const pv = state.playerView;
  const [myVote, setMyVote] = useState<string | null>(null);

  if (!pv) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 px-5" style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0818 0%, #0b0a0f 70%)" }}>
        <LycanLogo size={64} />
        <p className="text-[#9490a0] text-sm font-mono text-center">En attente des données du Maître du Jeu...</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a030] animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a030] animate-pulse" style={{ animationDelay: "0.2s" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a030] animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  const { player, instruction, phase, phaseNumber, gameName, currentVotes, winner } = pv;
  const phaseLabel = phase === "night" ? `🌙 Nuit ${phaseNumber}` : phase === "day" ? `☀️ Jour ${phaseNumber}` : phase === "vote" ? `🗳️ Vote` : phase === "end" ? "🏆 Fin de partie" : "⏳ En attente";

  const handleVote = async (targetId: string) => {
    if (phase !== "vote") return;
    setMyVote(targetId);
    await playerVote(targetId);
  };

  const maxVotes = currentVotes.length > 0 ? Math.max(...currentVotes.map((p) => p.votes)) : 0;

  return (
    <div className="min-h-full flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0818 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <BackButton onClick={() => navigate("home")} />
        <div className="text-center">
          <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest">{gameName}</p>
          <p className="text-[10px] text-[#c9a030] font-mono mt-0.5">{phaseLabel}</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="text-center mb-5 px-5">
        <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-1">Tu joues en tant que</p>
        <h2 className="text-2xl font-bold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>{player.name}</h2>
        {player.isCapitaine && <span className="text-[10px] text-[#c9a030] font-mono">⚔️ Capitaine</span>}
      </div>

      {/* Carte de rôle / mort / attente */}
      {player.status === "dead" ? (
        <div className="mx-5 py-8 px-6 rounded-2xl flex flex-col items-center gap-4" style={{ background: "#16141f", border: "1px solid rgba(255,0,0,0.2)" }}>
          <div className="text-5xl">💀</div>
          <p className="text-xl font-bold text-red-400" style={{ fontFamily: "Cinzel, serif" }}>Tu es mort(e)</p>
          <p className="text-sm text-[#9490a0] text-center" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Reste silencieux·se. Ne révèle pas ton rôle.</p>
        </div>
      ) : player.role ? (
        <div className="mx-5 py-8 px-6 rounded-2xl flex flex-col items-center gap-4 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #1c1040 0%, #0e0824 100%)", border: "1px solid rgba(201,160,48,0.4)", boxShadow: "0 0 50px rgba(139,28,28,0.15), inset 0 1px 0 rgba(201,160,48,0.12)" }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a030]/55 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a030]/55 to-transparent" />
          <div className="text-5xl">{player.roleData?.emoji ?? "❓"}</div>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-[#c9a030] mb-2" style={{ fontFamily: "Cinzel Decorative, Cinzel, serif" }}>{player.roleData?.name ?? player.role}</h3>
            <p className="text-sm text-[#c8c0b0]/80 leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
              "{player.roleData?.description}"
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a030]/40" />
            <div className="w-1 h-1 rounded-full bg-[#c9a030]/60" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a030]/40" />
          </div>
          <div className="px-3 py-1.5 rounded-lg" style={{ background: "rgba(201,160,48,0.1)", border: "1px solid rgba(201,160,48,0.22)" }}>
            <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest">
              Camp : {player.roleData?.category === "wolves" ? "🐺 Loups" : player.roleData?.category === "village" ? "🏡 Village" : "✨ Spécial"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-5 py-8 px-6 rounded-2xl flex flex-col items-center gap-4" style={{ background: "#16141f", border: "1px solid rgba(201,160,48,0.15)" }}>
          <div className="text-5xl">⏳</div>
          <p className="text-xl font-bold text-[#c9a030]" style={{ fontFamily: "Cinzel, serif" }}>En attente</p>
          <p className="text-sm text-[#9490a0] text-center" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Le Maître du Jeu n'a pas encore lancé la partie.</p>
        </div>
      )}

      {/* Bannière de victoire (fin de partie) */}
      {phase === "end" && winner && (
        <div className="mx-5 mt-4 p-5 rounded-2xl text-center" style={{
          background: winner === "wolves" ? "rgba(139,28,28,0.2)" : "rgba(16,185,129,0.1)",
          border: `1px solid ${winner === "wolves" ? "rgba(139,28,28,0.55)" : "rgba(16,185,129,0.35)"}`,
        }}>
          <p className="text-3xl mb-2">{winner === "wolves" ? "🐺" : "🏡"}</p>
          <p className="text-lg font-bold" style={{ fontFamily: "Cinzel, serif", color: winner === "wolves" ? "#f87171" : "#34d399" }}>
            {winner === "wolves" ? "Les Loups ont gagné !" : "Le Village a gagné !"}
          </p>
          <p className="text-xs text-[#9490a0] mt-2" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Vous pouvez révéler vos rôles.
          </p>
        </div>
      )}

      {/* Consigne actuelle */}
      <div className="mx-5 mt-4 p-4 rounded-xl" style={{ background: "#16141f", border: "1px solid rgba(139,28,28,0.28)" }}>
        <p className="text-[9px] text-[#8b1c1c] font-mono uppercase tracking-wider mb-2">Consigne actuelle</p>
        <p className="text-sm text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{instruction}</p>
      </div>

      {/* Zone de vote (si phase vote) */}
      {phase === "vote" && player.status !== "dead" && currentVotes.length > 0 && (
        <div className="mx-5 mt-4">
          <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-3">Voter contre</p>
          <div className="flex flex-col gap-2">
            {currentVotes.filter((p) => p.status !== "dead" && p.id !== player.id).map((target) => {
              const pct = currentVotes.reduce((s, p) => s + p.votes, 0) > 0
                ? (target.votes / currentVotes.reduce((s, p) => s + p.votes, 0)) * 100 : 0;
              const isLeader = target.votes > 0 && target.votes === maxVotes;
              const voted = myVote === target.id;
              return (
                <div key={target.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${voted ? "rgba(139,28,28,0.55)" : "rgba(201,160,48,0.1)"}` }}>
                  <div className="flex items-center gap-3 p-3" style={{ background: isLeader ? "rgba(139,28,28,0.1)" : "#16141f" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e8ddd0] mb-1.5" style={{ fontFamily: "Cinzel, serif" }}>{target.name}</p>
                      <div className="h-1 rounded-full bg-[#252235] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: isLeader ? "#8b1c1c" : "#c9a030" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-mono text-[#e8ddd0] w-4 text-center">{target.votes}</span>
                      <button onClick={() => handleVote(target.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 border ${voted ? "bg-[#8b1c1c]/25 border-[#8b1c1c]/50 text-red-400" : "border-[#c9a030]/30 text-[#c9a030]"}`}
                        style={{ fontFamily: "Cinzel, serif", fontSize: "11px" }}>
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

      {/* Actions privées en attente */}
      {pv.pendingActions && pv.pendingActions.length > 0 && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          {pv.pendingActions.map((action) => (
            <PlayerActionCard key={action.id} action={action} playerView={pv} />
          ))}
        </div>
      )}

      {/* Dernière action résolue (résultat Voyante) */}
      {pv.resolvedActions && pv.resolvedActions.length > 0 && (() => {
        const last = pv.resolvedActions[pv.resolvedActions.length - 1];
        if (last.type === "seer_choose_target" && last.result) {
          const r = last.result as { targetName: string; roleData: { name: string; emoji: string; category: string } | null };
          const isWolf = r.roleData?.category === "wolves";
          return (
            <div className="mx-5 mt-3 p-3 rounded-xl" style={{ background: isWolf ? "rgba(139,28,28,0.12)" : "rgba(201,160,48,0.06)", border: `1px solid ${isWolf ? "rgba(139,28,28,0.35)" : "rgba(201,160,48,0.2)"}` }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: isWolf ? "#f87171" : "#c9a030" }}>
                🔮 Résultat de ta vision
              </p>
              <p className="text-sm text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                {r.targetName} est <strong style={{ color: isWolf ? "#f87171" : "#c9a030" }}>{r.roleData?.name ?? "inconnu"}</strong>
                {isWolf && " 🐺"}
              </p>
            </div>
          );
        }
        return null;
      })()}

      {phase !== "end" && pv.pendingActions?.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a030] animate-pulse" />
          <p className="text-[10px] text-[#9490a0] font-mono">En attente du Maître du Jeu...</p>
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a030] animate-pulse" style={{ animationDelay: "0.3s" }} />
        </div>
      )}
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
    <div className="min-h-full px-5 py-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate("dashboard")} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Vote</h2>
          <p className="text-[10px] text-[#9490a0] font-mono">{totalVotes} vote{totalVotes !== 1 ? "s" : ""} exprimé{totalVotes !== 1 ? "s" : ""}</p>
        </div>
        <div className="px-3 py-1 rounded-full border" style={{ background: "rgba(139,28,28,0.18)", borderColor: "rgba(139,28,28,0.4)" }}>
          <p className="text-[10px] text-red-400 font-mono animate-pulse">● EN COURS</p>
        </div>
      </div>

      {leaders.length > 0 && (
        <div className="mb-4 p-4 rounded-xl" style={{ background: "rgba(139,28,28,0.1)", border: "1px solid rgba(139,28,28,0.35)" }}>
          <p className="text-[10px] text-[#9490a0] font-mono mb-1 uppercase tracking-widest">En tête</p>
          <div className="flex flex-wrap gap-2">
            {leaders.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-400" style={{ fontFamily: "Cinzel, serif" }}>⚠️ {l.name}</span>
                <span className="text-[10px] text-[#9490a0] font-mono">({l.votes} voix)</span>
                <button onClick={() => handleEliminate(l.id)} className="px-2 py-1 rounded text-[10px] font-mono text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors">
                  Éliminer
                </button>
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
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${isLeader ? "rgba(139,28,28,0.55)" : "rgba(201,160,48,0.1)"}` }}>
              <div className="flex items-center gap-3 p-3" style={{ background: isLeader ? "rgba(139,28,28,0.1)" : "#16141f" }}>
                <Avatar name={p.name} status={p.status} isCapitaine={p.isCapitaine} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-sm font-medium text-[#e8ddd0] truncate" style={{ fontFamily: "Cinzel, serif" }}>{p.name}</p>
                    {roleInfo && <span className="text-[10px] text-[#9490a0] font-mono flex-shrink-0">{roleInfo.emoji}</span>}
                    {isLeader && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#8b1c1c]/30 text-red-400 font-mono uppercase tracking-wider flex-shrink-0">En tête</span>}
                  </div>
                  <div className="h-1 rounded-full bg-[#252235] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: isLeader ? "#8b1c1c" : "#c9a030" }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-mono text-[#e8ddd0] w-5 text-center">{p.votes}</span>
                  {p.isCapitaine && <span className="text-[8px] text-[#c9a030] font-mono">×2</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GoldOutlineButton onClick={() => navigate("dashboard")}>← Retour au tableau de bord</GoldOutlineButton>
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

  useEffect(() => {
    const match = window.location.pathname.match(/\/join\/([A-Z0-9]+)/i);
    if (match) setGameId(match[1].toUpperCase());
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
    <div className="min-h-full px-5 py-6 flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-8">
        <BackButton onClick={() => navigate("home")} />
        <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Rejoindre</h2>
      </div>

      {state.error && <ErrorBanner message={state.error} onDismiss={() => setError(null)} />}

      {/* Bannière session sauvegardée */}
      {savedSession && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(201,160,48,0.07)", border: "1px solid rgba(201,160,48,0.22)" }}>
          <span className="text-lg">📱</span>
          <div className="flex-1">
            <p className="text-xs text-[#c9a030] font-mono">Session {savedSession.gameId} trouvée</p>
            <p className="text-[10px] text-[#9490a0] font-mono">Reconnexion automatique en cours…</p>
          </div>
          <button
            onClick={() => { localStorage.removeItem("lycan_session"); setSavedSession(null); }}
            className="text-[10px] text-[#9490a0] font-mono underline"
          >
            Effacer
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center gap-5">
        <div className="text-center mb-2">
          <LycanLogo size={64} />
          <p className="text-[#9490a0] text-sm mt-3 font-mono">Entrez le code de partie</p>
        </div>

        <DarkCard>
          <div className="mb-4">
            <SectionLabel>Code de la partie</SectionLabel>
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value.toUpperCase())}
              className="w-full bg-[#0b0a0f] border border-[#c9a030]/20 rounded-xl px-4 py-3 text-[#c9a030] text-xl text-center tracking-[0.3em] font-mono uppercase focus:outline-none focus:border-[#c9a030]/45 transition-colors"
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
              className="w-full bg-[#0b0a0f] border border-[#c9a030]/20 rounded-xl px-4 py-3 text-[#e8ddd0] text-sm focus:outline-none focus:border-[#c9a030]/45 transition-colors"
              style={{ fontFamily: "Crimson Pro, Georgia, serif" }}
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
              className="text-[10px] font-mono text-[#9490a0] underline underline-offset-2 transition-colors hover:text-[#c9a030]"
            >
              🧪 Réinitialiser mon token joueur local
            </button>
            {tokenResetMsg && <p className="text-[9px] text-emerald-400 font-mono">{tokenResetMsg}</p>}
          </div>
        )}
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
    <div className="min-h-full px-5 py-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}>
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate("dashboard")} />
        <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>Historique</h2>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {filters.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono transition-all border"
            style={{ background: filter === f.id ? "rgba(139,28,28,0.28)" : "transparent", borderColor: filter === f.id ? "rgba(139,28,28,0.75)" : "rgba(201,160,48,0.22)", color: filter === f.id ? "#f0e8d0" : "#9490a0" }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-[#9490a0] text-sm py-8 font-mono">Aucun événement encore</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#c9a030]/12" />
          <div className="flex flex-col gap-4">
            {filtered.map((event) => {
              const cfg = eventStyle[event.type] ?? eventStyle.day;
              return (
                <div key={event.id} className="flex gap-3.5 items-start">
                  <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 text-sm ${cfg.cls}`}>{cfg.icon}</div>
                  <div className="flex-1 min-w-0 pt-1 pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] text-[#c9a030] font-mono uppercase tracking-wider">{event.phase}</span>
                      <span className="text-[9px] text-[#9490a0]/60 font-mono">{event.time}</span>
                    </div>
                    <p className="text-sm text-[#c8c0b0] leading-snug" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{event.text}</p>
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
        className="min-h-screen overflow-y-auto"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #1c1228 0%, #05040a 70%)" }}
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
        <div className="px-4 py-1.5 rounded-full border" style={{ background: "rgba(22,20,31,0.9)", borderColor: "rgba(201,160,48,0.2)" }}>
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
