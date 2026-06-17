import type { GameState, HistoryEvent } from "./types";
import { ROLES_MAP } from "./roles";

// ── Attribution des rôles ─────────────────────────────────────────────────────

export function assignRoles(game: GameState): GameState {
  const pool: string[] = [];
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
    status: "alive" as const,
  }));
  return { ...game, players };
}

// ── Phases ────────────────────────────────────────────────────────────────────

const PHASE_ORDER = ["night", "day", "vote"] as const;

export function nextPhase(game: GameState): GameState {
  if (game.status === "finished") return game;
  let nextPhaseName: string;
  let nextPhaseNumber = game.phaseNumber;

  if (game.phase === "waiting") {
    nextPhaseName = "night";
    nextPhaseNumber = 1;
  } else if (game.phase === "vote") {
    nextPhaseName = "night";
    nextPhaseNumber = game.phaseNumber + 1;
  } else {
    const idx = PHASE_ORDER.indexOf(game.phase as typeof PHASE_ORDER[number]);
    nextPhaseName = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
  }

  const label = nextPhaseName === "night" ? `Nuit ${nextPhaseNumber}` : `Jour ${nextPhaseNumber}`;
  const event: HistoryEvent = {
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
    phase: nextPhaseName as GameState["phase"],
    phaseNumber: nextPhaseNumber,
    history: [...game.history, event],
    players: nextPhaseName === "vote"
      ? game.players.map((p) => ({ ...p, votes: 0 }))
      : game.players,
    votesByPlayer: nextPhaseName === "vote" ? {} : (game.votesByPlayer ?? {}),
    nightActions: nextPhaseName === "night"
      ? { wolvesTarget: null, witchSaved: false, witchKillTarget: null }
      : game.nightActions,
    phaseTimer: { ...timer, remaining: timer.duration, startedAt: null, running: false },
  };
}

// ── Actions nocturnes ─────────────────────────────────────────────────────────

export function setWolvesTarget(game: GameState, targetId: string): GameState {
  return { ...game, nightActions: { ...game.nightActions, wolvesTarget: targetId } };
}

export function witchSave(game: GameState): GameState {
  return {
    ...game,
    nightActions: { ...game.nightActions, witchSaved: true },
    witchPotions: { ...game.witchPotions, life: false },
  };
}

export function witchKill(game: GameState, targetId: string): GameState {
  const target = game.players.find((p) => p.id === targetId);
  if (!target) {
    console.warn("[Sorcière] cible introuvable:", targetId);
    return game;
  }
  if (target.status === "dead") {
    console.warn("[Sorcière] cible déjà morte:", target.name);
    return game;
  }
  const witch = game.players.find((p) => p.role === "witch" && p.status !== "dead");
  if (witch && targetId === witch.id) {
    console.warn("[Sorcière] ne peut pas se cibler elle-même");
    return game;
  }
  console.log("[Sorcière] potion de mort → cible:", target.name, "| potions avant:", game.witchPotions);
  return {
    ...game,
    nightActions: { ...(game.nightActions ?? {}), witchKillTarget: targetId },
    witchPotions: { ...(game.witchPotions ?? { life: true, death: true }), death: false },
  };
}

export function cupidLink(game: GameState, lover1Id: string, lover2Id: string): GameState {
  const l1 = game.players.find((p) => p.id === lover1Id);
  const l2 = game.players.find((p) => p.id === lover2Id);
  const event = _evt("power", `Cupidon unit ${l1?.name} et ${l2?.name} pour l'éternité`, game);
  return { ...game, cupidLovers: [lover1Id, lover2Id], history: [...game.history, event] };
}

