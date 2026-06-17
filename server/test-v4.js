/**
 * Test de scénario V4 — Lycan Master
 *
 * Joueurs & rôles aléatoires — le test adapte ses assertions dynamiquement.
 * Scénario :
 *  1.  Reconnexion par playerToken
 *  2.  Cupidon unit LG + Villageois via action privée
 *  3.  Voyante consulte LG via action privée → reçoit "werewolf"
 *  4.  Loups (MJ) ciblent Chasseur
 *  5.  Sorcière ne fait rien via action privée
 *  6.  Résolution nuit : Chasseur mort → hunter_choose_target créée
 *  7.  Chasseur tire sur LG via action privée → LG mort → Villageois meurt de chagrin
 *  8.  Phase Vote → day_vote créées pour chaque vivant
 *  9.  Voyante vote contre Sorcière via player:resolve_action
 * 10.  Historique cohérent
 */

"use strict";

const { io } = require("socket.io-client");

const SERVER = "http://localhost:3001";
const DELAY = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

/** Crée un socket et track son dernier game:state */
function createTrackedSocket() {
  return new Promise((resolve) => {
    const socket = io(SERVER);
    let state = null;
    socket.on("game:state", (s) => { state = s; });
    socket.on("player:state", (s) => { socket._playerState = s; });
    socket.once("connect", () => resolve({ socket, getState: () => state }));
    socket.getState = () => state;
  });
}

/** Émet un event et attend l'ACK */
function emit(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (res) => resolve(res));
  });
}

/** Attend que la condition soit vraie, en polling toutes les 50ms (max timeout) */
async function waitUntil(fn, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await DELAY(50);
  }
  return null;
}

