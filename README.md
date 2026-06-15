# Clash of Echoes

Browser prototype for a low-poly first-person hero arena game.

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite client:

```bash
npm run dev
```

Start the multiplayer WebSocket server in another terminal:

```bash
npm run server
```

Open two browser tabs with the same room query to test synchronized hits:

```text
http://127.0.0.1:5173/?room=test
```

The server also runs two synchronized room bots. They are sent through the same `peer-state`, `peer-attack`, `hit`, `damage`, and `peer-death` loop as real players, so bots can damage players and players can kill/respawn bots.

## Railway Deployment

Railway uses `railway.json`:

- Build command: `npm run build`
- Start command: `npm start`
- Health check: `/health`

After deployment, generate a public Railway domain for the service. The production client connects to the same domain with WebSocket automatically.
