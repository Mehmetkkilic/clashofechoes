import { WebSocketServer } from "ws";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(serverDir, "../dist");
const clients = new Map();
const rooms = new Map();
const server = http.createServer(handleRequest);
const wss = new WebSocketServer({ server });
const heartbeatIntervalMs = 15000;
const botTickMs = 50;
const botBroadcastMs = 100;
const botsPerRoom = 2;

const botClasses = ["fighter", "ranger"];
const classStats = {
  fighter: { hp: 150, speed: 4.8, color: 0xe0a34f },
  priest: { hp: 100, speed: 5.0, color: 0xf26f45 },
  ranger: { hp: 100, speed: 5.4, color: 0x7fcf79 },
  witch: { hp: 90, speed: 5.1, color: 0xb77ce8 },
};

const botSpawnPoints = [
  { x: -18, z: -16 },
  { x: 18, z: -16 },
  { x: -20, z: 18 },
  { x: 20, z: 18 },
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".m4a": "audio/mp4",
  ".md": "text/markdown; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

server.listen(port, host, () => {
  console.log(`Clash of Echoes server running on http://${host}:${port}`);
});

const heartbeatTimer = setInterval(() => {
  for (const [id, client] of clients) {
    if (client.ws.readyState !== client.ws.OPEN) {
      removeClient(id);
      continue;
    }

    if (!client.isAlive) {
      client.ws.terminate();
      removeClient(id);
      continue;
    }

    client.isAlive = false;
    client.ws.ping();
  }
}, heartbeatIntervalMs);

const botTimer = setInterval(updateRooms, botTickMs);

server.on("close", () => {
  clearInterval(heartbeatTimer);
  clearInterval(botTimer);
});

async function handleRequest(request, response) {
  const url = getRequestUrl(request);
  if (!url) {
    sendText(response, 400, "Bad request");
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      clients: clients.size,
      rooms: rooms.size,
      bots: [...rooms.values()].reduce((total, room) => total + room.bots.size, 0),
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method not allowed", {
      Allow: "GET, HEAD",
    });
    return;
  }

  await serveStaticFile(request, response, url);
}

function getRequestUrl(request) {
  try {
    return new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch {
    return null;
  }
}

async function serveStaticFile(request, response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  if (pathname.includes("\0")) {
    sendText(response, 400, "Bad request");
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(distDir, requestedPath);

  if (!isInsideDist(filePath)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  if (await sendFile(request, response, filePath)) return;

  if (pathname.startsWith("/assets/")) {
    sendText(response, 404, "Not found");
    return;
  }

  const indexPath = path.resolve(distDir, "index.html");
  if (await sendFile(request, response, indexPath)) return;

  sendText(response, 503, "Build output missing. Run npm run build before npm start.");
}

function isInsideDist(filePath) {
  return filePath === distDir || filePath.startsWith(`${distDir}${path.sep}`);
}

async function sendFile(request, response, filePath) {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    return false;
  }

  if (!stats.isFile()) return false;

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) {
      sendText(response, 500, "File read error");
      return;
    }
    response.destroy();
  });
  stream.pipe(response);
  return true;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-cache",
  });
  response.end(body);
}

function sendText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-cache",
    ...headers,
  });
  response.end(body);
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(room, message, exceptId = null) {
  for (const [id, client] of clients) {
    if (id === exceptId || client.room !== room) continue;
    send(client.ws, message);
  }
}

function peersFor(room, exceptId) {
  const roomState = rooms.get(room);
  const humanPeers = [...clients.entries()]
    .filter(([id, client]) => id !== exceptId && client.room === room && client.state)
    .map(([id, client]) => ({ id, state: client.state }));
  const botPeers = roomState ? [...roomState.bots.values()].map((bot) => ({ id: bot.id, state: botState(bot) })) : [];
  return [...humanPeers, ...botPeers];
}

