import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  generateCode,
  createSession,
  getSessionByCode,
  updateSessionState,
  subscribeToSession,
} from "../../lib/sessions";
import {
  assignRoles,
  nextPhase,
  setWolvesTarget,
  witchSave,
  witchKill,
  cupidLink,
  resolveNight,
  hunterShoot,
  eliminatePlayer,
  endGame,
  addHistoryEvent,
  buildPlayerView,
  setCaptain,
  normaliseGameState,
} from "../../lib/gameLogic";
import { createPlayerAction, resolvePlayerAction, cancelPlayerAction } from "../../lib/playerActions";
import { ROLES_MAP } from "../../lib/roles";
import { createId } from "../../lib/id";

// Re-export all shared types for backward compatibility with existing components
export type {
  GamePhase,
  GameMode,
  PlayerStatus,
  AppView,
  PlayerActionType,
  PlayerAction,
  Player,
  RoleConfig,
  HistoryEvent,
  GameState,
  PlayerView,
} from "../../lib/types";

import type {
  GamePhase,
  GameMode,
  AppView,
  PlayerActionType,
  RoleConfig,
  GameState,
  PlayerView,
  Player,
} from "../../lib/types";

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

// ── Context interface ──────────────────────────────────────────────────────────

interface GameContextValue {
  state: State;
  navigate: (view: AppView) => void;
  setDraft: (draft: Partial<State["draft"]>) => void;
  setError: (error: string | null) => void;
  gmCreate: (name: string, playerCount: number, mode: GameMode) => Promise<string>;
  gmAddPlayer: (playerName: string) => Promise<void>;
  gmRemovePlayer: (playerId: string) => Promise<void>;
  gmAddTestPlayers: () => Promise<void>;
  gmSetRoles: (roles: RoleConfig[]) => Promise<void>;
  gmStart: () => Promise<void>;
  gmNextPhase: () => Promise<void>;
  gmResolveVote: (winnerId: string | null) => Promise<void>;
  gmEliminate: (playerId: string, reason?: string) => Promise<void>;
  gmSetCaptain: (playerId: string) => Promise<void>;
  gmEndGame: (winner: "wolves" | "village" | "draw") => Promise<void>;
  gmLogEvent: (text: string, type?: string) => Promise<void>;
  gmHunterShoot: (hunterId: string, targetId: string) => Promise<void>;
  gmTimerConfigure: (duration: number) => Promise<void>;
  gmTimerStart: () => Promise<void>;
  gmTimerPause: () => Promise<void>;
  gmTimerReset: () => Promise<void>;
  gmTimerAdd: (seconds: number) => Promise<void>;
  gmWolvesTarget: (targetId: string) => Promise<void>;
  gmWolvesNoKill: () => Promise<void>;
  gmSeerCheck: (targetId: string) => Promise<{ name: string; role: string; roleData: { name: string; emoji: string; description: string; category: string } | null }>;
  gmWitchSave: () => Promise<void>;
  gmWitchKill: (targetId: string) => Promise<void>;
  gmCupidLink: (lover1Id: string, lover2Id: string) => Promise<void>;
  gmResolveNight: () => Promise<void>;
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
  playerJoin: (gameId: string, name: string) => Promise<void>;
  playerVote: (targetId: string) => Promise<void>;
  playerResolveAction: (actionId: string, payload: Record<string, unknown>) => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

const SESSION_KEY = "lycan_session";

// ── Provider ───────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs to always have fresh values without stale closure issues
  const gameIdRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Auto-reconnect on mount ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const { gameId, playerToken } = JSON.parse(raw) as { gameId: string; playerToken: string };
      if (!gameId || !playerToken) return;

      getSessionByCode(gameId)
        .then((session) => {
          const game: GameState = normaliseGameState(session.game_state);
          const player = game.players.find((p) => p.playerToken === playerToken);
          if (!player) return;

          gameIdRef.current = gameId;
          playerIdRef.current = player.id;
          gameRef.current = game;
          dispatch({ type: "SET_PLAYER_ID", playerId: player.id });
          dispatch({ type: "SET_IS_GM", isGM: false });
          dispatch({ type: "SET_GAME", game });
          const pv = buildPlayerView(game, player.id);
          if (pv) dispatch({ type: "SET_PLAYER_VIEW", view: pv as PlayerView });
          dispatch({ type: "NAVIGATE", view: "player" });
          _subscribe(gameId, player.id);
        })
        .catch(() => localStorage.removeItem(SESSION_KEY));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function _subscribe(code: string, forPlayerId?: string) {
    channelRef.current?.unsubscribe();
    const ch = subscribeToSession(code, (rawState) => {
      const newState = normaliseGameState(rawState);
      gameRef.current = newState;
      dispatch({ type: "SET_GAME", game: newState });
      if (forPlayerId) {
        const pv = buildPlayerView(newState, forPlayerId);
        if (pv) dispatch({ type: "SET_PLAYER_VIEW", view: pv as PlayerView });
      }
      dispatch({ type: "SET_CONNECTED", connected: true });
    });
    ch.subscribe((status) => {
      dispatch({ type: "SET_CONNECTED", connected: status === "SUBSCRIBED" });
    });
    channelRef.current = ch;
  }

