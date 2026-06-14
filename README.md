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

## Railway Deployment

Railway uses `railway.json`:

- Build command: `npm run build`
- Start command: `npm start`
- Health check: `/health`

After deployment, generate a public Railway domain for the service. The production client connects to the same domain with WebSocket automatically.