function removeClient(id) {
  const client = clients.get(id);
  if (!client) return;
  clients.delete(id);
  broadcast(client.room, { type: "peer-left", id }, id);
  if (clientsForRoom(client.room).length === 0) {
    rooms.delete(client.room);
  }
}

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, "ws://localhost");
  const id = crypto.randomUUID();
  const room = url.searchParams.get("room") || "public";
  const roomState = getRoom(room);

  clients.set(id, {
    id,
    room,
    ws,
    state: null,
    isAlive: true,
  });

  ensureRoomBots(roomState);

  send(ws, {
    type: "welcome",
    id,
    room,
    peers: peersFor(room, id),
  });

  broadcast(room, { type: "peer-joined", id }, id);

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const client = clients.get(id);
    if (!client) return;
    client.isAlive = true;

    if (message.type === "ping") {
      send(ws, { type: "pong", now: Date.now() });
      return;
    }

    if (message.type === "state" && message.state) {
      client.state = sanitizeState(message.state);
      broadcast(room, { type: "peer-state", id, state: client.state }, id);
      return;
    }

    if (message.type === "attack" && message.attack) {
      const attack = sanitizeAttack(message.attack);
      broadcast(room, { type: "peer-attack", id, attack }, id);
      return;
    }

    if (message.type === "hit") {
      const hit = sanitizeHit(message);
      const targetBot = roomState.bots.get(hit.targetId);
      if (targetBot) {
        damageBot(roomState, targetBot, id, hit);
        return;
      }

      const target = clients.get(hit.targetId);
      if (!target || target.room !== room) return;
      send(target.ws, { type: "damage", attackerId: id, hit });
      return;
    }

    if (message.type === "death" && message.death) {
      const death = sanitizeDeath(message.death);
      const killerBot = roomState.bots.get(death.killerId);
      if (killerBot) {
        killerBot.score += 1;
        broadcast(roomState.name, { type: "peer-state", id: killerBot.id, state: botState(killerBot) });
      }
      broadcast(room, { type: "peer-death", id, death }, id);
    }
  });

  ws.on("pong", () => {
    const client = clients.get(id);
    if (client) client.isAlive = true;
  });

  ws.on("close", () => {
    removeClient(id);
  });
});

function getRoom(name) {
  let room = rooms.get(name);
  if (!room) {
    room = {
      name,
      bots: new Map(),
      botSeed: crypto.randomUUID().slice(0, 8),
      nextBotSlot: 0,
      lastTickAt: Date.now(),
    };
    rooms.set(name, room);
  }
  return room;
}

function ensureRoomBots(room) {
  while (room.bots.size < botsPerRoom) {
    const slot = room.nextBotSlot;
    room.nextBotSlot += 1;
    const classId = botClasses[slot % botClasses.length];
    const stats = classStats[classId] || classStats.fighter;
    const spawn = botSpawnPoints[slot % botSpawnPoints.length];
    const bot = {
      id: `bot:${room.botSeed}:${slot}`,
      slot,
      classId,
      hp: stats.hp,
      maxHp: stats.hp,
      score: 0,
      deaths: 0,
      dead: false,
      respawn: 0,
      attackCd: 0.45 + Math.random() * 0.7,
      lastBroadcastAt: 0,
      yaw: 0,
      position: {
        x: spawn.x,
        y: 1.72,
        z: spawn.z,
      },
      wander: randomFlatDirection(),
      nextWander: 0.8 + Math.random() * 1.6,
    };
    room.bots.set(bot.id, bot);
    broadcast(room.name, { type: "peer-state", id: bot.id, state: botState(bot) });
  }
}

function updateRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    const roomClients = clientsForRoom(room.name);
    if (roomClients.length === 0) {
      rooms.delete(room.name);
      continue;
    }

    ensureRoomBots(room);

    const dt = Math.min(0.1, Math.max(0.001, (now - room.lastTickAt) / 1000));
    room.lastTickAt = now;
    const targets = roomClients.filter((client) => isClientAlive(client));

    for (const bot of room.bots.values()) {
      updateBot(room, bot, targets, now, dt);
    }
  }
}

function updateBot(room, bot, targets, now, dt) {
  if (bot.dead) {
    bot.respawn -= dt;
    if (bot.respawn <= 0) {
      respawnBot(bot);
      broadcast(room.name, { type: "peer-state", id: bot.id, state: botState(bot) });
    }
    return;
  }

  bot.attackCd = Math.max(0, bot.attackCd - dt);
  const target = nearestTarget(bot, targets);

  if (target) {
    moveBotTowardTarget(bot, target, dt);
    tryBotAttack(room, bot, target);
  } else {
    wanderBot(bot, dt);
  }

  if (now - bot.lastBroadcastAt >= botBroadcastMs) {
    bot.lastBroadcastAt = now;
    broadcast(room.name, { type: "peer-state", id: bot.id, state: botState(bot) });
  }
}

