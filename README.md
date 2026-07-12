# Table — local multiplayer chess

Host a live chess game on your computer; two tablets on the same Wi‑Fi connect
in their browser and play in real time, no app install required.

## Requirements

- [Node.js](https://nodejs.org) 16 or newer installed on the host computer.
- The host computer and both tablets on the **same Wi‑Fi network**.

## Setup

1. Copy the `chess-platform` folder onto the computer that will host the game.
2. Open a terminal in that folder and install dependencies (one-time, needs internet):
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. The terminal prints two addresses, e.g.:
   ```
   On this computer:  http://localhost:3000
   On your network:   http://192.168.1.42:3000
   ```

## Playing

1. On the host computer (or any device), open the "on your network" address and
   click **Start a new table**. A 6-character table code appears.
2. On each tablet, open the same address and enter the code under **Join a
   table** — the first to join gets White, the second gets Black. Anyone
   after that joins as a spectator.
3. Each seated player fills in a quick profile: name, an optional catchphrase,
   and an optional avatar — either a photo uploaded from the tablet or a
   quick finger-drawing on a built-in canvas. Names and catchphrases are
   checked against a family-friendly word filter (both in the browser and on
   the server, so it can't be skipped) — a flagged entry just asks the
   player to try something else. Once both players have set up their
   profile, a short "vs" intro plays on both screens (name, photo,
   catchphrase, and piece color for each player) before the board appears.
   The intro auto-advances after a few seconds, or either player can tap
   **Let's play →** to skip ahead.
4. Tap a piece to see its legal moves highlighted, then tap a destination
   square to move. Moves sync instantly to both tablets.
5. When a game ends, either player can tap **Start new game** to reset the
   board without leaving the table — profiles carry over, and the intro
   plays again for the new game.

A player's name/catchphrase/avatar are also remembered on that tablet's
browser (via local storage) so returning players don't have to redraw their
avatar every match — the form just pre-fills next time.

## Playing over the internet (remote family tournament)

By default the server is only reachable on your home Wi‑Fi. To let people
join from anywhere, run a **tunnel** alongside the server — it gives you a
public `https://` link that forwards straight to your computer. Nothing in
the app itself needs to change; you just also run one more command and share
its link instead of the "on your network" address.

Two good, free options:

**Cloudflare Tunnel (no account needed for a quick tunnel)**
1. Install `cloudflared`: see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. With `npm start` already running in one terminal, open a second terminal in the same folder and run:
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
3. It prints a public URL like `https://random-words-1234.trycloudflare.com`. Share that link with your family instead of the local network address — everything else (starting a table, joining with a code) works exactly the same.

**ngrok (also free, requires a quick sign-up)**
1. Install from https://ngrok.com/download and follow their one-time `ngrok config add-authtoken ...` setup.
2. With the server running, in a second terminal:
   ```
   ngrok http 3000
   ```
3. Share the `https://....ngrok-free.app` URL it prints.

**On tournament day:**
1. Start the server (`npm start`) and the tunnel, in that order.
2. Open the tunnel's URL yourself, click **Start a new table**, and send that same URL + the table code to the two players for that match.
3. Each match gets its own table code, so several matches can run at once, all through the same link.
4. Keep both terminal windows open for the whole tournament — closing either one drops the connection. Free tunnel links also expire when you stop `cloudflared`/`ngrok`, so if you need to restart, re-share the new link.

A note on privacy: the table code is the only thing standing between a
stranger and joining a game if they had the link, which is why codes are now
6 characters. For a family event sharing the link only with relatives, this
is reasonably safe — just don't post the tunnel link anywhere public.

## Notes

- Game state lives in the server's memory — closing the terminal ends all
  active tables. Refreshing a tablet's browser will drop that player to
  spectator on rejoin (the seat isn't preserved across a hard refresh).
- If tablets can't reach the "on your network" address, check that your
  computer's firewall allows incoming connections on the port shown (default
  3000), and that the tablets aren't on a guest/isolated Wi‑Fi network that
  blocks device-to-device traffic.
- To run on a different port: `PORT=8080 npm start`.

## Project layout

```
chess-platform/
├── server.js          # Express + WebSocket server, room + chess rules (chess.js)
├── package.json
└── public/
    ├── index.html      # lobby: start or join a table
    ├── game.html        # board screen
    ├── css/style.css
    └── js/game.js        # board rendering + move interaction
```

This is intentionally a small, self-contained foundation — additional games
can be added as new room types alongside chess without changing the core
server/lobby pattern.
