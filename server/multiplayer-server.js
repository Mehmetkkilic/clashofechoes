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
const server = http.createServer(handleRequest);
const wss = new WebSocketServer({ server });

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
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
  return [...clients.entries()]
    .filter(([id, client]) => id !== exceptId && client.room === room && client.state)
    .map(([id, client]) => ({ id, state: client.state }));
}

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, "ws://localhost");
  const id = crypto.randomUUID();
  const room = url.searchParams.get("room") || "public";

  clients.set(id, {
    id,
    room,
    ws,
    state: null,
  });

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

    if (message.type === "state" && message.state) {
      client.state = sanitizeState(message.state);
      broadcast(room, { type: "peer-state", id, state: client.state }, id);
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    broadcast(room, { type: "peer-left", id }, id);
  });
});

function sanitizeState(state) {
  return {
    classId: stringValue(state.classId, "fighter", 20),
    hp: numberValue(state.hp, 0, 300),
    maxHp: numberValue(state.maxHp, 1, 300),
    score: numberValue(state.score, 0, 999),
    deaths: numberValue(state.deaths, 0, 999),
    yaw: numberValue(state.yaw, -Math.PI * 4, Math.PI * 4),
    position: {
      x: numberValue(state.position?.x, -60, 60),
      y: numberValue(state.position?.y, 0, 20),
      z: numberValue(state.position?.z, -60, 60),
    },
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