function moveBotTowardTarget(bot, target, dt) {
  const targetPosition = target.state.position;
  const dx = targetPosition.x - bot.position.x;
  const dz = targetPosition.z - bot.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.001) return;

  bot.yaw = yawToward(dx, dz);
  if (distance <= 2.55) return;

  const stats = classStats[bot.classId] || classStats.fighter;
  const step = Math.min(distance - 2.2, stats.speed * dt);
  bot.position.x += (dx / distance) * step;
  bot.position.z += (dz / distance) * step;
  clampBotPosition(bot);
}

function wanderBot(bot, dt) {
  bot.nextWander -= dt;
  if (bot.nextWander <= 0) {
    bot.wander = randomFlatDirection();
    bot.nextWander = 0.8 + Math.random() * 1.8;
  }

  const stats = classStats[bot.classId] || classStats.fighter;
  bot.position.x += bot.wander.x * stats.speed * 0.35 * dt;
  bot.position.z += bot.wander.z * stats.speed * 0.35 * dt;
  bot.yaw = yawToward(bot.wander.x, bot.wander.z);
  clampBotPosition(bot);
}

function tryBotAttack(room, bot, target) {
  if (bot.attackCd > 0 || !target.state) return;
  const distance = horizontalDistance(bot.position, target.state.position);
  if (distance > 2.75) return;

  bot.attackCd = 0.95 + Math.random() * 0.35;
  const stats = classStats[bot.classId] || classStats.fighter;
  const direction = directionTo(bot.position, target.state.position);
  const attack = {
    classId: bot.classId,
    slot: "primary",
    label: "Slash",
    color: stats.color,
    yaw: bot.yaw,
    position: { ...bot.position },
    target: null,
    direction,
  };

  broadcast(room.name, { type: "peer-attack", id: bot.id, attack });
  send(target.ws, {
    type: "damage",
    attackerId: bot.id,
    hit: {
      targetId: target.id,
      amount: 12,
      label: "Bot Slash",
      color: stats.color,
      knock: 5,
    },
  });
}

function damageBot(room, bot, attackerId, hit) {
  if (bot.dead) return;
  const amount = Math.round(numberValue(hit.amount, 0, 200));
  if (amount <= 0) return;

  bot.hp = Math.max(0, bot.hp - amount);
  applyBotKnockback(bot, attackerId, hit.knock ?? 0);

  if (bot.hp <= 0) {
    bot.dead = true;
    bot.deaths += 1;
    bot.respawn = 2.1;
    broadcast(room.name, { type: "peer-state", id: bot.id, state: botState(bot) });
    broadcast(room.name, {
      type: "peer-death",
      id: bot.id,
      death: {
        killerId: attackerId,
        label: hit.label || "Defeated",
      },
    });
    return;
  }

  broadcast(room.name, { type: "peer-state", id: bot.id, state: botState(bot) });
}

function applyBotKnockback(bot, attackerId, knock) {
  if (!knock) return;
  const attacker = clients.get(attackerId);
  if (!attacker?.state?.position) return;
  const dx = bot.position.x - attacker.state.position.x;
  const dz = bot.position.z - attacker.state.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.001) return;

  const push = Math.min(1.4, knock * 0.055);
  bot.position.x += (dx / distance) * push;
  bot.position.z += (dz / distance) * push;
  clampBotPosition(bot);
}

function respawnBot(bot) {
  const spawn = botSpawnPoints[bot.slot % botSpawnPoints.length];
  const stats = classStats[bot.classId] || classStats.fighter;
  bot.position.x = spawn.x + (Math.random() - 0.5) * 5;
  bot.position.y = 1.72;
  bot.position.z = spawn.z + (Math.random() - 0.5) * 5;
  bot.hp = bot.maxHp || stats.hp;
  bot.dead = false;
  bot.attackCd = 0.85 + Math.random() * 0.8;
  bot.wander = randomFlatDirection();
  bot.nextWander = 0.8 + Math.random() * 1.8;
  clampBotPosition(bot);
}

