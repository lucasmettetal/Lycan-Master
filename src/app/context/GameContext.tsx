import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { connectSocket, getSocket } from "../socket";

// ── Types ──────────────────────────────────────────────────────────────────────

export type GamePhase = "waiting" | "night" | "day" | "vote" | "end";
export type GameMode = "beginner" | "classic" | "expert" | "custom";
export type PlayerStatus = "alive" | "dead" | "protected" | "infected";
export type AppView = "home" | "create" | "players" | "roles" | "dashboard" | "player" | "vote" | "history" | "join" | "rules";
export type PlayerActionType =
  | "seer_choose_target"
  | "cupid_choose_lovers"
  | "witch_choose_potions"
  | "hunter_choose_target"
  | "day_vote";

export interface PlayerAction {
  id: string;
  playerId: string;
  type: PlayerActionType;
  title: string;
  description: string;
  targets: string[];
  minTargets: number;
  maxTargets: number;
  status: "pending" | "resolved" | "cancelled";
  result: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Player {
  id: string;
  name: string;
  socketId: string | null;
  playerToken: string;
  role: string | null;
  status: PlayerStatus;
  isConnected: boolean;
  isCapitaine: boolean;
  votes: number;
  lastSeenAt: string | null;
}

export interface RoleConfig {
  id: string;
  count: number;
}

export interface HistoryEvent {
  id: string;
  type: "night" | "day" | "vote" | "power";
  text: string;
  phase: string;
  time: string;
}

export interface GameState {
  id: string;
  name: string;
  gmSocketId: string;
  playerCount: number;
  mode: GameMode;
  phase: GamePhase;
  phaseNumber: number;
  status: "waiting" | "running" | "finished";
  players: Player[];
  selectedRoles: RoleConfig[];
  history: HistoryEvent[];
  witchPotions: { life: boolean; death: boolean };
  cupidLovers: string[];
  nightActions: { wolvesTarget: string | null; witchSaved: boolean; witchKillTarget: string | null };
  pendingHunterActions: string[];
  pendingPlayerActions: PlayerAction[];
  phaseTimer: { duration: number; remaining: number; startedAt: number | null; running: boolean };
  createdAt: string;
}

export interface PlayerView {
  gameId: string;
  gameName: string;
  phase: GamePhase;
  phaseNumber: number;
  player: {
    id: string;
    name: string;
    role: string;
    roleData: { name: string; emoji: string; description: string; category: string } | null;
    status: PlayerStatus;
    isCapitaine: boolean;
  };
  instruction: string;
  isLover?: boolean;
  alivePlayers: { id: string; name: string; status: PlayerStatus; votes: number }[];
  currentVotes: { id: string; name: string; votes: number; status: PlayerStatus }[];
  pendingActions: PlayerAction[];
  resolvedActions: PlayerAction[];
}

// ── State shape ────────────────────────────────────────────────────────────────

interface State {
  view: AppView;
  isGM: boolean;
  game: GameState | null;
  playerView: PlayerView | null;
  playerId: string | null;
  connected: boolean;
  error: string | null;
  draft: { name: string; playerCount: number; mode: GameMode };
}

const initialState: State = {
  view: "home",
  isGM: false,
  game: null,
  playerView: null,
  playerId: null,
  connected: false,
  error: null,
  draft: { name: "Soirée des Loups", playerCount: 9, mode: "classic" },
};

// ── Reducer ────────────────────────────────────────────────────────────────────

type Action =
  | { type: "NAVIGATE"; view: AppView }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_GAME"; game: GameState }
  | { type: "SET_PLAYER_VIEW"; view: PlayerView }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_DRAFT"; draft: Partial<State["draft"]> }
  | { type: "SET_IS_GM"; isGM: boolean }
  | { type: "SET_PLAYER_ID"; playerId: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "NAVIGATE": return { ...state, view: action.view, error: null };
    case "SET_CONNECTED": return { ...state, connected: action.connected };
    case "SET_GAME": return { ...state, game: action.game };
    case "SET_PLAYER_VIEW": return { ...state, playerView: action.view };
    case "SET_ERROR": return { ...state, error: action.error };
    case "SET_DRAFT": return { ...state, draft: { ...state.draft, ...action.draft } };
    case "SET_IS_GM": return { ...state, isGM: action.isGM };
    case "SET_PLAYER_ID": return { ...state, playerId: action.playerId };
    default: return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: State;
  navigate: (view: AppView) => void;
  setDraft: (draft: Partial<State["draft"]>) => void;
  setError: (error: string | null) => void;
  // Actions GM
  gmCreate: (name: string, playerCount: number, mode: GameMode) => Promise<string>;
  gmAddPlayer: (playerName: string) => Promise<void>;
  gmRemovePlayer: (playerId: string) => Promise<void>;
  gmSetRoles: (roles: RoleConfig[]) => Promise<void>;
  gmStart: () => Promise<void>;
  gmNextPhase: () => Promise<void>;
  gmEliminate: (playerId: string, reason?: string) => Promise<void>;
  gmSetCaptain: (playerId: string) => Promise<void>;
  gmEndGame: (winner: "wolves" | "village" | "draw") => Promise<void>;
  gmLogEvent: (text: string, type?: string) => Promise<void>;
  // Chasseur
  gmHunterShoot: (hunterId: string, targetId: string) => Promise<void>;
  // Timer
  gmTimerConfigure: (duration: number) => Promise<void>;
  gmTimerStart: () => Promise<void>;
  gmTimerPause: () => Promise<void>;
  gmTimerReset: () => Promise<void>;
  gmTimerAdd: (seconds: number) => Promise<void>;
  // Actions nocturnes
  gmWolvesTarget: (targetId: string) => Promise<void>;
  gmWolvesNoKill: () => Promise<void>;
  gmSeerCheck: (targetId: string) => Promise<{ name: string; role: string; roleData: { name: string; emoji: string; description: string; category: string } | null }>;
  gmWitchSave: () => Promise<void>;
  gmWitchKill: (targetId: string) => Promise<void>;
  gmCupidLink: (lover1Id: string, lover2Id: string) => Promise<void>;
  gmResolveNight: () => Promise<void>;
  // Actions privées joueur (déléguées depuis NightWizard)
  gmCreatePlayerAction: (data: {
    playerId: string;
    type: PlayerActionType;
    title: string;
    description: string;
    targets: string[];
    minTargets?: number;
    maxTargets?: number;
    context?: Record<string, unknown> | null;
  }) => Promise<string>;
  gmCancelPlayerAction: (actionId: string) => Promise<void>;
  // Actions joueur
  playerJoin: (gameId: string, name: string) => Promise<void>;
  playerVote: (targetId: string) => Promise<void>;
  playerResolveAction: (actionId: string, payload: Record<string, unknown>) => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

const SESSION_KEY = "lycan_session";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const gameIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = connectSocket();

    socket.on("connect", () => {
      dispatch({ type: "SET_CONNECTED", connected: true });
      // Tentative de reconnexion automatique
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
          const { gameId, playerToken } = JSON.parse(saved) as { gameId: string; playerToken: string };
          if (gameId && playerToken) {
            socket.emit(
              "player:join",
              { gameId, playerToken },
              (res: { ok: boolean; playerId?: string; playerToken?: string; state?: PlayerView }) => {
                if (res?.ok && res.playerId) {
                  gameIdRef.current = gameId;
                  dispatch({ type: "SET_PLAYER_ID", playerId: res.playerId });
                  dispatch({ type: "SET_IS_GM", isGM: false });
                  if (res.state) dispatch({ type: "SET_PLAYER_VIEW", view: res.state });
                  dispatch({ type: "NAVIGATE", view: "player" });
                }
              }
            );
          }
        }
      } catch { /* localStorage non disponible */ }
    });

    socket.on("disconnect", () => dispatch({ type: "SET_CONNECTED", connected: false }));

    socket.on("game:state", (game: GameState) => {
      dispatch({ type: "SET_GAME", game });
      gameIdRef.current = game.id;
    });

    socket.on("player:state", (view: PlayerView) => {
      dispatch({ type: "SET_PLAYER_VIEW", view });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("game:state");
      socket.off("player:state");
    };
  }, []);

  const emit = <T,>(event: string, data?: object): Promise<T> =>
    new Promise((resolve, reject) => {
      const socket = getSocket();
      socket.emit(event, data, (res: { ok: boolean; error?: string } & T) => {
        if (res?.ok === false) reject(new Error(res.error || "Erreur réseau"));
        else resolve(res as T);
      });
    });

  const gmCreate = async (name: string, playerCount: number, mode: GameMode): Promise<string> => {
    const res = await emit<{ ok: boolean; gameId: string }>("gm:create", { name, playerCount, mode });
    gameIdRef.current = res.gameId;
    dispatch({ type: "SET_IS_GM", isGM: true });
    return res.gameId;
  };

  const gmAddPlayer = async (playerName: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:add_player", { gameId: gameIdRef.current, playerName });
  };

  const gmRemovePlayer = async (playerId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:remove_player", { gameId: gameIdRef.current, playerId });
  };

  const gmSetRoles = async (roles: RoleConfig[]) => {
    if (!gameIdRef.current) return;
    await emit("gm:set_roles", { gameId: gameIdRef.current, roles });
  };

  const gmStart = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:start", { gameId: gameIdRef.current });
  };

  const gmNextPhase = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:next_phase", { gameId: gameIdRef.current });
  };

  const gmEliminate = async (playerId: string, reason = "vote") => {
    if (!gameIdRef.current) return;
    await emit("gm:eliminate", { gameId: gameIdRef.current, playerId, reason });
  };

  const gmSetCaptain = async (playerId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:set_captain", { gameId: gameIdRef.current, playerId });
  };

  const gmEndGame = async (winner: "wolves" | "village" | "draw") => {
    if (!gameIdRef.current) return;
    await emit("gm:end_game", { gameId: gameIdRef.current, winner });
  };

  const gmLogEvent = async (text: string, type = "day") => {
    if (!gameIdRef.current) return;
    await emit("gm:log_event", { gameId: gameIdRef.current, text, type });
  };

  const gmHunterShoot = async (hunterId: string, targetId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:hunter_shoot", { gameId: gameIdRef.current, hunterId, targetId });
  };

  const gmTimerConfigure = async (duration: number) => {
    if (!gameIdRef.current) return;
    await emit("gm:timer_configure", { gameId: gameIdRef.current, duration });
  };

  const gmTimerStart = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:timer_start", { gameId: gameIdRef.current });
  };

  const gmTimerPause = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:timer_pause", { gameId: gameIdRef.current });
  };

  const gmTimerReset = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:timer_reset", { gameId: gameIdRef.current });
  };

  const gmTimerAdd = async (seconds: number) => {
    if (!gameIdRef.current) return;
    await emit("gm:timer_add", { gameId: gameIdRef.current, seconds });
  };

  const gmWolvesTarget = async (targetId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:wolves_target", { gameId: gameIdRef.current, targetId });
  };

  const gmWolvesNoKill = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:wolves_no_kill", { gameId: gameIdRef.current });
  };

  const gmSeerCheck = async (targetId: string) => {
    if (!gameIdRef.current) throw new Error("Pas de partie");
    return emit<{ ok: boolean; name: string; role: string; roleData: { name: string; emoji: string; description: string; category: string } | null }>(
      "gm:seer_check", { gameId: gameIdRef.current, targetId }
    );
  };

  const gmWitchSave = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:witch_save", { gameId: gameIdRef.current });
  };

  const gmWitchKill = async (targetId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:witch_kill", { gameId: gameIdRef.current, targetId });
  };

  const gmCupidLink = async (lover1Id: string, lover2Id: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:cupid_link", { gameId: gameIdRef.current, lover1Id, lover2Id });
  };

  const gmResolveNight = async () => {
    if (!gameIdRef.current) return;
    await emit("gm:resolve_night", { gameId: gameIdRef.current });
  };

  const gmCreatePlayerAction = async (data: {
    playerId: string;
    type: PlayerActionType;
    title: string;
    description: string;
    targets: string[];
    minTargets?: number;
    maxTargets?: number;
    context?: Record<string, unknown> | null;
  }): Promise<string> => {
    if (!gameIdRef.current) return "";
    const res = await emit<{ ok: boolean; actionId: string }>(
      "gm:create_player_action",
      { gameId: gameIdRef.current, action: data }
    );
    return res.actionId;
  };

  const gmCancelPlayerAction = async (actionId: string) => {
    if (!gameIdRef.current) return;
    await emit("gm:cancel_player_action", { gameId: gameIdRef.current, actionId });
  };

  const playerJoin = async (gameId: string, name: string) => {
    const res = await emit<{ ok: boolean; playerId: string; playerToken: string; state: PlayerView }>(
      "player:join",
      { gameId, playerName: name }
    );
    gameIdRef.current = gameId;
    dispatch({ type: "SET_PLAYER_ID", playerId: res.playerId });
    dispatch({ type: "SET_IS_GM", isGM: false });
    if (res.state) dispatch({ type: "SET_PLAYER_VIEW", view: res.state });
    // Sauvegarder la session pour reconnexion automatique
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ gameId, playerToken: res.playerToken }));
    } catch { /* ignore */ }
  };

  const playerVote = async (targetId: string) => {
    if (!gameIdRef.current) return;
    await emit("player:vote", { gameId: gameIdRef.current, targetId });
  };

  const playerResolveAction = async (actionId: string, payload: Record<string, unknown>) => {
    await emit("player:resolve_action", { actionId, payload });
  };

  return (
    <GameContext.Provider
      value={{
        state,
        navigate: (view) => dispatch({ type: "NAVIGATE", view }),
        setDraft: (draft) => dispatch({ type: "SET_DRAFT", draft }),
        setError: (error) => dispatch({ type: "SET_ERROR", error }),
        gmCreate, gmAddPlayer, gmRemovePlayer, gmSetRoles, gmStart,
        gmNextPhase, gmEliminate, gmSetCaptain, gmEndGame, gmLogEvent,
        gmHunterShoot,
        gmTimerConfigure, gmTimerStart, gmTimerPause, gmTimerReset, gmTimerAdd,
        gmWolvesTarget, gmWolvesNoKill, gmSeerCheck, gmWitchSave, gmWitchKill,
        gmCupidLink, gmResolveNight,
        gmCreatePlayerAction, gmCancelPlayerAction,
        playerJoin, playerVote, playerResolveAction,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame doit être utilisé dans GameProvider");
  return ctx;
}
