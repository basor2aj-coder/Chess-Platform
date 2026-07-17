# Code readiness plan: preparing Table for AWS deployment

Status: draft
Scope: code and CI/CD changes only. Infrastructure steps (Lightsail, Route 53, Caddy)
are covered separately and are not repeated here — see the hosting plan artifact
from this same planning conversation. This document assumes that plan: a single
Lightsail instance, Caddy as the public-facing TLS/reverse-proxy, deployed from
`github.com/basor2aj-coder/Chess-Platform`.

Nothing here requires moving off the current architecture (in-memory `Map` of
rooms, single process). Anything that only makes sense once there are multiple
instances is called out and deliberately deferred — see "Explicitly out of scope"
at the end.

---

## 1. Technology stack and services

### Application (unchanged)
- Node.js — runtime. Currently pinned loosely (`>=16.0.0` in `package.json`);
  recommend tightening to Node 20 LTS to match whatever the Lightsail blueprint ships.
- Express 4 — static file serving + HTTP server.
- `ws` — WebSocket server, attached to the same HTTP server as Express.
- `chess.js` — move legality/game state.
- `selfsigned` — generates the LAN-only HTTPS cert; stays in the codebase for the
  no-internet game-night use case, just not exposed publicly once Caddy is in front.

### New, for production readiness
- **systemd** — process supervision (auto-restart on crash, start on boot). Native
  to the Lightsail Ubuntu/Amazon Linux image, no new dependency to install.
- **Caddy** — reverse proxy + automatic TLS (infra-side, not an npm dependency).
- **Node's built-in test runner** (`node:test`, `node:assert/strict`) — zero new
  dependencies, available since Node 18. Matches the project's current
  four-dependency footprint.
- **ESLint** — first devDependency the project would gain. Optional but
  recommended once there's a CI pipeline to gate on.

### AWS services
- **Lightsail** — compute, static IP, firewall.
- **Route 53** — domain registration + hosted zone/DNS.
- **IAM** — a scoped user/role for deploys, separate from your root login.
- **CloudWatch** — billing alarm at minimum; optional log shipping later.

### CI/CD tooling
- **GitHub Actions** — repo is already on GitHub
  (`basor2aj-coder/Chess-Platform`), no existing workflow yet. This is the natural
  choice; no new tooling to adopt.
- **`appleboy/ssh-action`** (or a plain `ssh` step) — runs the deploy command
  against the Lightsail box over SSH.

---

## 2. Code changes checklist

Grouped by priority. Nothing here is a rewrite — these are additive, low-risk
changes to `server.js` and `package.json`.

### Required for a clean deploy
- [ ] **`GET /healthz`** — a trivial `res.sendStatus(200)` route in `server.js`.
      Needed for the CI/CD smoke test after each deploy, and it's the same
      endpoint an ALB target group would want if this ever moves off Lightsail —
      free to add now, expensive to realize is missing mid-incident.
- [ ] **Pin the Node version.** Change `engines.node` in `package.json` from
      `>=16.0.0` to the actual LTS you'll run in prod (e.g. `>=20.0.0`), and add
      an `.nvmrc` (`20`) so local dev, CI, and the server agree.
- [ ] **`app.set('trust proxy', 1)`** — one line in `server.js`. Caddy sits in
      front of Express now; without this, anything that reads `req.ip` or
      `X-Forwarded-*` (nothing today, but logging or rate-limiting later) sees
      Caddy's address instead of the real client.

### Strongly recommended before tournament day
- [ ] **Graceful shutdown.** On `SIGTERM` (which systemd sends on restart/deploy),
      stop accepting new connections, optionally notify connected clients, and
      exit cleanly instead of the process being killed mid-broadcast. A few lines
      in `server.js`; makes every future deploy less disruptive to a live game.