function botState(bot) {
  return {
    classId: bot.classId,
    hp: bot.hp,
    maxHp: bot.maxHp,
    score: bot.score,
    deaths: bot.deaths,
    yaw: bot.yaw,
    shield: false,
    chargingShot: false,
    dead: bot.dead,
    bot: true,
    name: `Bot ${bot.slot + 1}`,
    position: {
      x: bot.position.x,
      y: bot.position.y,
      z: bot.position.z,
    },
  };
}

function clientsForRoom(room) {
  return [...clients.values()].filter((client) => client.room === room);
}

function isClientAlive(client) {
  return client.state?.ready && !client.state.dead && (client.state.hp ?? 0) > 0;
}

function nearestTarget(bot, targets) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const target of targets) {
    const distance = horizontalDistance(bot.position, target.state.position);
    if (distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function directionTo(from, to) {
  const dx = to.x - from.x;
  const dy = (to.y ?? 1.72) - (from.y ?? 1.72);
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  return {
    x: dx / length,
    y: dy / length,
    z: dz / length,
  };
}

function yawToward(dx, dz) {
  if (Math.hypot(dx, dz) <= 0.001) return 0;
  return Math.atan2(-dx, -dz);
}

function randomFlatDirection() {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle),
    z: Math.sin(angle),
  };
}

function clampBotPosition(bot) {
  bot.position.x = Math.min(47, Math.max(-47, bot.position.x));
  bot.position.z = Math.min(47, Math.max(-47, bot.position.z));
}

function sanitizeState(state) {
  return {
    classId: stringValue(state.classId, "fighter", 20),
    hp: numberValue(state.hp, 0, 300),
    maxHp: numberValue(state.maxHp, 1, 300),
    score: numberValue(state.score, 0, 999),
    deaths: numberValue(state.deaths, 0, 999),
    yaw: numberValue(state.yaw, -Math.PI * 4, Math.PI * 4),
    shield: booleanValue(state.shield),
    chargingShot: booleanValue(state.chargingShot),
    dead: booleanValue(state.dead),
    ready: booleanValue(state.ready),
    position: {
      x: numberValue(state.position?.x, -60, 60),
      y: numberValue(state.position?.y, 0, 20),
      z: numberValue(state.position?.z, -60, 60),
    },
  };
}

function sanitizeAttack(attack) {
  return {
    classId: stringValue(attack.classId, "fighter", 20),
    slot: stringValue(attack.slot, "primary", 20),
    label: stringValue(attack.label, "Attack", 40),
    color: colorValue(attack.color, 0xe0a34f),
    yaw: numberValue(attack.yaw, -Math.PI * 4, Math.PI * 4),
    position: {
      x: numberValue(attack.position?.x, -60, 60),
      y: numberValue(attack.position?.y, 0, 20),
      z: numberValue(attack.position?.z, -60, 60),
    },
    target: sanitizeAttackTarget(attack.target),
    direction: sanitizeDirection(attack.direction),
  };
}

function sanitizeHit(message) {
  return {
    targetId: stringValue(message.targetId, "", 80),
    amount: numberValue(message.amount, 0, 200),
    label: stringValue(message.label, "Hit", 40),
    color: colorValue(message.color, 0xe0a34f),
    knock: numberValue(message.knock, 0, 24),
  };
}

function sanitizeDeath(death) {
  return {
    killerId: stringValue(death.killerId, "", 80),
    label: stringValue(death.label, "Defeated", 40),
  };
}

function numberValue(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function stringValue(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  return value.slice(0, maxLength);
}

function booleanValue(value) {
  return value === true;
}

function colorValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(0xffffff, Math.max(0, parsed)));
}

function sanitizeDirection(direction) {
  if (!direction || typeof direction !== "object") return null;
  return {
    x: directionValue(direction.x, 0),
    y: directionValue(direction.y, 0),
    z: directionValue(direction.z, -1),
  };
}

function directionValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(-1, parsed));
}

function sanitizeAttackTarget(target) {
  if (!target || typeof target !== "object") return null;
  return {
    x: numberValue(target.x, -60, 60),
    y: numberValue(target.y, 0, 20),
    z: numberValue(target.z, -60, 60),
  };
}
