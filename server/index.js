const path = require("path");
// Charge server/.env.local en priorité, puis server/.env en fallback
require("dotenv").config({ path: [path.resolve(__dirname, ".env.local"), path.resolve(__dirname, ".env")], quiet: true });
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const { createGame, getGame, updateGame, getGameBySocketId } = require("./gameStore");
const {
  assignRoles, nextPhase,
  setWolvesTarget, witchSave, witchKill, cupidLink, resolveNight,
  hunterShoot,
  eliminatePlayer, endGame, addHistoryEvent,
  buildPlayerView,
} = require("./gameLogic");
const {
  createPlayerAction, resolvePlayerAction,
  cancelPlayerAction, cancelActionsOfType, cancelActionsOfTypes,
  getPendingActionsForPlayer, processHunterQueue,
} = require("./playerActions");
const { ROLES_MAP } = require("./roles");

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const io = new Server(server, { cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] } });

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// ── REST ──────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Backend API running" });
});

app.get("/api/game/:code/qr", async (req, res) => {
  const game = getGame(req.params.code);
  if (!game) return res.status(404).json({ error: "Partie introuvable" });
  const clientUrl = req.query.clientUrl || "http://localhost:5173";
  const joinUrl = `${clientUrl}/join/${req.params.code}`;
  try {
    const qr = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
    res.json({ qr, url: joinUrl });
  } catch {
    res.status(500).json({ error: "Erreur QR" });
  }
});