  // Apply a pure state update, optimistically update local ref + dispatch, then persist to Supabase
  async function _update(updater: (g: GameState) => GameState): Promise<void> {
    const current = gameRef.current;
    if (!current || !gameIdRef.current) return;
    const newState = updater(current);
    gameRef.current = newState;
    dispatch({ type: "SET_GAME", game: newState });
    try {
      await updateSessionState(gameIdRef.current, newState);
    } catch (e: unknown) {
      console.error("[_update] Erreur Supabase:", e);
      // Rollback : l'état local revient à ce qui était en Supabase
      gameRef.current = current;
      dispatch({ type: "SET_GAME", game: current });
      dispatch({ type: "SET_ERROR", error: "Erreur de synchronisation — l'action n'a pas été sauvegardée." });
    }
  }

  // ── GM: créer une partie ─────────────────────────────────────────────────────

  const gmCreate = async (name: string, playerCount: number, mode: GameMode): Promise<string> => {
    const code = generateCode();
    const initialGame: GameState = {
      id: code,
      name,
      gmSocketId: "",
      playerCount,
      mode,
      phase: "waiting",
      phaseNumber: 0,
      status: "waiting",
      players: [],
      selectedRoles: [],
      history: [],
      witchPotions: { life: true, death: true },
      cupidLovers: [],
      nightActions: { wolvesTarget: null, witchSaved: false, witchKillTarget: null },
      pendingHunterActions: [],
      pendingPlayerActions: [],
      votesByPlayer: {},
      winner: null,
      phaseTimer: { duration: 300, remaining: 300, startedAt: null, running: false },
      createdAt: new Date().toISOString(),
    };
    await createSession(code, name, initialGame);
    gameIdRef.current = code;
    gameRef.current = initialGame;
    dispatch({ type: "SET_GAME", game: initialGame });
    dispatch({ type: "SET_IS_GM", isGM: true });
    _subscribe(code);
    return code;
  };

  // ── GM: gestion des joueurs ──────────────────────────────────────────────────

  const gmAddPlayer = async (playerName: string) => {
    await _update((g) => {
      const player: Player = {
        id: createId("player"),
        name: playerName,
        socketId: null,
        playerToken: createId("token"),
        role: null,
        status: "alive",
        isConnected: false,
        isCapitaine: false,
        votes: 0,
        lastSeenAt: null,
      };
      return { ...g, players: [...g.players, player] };
    });
  };

  const gmRemovePlayer = async (playerId: string) => {
    await _update((g) => ({ ...g, players: g.players.filter((p) => p.id !== playerId) }));
  };

  const gmAddTestPlayers = async () => {
    console.log("[Test] Ajout joueurs test — session:", gameIdRef.current ?? "AUCUNE");
    if (!gameIdRef.current || !gameRef.current) {
      console.warn("[Test] Aucune session active — crée d'abord une partie.");
      return;
    }
    const TEST_NAMES = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace", "Hugo"];
    await _update((g) => {
      console.log("[Test] Joueurs avant:", g.players.length);
      const existing = new Set(g.players.map((p) => p.name));
      const toAdd = TEST_NAMES.filter((n) => !existing.has(n));
      console.log("[Test] Noms à ajouter:", toAdd);
      if (toAdd.length === 0) {
        console.log("[Test] Tous les noms existent déjà.");
        return g;
      }
      const newPlayers: Player[] = toAdd.map((name) => ({
        id: createId("player"),
        name,
        socketId: null,
        playerToken: createId("token"),
        role: null,
        status: "alive" as const,
        isConnected: false,
        isCapitaine: false,
        votes: 0,
        lastSeenAt: null,
      }));
      const next = { ...g, players: [...g.players, ...newPlayers] };
      console.log("[Test] Joueurs après:", next.players.length);
      return next;
    });
    console.log("[Test] Supabase update terminé");
  };

  const gmSetRoles = async (roles: RoleConfig[]) => {
    await _update((g) => ({ ...g, selectedRoles: roles }));
  };

  const gmStart = async () => {
    await _update((g) => {
      let ng = assignRoles(g);
      ng = nextPhase(ng);
      return { ...ng, status: "running" };
    });
  };

