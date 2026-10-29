# Decorate the NxtWave Bot

A client-side Three.js humanoid customization playground for the NxtWave Growth Intern campaign.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`. The humanoid playground is the sole product experience; `/` loads it directly. There is no separate orb route.

## Features

- Five robot poses
- Seven procedural accessories with fusion effects
- Local uploaded PNG/JPEG/WebP badges with placement, resizing, rotation, and removal
- Browser-local upload credits
- Compact humanoid creation share URLs
- Optional Supabase leaderboard, publishing, likes, withdrawal, reporting, and thumbnails
- Permanent NxtWave chest logo

## Configuration

Supabase configuration is optional for local customization and sharing. To enable the public leaderboard, follow [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) and the SQL migration in [`database/SUPABASE_MIGRATION.sql`](database/SUPABASE_MIGRATION.sql).

The browser expects these Vite environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For the workshop registration landing page, optionally set `VITE_WORKSHOP_REGISTRATION_URL` in `.env.local` (or the deployment environment) to the verified workshop registration form URL. The variable is read by the `workshopRegisterButton` handler in `src/robot-preview.js`. No registration reward is granted automatically: unlimited uploads require a separate confirmed-registration mechanism.

The optional prize variables are documented in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). Never add a Supabase service-role key to Vite environment variables or browser code.

## Project structure

- `src/` — application modules
- `src/styles/` — shared application styles
- `src/tests/` — automated tests
- `public/` — browser-served models, logos, and doodle assets
- `assets/source-images/` — original source artwork retained outside the runtime asset directory
- `database/` — Supabase migration scripts
- `docs/` — setup and design documentation
- `index.html` — application entry markup

## Validation

```bash
npm test
npm run build
```