app.get("/api/game/:code", (req, res) => {
  const game = getGame(req.params.code);
  if (!game) return res.status(404).json({ error: "Partie introuvable" });
  res.json({ id: game.id, name: game.name, status: game.status, playerCount: game.playerCount });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function emitGameState(game) {
  io.to(`gm:${game.id}`).emit("game:state", game);
  for (const player of game.players) {
    if (player.socketId) {
      io.to(player.socketId).emit("player:state", buildPlayerView(game, player.id));
    }
  }
}

// ── Socket.io ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  // ─ MJ : créer ──────────────────────────────────────────────────────────────
  socket.on("gm:create", ({ name, playerCount, mode }, ack) => {
    const game = createGame({ name, gmSocketId: socket.id, playerCount, mode });
    socket.join(`gm:${game.id}`);
    socket.join(`game:${game.id}`);
    socket.data.gameId = game.id;
    socket.data.isGM = true;
    console.log(`[game] Créée : ${game.id} — "${game.name}"`);
    ack?.({ ok: true, gameId: game.id });
  });

  // ─ MJ : définir les rôles ──────────────────────────────────────────────────
  socket.on("gm:set_roles", ({ gameId, roles }, ack) => {
    const game = updateGame(gameId, (g) => ({ ...g, selectedRoles: roles }));
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });
    ack?.({ ok: true });
  });

  // ─ MJ : lancer la partie ──────────────────────────────────────────────────
  socket.on("gm:start", ({ gameId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });
    if (!game.players.length) return ack?.({ ok: false, error: "Aucun joueur" });
    const total = game.selectedRoles.reduce((s, r) => s + r.count, 0);
    if (total !== game.players.length)
      return ack?.({ ok: false, error: `${total} rôles pour ${game.players.length} joueurs` });

    game = assignRoles(game);
    game = nextPhase(game);
    game = { ...game, status: "running" };
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ MJ : ajouter un joueur ─────────────────────────────────────────────────
  socket.on("gm:add_player", ({ gameId, playerName }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g,
      players: [...g.players, {
        id: uuidv4(),
        name: playerName.trim(),
        socketId: null,
        playerToken: uuidv4(),
        role: null,
        status: "alive",
        isConnected: false,
        isCapitaine: false,
        votes: 0,
        lastSeenAt: null,
      }],
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  // ─ MJ : supprimer un joueur ───────────────────────────────────────────────
  socket.on("gm:remove_player", ({ gameId, playerId }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g, players: g.players.filter((p) => p.id !== playerId),
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  // ─ MJ : phase suivante ────────────────────────────────────────────────────
  socket.on("gm:next_phase", ({ gameId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });

    const prevPhase = game.phase;
    game = nextPhase(game);
    const newPhase = game.phase;

    // Annuler les actions de la phase précédente
    if (prevPhase === "night") {
      game = cancelActionsOfTypes(game, ["seer_choose_target", "cupid_choose_lovers", "witch_choose_potions"]);
    } else if (prevPhase === "vote") {
      game = cancelActionsOfTypes(game, ["day_vote"]);
    }

    // Créer des actions pour la nouvelle phase
    if (newPhase === "vote") {
      const alivePlayers = game.players.filter((p) => p.status !== "dead");
      for (const player of alivePlayers) {
        game = createPlayerAction(game, {
          playerId: player.id,
          type: "day_vote",
          title: "Vote du village",
          description: "Désigne le joueur que tu souhaites éliminer.",
          targets: alivePlayers.filter((p) => p.id !== player.id).map((p) => p.id),
          minTargets: 1,
          maxTargets: 1,
        });
      }
    }

    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ MJ : éliminer un joueur ────────────────────────────────────────────────
  socket.on("gm:eliminate", ({ gameId, playerId, reason }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    const prevHunters = game.pendingHunterActions ?? [];
    game = eliminatePlayer(game, playerId, reason);
    game = processHunterQueue(game, prevHunters);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ MJ : désigner le Capitaine ─────────────────────────────────────────────
  socket.on("gm:set_captain", ({ gameId, playerId }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g, players: g.players.map((p) => ({ ...p, isCapitaine: p.id === playerId })),
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  // ─ MJ : terminer la partie ────────────────────────────────────────────────
  socket.on("gm:end_game", ({ gameId, winner }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = endGame(game, winner);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ MJ : journal manuel ────────────────────────────────────────────────────
  socket.on("gm:log_event", ({ gameId, text, type }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = addHistoryEvent(game, text, type);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ══ TIMER ════════════════════════════════════════════════════════════════════

  socket.on("gm:timer_configure", ({ gameId, duration }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g, phaseTimer: { ...g.phaseTimer, duration, remaining: duration },
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  socket.on("gm:timer_start", ({ gameId }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g, phaseTimer: { ...g.phaseTimer, running: true, startedAt: Date.now() },
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  socket.on("gm:timer_pause", ({ gameId }, ack) => {
    const game = updateGame(gameId, (g) => {
      const t = g.phaseTimer;
      const elapsed = t.running && t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : 0;
      const remaining = Math.max(0, t.remaining - elapsed);
      return { ...g, phaseTimer: { ...t, running: false, startedAt: null, remaining } };
    });
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  socket.on("gm:timer_reset", ({ gameId }, ack) => {
    const game = updateGame(gameId, (g) => ({
      ...g, phaseTimer: { ...g.phaseTimer, remaining: g.phaseTimer.duration, startedAt: null, running: false },
    }));
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  socket.on("gm:timer_add", ({ gameId, seconds }, ack) => {
    const game = updateGame(gameId, (g) => {
      const t = g.phaseTimer;
      const elapsed = t.running && t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : 0;
      const currentRemaining = t.running ? Math.max(0, t.remaining - elapsed) : t.remaining;
      return {
        ...g,
        phaseTimer: { ...t, remaining: currentRemaining + seconds, startedAt: t.running ? Date.now() : null },
      };
    });
    if (!game) return ack?.({ ok: false });
    emitGameState(game);
    ack?.({ ok: true });
  });

  // ══ ACTIONS PRIVÉES ══════════════════════════════════════════════════════════

  // ─ MJ : créer une action privée pour un joueur ────────────────────────────
  socket.on("gm:create_player_action", ({ gameId, action }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });
    game = createPlayerAction(game, action);
    const created = game.pendingPlayerActions[game.pendingPlayerActions.length - 1];
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true, actionId: created.id });
  });

  // ─ MJ : annuler une action privée (override) ──────────────────────────────
  socket.on("gm:cancel_player_action", ({ gameId, actionId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = cancelPlayerAction(game, actionId);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ Joueur : résoudre une action privée ────────────────────────────────────
  socket.on("player:resolve_action", ({ actionId, payload }, ack) => {
    const { gameId, playerId } = socket.data;
    if (!gameId || !playerId) return ack?.({ ok: false, error: "Non identifié" });

    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });

    const action = (game.pendingPlayerActions ?? []).find((a) => a.id === actionId);
    if (!action) return ack?.({ ok: false, error: "Action introuvable" });

    // Sécurité : seul le joueur propriétaire peut résoudre (sauf hunters morts)
    if (action.playerId !== playerId) return ack?.({ ok: false, error: "Action non autorisée" });
    if (action.status !== "pending") return ack?.({ ok: false, error: "Cette action n'est plus disponible" });

    const actionPlayer = game.players.find((p) => p.id === playerId);
    if (actionPlayer?.status === "dead" && action.type !== "hunter_choose_target") {
      return ack?.({ ok: false, error: "Les joueurs morts ne peuvent pas agir" });
    }

    // Enrichir le payload selon le type (ex : révéler le rôle pour la Voyante)
    let enrichedPayload = payload;

    if (action.type === "seer_choose_target") {
      const target = game.players.find((p) => p.id === payload.targetId);
      const roleData = target?.role ? ROLES_MAP[target.role] : null;
      enrichedPayload = { targetId: payload.targetId, targetName: target?.name, role: target?.role, roleData };
    }

    // Marquer l'action comme résolue
    game = resolvePlayerAction(game, actionId, enrichedPayload);

    // Appliquer la logique métier
    const prevHunters = game.pendingHunterActions ?? [];
    switch (action.type) {
      case "seer_choose_target": {
        const { targetName, role, roleData } = enrichedPayload;
        game = addHistoryEvent(game, `🔮 La Voyante a consulté ses visions cette nuit`, "power");
        // Le résultat détaillé (nom + rôle) est dans action.result — visible joueur + MJ
        break;
      }
      case "cupid_choose_lovers": {
        game = cupidLink(game, payload.lover1Id, payload.lover2Id);
        // Notifier les amoureux via leurs vues joueur (déjà géré par emitGameState → buildPlayerView)
        break;
      }
      case "witch_choose_potions": {
        if (payload.save && game.witchPotions?.life) game = witchSave(game);
        if (payload.killTargetId && game.witchPotions?.death) game = witchKill(game, payload.killTargetId);
        if (!payload.save && !payload.killTargetId) {
          game = addHistoryEvent(game, "La Sorcière n'a pas utilisé ses potions cette nuit", "power");
        }
        break;
      }
      case "hunter_choose_target": {
        game = hunterShoot(game, playerId, payload.targetId);
        // hunterShoot retire de pendingHunterActions — pas besoin de cancelActionsOfType ici
        break;
      }
      case "day_vote": {
        const voter = game.players.find((p) => p.id === playerId);
        if (voter && voter.status !== "dead") {
          const voteWeight = voter.isCapitaine ? 2 : 1;
          game = {
            ...game,
            players: game.players.map((p) =>
              p.id === payload.targetId ? { ...p, votes: p.votes + voteWeight } : p
            ),
          };
          const targetName = game.players.find((p) => p.id === payload.targetId)?.name ?? "?";
          game = addHistoryEvent(
            game,
            `${voter.name} vote contre ${targetName}${voter.isCapitaine ? " (vote double ⚔️)" : ""}`,
            "vote"
          );
        }
        break;
      }
    }

    // Processus cascades hunters (ex: cible du vote = chasseur)
    game = processHunterQueue(game, prevHunters);

    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ══ ACTIONS NOCTURNES ════════════════════════════════════════════════════════

  socket.on("gm:wolves_target", ({ gameId, targetId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = setWolvesTarget(game, targetId);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  socket.on("gm:wolves_no_kill", ({ gameId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = setWolvesTarget(game, null);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  socket.on("gm:seer_check", ({ gameId, targetId }, ack) => {
    const game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    const target = game.players.find((p) => p.id === targetId);
    if (!target) return ack?.({ ok: false });
    const roleData = target.role ? ROLES_MAP[target.role] : null;
    const updated = updateGame(gameId, (g) => addHistoryEvent(g,
      `Voyante consulte ${target.name} — ${roleData?.emoji ?? ""} ${roleData?.name ?? target.role}`,
      "power"
    ));
    emitGameState(updated);
    ack?.({ ok: true, name: target.name, role: target.role, roleData });
  });

  socket.on("gm:witch_save", ({ gameId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    if (!game.witchPotions?.life) return ack?.({ ok: false, error: "Potion de vie déjà utilisée" });
    game = witchSave(game);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  socket.on("gm:witch_kill", ({ gameId, targetId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    if (!game.witchPotions?.death) return ack?.({ ok: false, error: "Potion de mort déjà utilisée" });
    game = witchKill(game, targetId);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  socket.on("gm:cupid_link", ({ gameId, lover1Id, lover2Id }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    game = cupidLink(game, lover1Id, lover2Id);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  socket.on("gm:resolve_night", ({ gameId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false });
    const prevHunters = game.pendingHunterActions ?? [];
    game = resolveNight(game);
    game = processHunterQueue(game, prevHunters);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ Chasseur : tire sa dernière flèche après sa mort (voie MJ) ─────────────
  socket.on("gm:hunter_shoot", ({ gameId, hunterId, targetId }, ack) => {
    let game = getGame(gameId);
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });
    const hunter = game.players.find((p) => p.id === hunterId);
    if (!hunter || !game.pendingHunterActions?.includes(hunterId))
      return ack?.({ ok: false, error: "Ce Chasseur n'a pas de tir en attente" });
    game = hunterShoot(game, hunterId, targetId);
    // Annuler l'action phone du chasseur (MJ a déjà géré)
    game = cancelActionsOfType(game, hunterId, "hunter_choose_target");
    // Processus cascades si la cible était aussi un chasseur
    const prevHunters = game.pendingHunterActions ?? [];
    game = processHunterQueue(game, prevHunters);
    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ══ JOUEURS ═══════════════════════════════════════════════════════════════

  socket.on("player:join", ({ gameId, playerName, playerToken }, ack) => {
    const game = getGame(gameId);
    if (!game) return ack?.({ ok: false, error: "Partie introuvable" });
    if (game.status === "finished") return ack?.({ ok: false, error: "Partie terminée" });

    let playerId;
    let updatedGame;

    // ─ Reconnexion par token ──────────────────────────────────────────────────
    if (playerToken) {
      const existing = game.players.find((p) => p.playerToken === playerToken);
      if (existing) {
        playerId = existing.id;
        updatedGame = updateGame(gameId, (g) => ({
          ...g,
          players: g.players.map((p) =>
            p.id === playerId
              ? { ...p, socketId: socket.id, isConnected: true, lastSeenAt: new Date().toISOString() }
              : p
          ),
        }));
        socket.join(`game:${gameId}`);
        socket.data.gameId = gameId;
        socket.data.playerId = playerId;
        emitGameState(updatedGame);
        ack?.({ ok: true, playerId, playerToken, state: buildPlayerView(updatedGame, playerId) });
        console.log(`[player] Reconnexion : ${existing.name} → ${gameId}`);
        return;
      }
      // Token inconnu → continuer avec le flux normal (nom ou erreur)
    }

    // ─ Reconnexion par nom (joueur déjà dans la liste, pas de socket) ─────────
    const existingIdx = game.players.findIndex(
      (p) => p.name.toLowerCase() === (playerName ?? "").trim().toLowerCase() && !p.socketId
    );

    if (existingIdx !== -1) {
      playerId = game.players[existingIdx].id;
      const token = game.players[existingIdx].playerToken;
      updatedGame = updateGame(gameId, (g) => ({
        ...g,
        players: g.players.map((p) =>
          p.id === playerId
            ? { ...p, socketId: socket.id, isConnected: true, lastSeenAt: new Date().toISOString() }
            : p
        ),
      }));
      socket.join(`game:${gameId}`);
      socket.data.gameId = gameId;
      socket.data.playerId = playerId;
      emitGameState(updatedGame);
      ack?.({ ok: true, playerId, playerToken: token, state: buildPlayerView(updatedGame, playerId) });
      console.log(`[player] Reconnexion nom : ${game.players[existingIdx].name} → ${gameId}`);
      return;
    }

    // ─ Nouveau joueur (partie en attente) ─────────────────────────────────────
    if (game.status !== "waiting") {
      return ack?.({ ok: false, error: "Partie déjà commencée. Contacte le MJ." });
    }

    if (!playerName?.trim()) return ack?.({ ok: false, error: "Nom requis" });

    playerId = uuidv4();
    const newToken = uuidv4();
    updatedGame = updateGame(gameId, (g) => ({
      ...g,
      players: [...g.players, {
        id: playerId,
        name: playerName.trim(),
        socketId: socket.id,
        playerToken: newToken,
        role: null,
        status: "alive",
        isConnected: true,
        isCapitaine: false,
        votes: 0,
        lastSeenAt: new Date().toISOString(),
      }],
    }));

    socket.join(`game:${gameId}`);
    socket.data.gameId = gameId;
    socket.data.playerId = playerId;
    emitGameState(updatedGame);
    ack?.({ ok: true, playerId, playerToken: newToken, state: buildPlayerView(updatedGame, playerId) });
    console.log(`[player] Nouveau : ${playerName} → ${gameId}`);
  });

  // ─ Voter (voie historique — reste compatible) ─────────────────────────────
  socket.on("player:vote", ({ gameId, targetId }, ack) => {
    let game = getGame(gameId);
    if (!game || game.phase !== "vote") return ack?.({ ok: false });

    const voterId = socket.data.playerId;
    if (!voterId) return ack?.({ ok: false });
    const voter = game.players.find((p) => p.id === voterId);
    if (!voter || voter.status === "dead") return ack?.({ ok: false, error: "Tu ne peux pas voter" });

    // Empêcher le double vote (via day_vote déjà résolu)
    const alreadyVoted = (game.pendingPlayerActions ?? []).some(
      (a) => a.playerId === voterId && a.type === "day_vote" && a.status === "resolved"
    );
    if (alreadyVoted) return ack?.({ ok: false, error: "Tu as déjà voté" });

    const voteWeight = voter.isCapitaine ? 2 : 1;
    game = {
      ...game,
      players: game.players.map((p) =>
        p.id === targetId ? { ...p, votes: p.votes + voteWeight } : p
      ),
    };
    const targetName = game.players.find((p) => p.id === targetId)?.name ?? "?";
    game = addHistoryEvent(
      game,
      `${voter.name} vote contre ${targetName}${voter.isCapitaine ? " (vote double ⚔️)" : ""}`,
      "vote"
    );

    // Résoudre l'action day_vote si elle existe (pour cohérence UI)
    const dayVoteAction = (game.pendingPlayerActions ?? []).find(
      (a) => a.playerId === voterId && a.type === "day_vote" && a.status === "pending"
    );
    if (dayVoteAction) {
      game = resolvePlayerAction(game, dayVoteAction.id, { targetId, targetName });
    }

    const updated = updateGame(gameId, () => game);
    emitGameState(updated);
    ack?.({ ok: true });
  });

  // ─ Déconnexion ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);
    const { gameId, playerId } = socket.data || {};
    if (gameId && playerId) {
      const updated = updateGame(gameId, (g) => {
        const player = g.players.find((p) => p.id === playerId);
        // Si le joueur s'est reconnecté avec un autre socket, ne pas effacer le nouveau socketId
        if (!player || player.socketId !== socket.id) return g;
        return {
          ...g,
          players: g.players.map((p) =>
            p.id === playerId
              ? { ...p, isConnected: false, socketId: null, lastSeenAt: new Date().toISOString() }
              : p
          ),
        };
      });
      if (updated) emitGameState(updated);
    }
  });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🐺 Lycan Master server — http://localhost:${PORT}\n`);
});
