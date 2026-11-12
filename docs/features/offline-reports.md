# Offline reports (PWA)

## What it does
The app can be installed on a phone and a new service report can be filled in without internet. The report is saved on the device and sent when the app is open with a connection, automatically or with "Enviar todos" on `/pendentes`. Only creating a report works offline. History, editing saved reports, DOCX download, tithes and admin need internet.

## Key files
- `public/sw.js` - hand-written service worker: saves `/`, `/culto/novo`, `/pendentes` and their build files, and serves them offline
- `app/manifest.ts` - generic web app manifest; icons in `public/icons/`, offline fallback `public/offline.html`
- `components/offline/OfflineProvider.tsx` - context in the root layout: online state, pending counts, automatic sending, people-list refresh, SW registration
- `components/offline/OfflineStatusBar.tsx`, `InstallHint.tsx` - offline/pending bar under the header; install hint on the home page (Android button, iPhone steps)
- `lib/offline/db.ts` - IndexedDB `relatorio-culto-offline`: `outbox` (pending reports, by `clientId`) and `people` (per church)
- `lib/offline/post-report.ts` - POST with a 20 s timeout, sorted into ok / invalid (400) / auth (401, 403) / retry; `newClientId()`
- `lib/offline/sync.ts` - sends the outbox oldest first, one run at a time (Web Locks across tabs)
- `lib/offline/people.ts` - people list from `GET /api/pessoas?limit=2000` with a device fallback; offline name search
- `lib/offline/clear.ts` - removes the saved pages on login and logout
- `app/culto/novo/page.tsx`, `app/pendentes/page.tsx` - save to the device on failure; list, edit, delete and send pending reports
- `prisma/migrations/20261112000000_report_client_id` - `Report.clientId` and unique `(churchId, clientId)`

## How it works
- Each new-report form gets a `clientId` (UUID v4). `POST /api/relatorios` first looks it up and, if that report exists, answers 200 with its id instead of creating a copy. A unique-index race (P2002) is answered the same way. So a resend after a lost response never duplicates a report.
- On submit, `postReport` runs. `invalid` stays in the form with the server message. `auth` and `retry` put the report in the outbox, marked `pending`.
- `OfflineProvider` sends the outbox on open, on `online`, on return to the foreground, and every 60 s while something is waiting. An `invalid` answer marks the item `error` with the message. Automatic runs skip those; "Enviar todos" retries them. `auth` and `retry` stop the run.
- The SW serves navigations to the three offline pages network-first, with a 6 s timeout before falling back to the saved copy. Other pages fall back to `offline.html`. `/_next/static/*` is cache-first. API and RSC requests are not intercepted: when an RSC fetch fails, Next falls back to a full page load, which the SW serves.
- `warm` (a message from the provider, at most every 15 min) re-downloads the three pages and every `/_next/static/` file they reference. The people list refreshes on every navigation, at most every 20 s.

## Decisions and gotchas
- No Serwist: it needs webpack, and this project builds with Turbopack. If you change caching in `sw.js`, bump `VERSION`.
- iOS Safari has no Background Sync, so sending only happens while the app is open. That's why the pending bar and the "Enviar todos" button exist.
- `proxy.ts` must let `manifest.webmanifest`, `sw.js`, `offline.html` and `icons/` through without a session. Otherwise install and SW registration break while logged out.
- The manifest stays generic: browsers fetch it without cookies, so it can't show the user's church. That's also why "IEQ Canto do Mar" was removed.
- Saved pages contain the church's data, so login and logout delete the `pages-*` caches. Pending reports are kept, scoped by `churchId`. Logout warns when some are unsent.
- `/pendentes` marks the report being edited (`setEditing`) so automatic sending doesn't send the old version. If it was sent meanwhile, the edit is refused, and the change must be made in Histórico.
- iPhone: an installed app has its own storage and cookies, separate from Safari. The user logs in inside the app once with internet. `navigator.storage.persist()` is requested so the outbox isn't evicted.
- The SW is registered only in production builds. In dev, the provider unregisters it.

## How to verify it
Run on 2026-11-12 with a production build (`next start`), a throwaway Postgres 17 and Playwright (Chromium and WebKit):
- With the SW active, offline: `/` and `/culto/novo` open, name suggestions come from the device, saving shows "Relatório salvo no aparelho", and the outbox has 1 item. `/pendentes` opens with "Sem internet" disabled.
- Back online, it sends automatically and the server has exactly 1 new report. Chromium only (Playwright can't intercept requests behind a SW in WebKit): the first POST reached the server (201) but the response was dropped, the item stayed, and "Enviar todos" left exactly 1 report on the server.
- Treasurer role removed before sending: the item shows "Não aceito pelo servidor" and the bar says "com problema". With the role restored, "Enviar todos" empties the outbox.
- Logout leaves no `pages-*` cache.
- Not tested on a real phone. Check install and offline use on Android Chrome and iPhone Safari after deploying (needs HTTPS).
