// Système générique d'actions privées joueur

function createPlayerAction(game, {
  playerId, type, title, description,
  targets = [], minTargets = 1, maxTargets = 1,
  context = null,
}) {
  const action = {
    id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    type,
    title,
    description,
    targets,
    minTargets,
    maxTargets,
    status: "pending",
    result: null,
    context,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  return { ...game, pendingPlayerActions: [...(game.pendingPlayerActions ?? []), action] };
}

function resolvePlayerAction(game, actionId, payload) {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.id === actionId && a.status === "pending"
        ? { ...a, status: "resolved", result: payload, resolvedAt: new Date().toISOString() }
        : a
    ),
  };
}

function cancelPlayerAction(game, actionId) {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.id === actionId && a.status === "pending" ? { ...a, status: "cancelled" } : a
    ),
  };
}

// Annule toutes les actions pending d'un type pour un joueur
function cancelActionsOfType(game, playerId, type) {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.playerId === playerId && a.type === type && a.status === "pending"
        ? { ...a, status: "cancelled" }
        : a
    ),
  };
}

// Annule toutes les actions pending d'une liste de types (sans restriction joueur)
function cancelActionsOfTypes(game, types) {
  return {
    ...game,
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      types.includes(a.type) && a.status === "pending" ? { ...a, status: "cancelled" } : a
    ),
  };
}

function getPendingActionsForPlayer(game, playerId) {
  return (game.pendingPlayerActions ?? []).filter(
    (a) => a.playerId === playerId && a.status === "pending"
  );
}

function getResolvedActionsForPlayer(game, playerId) {
  return (game.pendingPlayerActions ?? []).filter(
    (a) => a.playerId === playerId && a.status === "resolved"
  );
}

// Crée des actions hunter_choose_target pour les nouveaux chasseurs dans la file
function processHunterQueue(game, prevHunterIds) {
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

module.exports = {
  createPlayerAction,
  resolvePlayerAction,
  cancelPlayerAction,
  cancelActionsOfType,
  cancelActionsOfTypes,
  getPendingActionsForPlayer,
  getResolvedActionsForPlayer,
  processHunterQueue,
};
