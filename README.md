<div align="center">

<img src="build/icon.png" width="96" alt="">

# Claude Code UI

**A clean, claude.ai-style desktop app for [Claude Code](https://docs.claude.com/en/docs/claude-code/overview).**
All your past Claude Code sessions in a sidebar, live tool output, and one-click permissions — no terminal required.

[**Download**](../../releases/latest) · [Features](#features) · [Build from source](#build-from-source) · [How it works](#how-it-works)

<img src="docs/screenshot-light.png" alt="Claude Code UI showing a chat with tool calls and a code block" width="860">

</div>

> [!NOTE]
> This is an unofficial community project. It isn't made by or affiliated with Anthropic. It's a front end for the official Claude Code CLI, which you install and sign in to separately.

## Features

- **Your whole history, organized** — reads the transcripts Claude Code already saves in `~/.claude/projects`, so chats you started in the terminal show up too. Grouped into Today / Yesterday / Previous 7 days, with a **Projects** list of every folder you've used, plus **Starred** chats.
- **Search** across chat titles and the full text of every message (`Ctrl/⌘+K`).
- **Live streaming** replies with readable tool cards: shell commands with output, file edits as red/green diffs, to-do lists, sub-agents, web fetches.
- **Permissions without the guesswork** — pick *Ask first*, *Accept edits*, *Plan mode* or *Bypass*. If Claude gets blocked on a tool, one click allows it and continues.
- **Model picker** (Opus / Sonnet / Haiku), **folder picker** for new chats, and a **stop** button (or `Esc`).
- Keeps working in the background — switch chats while Claude runs; a spinner marks busy chats, and you re-attach to the live output when you come back.
- Rename, star and delete chats. Deleted transcripts go to `~/.claude-code-ui/trash`, never erased.
- Light, dark and system themes, collapsible sidebar, and a phone-sized layout.
- Works with `claude --resume`: every chat has a **Copy resume command** to continue it in the terminal.

<table>
<tr>
<td><img src="docs/screenshot-dark.png" alt="Dark theme"></td>
<td><img src="docs/screenshot-permissions.png" alt="Granting a blocked tool permission"></td>
</tr>
<tr>
<td align="center"><sub>Dark theme</sub></td>
<td align="center"><sub>Allowing a blocked tool and continuing</sub></td>
</tr>
</table>

## Install

1. Install **Claude Code** and sign in once:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude
   ```
2. Download the installer for your system from the [**latest release**](../../releases/latest):
   - **Windows:** `Claude-Code-UI-…-win-x64.exe`. If Windows shows *"Windows protected your PC"*, click **More info → Run anyway** (the app isn't signed with a paid certificate).
   - **Mac:** the `.dmg` for your chip (`arm64` for Apple Silicon, `x64` for Intel). Drag the app into Applications; the first time, right-click it → **Open** → **Open**.
   - **Linux:** the `.AppImage`. Make it executable (`chmod +x`) and run it.

## Build from source

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone <this repo's URL>
cd claude-code-ui
npm install
npm start          # run the desktop app
npm run dist       # build an installer for your OS into ./dist
npm run web        # or: use it in your browser at http://localhost:3456
npm test           # smoke test (doesn't need Claude Code installed)
```

On Windows you can also double-click `start.bat`, which installs on first run and then opens the app.

### Releasing

Bump `version` in `package.json`, then tag and push:

```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions builds the Windows, Mac and Linux installers and attaches them to a new release automatically.

## How it works

```
┌──────────── desktop app (Electron) ─────────────┐
│  window  ⇄  local server (server.js, 127.0.0.1)  │
└──────────────────────┬───────────────────────────┘
          reads        │        runs
  ~/.claude/projects ◄─┴─► claude -p --output-format stream-json --resume <id>
```

- **History** comes straight from Claude Code's own transcript files; nothing is copied or synced anywhere.
- **Messages** run `claude` in headless mode in the chat's folder, streaming its events into the window.
- The server only listens on `127.0.0.1` and rejects requests from other hosts or websites, since it can run Claude with tool access.
- Headless mode can't pause to ask for approval mid-task, so tool permissions are chosen up front (or granted afterwards with **Allow & continue**).
- No dependencies at runtime — the server and UI are plain Node and vanilla JavaScript. Electron is only used for the desktop window.

### Options

Environment variables, mostly useful with `npm run web`:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3456` (web) · `3457` (app) | Port to listen on; tries the next one if taken |
| `CLAUDE_BIN` | `claude` | Path to the Claude Code executable if it isn't on your PATH |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Where Claude Code keeps its data |
| `DEFAULT_CWD` | home / launch folder | Starting folder for new chats |
| `NO_OPEN` | — | Set to `1` so `npm run web` doesn't open a browser |

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Enter` / `Shift+Enter` | Send / new line |
| `Ctrl/⌘ + K` | Search chats |
| `Ctrl/⌘ + Shift + O` | New chat |
| `Ctrl/⌘ + B` | Toggle sidebar |
| `Ctrl/⌘ + ,` | Settings (desktop app) |
| `Esc` | Stop Claude |

## Project layout

```
server.js            local API + runs the claude CLI
electron/main.js     desktop window, menu, PATH fix-up
public/              the UI (index.html, app.js, style.css, md.js)
scripts/             smoke test
build/icon.png       app icon
.github/workflows/   CI and installer builds
```

## License

[MIT](LICENSE)
