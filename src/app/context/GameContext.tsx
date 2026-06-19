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
  killPlayer,
  checkWinCondition,
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
import type { GameState as GameStateType } from "../../lib/types";

// ── Helper Pyromane ───────────────────────────────────────────────────────────
// Victoire solo si Pyromane est le seul survivant
function checkPyromaneWin(g: GameStateType): GameStateType {
  if (g.status !== "running") return g;
  const pyro = g.players.find((p) => p.role === "pyromane" && p.status !== "dead");
  if (!pyro) return g;
  const alive = g.players.filter((p) => p.status !== "dead");
  if (alive.length === 1 && alive[0].id === pyro.id) {
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return {
      ...g,
      status: "finished" as const,
      winner: "pyromane" as const,
      phase: "end" as const,
      pendingHunterActions: [],
      pendingPlayerActions: (g.pendingPlayerActions ?? []).map((a) => a.status === "pending" ? { ...a, status: "cancelled" as const } : a),
      history: [...g.history, { id: Date.now().toString() + "py", type: "power" as const, text: `🔥 ${pyro.name} (Pyromane) est le dernier survivant — victoire solitaire !`, phase: "Fin de partie", time: now }],
    };
  }
  return g;
}

// ── Helper Joueur de Flûte ────────────────────────────────────────────────────
// Vérifie si tous les vivants (hors Flûte) sont ensorcelés → victoire solo
function checkFluteWin(g: GameStateType): GameStateType {
  if (g.status !== "running") return g;
  const flute = g.players.find((p) => p.role === "joueur_flute" && p.status !== "dead");
  if (!flute) return g;
  const enchanted = g.enchanted ?? [];
  const otherAlive = g.players.filter((p) => p.status !== "dead" && p.id !== flute.id);
  if (otherAlive.length > 0 && otherAlive.every((p) => enchanted.includes(p.id))) {
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return {
      ...g,
      status: "finished" as const,
      winner: "flute" as const,
      phase: "end" as const,
      pendingHunterActions: [],
      pendingPlayerActions: (g.pendingPlayerActions ?? []).map((a) => a.status === "pending" ? { ...a, status: "cancelled" as const } : a),
      history: [...g.history, { id: Date.now().toString() + "fl", type: "power" as const, text: `🎵 ${flute.name} (Joueur de Flûte) a ensorcelé tous les survivants — victoire solitaire !`, phase: "Fin de partie", time: now }],
    };
  }
  return g;
}