export function killPlayer(game: GameState, playerId: string, reason = "vote"): GameState {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || player.status === "dead") return game;

  const eventText = ({
    vote: `${player.name} est éliminé(e) par le vote du village`,
    night: `${player.name} est retrouvé(e) mort(e) cette nuit`,
    hunter_shot: `${player.name} est touché(e) par la flèche du Chasseur`,
    witch: `${player.name} est tué(e) par la potion de mort de la Sorcière`,
  } as Record<string, string>)[reason] ?? `${player.name} est éliminé(e)`;

  let g: GameState = {
    ...game,
    players: game.players.map((p) => p.id === playerId ? { ...p, status: "dead" as const } : p),
    history: [...game.history, _evt(reason === "vote" ? "vote" : "power", eventText, game)],
  };

  if (player.role === "hunter") {
    g = { ...g, pendingHunterActions: [...(g.pendingHunterActions ?? []), playerId] };
  }

  if (game.cupidLovers.includes(playerId)) {
    const otherId = game.cupidLovers.find((id) => id !== playerId);
    const other = g.players.find((p) => p.id === otherId);
    if (other && other.status !== "dead") {
      g = {
        ...g,
        players: g.players.map((p) => p.id === otherId ? { ...p, status: "dead" as const } : p),
        history: [...g.history, _evt("power", `${other.name} meurt de chagrin (lié(e) par Cupidon)`, g)],
      };
      if (other.role === "hunter") {
        g = { ...g, pendingHunterActions: [...(g.pendingHunterActions ?? []), otherId] };
      }
    }
  }

  return g;
}

export function resolveNight(game: GameState): GameState {
  const na = game.nightActions ?? { wolvesTarget: null, witchSaved: false, witchKillTarget: null };
  const { phaseNumber } = game;
  let g = { ...game, nightActions: na };
  const label = `Nuit ${phaseNumber}`;

  console.log("[Sorcière] wolvesVictimId:", na.wolvesTarget ?? "aucun");
  console.log("[Sorcière] saveUsed:", na.witchSaved);
  console.log("[Sorcière] killTargetId:", na.witchKillTarget ?? "aucun");
  console.log("[Sorcière] witchPotions before:", game.witchPotions);

  // Construire la liste des morts (Map id → raison)
  const deaths = new Map<string, "night" | "witch">();

  if (na.wolvesTarget && !na.witchSaved) {
    const victim = g.players.find((p) => p.id === na.wolvesTarget && p.status !== "dead");
    if (victim) deaths.set(na.wolvesTarget, "night");
  }
  if (na.witchKillTarget) {
    const target = g.players.find((p) => p.id === na.witchKillTarget && p.status !== "dead");
    if (target) {
      deaths.set(na.witchKillTarget, "witch");
    } else {
      const found = g.players.find((p) => p.id === na.witchKillTarget);
      console.warn("[Sorcière] witchKillTarget ignoré:", na.witchKillTarget, found ? "(déjà mort)" : "(introuvable)");
    }
  }

  console.log("[Sorcière] deaths final before killPlayer:", [...deaths.entries()].map(([id, r]) => `${g.players.find((p) => p.id === id)?.name ?? id}(${r})`));

  // Événement histoire : sort des loups (avant les morts pour ordre chronologique)
  if (!na.wolvesTarget) {
    g = { ...g, history: [...g.history, { id: Date.now().toString(), type: "night" as const, text: "Les Loups n'ont tué personne cette nuit", phase: label, time: _time() }] };
  } else if (na.witchSaved) {
    const saved = g.players.find((p) => p.id === na.wolvesTarget);
    if (saved) {
      g = { ...g, history: [...g.history, { id: Date.now().toString(), type: "power" as const, text: `${saved.name} a été sauvé(e) par la Sorcière`, phase: label, time: _time() }] };
    }
  }

  // Appliquer toutes les morts (killPlayer gère déjà le guard "déjà mort")
  for (const [id, reason] of deaths) {
    const player = g.players.find((p) => p.id === id);
    if (!player || player.status === "dead") continue;
    console.log(`[Sorcière] tuer ${player.name} (${reason})`);
    g = killPlayer(g, id, reason);
  }

  console.log("[Sorcière] joueurs vivants après:", g.players.filter((p) => p.status !== "dead").map((p) => p.name));
  const result = checkWinCondition(nextPhase(g));
  console.log("[Sorcière] resolveNight success: phase=", result.phase, "| status=", result.status, "| winner=", result.winner ?? "—");
  return result;
}