  const gmNextPhase = async () => {
    await _update((g) => nextPhase(g));
  };

  const gmResolveVote = async (winnerId: string | null): Promise<void> => {
    console.log("[Vote] résolution — gagnant:", winnerId ?? "aucun");
    await _update((g) => {
      if (g.phase !== "vote") return g;
      if (!winnerId) {
        console.log("[Vote] passage à la nuit sans élimination");
        return nextPhase(g);
      }
      const afterElim = eliminatePlayer(g, winnerId, "vote");
      // Ne pas avancer si la partie est terminée ou si le Chasseur doit tirer
      if (afterElim.status === "finished" || (afterElim.pendingHunterActions ?? []).length > 0) {
        console.log("[Vote] jeu terminé ou Chasseur en attente");
        return afterElim;
      }
      return nextPhase(afterElim);
    });
  };

  const gmEliminate = async (playerId: string, reason = "vote") => {
    await _update((g) => eliminatePlayer(g, playerId, reason));
  };

  const gmSetCaptain = async (playerId: string) => {
    await _update((g) => setCaptain(g, playerId));
  };

  const gmEndGame = async (winner: "wolves" | "village" | "draw") => {
    await _update((g) => endGame(g, winner));
  };

  const gmLogEvent = async (text: string, type = "day") => {
    await _update((g) => addHistoryEvent(g, text, type as "night" | "day" | "vote" | "power"));
  };

  // ── GM: Chasseur ─────────────────────────────────────────────────────────────

  const gmHunterShoot = async (hunterId: string, targetId: string) => {
    await _update((g) => hunterShoot(g, hunterId, targetId));
  };

  // ── GM: Timer ─────────────────────────────────────────────────────────────────

  const gmTimerConfigure = async (duration: number) => {
    await _update((g) => ({ ...g, phaseTimer: { ...g.phaseTimer, duration, remaining: duration } }));
  };

  const gmTimerStart = async () => {
    await _update((g) => ({
      ...g,
      phaseTimer: { ...g.phaseTimer, running: true, startedAt: Date.now() },
    }));
  };

  const gmTimerPause = async () => {
    await _update((g) => {
      const t = g.phaseTimer;
      const elapsed = t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0;
      return {
        ...g,
        phaseTimer: { ...t, running: false, startedAt: null, remaining: Math.max(0, t.remaining - elapsed) },
      };
    });
  };

  const gmTimerReset = async () => {
    await _update((g) => ({
      ...g,
      phaseTimer: { ...g.phaseTimer, running: false, startedAt: null, remaining: g.phaseTimer.duration },
    }));
  };

  const gmTimerAdd = async (seconds: number) => {
    await _update((g) => ({
      ...g,
      phaseTimer: { ...g.phaseTimer, remaining: g.phaseTimer.remaining + seconds },
    }));
  };

  // ── GM: Actions nocturnes ─────────────────────────────────────────────────────

  const gmWolvesTarget = async (targetId: string) => {
    await _update((g) => setWolvesTarget(g, targetId));
  };

  const gmWolvesNoKill = async () => {
    await _update((g) => ({ ...g, nightActions: { ...g.nightActions, wolvesTarget: null } }));
  };

  const gmSeerCheck = async (targetId: string) => {
    const game = gameRef.current;
    if (!game) throw new Error("Pas de partie");
    const target = game.players.find((p) => p.id === targetId);
    if (!target) throw new Error("Joueur introuvable");
    const roleData = ROLES_MAP[target.role ?? ""] || null;
    return { name: target.name, role: target.role ?? "", roleData };
  };

  const gmWitchSave = async () => {
    await _update((g) => witchSave(g));
  };

  const gmWitchKill = async (targetId: string) => {
    await _update((g) => witchKill(g, targetId));
  };

  const gmCupidLink = async (lover1Id: string, lover2Id: string) => {
    await _update((g) => cupidLink(g, lover1Id, lover2Id));
  };

  const gmResolveNight = async () => {
    await _update((g) => resolveNight(g));
  };

