const fs = require("fs");
const path = require("path");

// DATA_FILE_PATH permet de pointer vers un volume persistant en production (ex: Railway)
// Future migration DB : remplacer load()/save() par des appels ORM ici
const DATA_FILE = process.env.DATA_FILE_PATH || path.join(__dirname, "games.json");
const games = new Map();

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const obj = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      for (const [k, v] of Object.entries(obj)) {
        // Ne restaure que les parties en cours
        if (v.status !== "finished") games.set(k, v);
      }
      if (games.size) console.log(`[store] ${games.size} partie(s) restaurée(s)`);
    }
  } catch (e) {
    console.warn("[store] Impossible de charger games.json :", e.message);
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(games), null, 2));
  } catch (e) {
    console.warn("[store] Impossible de sauvegarder :", e.message);
  }
}

load();

function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createGame({ name, gmSocketId, playerCount, mode }) {
  let code;
  do { code = generateGameCode(); } while (games.has(code));

  const game = {
    id: code,
    name,
    gmSocketId,
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
    phaseTimer: { duration: 300, remaining: 300, startedAt: null, running: false },
    createdAt: new Date().toISOString(),
  };
  games.set(code, game);
  save();
  return game;
}

function getGame(code) {
  return games.get(code) || null;
}

function updateGame(code, updater) {
  const game = games.get(code);
  if (!game) return null;
  const updated = updater(game);
  games.set(code, updated);
  save();
  return updated;
}

function deleteGame(code) {
  games.delete(code);
  save();
}

function getGameBySocketId(socketId) {
  for (const game of games.values()) {
    if (game.gmSocketId === socketId) return game;
    if (game.players.some((p) => p.socketId === socketId)) return game;
  }
  return null;
}

module.exports = { createGame, getGame, updateGame, deleteGame, getGameBySocketId };
