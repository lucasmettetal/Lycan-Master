import type { GameState, PlayerActionType } from "./types";

export function createPlayerAction(
  game: GameState,
  {
    playerId,
    type,
    title,
    description,
    targets = [],
    minTargets = 1,
    maxTargets = 1,
    context = null,
  }: {
    playerId: string;
    type: PlayerActionType;
    title: string;
    description: string;
    targets?: string[];
    minTargets?: number;
    maxTargets?: number;
    context?: Record<string, unknown> | null;
  }
): GameState {
  const action = {
    id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    type,
    title,
    description,
    targets,
    minTargets,
    maxTargets,
    status: "pending" as const,
    result: null,
    context,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  return { ...game, pendingPlayerActions: [...(game.pendingPlayerActions ?? []), action] };
}

export function resolvePlayerAction(
  game: GameState,
  actionId: string,
  payload: Record<string, unknown>
): GameState {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.id === actionId && a.status === "pending"
        ? { ...a, status: "resolved" as const, result: payload, resolvedAt: new Date().toISOString() }
        : a
    ),
  };
}

export function cancelPlayerAction(game: GameState, actionId: string): GameState {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.id === actionId && a.status === "pending" ? { ...a, status: "cancelled" as const } : a
    ),
  };
}

export function cancelActionsOfType(game: GameState, playerId: string, type: PlayerActionType): GameState {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.playerId === playerId && a.type === type && a.status === "pending"
        ? { ...a, status: "cancelled" as const }
        : a
    ),
  };
}

export function cancelActionsOfTypes(game: GameState, types: PlayerActionType[]): GameState {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      types.includes(a.type) && a.status === "pending" ? { ...a, status: "cancelled" as const } : a
    ),
  };
}

export function processHunterQueue(game: GameState, prevHunterIds: string[]): GameState {
  const newIds = (game.pendingHunterActions ?? []).filter((id) => !prevHunterIds.includes(id));
  let g = game;
  for (const hunterId of newIds) {
    g = cancelActionsOfType(g, hunterId, "hunter_choose_target");
    const alivePlayers = g.players.filter((p) => p.status !== "dead");
    g = createPlayerAction(g, {
      playerId: hunterId,
      type: "hunter_choose_target",
      title: "Dernier tir",
      description: "Tu viens d'être éliminé(e). Désigne un joueur pour tirer ta dernière flèche.",
      targets: alivePlayers.map((p) => p.id),
      minTargets: 1,
      maxTargets: 1,
    });
  }
  return g;
}
