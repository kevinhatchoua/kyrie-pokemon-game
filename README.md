# Name That Pokémon! — Party Game

Multiplayer Pokémon guessing game. Host on a TV/laptop; players join on their phones via QR code.

## Play now

**https://kyrie-pokemon-game.vercel.app**

1. Open the link → tap **Host Game**
2. Share the QR code or join URL with players
3. Players scan QR → enter a name → vote on each round

## Repo & hosting

| Service | URL |
|---------|-----|
| GitHub | https://github.com/kevinhatchoua/kyrie-pokemon-game |
| Vercel | https://kyrie-pokemon-game.vercel.app |

## Enable live multiplayer (Supabase)

The game uses **Supabase Realtime** (broadcast + presence) so players on cellular can vote while the host is on Wi‑Fi. No database tables are required.

### One-time setup (~3 min)

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Project Settings → API** → copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
3. In [Vercel → kyrie-pokemon-game → Settings → Environment Variables](https://vercel.com/kevin-hatchouas-projects/kyrie-pokemon-game/settings/environment-variables), add both for **Production**, **Preview**, and **Development**
4. Redeploy: **Deployments → … → Redeploy** (or push to `main`)

Or from the CLI (after creating the Supabase project):

```bash
./scripts/setup-vercel-env.sh 'https://YOUR_PROJECT.supabase.co' 'your-anon-key'
```

When configured, the host screen shows **🟢 Live — any network** instead of **⚪ Live voting off**.

## Local development

```bash
cp .env.example .env   # paste Supabase keys
# — or —
cp config.js.example config.js   # paste keys for local phone testing

npm run build
npm run dev            # http://localhost:8765 (serves dist/)
```

Paste keys directly into `index.html` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) if you prefer.

## Deploy

Pushes to `main` auto-deploy via Vercel when Git is connected. Manual deploy:

```bash
npx vercel --prod
```

Build injects Supabase keys from Vercel env into `dist/index.html` via `scripts/inject-env.mjs`.
