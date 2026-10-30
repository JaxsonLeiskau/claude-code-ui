# Roundtable — notes for Claude Code

Roundtable is a desktop app (Electron) that gives Claude Code a claude.ai-style interface, plus
chats with other AI models, debates, projects with shared memory, and sync between computers.
The owner isn't a programmer: explain changes in plain language, and keep the app working.

## How it's built

- `server.js` — local HTTP server (127.0.0.1 only) and the API the page uses: sessions, projects,
  running the `claude` CLI headless (`-p --output-format stream-json`), uploads, usage, routes for everything below.
- `ai.js` — Open WebUI / ChatGPT / Gemini / DeepSeek (OpenAI-compatible APIs), plain Claude chats and
  debate mode (Claude runs through the CLI with tools off).
- `sync.js` — sync through a private GitHub repo via the GitHub REST API (three-way compare per file).
- `commands.js` — the `/` menu (skills, commands, plugins, headless-safe built-ins). `/plugin …` is run by
  Roundtable itself through `claude plugin …` (`POST /api/plugin`), since the interactive menu needs a terminal.
- `import.js` — imports claude.ai data exports (old single zip and new split zips / manifest), and pulls the
  text out of attached Word, PowerPoint and Excel files (`officeText`) so every chat can read them.
- `remote.js` — optional phone access: a second listener (default port 3500) that only answers Tailscale
  addresses and needs a password sign-in (cookie session, lockout after failed tries).
- `electron/main.js` + `electron/preload.js` — windows, menu, auto-updates, claude.ai export downloads.
- `public/` — the whole UI in plain HTML/CSS/vanilla JS (`app.js`, `style.css`, `md.js`). No build step,
  no frameworks, no runtime dependencies. Keep it that way.
- User data lives in `~/.roundtable/` (chats, projects, settings, sync state). Claude Code's own
  transcripts are in `~/.claude/projects/`. Never delete user data; things go to `~/.roundtable/trash`.

## Checking your work

- `npm test` runs `scripts/smoke-test.js` and `scripts/integration-test.js`. They use stand-ins in
  `scripts/` for GitHub, the AI APIs and the `claude` CLI, so no keys or network are needed. Add a test
  for anything new that can be tested this way, and keep both passing.
- `npm run web` serves the UI at http://localhost:3456 for trying changes in a browser.
- `npm start` runs the desktop app from source (needs `npm install` once).
- Syntax check: `node --check` on each changed .js file (CI does this too).

## Releasing (this is how the owner gets updates)

1. Bump `version` in `package.json` (patch for fixes, minor for features).
2. Commit and push to `main`. Commit messages say what changed for the user.
3. GitHub Actions (`.github/workflows/release.yml`) sees the new version, builds the Windows, Mac and
   Linux installers, and publishes release `v<version>`. Installed apps update themselves
   (File → Check for Updates…). Pushing without a version bump runs tests but doesn't release.

## Things to keep in mind

- Windows is the main platform: paths with spaces, `claude` is a `.cmd` (spawned through the shell
  with quoting — see `spawnClaude`/`winQuote`), and temp folders may stay locked briefly.
- The server only accepts requests from this computer (Host/Origin checks). Don't loosen that.
  The one deliberate exception is phone access in `remote.js` (opt-in, Tailscale-only, password); keep its checks
  at least as strict, and keep `/api/remote*` and updates off-limits from phones.
- API keys and the sync token stay on each computer and are never synced or logged.
- The appId `local.claude-code-ui` and the data-folder migration from `~/.claude-code-ui` must stay,
  or existing installs stop updating / lose data.