  // ── GM: Actions privées joueur ────────────────────────────────────────────────

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
    const actionId = `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await _update((g) => createPlayerAction(g, { ...data, targets: data.targets }));
    // Return the ID of the last created action (matches the id generated in createPlayerAction)
    const game = gameRef.current;
    const lastAction = game?.pendingPlayerActions?.slice(-1)[0];
    return lastAction?.id ?? actionId;
  };

  const gmCancelPlayerAction = async (actionId: string) => {
    await _update((g) => cancelPlayerAction(g, actionId));
  };

  // ── Joueur: rejoindre ─────────────────────────────────────────────────────────

  const playerJoin = async (gameId: string, name: string) => {
    const session = await getSessionByCode(gameId);
    let game: GameState = normaliseGameState(session.game_state);

    // Reconnexion par token
    let existingToken: string | null = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { gameId: savedId, playerToken } = JSON.parse(raw) as { gameId: string; playerToken: string };
        if (savedId === gameId) existingToken = playerToken;
      }
    } catch { /* ignore */ }

    let player = existingToken ? game.players.find((p) => p.playerToken === existingToken) : undefined;

    if (!player) {
      // Nouveau joueur — bloqué si la partie est en cours
      if (game.status === "running") {
        throw new Error("La partie a déjà commencé. Demande au Maître du Jeu de t'ajouter à la prochaine partie.");
      }
      const token = createId("token");
      player = {
        id: createId("player"),
        name,
        socketId: null,
        playerToken: token,
        role: null,
        status: "alive",
        isConnected: true,
        isCapitaine: false,
        votes: 0,
        lastSeenAt: new Date().toISOString(),
      };
      game = { ...game, players: [...game.players, player] };
      await updateSessionState(gameId, game);
    }

    gameIdRef.current = gameId;
    playerIdRef.current = player.id;
    gameRef.current = game;
    dispatch({ type: "SET_PLAYER_ID", playerId: player.id });
    dispatch({ type: "SET_IS_GM", isGM: false });
    dispatch({ type: "SET_GAME", game });
    const pv = buildPlayerView(game, player.id);
    if (pv) dispatch({ type: "SET_PLAYER_VIEW", view: pv as PlayerView });

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ gameId, playerToken: player.playerToken }));
    } catch { /* ignore */ }

    _subscribe(gameId, player.id);
  };

  // ── Joueur: vote ──────────────────────────────────────────────────────────────

  const playerVote = async (targetId: string) => {
    const voterId = playerIdRef.current;
    if (!voterId || !gameIdRef.current) return;

    const current = gameRef.current;
    if (!current) return;
    if (current.status !== "running" || current.phase !== "vote") return;

    const voter = current.players.find((p) => p.id === voterId);
    if (!voter || voter.status === "dead") return; // un mort ne vote pas

    const newVotesByPlayer = { ...(current.votesByPlayer ?? {}), [voterId]: targetId };
    const players = current.players.map((p) => ({
      ...p,
      votes: Object.values(newVotesByPlayer).filter((v) => v === p.id).length,
    }));
    const newState = { ...current, votesByPlayer: newVotesByPlayer, players };
    gameRef.current = newState;
    dispatch({ type: "SET_GAME", game: newState });
    await updateSessionState(gameIdRef.current, newState);
  };

  // ── Joueur: résoudre une action ───────────────────────────────────────────────

  const playerResolveAction = async (actionId: string, payload: Record<string, unknown>) => {
    if (!gameIdRef.current) return;
    const current = gameRef.current;
    if (!current) return;

    // Voyante : enrichir le résultat avec le nom et le rôle de la cible
    let enrichedPayload = payload;
    const action = current.pendingPlayerActions?.find((a) => a.id === actionId);
    if (action?.type === "seer_choose_target" && typeof payload.targetId === "string") {
      const target = current.players.find((p) => p.id === payload.targetId);
      if (target) {
        const roleData = ROLES_MAP[target.role ?? ""] ?? null;
        if (!roleData) console.warn("[Voyante] rôle introuvable dans ROLES_MAP:", target.role, "— joueur:", target.name);
        enrichedPayload = {
          targetId: payload.targetId,
          targetName: target.name,
          role: target.role ?? "",
          roleData: roleData
            ? { name: roleData.name, emoji: roleData.emoji, description: roleData.description, category: roleData.category }
            : null,
        };
      } else {
        console.warn("[Voyante] joueur cible introuvable:", payload.targetId);
      }
    }

    const newState = resolvePlayerAction(current, actionId, enrichedPayload);
    gameRef.current = newState;
    dispatch({ type: "SET_GAME", game: newState });
    await updateSessionState(gameIdRef.current, newState);
  };

  return (
    <GameContext.Provider
      value={{
        state,
        navigate: (view) => dispatch({ type: "NAVIGATE", view }),
        setDraft: (draft) => dispatch({ type: "SET_DRAFT", draft }),
        setError: (error) => dispatch({ type: "SET_ERROR", error }),
        gmCreate, gmAddPlayer, gmRemovePlayer, gmAddTestPlayers, gmSetRoles, gmStart,
        gmNextPhase, gmResolveVote, gmEliminate, gmSetCaptain, gmEndGame, gmLogEvent,
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
