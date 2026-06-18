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
  hasVotingRight?: boolean;
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
  winner?: "wolves" | "village" | "draw" | "angel" | null;
  players: Player[];
  selectedRoles: RoleConfig[];
  history: HistoryEvent[];
  witchPotions: { life: boolean; death: boolean };
  cupidLovers: string[];
  nightActions: { wolvesTarget: string | null; witchSaved: boolean; witchKillTarget: string | null };
  pendingHunterActions: string[];
  pendingPlayerActions: PlayerAction[];
  votesByPlayer: Record<string, string>; // voterPlayerId → targetPlayerId
  phaseTimer: { duration: number; remaining: number; startedAt: number | null; running: boolean };
  createdAt: string;
}

export interface PlayerView {
  gameId: string;
  gameName: string;
  phase: GamePhase;
  phaseNumber: number;
  winner?: "wolves" | "village" | "draw" | "angel" | null;
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
