# AGENTS.md — Technical Context & Guidelines for AI Agents

Welcome to the **Autolyrics** repository. This document provides technical context, architectural rules, and guidelines for AI agents working on or modifying this codebase.

---

## 1. System Architecture Overview

Autolyrics is a lightweight, real-time web application for synchronized song lyric projection and stage display.

* **Backend**: Node.js + Express (`server/index.js`) + WebSocket (`ws` library on `/ws`).
* **Frontend**: Single Page Application (SPA) in React 18 (`src/app.jsx`), styled with Tailwind CSS (`src/styles.css`).
* **Data Storage**: Single JSON file located at `data/state.json` (overridden via `DATA_DIR` environment variable).
* **Media Uploads**: Audio files (MP3s) stored in `data/uploads/` and served statically via `/uploads/`.
* **Build System**: `esbuild` for bundling React JSX to `public/bundle.js` and `tailwindcss` CLI for compiling `public/styles.css`.

---

## 2. Key Codebase Directives & Rules for Agents

### Source vs. Artifacts
* **DO NOT EDIT ARTIFACTS**: Do not edit `public/bundle.js` or `public/styles.css` directly. Always make edits in `src/app.jsx` or `src/styles.css`.
* **ALWAYS RUN BUILD**: Whenever you modify files in `src/` or dependencies, you **MUST** run:
  ```bash
  npm run build
  ```
  This command executes three sub-scripts:
  1. `npm run build:version` -> generates `src/version.json`
  2. `npm run build:css` -> minifies Tailwind CSS to `public/styles.css`
  3. `npm run build:js` -> bundles React code into `public/bundle.js`

### Versioning Mechanism
* App versioning is formatted as `1.0.<commit_count>`.
* `scripts/generate-version.js` generates `src/version.json` using `git rev-list --count HEAD`.
* In CI/CD (GitHub Actions), ensure `fetch-depth: 0` is set during checkout so commit counts are computed accurately.

---

## 3. Data Models & Synchronization

### Persistent State (`data/state.json`)
The application state is persisted in a single JSON structure:
```json
{
  "songs": [ ... ],
  "playback": {
    "songId": "demo-1",
    "status": "stopped" | "playing" | "paused",
    "anchorEpoch": 1700000000000,
    "anchorElapsed": 0,
    "updatedAt": 1700000000000,
    "fontSize": 64,
    "translationPercent": 60,
    "positionX": 50,
    "positionY": 50,
    "showHeartbeat": true,
    "stagePastLines": 2,
    "stageFutureLines": 2,
    "stageLeadSeconds": 0
  },
  "players": {
    "<player_uuid>": {
      "id": "<player_uuid>",
      "role": "live" | "stage" | null,
      "lastSeen": 1700000000000,
      "online": true
    }
  }
}
```

### WebSocket Communication Protocol (`/ws`)
* **Server to Client**:
  * `{ type: 'state', songs, playback, players, serverIp, serverPort }` (sent on initial connection)
  * `{ type: 'songs', songs }`
  * `{ type: 'playback', playback }`
  * `{ type: 'players', players }`
* **Client to Server**:
  * `{ type: 'registerPlayer', playerId }`
  * `{ type: 'setPlayerRole', playerId, role }`
  * `{ type: 'deletePlayer', playerId }`
  * `{ type: 'setSongs', songs }`
  * `{ type: 'setPlayback', playback }`

---

## 4. Frontend Component Structure (`src/app.jsx`)

All main view components and state management reside in `src/app.jsx`:

1. `useSyncedState()`: WebSocket hook for bi-directional synchronization with `/ws`.
2. `useElapsed(playback)`: Hook that calculates current playback elapsed time in seconds using `anchorEpoch` and `anchorElapsed`.
3. `computeLinesWithTimes(song)`: Helper that converts song lines (whether timed in `sec`, `relative`, `bar_beat`, `beat`, or `relative_bar_beat`) into sorted absolute seconds timestamps (`t`).
4. `WaveformEditor` & `WaveformCanvas`: Canvas-based interactive MP3 waveform renderer with drag-and-drop lyric time markers and support for `single` vs `following` marker drag modes and positive/negative `audioOffset`.
5. Views:
   * `ControlView`: Operator interface for song selection, playback control, jump-to-line, player management, and mobile QR codes.
   * `ProjectionView`: Audience view (`/live`) showing original line and translation, with auto blackout if disconnected > 30s or song ends.
   * `StageView`: Teleprompter view (`/stage`) for singers with past/future line preview and stage lead seconds.
   * `UnassignedPlayerView`: Screen shown to connected `/player` devices before a role (`live` or `stage`) is assigned by the operator.
   * `EditorView` & `SongEditor`: Manage songs, line timings, MP3 uploads, and JSON import/export.
   * `OptionsView`: Adjust fonts, text positions, stage view offsets, and heartbeat dot settings.

---

## 5. Development & Testing Workflow

* **Running Local Server**:
  ```bash
  npm start
  ```
* **Building Assets**:
  ```bash
  npm run build
  ```
* **Dependencies**:
  Ensure packages in `package.json` are installed before running build commands (`npm install`).

When making changes to logic or UI, verify that:
1. `npm run build` completes with zero errors.
2. The server starts cleanly without syntax errors in `server/index.js`.