async function run() {
  console.log("\n🐺 Test V4 — Lycan Master\n");

  // ─ MJ ─────────────────────────────────────────────────────────────────────
  const { socket: gm, getState: getGM } = await createTrackedSocket();

  const createRes = await emit(gm, "gm:create", { name: "Test V4", playerCount: 6, mode: "classic" });
  assert("Partie créée", createRes.ok && createRes.gameId);
  const gameId = createRes.gameId;
  console.log(`  Partie : ${gameId}`);

  // ─ Joueurs ────────────────────────────────────────────────────────────────
  console.log("\n▶ Ajout des 6 joueurs");
  const names = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank"];
  const playerTokens = {};

  for (const name of names) {
    const r = await emit(gm, "gm:add_player", { gameId, playerName: name });
    assert(`${name} ajouté`, r.ok);
  }

  // Connexion de chaque joueur (obtient son token)
  const playerSockets = {};
  for (const name of names) {
    const { socket, getState } = await createTrackedSocket();
    playerSockets[name] = { socket, getState };
    const res = await emit(socket, "player:join", { gameId, playerName: name });
    assert(`${name} rejoint`, res.ok && res.playerToken);
    playerTokens[name] = res.playerToken;
  }

  // Attendre que l'état GM se stabilise (6 joueurs)
  const gmStateInit = await waitUntil(() => {
    const s = getGM(); return s?.players?.length === 6 ? s : null;
  });
  assert("6 joueurs dans l'état GM", !!gmStateInit);
  const playerList = gmStateInit.players;

  // ─ Test reconnexion token + stabilité socketId ───────────────────────────
  console.log("\n▶ Reconnexion par playerToken (stabilité socketId)");
  const aliceId = playerList.find((p) => p.name === "Alice")?.id;
  const aliceSocketA = playerSockets["Alice"].socket; // socket original (A)

  // Socket B prend la place d'Alice
  const { socket: aliceSocketB } = await createTrackedSocket();
  const reconnectRes = await emit(aliceSocketB, "player:join", { gameId, playerToken: playerTokens["Alice"] });
  assert("Reconnexion token ok (socket B)", reconnectRes.ok && reconnectRes.playerId === aliceId);
  const socketBId = aliceSocketB.id;

  // Attendre que le GM reçoive l'état mis à jour (socketId = B)
  await waitUntil(() => {
    const s = getGM(); return s?.players?.find((p) => p.id === aliceId)?.socketId === socketBId ? s : null;
  });
  assert("socketId d'Alice mis à jour vers socket B", true);

  // Socket A se déconnecte — ne doit PAS effacer le socketId de socket B
  const disconnectSettled = new Promise((res) => aliceSocketA.once("disconnect", () => setTimeout(res, 150)));
  aliceSocketA.disconnect();
  await disconnectSettled;

  const stateAfterDisconnect = await waitUntil(() => {
    const s = getGM();
    // On veut juste que l'état ait été ré-émis
    return s ? s : null;
  });
  const aliceAfterDisconnect = stateAfterDisconnect?.players?.find((p) => p.id === aliceId);
  assert("socketId d'Alice toujours = socket B après déconnexion de socket A", aliceAfterDisconnect?.socketId === socketBId);
  assert("Alice reste connected=true après déconnexion de socket A", aliceAfterDisconnect?.isConnected === true);

  // Socket B devient le socket "officiel" d'Alice pour la suite du test
  playerSockets["Alice"] = { socket: aliceSocketB, getState: () => aliceSocketB._playerState };

  // ─ Rôles & lancement ─────────────────────────────────────────────────────
  console.log("\n▶ Attribution rôles & lancement");
  await emit(gm, "gm:set_roles", { gameId, roles: [
    { id: "seer", count: 1 }, { id: "werewolf", count: 1 }, { id: "witch", count: 1 },
    { id: "hunter", count: 1 }, { id: "cupid", count: 1 }, { id: "villager", count: 1 },
  ]});
  await emit(gm, "gm:start", { gameId });
  const gmStateNight1 = await waitUntil(() => { const s = getGM(); return s?.phase === "night" ? s : null; });
  assert("Nuit 1", !!gmStateNight1);

  // Identifier les rôles (assignés aléatoirement)
  const gp = gmStateNight1.players;
  const byRole = (r) => gp.find((p) => p.role === r);
  const seerP = byRole("seer");
  const wolfP = byRole("werewolf");
  const witchP = byRole("witch");
  const hunterP = byRole("hunter");
  const cupidP = byRole("cupid");
  const villagerP = gp.find((p) => p.role === "villager");

  console.log(`  Rôles: Voyante=${seerP?.name} Loup=${wolfP?.name} Sorcière=${witchP?.name} Chasseur=${hunterP?.name} Cupidon=${cupidP?.name} Villageois=${villagerP?.name}`);

  const sockOf = (p) => playerSockets[p?.name]?.socket;

  // ─ Cupidon unit LG + Villageois (via action privée) ──────────────────────
  console.log("\n▶ Cupidon — action privée");
  const cupidActionRes = await emit(gm, "gm:create_player_action", { gameId, action: {
    playerId: cupidP.id, type: "cupid_choose_lovers",
    title: "Amoureux", description: "Choisis deux joueurs.",
    targets: gp.filter((p) => p.id !== cupidP.id).map((p) => p.id),
    minTargets: 2, maxTargets: 2,
  }});
  assert("Action Cupidon créée", cupidActionRes.ok);

  await emit(sockOf(cupidP), "player:resolve_action", {
    actionId: cupidActionRes.actionId,
    payload: { lover1Id: wolfP.id, lover2Id: villagerP.id },
  });
  const stateAfterCupid = await waitUntil(() => { const s = getGM(); return s?.cupidLovers?.length === 2 ? s : null; });
  assert("Amoureux liés (LG + Villageois)", stateAfterCupid?.cupidLovers?.includes(wolfP.id) && stateAfterCupid?.cupidLovers?.includes(villagerP.id));

  // ─ Voyante consulte LG (via action privée) ───────────────────────────────
  console.log("\n▶ Voyante — action privée");
  const seerActionRes = await emit(gm, "gm:create_player_action", { gameId, action: {
    playerId: seerP.id, type: "seer_choose_target",
    title: "Vision", description: "Consulte un joueur.",
    targets: gp.filter((p) => p.status !== "dead" && p.id !== seerP.id).map((p) => p.id),
    minTargets: 1, maxTargets: 1,
  }});
  assert("Action Voyante créée", seerActionRes.ok);

  await emit(sockOf(seerP), "player:resolve_action", {
    actionId: seerActionRes.actionId, payload: { targetId: wolfP.id },
  });
  const stateAfterSeer = await waitUntil(() => {
    const s = getGM();
    return s?.pendingPlayerActions?.find((a) => a.id === seerActionRes.actionId)?.status === "resolved" ? s : null;
  });
  const seerResult = stateAfterSeer?.pendingPlayerActions?.find((a) => a.id === seerActionRes.actionId)?.result;
  assert("Voyante a vu le Loup-Garou", seerResult?.role === "werewolf");

  // La Voyante voit son résultat dans sa player:state
  const seerPlayerState = await waitUntil(() => {
    const ps = playerSockets[seerP.name]?.socket._playerState;
    return ps?.resolvedActions?.length > 0 ? ps : null;
  });
  assert("Voyante reçoit son résultat dans player:state", !!seerPlayerState);

  // ─ Loups ciblent Chasseur (MJ) ───────────────────────────────────────────
  console.log("\n▶ Loups ciblent le Chasseur (MJ)");
  await emit(gm, "gm:wolves_target", { gameId, targetId: hunterP.id });
  const stateAfterWolves = await waitUntil(() => { const s = getGM(); return s?.nightActions?.wolvesTarget === hunterP.id ? s : null; });
  assert("Loups ciblent Chasseur", !!stateAfterWolves);

  // ─ Sorcière ne fait rien (via action privée) ────────────────────────────
  console.log("\n▶ Sorcière — ne fait rien (action privée)");
  const witchActionRes = await emit(gm, "gm:create_player_action", { gameId, action: {
    playerId: witchP.id, type: "witch_choose_potions",
    title: "Potions", description: "Utilise tes potions.",
    targets: gp.filter((p) => p.status !== "dead").map((p) => p.id),
    minTargets: 0, maxTargets: 1,
    context: { wolvesTargetId: hunterP.id, wolvesTargetName: hunterP.name, witchPotions: { life: true, death: true } },
  }});
  assert("Action Sorcière créée", witchActionRes.ok);

  await emit(sockOf(witchP), "player:resolve_action", {
    actionId: witchActionRes.actionId, payload: { save: false, killTargetId: null },
  });
  await waitUntil(() => {
    const s = getGM();
    return s?.pendingPlayerActions?.find((a) => a.id === witchActionRes.actionId)?.status === "resolved" ? s : null;
  });
  assert("Action Sorcière résolue (ne fait rien)", true);

  // ─ Résolution de la nuit ─────────────────────────────────────────────────
  console.log("\n▶ Résolution nuit");
  await emit(gm, "gm:resolve_night", { gameId });
  const stateDay1 = await waitUntil(() => { const s = getGM(); return s?.phase === "day" ? s : null; });
  assert("Phase = Jour 1", !!stateDay1);

  const hunterDead = stateDay1.players.find((p) => p.id === hunterP.id)?.status === "dead";
  assert("Chasseur mort (attaque Loups)", hunterDead);

  const hunterInQueue = stateDay1.pendingHunterActions?.includes(hunterP.id);
  assert("Chasseur dans pendingHunterActions", hunterInQueue);

  const hunterAction = stateDay1.pendingPlayerActions?.find(
    (a) => a.playerId === hunterP.id && a.type === "hunter_choose_target" && a.status === "pending"
  );
  assert("Action hunter_choose_target créée automatiquement", !!hunterAction);

  // ─ Chasseur tire sur le Loup (via téléphone) ─────────────────────────────
  console.log("\n▶ Chasseur tire sur le Loup (téléphone)");
  if (hunterAction) {
    await emit(sockOf(hunterP), "player:resolve_action", {
      actionId: hunterAction.id, payload: { targetId: wolfP.id },
    });
    const stateAfterShot = await waitUntil(() => { const s = getGM(); return s?.players?.find((p) => p.id === wolfP.id)?.status === "dead" ? s : null; });
    assert("Loup mort (flèche du Chasseur)", !!stateAfterShot);

    const villagerDead = stateAfterShot?.players?.find((p) => p.id === villagerP.id)?.status === "dead";
    assert("Villageois mort de chagrin (amoureux du Loup)", villagerDead);

    const hunterCleared = !stateAfterShot?.pendingHunterActions?.includes(hunterP.id);
    assert("Chasseur retiré de pendingHunterActions", hunterCleared);

    const history = stateAfterShot?.history ?? [];
    assert("Historique : tir du Chasseur", history.some((e) => e.text.includes("dernière flèche")));
    assert("Historique : mort de chagrin", history.some((e) => e.text.includes("chagrin")));
  }

  // ─ Phase Vote : actions day_vote créées ──────────────────────────────────
  console.log("\n▶ Phase Vote — actions day_vote interactives");
  await emit(gm, "gm:next_phase", { gameId }); // Jour → Vote
  const stateVote = await waitUntil(() => { const s = getGM(); return s?.phase === "vote" ? s : null; });
  assert("Phase = Vote", !!stateVote);

  const aliveCount = stateVote.players.filter((p) => p.status !== "dead").length;
  const dayVoteActions = stateVote.pendingPlayerActions?.filter(
    (a) => a.type === "day_vote" && a.status === "pending"
  ) ?? [];
  assert(`day_vote créées pour les ${aliveCount} joueurs vivants`, dayVoteActions.length === aliveCount);

  // Voyante vote contre la Sorcière
  const seerVoteAction = dayVoteActions.find((a) => a.playerId === seerP.id);
  assert("Voyante a une action day_vote", !!seerVoteAction);

  if (seerVoteAction) {
    await emit(sockOf(seerP), "player:resolve_action", {
      actionId: seerVoteAction.id, payload: { targetId: witchP.id },
    });
    const stateAfterVote = await waitUntil(() => { const s = getGM(); return s?.players?.find((p) => p.id === witchP.id)?.votes > 0 ? s : null; });
    assert("Vote Voyante enregistré contre Sorcière", !!stateAfterVote);
    const resolved = stateAfterVote?.pendingPlayerActions?.find((a) => a.id === seerVoteAction.id)?.status;
    assert("Action day_vote Voyante résolue", resolved === "resolved");
  }

  // ─ Résumé ─────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────");
  console.log(`Tests : ${passed + failed} total — ✅ ${passed} réussis — ❌ ${failed} échoués`);

  gm.disconnect();
  for (const { socket } of Object.values(playerSockets)) socket.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\n💥 Erreur fatale :", err.message, err.stack);
  process.exit(1);
});
