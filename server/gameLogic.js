const { ROLES_MAP } = require("./roles");

// ── Attribution des rôles ────────────────────────────────────────────────────

function assignRoles(game) {
  const pool = [];
  for (const roleConf of game.selectedRoles) {
    for (let i = 0; i < roleConf.count; i++) pool.push(roleConf.id);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const players = game.players.map((p, i) => ({
    ...p,
    role: pool[i] || "villager",
    status: "alive",
  }));
  return { ...game, players };
}

// ── Phases ────────────────────────────────────────────────────────────────────

const PHASE_ORDER = ["night", "day", "vote"];

function nextPhase(game) {
  let nextPhaseName;
  let nextPhaseNumber = game.phaseNumber;

  if (game.phase === "waiting") {
    nextPhaseName = "night";
    nextPhaseNumber = 1;
  } else if (game.phase === "vote") {
    nextPhaseName = "night";
    nextPhaseNumber = game.phaseNumber + 1;
  } else {
    const idx = PHASE_ORDER.indexOf(game.phase);
    nextPhaseName = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
  }

  const label = nextPhaseName === "night" ? `Nuit ${nextPhaseNumber}` : `Jour ${nextPhaseNumber}`;
  const event = {
    id: Date.now().toString(),
    type: nextPhaseName === "night" ? "night" : nextPhaseName === "day" ? "day" : "vote",
    text: nextPhaseName === "night"
      ? `Nuit ${nextPhaseNumber} commence`
      : nextPhaseName === "day"
      ? `Jour ${nextPhaseNumber} — réveil du village`
      : `Vote lancé — Jour ${nextPhaseNumber}`,
    phase: label,
    time: _time(),
  };

  const timer = game.phaseTimer ?? { duration: 300, remaining: 300, startedAt: null, running: false };
  return {
    ...game,
    phase: nextPhaseName,
    phaseNumber: nextPhaseNumber,
    history: [...game.history, event],
    players: nextPhaseName === "vote"
      ? game.players.map((p) => ({ ...p, votes: 0 }))
      : game.players,
    nightActions: nextPhaseName === "night"
      ? { wolvesTarget: null, witchSaved: false, witchKillTarget: null }
      : game.nightActions,
    phaseTimer: { ...timer, remaining: timer.duration, startedAt: null, running: false },
  };
}

// ── Actions nocturnes ─────────────────────────────────────────────────────────

function setWolvesTarget(game, targetId) {
  return { ...game, nightActions: { ...game.nightActions, wolvesTarget: targetId } };
}

function witchSave(game) {
  return {
    ...game,
    nightActions: { ...game.nightActions, witchSaved: true },
    witchPotions: { ...game.witchPotions, life: false },
  };
}

function witchKill(game, targetId) {
  return {
    ...game,
    nightActions: { ...game.nightActions, witchKillTarget: targetId },
    witchPotions: { ...game.witchPotions, death: false },
  };
}

function cupidLink(game, lover1Id, lover2Id) {
  const l1 = game.players.find((p) => p.id === lover1Id);
  const l2 = game.players.find((p) => p.id === lover2Id);
  const event = _evt("power", `Cupidon unit ${l1?.name} et ${l2?.name} pour l'éternité`, game);
  return { ...game, cupidLovers: [lover1Id, lover2Id], history: [...game.history, event] };
}

// Tue un joueur avec toutes les cascades : Chasseur + amoureux Cupidon
function killPlayer(game, playerId, reason = "vote") {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || player.status === "dead") return game;

  const eventText = {
    vote: `${player.name} est éliminé(e) par le vote du village`,
    night: `${player.name} est retrouvé(e) mort(e) cette nuit`,
    hunter_shot: `${player.name} est touché(e) par la flèche du Chasseur`,
    witch: `${player.name} est tué(e) par la potion de mort de la Sorcière`,
  }[reason] ?? `${player.name} est éliminé(e)`;

  let g = {
    ...game,
    players: game.players.map((p) => p.id === playerId ? { ...p, status: "dead" } : p),
    history: [...game.history, _evt(reason === "vote" ? "vote" : "power", eventText, game)],
  };

  // Chasseur : mise en file d'attente de son tir
  if (player.role === "hunter") {
    g = { ...g, pendingHunterActions: [...(g.pendingHunterActions ?? []), playerId] };
  }

  // Amoureux Cupidon : l'autre meurt de chagrin
  if (game.cupidLovers.includes(playerId)) {
    const otherId = game.cupidLovers.find((id) => id !== playerId);
    const other = g.players.find((p) => p.id === otherId);
    if (other && other.status !== "dead") {
      g = {
        ...g,
        players: g.players.map((p) => p.id === otherId ? { ...p, status: "dead" } : p),
        history: [...g.history, _evt("power", `${other.name} meurt de chagrin (lié(e) par Cupidon)`, g)],
      };
      if (other.role === "hunter") {
        g = { ...g, pendingHunterActions: [...(g.pendingHunterActions ?? []), otherId] };
      }
    }
  }

  return g;
}