export function hunterShoot(game: GameState, hunterId: string, targetId: string): GameState {
  const hunter = game.players.find((p) => p.id === hunterId);
  const target = game.players.find((p) => p.id === targetId);
  if (!hunter || !target) return game;

  let g = { ...game, pendingHunterActions: game.pendingHunterActions.filter((id) => id !== hunterId) };
  g = { ...g, history: [...g.history, _evt("power", `🏹 ${hunter.name} tire sa dernière flèche sur ${target.name}`, g)] };
  g = killPlayer(g, targetId, "hunter_shot");
  return checkWinCondition(g);
}

export function eliminatePlayer(game: GameState, playerId: string, reason = "vote"): GameState {
  return checkWinCondition(killPlayer(game, playerId, reason));
}

export function endGame(game: GameState, winner: "wolves" | "village" | "draw"): GameState {
  const text = winner === "wolves"
    ? "🐺 Les Loups-Garous ont gagné !"
    : winner === "village"
    ? "🏡 Le Village a gagné : tous les Loups-Garous sont éliminés !"
    : "La partie est terminée";

  const event: HistoryEvent = { id: Date.now().toString(), type: "day", text, phase: "Fin de partie", time: _time() };
  return {
    ...game,
    phase: "end",
    status: "finished",
    winner,
    pendingHunterActions: [],
    pendingPlayerActions: (game.pendingPlayerActions ?? []).map((a) =>
      a.status === "pending" ? { ...a, status: "cancelled" as const } : a
    ),
    history: [...game.history, event],
  };
}

export function checkWinCondition(game: GameState): GameState {
  if (game.status !== "running") return game;
  if ((game.pendingHunterActions ?? []).length > 0) return game; // attendre le tir du Chasseur

  const alive = game.players.filter((p) => p.status !== "dead");
  const wolvesAlive = alive.filter((p) => ROLES_MAP[p.role ?? ""]?.team === "wolves");
  const nonWolvesAlive = alive.filter((p) => ROLES_MAP[p.role ?? ""]?.team !== "wolves");

  if (wolvesAlive.length === 0) {
    return endGame(game, "village");
  }
  if (nonWolvesAlive.length === 0 || wolvesAlive.length >= nonWolvesAlive.length) {
    return endGame(game, "wolves");
  }
  return game;
}

export function addHistoryEvent(game: GameState, text: string, type: HistoryEvent["type"] = "day"): GameState {
  return { ...game, history: [...game.history, _evt(type, text, game)] };
}

export function setCaptain(game: GameState, playerId: string): GameState {
  return {
    ...game,
    players: game.players.map((p) => ({ ...p, isCapitaine: p.id === playerId })),
  };
}

// ── Vue joueur ────────────────────────────────────────────────────────────────

export function buildPlayerView(game: GameState, playerId: string) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;

  const roleData = ROLES_MAP[player.role ?? ""] || null;
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
    winner: game.winner ?? null,
    player: {
      id: player.id,
      name: player.name,
      role: player.role ?? "",
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

// ── Normalisation (état chargé depuis Supabase) ────────────────────────────────

export function normaliseGameState(g: GameState): GameState {
  return {
    ...g,
    winner: g.winner ?? null,
    players: (g.players ?? []).map((p) => ({
      ...p,
      role: p.role ?? null,
      status: p.status ?? "alive",
      isConnected: p.isConnected ?? false,
      isCapitaine: p.isCapitaine ?? false,
      votes: p.votes ?? 0,
      socketId: p.socketId ?? null,
    })),
    selectedRoles: g.selectedRoles ?? [],
    history: g.history ?? [],
    cupidLovers: g.cupidLovers ?? [],
    pendingHunterActions: g.pendingHunterActions ?? [],
    pendingPlayerActions: g.pendingPlayerActions ?? [],
    votesByPlayer: g.votesByPlayer ?? {},
    witchPotions: g.witchPotions ?? { life: true, death: true },
    nightActions: g.nightActions ?? { wolvesTarget: null, witchSaved: false, witchKillTarget: null },
    phaseTimer: g.phaseTimer ?? { duration: 300, remaining: 300, startedAt: null, running: false },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _time(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function _evt(type: HistoryEvent["type"], text: string, game: GameState): HistoryEvent {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    type,
    text,
    phase: game.phase === "night" ? `Nuit ${game.phaseNumber}` : `Jour ${game.phaseNumber}`,
    time: _time(),
  };
}