- [ ] **Reconnect token for seated players.** Today a hard refresh drops a player
      to spectator (see README's existing note on this). Family wifi/cellular on
      tournament day will produce real disconnects. Add a per-seat random token
      handed out on `join_room`, stored client-side (same `localStorage` pattern
      already used for profile info), and accepted on rejoin to re-claim the same
      seat instead of falling through to spectator. This is an in-memory change
      only — no new infrastructure required at the current single-instance scale.

### Nice-to-have / low priority
- [ ] **Gate the self-signed HTTPS listener behind an env var** (e.g. skip
      `createHttpsServer()` when `NODE_ENV=production`). The Lightsail firewall
      already blocks port 3443 from the internet, so this is tidiness, not a
      security requirement — the LAN game-night path stays intact either way.
- [ ] **Structured `console.log` → journald.** No code change needed if run under
      systemd (`journalctl -u table-chess` just works), but worth confirming
      log output is readable there before relying on it during the tournament.

### Testing & quality gates (new)
- [ ] Add `node --test` coverage for the pure logic that's easiest to break
      silently: `legalMovesMap()`, `gameStatus()`, and the profanity filter. A
      couple of unit tests each.
- [ ] Add one smoke test that starts the server and hits `/healthz` over plain
      `http` (no need for a `supertest` dependency — Node's `http.request` is
      enough for one endpoint).
- [ ] `npm run lint` via ESLint with a minimal flat config — mainly to catch
      typos/reference errors before they reach the deploy step, not for style
      enforcement.
- [ ] Add `"lint"` and `"test"` scripts to `package.json` so CI can call them
      uniformly (`npm run lint --if-present`, `npm test --if-present`).

---

## 3. CI/CD pipeline

Two jobs: build-and-test on every push/PR, deploy only on `main` after tests pass.
This matches the "simple now, containerize later" decision — a `git pull` +
`systemctl restart` deploy, no container registry involved yet.

**Draft workflow** (`.github/workflows/ci-cd.yml` — not yet created, for review):

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present

  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            cd /opt/table-chess
            git pull origin main
            npm ci --omit=dev
            sudo systemctl restart table-chess

      - name: Smoke test
        run: |
          sleep 5
          curl -sf https://chess.yourdomain.com/healthz || exit 1
```

**GitHub repo secrets needed:** `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`,
`LIGHTSAIL_SSH_KEY`. Generate a dedicated deploy keypair for this rather than
reusing your personal SSH key — add its public half to the Lightsail box's
`~/.ssh/authorized_keys` for the deploy user only, scoped to what it needs.

If the repo stays public, the box can `git pull` without credentials. If it goes
private, either add a read-only deploy key on the Lightsail side or have the
Action push a tarball over SSH instead of relying on the box to pull.

---

## 4. Order of operations

1. **Code changes** (section 2, "Required" + "Strongly recommended") — do these
   in this repo first, independent of any AWS resource existing yet. Everything
   here is testable locally.
2. **Add the test/lint scripts and confirm `npm run lint` / `npm test` pass.**
3. **Provision the AWS infra** per the hosting plan (Lightsail, static IP, Route 53,
   Caddy) — unchanged from that plan, do this in parallel with step 1 if convenient.
4. **Add the GitHub Actions workflow and secrets**, first deploy manually once to
   confirm the systemd unit name and deploy path match the workflow, then let
   subsequent pushes to `main` deploy automatically.
5. **Dress-rehearsal test** (from the hosting plan) after the pipeline is live, so
   the tested path is the same one the tournament will actually run on.

---

## 5. Explicitly out of scope for this pass

Deferred on purpose, consistent with the "simple Lightsail version now" decision —
none of these are needed at family-tournament scale:

- Shared state (Redis/DynamoDB) for room data — only needed once more than one
  app instance runs concurrently (multi-AZ HA or zero-downtime rolling deploys).
- Containerizing the app (Docker) and an ECR-based CI/CD pipeline — the natural
  next step if this later moves to ECS Fargate + ALB, not needed for a
  systemd-managed single VM.
- S3 + CloudFront for profile photos — current inline-base64-over-WebSocket
  approach is fine at this message size and room count.
- WAF / rate limiting — the 6-character room code plus not publishing the link
  publicly remains the access model; revisit only if the link model changes.
