# Bot Optimization & Redesign — Changes Summary

## Performance Fixes

### 1. Removed Double Message Processing (index.js)
- **Problem:** Every message was processed TWICE — once via the `msgQueue`/`handleMessageUltra` system AND again in the main handler below it. Commands fired twice, presence updates doubled.
- **Fix:** Removed `handleMessageUltra`, `msgQueue`, `processQueue`, and `perfStats` entirely. One clean, unified message handler now handles everything.

### 2. Fixed Event Listener Leak — CRITICAL (auto-menu.js)
- **Problem:** Every `.menu` command call attached a NEW `messages.upsert` listener to the bot. After hours of use (e.g., 100 menu calls = 100 handlers firing on every single message), the bot became unresponsive and would show "waiting for message" behavior.
- **Fix:** Replaced per-call listeners with a single global handler + a `menuSessions` Map. The handler only does work when a matching session exists. This completely eliminates listener accumulation.

### 3. Removed Conflicting Duplicate Menu Plugin (menu-new.js)
- **Problem:** Both `menu-new.js` and `auto-menu.js` registered the `"menu"` pattern (and the alias `"menu"`), causing double command registration and unpredictable behavior.
- **Fix:** `menu-new.js` is now a stub/disabled file. All menu logic lives in `auto-menu.js`.

### 4. Group Metadata Now Always Cached (index.js)
- **Problem:** The main message handler called `conn.groupMetadata(from)` on every group message without caching, causing a network/database call for every message in every group.
- **Fix:** All group metadata lookups use a 2-minute TTL cache. Cache is automatically invalidated when group membership changes.

### 5. Simplified alive Plugin (main-alive.js)
- **Problem:** The `alive` command downloaded a video via `axios` on every call AND started a `setInterval` that ran 12 times at 5-second intervals, calling `sendPresenceUpdate` each iteration. This kept CPU busy for 60 seconds after each `.alive` call.
- **Fix:** Replaced with a simple, fast response that sends one image with bot stats. Instant, no downloads, no intervals.

### 6. Removed Duplicate ping2 Command (main-ping.js)
- **Problem:** `ping2` was an older, slightly different version of `ping` still registered as a command.
- **Fix:** Removed. Only one clean `ping` command remains.

### 7. Auto Typing/Recording Only on Commands (index.js)
- **Problem:** Auto typing and recording presence updates fired on EVERY message (even chats that weren't bot commands), polluting WhatsApp presence and wasting bandwidth.
- **Fix:** Presence updates now only fire when a command is detected.

### 8. Always Online Heartbeat Optimized (index.js)
- **Problem:** Always online presence was sent every 10 seconds, causing frequent API calls.
- **Fix:** Interval changed to 30 seconds — still maintains online status but with 3x fewer API calls.

---

## Design Standardization

All bot responses now follow a single consistent format:

```
*BOT_NAME*
━━━━━━━━━━━━━━━━━━
Field: Value
Field: Value
━━━━━━━━━━━━━━━━━━
> Powered by BOT_NAME
```

- Removed complex Unicode box art (╔══╗, ╚══╝, etc.) from core plugins — they render incorrectly on some devices and make messages harder to read
- Menu now uses clean bullet-point lists instead of padded box lines
- Consistent footer across all responses: `> DESCRIPTION`
- See `DESIGN_STANDARD.md` for the full style guide

---

## Files Changed

| File | Change |
|---|---|
| `index.js` | Remove double processing, fix caching, optimize presence |
| `plugins/auto-menu.js` | Fix listener leak, clean design, add command cache |
| `plugins/menu-new.js` | Disabled (was duplicate of auto-menu.js) |
| `plugins/main-alive.js` | Simplified — removed video download + setInterval |
| `plugins/main-ping.js` | Removed ping2 duplicate |
| `plugins/auto-typing.js` | Stub (typing now handled centrally) |
| `plugins/auto-recoding.js` | Stub (recording now handled centrally) |
| `plugins/check-uptime.js` | Standardized design |
| `plugins/creator.js` | Standardized design |
| `plugins/main-repo.js` | Standardized design |
| `DESIGN_STANDARD.md` | New — style guide for all future plugins |