// ── Helper Enfant Sauvage ─────────────────────────────────────────────────────
// Appelé après chaque mort : si le modèle de l'Enfant Sauvage est mort, il bascule loup
function applyWildChild(g: GameStateType): GameStateType {
  if (!g.wildChildModel) return g;
  const child = g.players.find((p) => p.role === "enfant_sauvage" && p.status !== "dead");
  if (!child) return g;
  const model = g.players.find((p) => p.id === g.wildChildModel);
  if (!model || model.status !== "dead") return g;
  const updated = addHistoryEvent(g, `🐺 ${child.name} (Enfant Sauvage) a perdu son modèle — il rejoint les loups !`, "power");
  return { ...updated, wildChildModel: null, players: updated.players.map((p) => p.id === child.id ? { ...p, role: "werewolf" } : p) };
}

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
  corbeauSetTarget: (targetId: string) => Promise<void>;
  chienLoupChoose: (choice: "wolves" | "village") => Promise<void>;
  gmChienLoupAssign: (playerId: string, choice: "wolves" | "village") => Promise<void>;
  gmTransferRole: (fromPlayerId: string, toPlayerId: string) => Promise<void>;
  gmSalvatorProtect: (targetId: string) => Promise<void>;
  gmWhitewolfKill: (targetId: string | null) => Promise<void>;
  gmInfectTarget: (targetId: string | null) => Promise<void>;
  gmWildChildSetModel: (modelId: string) => Promise<void>;
  gmSectaireChoose: (choice: "wolves" | "village") => Promise<void>;
  gmJudgeTrigger: () => Promise<void>;
  gmRenardInspect: (playerIds: string[]) => Promise<{ hasWolf: boolean }>;
  gmGitaneSwap: (targetId: string) => Promise<void>;
  gmFluteEnchant: (playerIds: string[]) => Promise<void>;
  gmPyromaniacSpray: (targetId: string) => Promise<void>;
  gmPyromaniacPrepareIgnite: () => Promise<void>;
  gmVoleurSetup: (cards: string[]) => Promise<void>;
  gmVoleurChoose: (roleId: string | null) => Promise<void>;
  gmComedienSetRoles: (roleIds: string[]) => Promise<void>;
  gmComedienChooseRole: (roleId: string) => Promise<void>;
  gmSetPlayerOrder: (order: string[]) => Promise<void>;
  gmStartNight: () => Promise<void>;
  playerScanRole: (roleId: string) => Promise<void>;
  gmAssignRole: (playerId: string, roleId: string) => Promise<void>;
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
    // Passe en mode distribution physique : les rôles seront scannés par les joueurs
    await _update((g) => ({ ...g, scanningRoles: true }));
  };

  const gmStartNight = async () => {
    // Démarre la partie et passe à la nuit 1 (appelé quand tous les rôles sont assignés)
    await _update((g) => nextPhase({ ...g, status: "running" as const, scanningRoles: false }));
  };

  const playerScanRole = async (roleId: string) => {
    const playerId = playerIdRef.current;
    if (!playerId) return;
    await _update((g) => ({
      ...g,
      players: g.players.map((p) => p.id === playerId ? { ...p, role: roleId } : p),
    }));
  };

  const gmAssignRole = async (playerId: string, roleId: string) => {
    await _update((g) => ({
      ...g,
      players: g.players.map((p) => p.id === playerId ? { ...p, role: roleId } : p),
    }));
  };

  const gmNextPhase = async () => {
    await _update((g) => {
      const next = nextPhase(g);
      if (next.phase === "night") {
        return { ...next, corbeauTarget: null };
      }
      if (next.phase === "vote") {
        return {
          ...next,
          votesByPlayer: {},
          players: next.players.map((p) => ({
            ...p,
            votes: next.corbeauTarget === p.id ? 2 : 0,
          })),
        };
      }
      // Transition nuit → jour : vérifier les victoires solo APRÈS les morts de nuit
      if (next.phase === "day") {
        let result = checkFluteWin(next);
        if (result.status === "running") result = checkPyromaneWin(result);
        return result;
      }
      return next;
    });
  };

  const gmResolveVote = async (winnerId: string | null): Promise<void> => {
    await _update((g) => {
      if (g.phase !== "vote") return g;

      // Égalité — Bouc Émissaire prend la place si vivant
      if (!winnerId) {
        const bouc = g.players.find((p) => p.role === "bouc_emissaire" && p.status !== "dead");
        if (bouc) {
          const withEvent = addHistoryEvent(g, `🐐 ${bouc.name} (Bouc Émissaire) est sacrifié à la place — demain, tout le monde doit voter`, "vote");
          let afterElim = eliminatePlayer(withEvent, bouc.id, "vote");
          afterElim = applyWildChild(afterElim);
          if (afterElim.status === "running") afterElim = checkWinCondition(afterElim);
          if (afterElim.status === "running") afterElim = checkFluteWin(afterElim);
          if (afterElim.status === "running") afterElim = checkPyromaneWin(afterElim);
          if (afterElim.status === "finished" || (afterElim.pendingHunterActions ?? []).length > 0) return afterElim;
          return nextPhase(afterElim);
        }
        return nextPhase(g);
      }

      const target = g.players.find((p) => p.id === winnerId);

      // Ange — victoire solo si premier vote (phaseNumber === 1)
      if (target?.role === "ange" && g.phaseNumber === 1) {
        const withEvent = addHistoryEvent(g, `😇 ${target.name} (Ange) est éliminé au premier vote et gagne seul !`, "vote");
        return { ...withEvent, status: "finished" as const, winner: "angel" as const, phase: "end" as const };
      }

      // Idiot du Village — survit la première fois, perd son droit de vote
      if (target?.role === "idiot_village" && target.hasVotingRight !== false) {
        const withEvent = addHistoryEvent(g, `🤡 ${target.name} (Idiot du Village) révèle son identité et survit — il perd son droit de vote`, "vote");
        const updated = {
          ...withEvent,
          players: withEvent.players.map((p) => p.id === winnerId ? { ...p, hasVotingRight: false } : p),
          votesByPlayer: {} as Record<string, string>,
        };
        return nextPhase(updated);
      }

      // Cas normal
      let afterElim = eliminatePlayer(g, winnerId, "vote");
      afterElim = applyWildChild(afterElim);
      if (afterElim.status === "running") afterElim = checkWinCondition(afterElim);
      if (afterElim.status === "running") afterElim = checkFluteWin(afterElim);
      if (afterElim.status === "running") afterElim = checkPyromaneWin(afterElim);
      if (afterElim.status === "finished" || (afterElim.pendingHunterActions ?? []).length > 0) return afterElim;
      return nextPhase(afterElim);
    });
  };

  const gmEliminate = async (playerId: string, reason = "vote") => {
    await _update((g) => {
      let result = eliminatePlayer(g, playerId, reason);
      result = applyWildChild(result);
      if (result.status === "running") result = checkWinCondition(result);
      if (result.status === "running") result = checkFluteWin(result);
      if (result.status === "running") result = checkPyromaneWin(result);
      return result;
    });
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
    await _update((g) => {
      let result = hunterShoot(g, hunterId, targetId);
      result = applyWildChild(result);
      if (result.status === "running") result = checkWinCondition(result);
      if (result.status === "running") result = checkFluteWin(result);
      if (result.status === "running") result = checkPyromaneWin(result);
      return result;
    });
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
    await _update((g) => {
      let processed = { ...g };

      // 0. Pyromane — embrasement (appliqué avant les loups pour clarté d'historique)
      if (processed.nightActions.pyromaniacIgniting) {
        const oiled = processed.oiled ?? [];
        const pyro = processed.players.find((p) => p.role === "pyromane" && p.status !== "dead");
        if (pyro && oiled.length > 0) {
          processed = addHistoryEvent(processed, `🔥 ${pyro.name} (Pyromane) déclenche l'embrasement !`, "power");
          for (const id of oiled) {
            if (processed.players.find((p) => p.id === id && p.status !== "dead")) {
              processed = killPlayer(processed, id, "night");
            }
          }
        }
        processed = { ...processed, oiled: [] };
      }

      // 1. Infect Père des Loups — infecte la victime au lieu de la tuer
      const infectId = processed.nightActions.infectTarget ?? null;
      if (infectId && !processed.infectUsed) {
        const infectTarget = processed.players.find((p) => p.id === infectId && p.status !== "dead");
        if (infectTarget) {
          processed = addHistoryEvent(processed, `☣️ ${infectTarget.name} est infecté(e) et rejoint secrètement la meute !`, "power");
          processed = {
            ...processed,
            infectUsed: true,
            players: processed.players.map((p) => p.id === infectId ? { ...p, role: "werewolf" } : p),
            nightActions: { ...processed.nightActions, wolvesTarget: null, infectTarget: null },
          };
        }
      }

      // 2. Salvateur — annule le kill des loups si la cible est protégée
      const salvatorId = processed.nightActions.salvatorTarget ?? null;
      if (salvatorId && processed.nightActions.wolvesTarget === salvatorId) {
        const saved = processed.players.find((p) => p.id === salvatorId);
        if (saved) {
          processed = addHistoryEvent(processed, `🛡️ ${saved.name} est protégé(e) par le Salvateur cette nuit`, "power");
          processed = { ...processed, nightActions: { ...processed.nightActions, wolvesTarget: null } };
        }
      }
      processed = { ...processed, lastSalvatorTarget: salvatorId };

      // 3. Résolution standard (loups + sorcière + Cupidon + Chasseur + win check)
      let result = resolveNight(processed);

      // 4. Loup-Garou Blanc — kill nocturne solo (appliqué après la résolution standard)
      const whitewolfKillId = g.nightActions.whitewolfTarget ?? null;
      if (whitewolfKillId && result.status === "running") {
        const lb = result.players.find((p) => p.role === "loup_blanc" && p.status !== "dead");
        const wbTarget = result.players.find((p) => p.id === whitewolfKillId && p.status !== "dead");
        if (lb && wbTarget) {
          const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          result = { ...result, history: [...result.history, { id: Date.now().toString(), type: "power" as const, text: `🐺 ${lb.name} (LG Blanc) élimine ${wbTarget.name} dans son sommeil`, phase: `Nuit ${result.phaseNumber}`, time: now }] };
          result = killPlayer(result, whitewolfKillId, "night");
          result = checkWinCondition(result);
        }
      }

      // 5. Enfant Sauvage — conversion si modèle mort cette nuit
      if (result.status === "running") {
        result = applyWildChild(result);
        if (result.status === "running") result = checkWinCondition(result);
        if (result.status === "running") result = checkFluteWin(result);
        if (result.status === "running") result = checkPyromaneWin(result);
      }

      // 6. Loup-Garou Blanc — victoire solitaire si dernier survivant
      if (result.status === "running") {
        const alive = result.players.filter((p) => p.status !== "dead");
        const lb = alive.find((p) => p.role === "loup_blanc");
        if (lb && alive.length === 1) {
          const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          result = {
            ...result,
            status: "finished" as const,
            winner: "whitewolf" as const,
            phase: "end" as const,
            pendingHunterActions: [],
            history: [...result.history, { id: Date.now().toString() + "ww", type: "power" as const, text: `🐺 ${lb.name} (LG Blanc) est le dernier survivant — victoire solitaire !`, phase: "Fin de partie", time: now }],
          };
        }
      }

      return result;
    });
  };

  const gmWildChildSetModel = async (modelId: string) => {
    await _update((g) => ({ ...g, wildChildModel: modelId }));
  };

  const gmSectaireChoose = async (choice: "wolves" | "village") => {
    await _update((g) => {
      const sectaire = g.players.find((p) => p.role === "sectaire" && p.status !== "dead");
      if (!sectaire) return { ...g, sectaireTeam: choice };
      const players = choice === "wolves"
        ? g.players.map((p) => p.id === sectaire.id ? { ...p, role: "werewolf" } : p)
        : g.players;
      return { ...g, sectaireTeam: choice, players };
    });
  };

  const gmJudgeTrigger = async () => {
    await _update((g) => {
      if (g.phase !== "vote" || g.judgePowerUsed) return g;
      const juge = g.players.find((p) => p.role === "juge_begue" && p.status !== "dead");
      if (!juge) return g;
      const withEvent = addHistoryEvent(g, `⚖️ ${juge.name} (Juge Bègue) décrète un second vote !`, "vote");
      const corbeauTarget = withEvent.corbeauTarget ?? null;
      return {
        ...withEvent,
        judgePowerUsed: true,
        votesByPlayer: {},
        players: withEvent.players.map((p) => ({
          ...p,
          votes: corbeauTarget === p.id ? 2 : 0,
        })),
      };
    });
  };

  const gmPyromaniacSpray = async (targetId: string) => {
    await _update((g) => {
      const newOiled = [...new Set([...(g.oiled ?? []), targetId])];
      return { ...g, oiled: newOiled };
    });
  };

  const gmPyromaniacPrepareIgnite = async () => {
    await _update((g) => ({ ...g, nightActions: { ...g.nightActions, pyromaniacIgniting: true } }));
  };

  const gmFluteEnchant = async (playerIds: string[]) => {
    await _update((g) => {
      const newEnchanted = [...new Set([...(g.enchanted ?? []), ...playerIds])];
      const names = playerIds.map((id) => g.players.find((p) => p.id === id)?.name ?? "?").join(" & ");
      // Pas de checkFluteWin ici : la victoire est vérifiée à l'aube (gmNextPhase nuit→jour)
      // afin que les loups puissent encore tuer le Joueur de Flûte cette même nuit
      return addHistoryEvent({ ...g, enchanted: newEnchanted }, `🎵 ${names} ${playerIds.length > 1 ? "sont ensorcelés" : "est ensorcelé(e)"}`, "power");
    });
  };

  const gmRenardInspect = async (playerIds: string[]): Promise<{ hasWolf: boolean }> => {
    const game = gameRef.current;
    if (!game) throw new Error("Pas de partie");
    const hasWolf = playerIds.some((id) => {
      const p = game.players.find((pl) => pl.id === id);
      return p && ROLES_MAP[p.role ?? ""]?.team === "wolves";
    });
    if (!hasWolf) {
      await _update((g) => addHistoryEvent({ ...g, foxPowerLost: true }, "🦊 Le Renard perd son flair — aucun loup dans le groupe inspecté", "power"));
    }
    return { hasWolf };
  };

  const gmGitaneSwap = async (targetId: string) => {
    await _update((g) => {
      const gitane = g.players.find((p) => p.role === "gitane" && p.status !== "dead");
      if (!gitane) return g;
      const target = g.players.find((p) => p.id === targetId);
      if (!target) return g;
      const gitaneRole = gitane.role ?? "gitane";
      const targetRole = target.role ?? "villager";
      const withEvent = addHistoryEvent(g, `🔮 La Gitane échange secrètement son rôle avec ${target.name}`, "power");
      return {
        ...withEvent,
        gitaneUsed: true,
        players: withEvent.players.map((p) => {
          if (p.id === gitane.id) return { ...p, role: targetRole };
          if (p.id === targetId) return { ...p, role: gitaneRole };
          return p;
        }),
      };
    });
  };

  const gmSalvatorProtect = async (targetId: string) => {
    await _update((g) => ({ ...g, nightActions: { ...g.nightActions, salvatorTarget: targetId } }));
  };

  const gmWhitewolfKill = async (targetId: string | null) => {
    await _update((g) => ({ ...g, nightActions: { ...g.nightActions, whitewolfTarget: targetId } }));
  };

  const gmInfectTarget = async (targetId: string | null) => {
    await _update((g) => ({ ...g, nightActions: { ...g.nightActions, infectTarget: targetId } }));
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
    if (voter.hasVotingRight === false) return; // Idiot du Village sans droit de vote

    const newVotesByPlayer = { ...(current.votesByPlayer ?? {}), [voterId]: targetId };
    const capitaineId = current.players.find((p) => p.isCapitaine)?.id;
    const corbeauTarget = current.corbeauTarget ?? null;
    const players = current.players.map((p) => ({
      ...p,
      votes: Object.entries(newVotesByPlayer)
        .filter(([, tid]) => tid === p.id)
        .reduce((sum, [vid]) => sum + (vid === capitaineId ? 2 : 1), 0)
        + (corbeauTarget === p.id ? 2 : 0),
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

    const action = current.pendingPlayerActions?.find((a) => a.id === actionId);

    // Voyante : enrichir le résultat avec le nom et le rôle de la cible
    let enrichedPayload = payload;
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

    // 1. Marquer l'action comme résolue (status → "resolved", result = payload)
    let newState = resolvePlayerAction(current, actionId, enrichedPayload);

    // 2. Appliquer les effets secondaires sur le game state selon le type d'action.
    //    Sans ça, resolveNight lit nightActions encore vide → les décisions joueur sont perdues.
    if (action?.type === "witch_choose_potions") {
      if (payload.save === true) {
        newState = witchSave(newState);
      }
      if (payload.killTargetId && typeof payload.killTargetId === "string") {
        newState = witchKill(newState, payload.killTargetId);
      }
    } else if (action?.type === "cupid_choose_lovers") {
      if (typeof payload.lover1Id === "string" && typeof payload.lover2Id === "string") {
        newState = cupidLink(newState, payload.lover1Id, payload.lover2Id);
      }
    }

    gameRef.current = newState;
    dispatch({ type: "SET_GAME", game: newState });
    await updateSessionState(gameIdRef.current, newState);
  };

  // ── Corbeau : désigner une cible (+ 2 votes) ──────────────────────────────────
  const corbeauSetTarget = async (targetId: string) => {
    await _update((g) => ({ ...g, corbeauTarget: targetId }));
  };

  // ── Chien-Loup : choisir son camp (côté joueur) ────────────────────────────
  const chienLoupChoose = async (choice: "wolves" | "village") => {
    const playerId = playerIdRef.current;
    if (!playerId) return;
    await _update((g) => {
      const chienLoupChoice = { ...(g.chienLoupChoice ?? {}), [playerId]: choice };
      const players = g.players.map((p) =>
        p.id === playerId
          ? { ...p, role: choice === "wolves" ? "werewolf" : p.role }
          : p
      );
      return { ...g, players, chienLoupChoice };
    });
  };

  // ── Chien-Loup : choisir son camp (côté MJ — NightWizard) ──────────────────
  const gmChienLoupAssign = async (playerId: string, choice: "wolves" | "village") => {
    await _update((g) => {
      const chienLoupChoice = { ...(g.chienLoupChoice ?? {}), [playerId]: choice };
      const players = g.players.map((p) =>
        p.id === playerId ? { ...p, role: choice === "wolves" ? "werewolf" : p.role } : p
      );
      const label = choice === "wolves" ? "rejoint la meute" : "reste du côté du Village";
      const name = g.players.find((p) => p.id === playerId)?.name ?? "?";
      return addHistoryEvent({ ...g, players, chienLoupChoice }, `🐕 ${name} (Chien-Loup) ${label}`, "power");
    });
  };

  const gmVoleurSetup = async (cards: string[]) => {
    await _update((g) => ({ ...g, voleurCards: cards }));
  };

  const gmVoleurChoose = async (roleId: string | null) => {
    await _update((g) => {
      const voleur = g.players.find((p) => p.role === "voleur" && p.status !== "dead");
      if (!voleur) return { ...g, voleurCards: null };
      if (!roleId) {
        // garde sa carte
        return addHistoryEvent({ ...g, voleurCards: null }, `🃏 ${voleur.name} (Voleur) garde sa carte`, "power");
      }
      const roleMeta = ROLES_MAP[roleId];
      const withEvent = addHistoryEvent({ ...g, voleurCards: null }, `🃏 ${voleur.name} (Voleur) échange sa carte contre ${roleMeta?.name ?? roleId}`, "power");
      return {
        ...withEvent,
        players: withEvent.players.map((p) => p.id === voleur.id ? { ...p, role: roleId } : p),
      };
    });
  };

  const gmComedienSetRoles = async (roleIds: string[]) => {
    await _update((g) => ({ ...g, comedienRoles: roleIds, comedienUsed: [] }));
  };

  const gmSetPlayerOrder = async (order: string[]) => {
    await _update((g) => ({ ...g, playerOrder: order }));
  };

  const gmComedienChooseRole = async (roleId: string) => {
    await _update((g) => {
      const comedien = g.players.find((p) => p.role === "comedien" && p.status !== "dead");
      const roleMeta = ROLES_MAP[roleId];
      const used = [...new Set([...(g.comedienUsed ?? []), roleId])];
      return addHistoryEvent(
        { ...g, comedienUsed: used },
        `🎭 ${comedien?.name ?? "Comédien"} joue le rôle de ${roleMeta?.name ?? roleId} cette nuit`,
        "power"
      );
    });
  };

  // ── Servante Dévouée : transférer le rôle d'un mort ────────────────────────────
  const gmTransferRole = async (fromPlayerId: string, toPlayerId: string) => {
    await _update((g) => {
      const from = g.players.find((p) => p.id === fromPlayerId);
      if (!from) return g;
      const withEvent = addHistoryEvent(
        g,
        `🧹 La Servante Dévouée récupère secrètement la carte de ${from.name}`,
        "power"
      );
      return {
        ...withEvent,
        players: withEvent.players.map((p) =>
          p.id === toPlayerId ? { ...p, role: from.role } : p
        ),
      };
    });
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
        corbeauSetTarget, chienLoupChoose, gmChienLoupAssign, gmTransferRole,
        gmSalvatorProtect, gmWhitewolfKill, gmInfectTarget,
        gmWildChildSetModel, gmSectaireChoose, gmJudgeTrigger,
        gmRenardInspect, gmGitaneSwap, gmFluteEnchant,
        gmPyromaniacSpray, gmPyromaniacPrepareIgnite,
        gmVoleurSetup, gmVoleurChoose, gmComedienSetRoles, gmComedienChooseRole,
        gmSetPlayerOrder, gmStartNight, playerScanRole, gmAssignRole,
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