// Applique toutes les décisions de la nuit et passe en phase jour
function resolveNight(game) {
  const { nightActions, phaseNumber } = game;
  let g = game;
  const label = `Nuit ${phaseNumber}`;

  // 1. Cible des Loups (sauf si la Sorcière a sauvé)
  if (nightActions.wolvesTarget) {
    const victim = g.players.find((p) => p.id === nightActions.wolvesTarget);
    if (victim && victim.status !== "dead") {
      if (nightActions.witchSaved) {
        g = { ...g, history: [...g.history, { id: Date.now().toString(), type: "power", text: `${victim.name} a été sauvé(e) par la Sorcière`, phase: label, time: _time() }] };
      } else {
        g = killPlayer(g, victim.id, "night");
      }
    }
  } else {
    g = { ...g, history: [...g.history, { id: Date.now().toString(), type: "night", text: "Les Loups n'ont tué personne cette nuit", phase: label, time: _time() }] };
  }

  // 2. Potion de mort de la Sorcière
  if (nightActions.witchKillTarget) {
    const target = g.players.find((p) => p.id === nightActions.witchKillTarget);
    if (target && target.status !== "dead") {
      g = killPlayer(g, target.id, "witch");
    }
  }

  return nextPhase(g);
}

// Le Chasseur tire sa dernière flèche
function hunterShoot(game, hunterId, targetId) {
  const hunter = game.players.find((p) => p.id === hunterId);
  const target = game.players.find((p) => p.id === targetId);
  if (!hunter || !target) return game;

  let g = { ...game, pendingHunterActions: game.pendingHunterActions.filter((id) => id !== hunterId) };
  g = { ...g, history: [...g.history, _evt("power", `🏹 ${hunter.name} tire sa dernière flèche sur ${target.name}`, g)] };
  g = killPlayer(g, targetId, "hunter_shot");
  return g;
}

// ── Éliminations / Capitaine / Fin ─────────────────────────────────────────

function eliminatePlayer(game, playerId, reason = "vote") {
  return killPlayer(game, playerId, reason);
}

function endGame(game, winner) {
  const text = winner === "wolves"
    ? "🐺 Les Loups-Garous ont gagné !"
    : winner === "village"
    ? "🏡 Le Village a gagné !"
    : "La partie est terminée";

  const event = { id: Date.now().toString(), type: "day", text, phase: "Fin de partie", time: _time() };
  return { ...game, phase: "end", status: "finished", history: [...game.history, event] };
}

function addHistoryEvent(game, text, type = "day") {
  return { ...game, history: [...game.history, _evt(type, text, game)] };
}

// ── Vue joueur ────────────────────────────────────────────────────────────────

function buildPlayerView(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;

  const roleData = ROLES_MAP[player.role] || null;
  const instruction = roleData?.instructions?.[game.phase] || "Attends les instructions du Maître du Jeu.";

  const pendingActions = (game.pendingPlayerActions ?? []).filter(
    (a) => a.playerId === playerId && a.status === "pending"
  );
  const resolvedActions = (game.pendingPlayerActions ?? [])
    .filter((a) => a.playerId === playerId && a.status === "resolved")
    .slice(-5);

  return {
    gameId: game.id,
    gameName: game.name,
    phase: game.phase,
    phaseNumber: game.phaseNumber,
    player: {
      id: player.id,
      name: player.name,
      role: player.role,
      roleData,
      status: player.status,
      isCapitaine: player.isCapitaine,
    },
    instruction,
    isLover: game.cupidLovers.includes(playerId),
    alivePlayers: game.players
      .filter((p) => p.status !== "dead")
      .map((p) => ({ id: p.id, name: p.name, status: p.status, votes: p.votes })),
    currentVotes: game.phase === "vote"
      ? game.players.map((p) => ({ id: p.id, name: p.name, votes: p.votes, status: p.status }))
      : [],
    pendingActions,
    resolvedActions,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _time() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function _evt(type, text, game) {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    type,
    text,
    phase: game.phase === "night" ? `Nuit ${game.phaseNumber}` : `Jour ${game.phaseNumber}`,
    time: _time(),
  };
}

module.exports = {
  assignRoles, nextPhase,
  setWolvesTarget, witchSave, witchKill, cupidLink, resolveNight,
  killPlayer, hunterShoot,
  eliminatePlayer, endGame, addHistoryEvent,
  buildPlayerView,
};
