# Gather

A responsive chat app built with HTML, CSS, vanilla JavaScript, Vite, and the official Firebase SDK. Step 2 adds phone OTP sign-in, logout, profiles, and persistent 1-to-1 messages through Firebase Realtime Database.

**Start with [FIREBASE_SETUP.md](FIREBASE_SETUP.md)** for project creation, SMS billing/provider settings, database rules, environment variables, Vercel deployment, and two-account testing. Firebase is not configured until you supply your project's public web configuration.

## Run

Use Node.js 22.12+.

```sh
npm install
cp .env.example .env.local
# Fill .env.local using FIREBASE_SETUP.md
npm run dev
```

`npm run build` creates `dist/`; `npm run preview` serves it. `npm test` runs local model and mock repository tests. Real SMS verification should be tested on an authorized deployed HTTPS domain.

## Structure

- `index.html`: login, profile, contact, conversation, and new-chat markup.
- `src/main.js`: authentication lifecycle, navigation, drafts, and UI coordination.
- `src/ui/auth.js`: phone/reCAPTCHA and OTP form handling, friendly errors.
- `src/ui/`: safe reusable DOM rendering for contacts and messages.
- `src/services/firebase.js`: environment configuration and Firebase initialization.
- `src/services/firebaseRepository.js`: profiles, chat creation, subscriptions, persisted messages, unread state, and cleanup.
- `src/services/chatModel.js`: shared ID and message validation.
- `src/data/` and `mockRepository.js`: original fixtures and adapter retained for isolated tests; not used in the real app.
- `database.rules.json`: participant-based access and data validation.
- `firebase.json`: database rules and local emulator configuration.

## Current behavior

Users sign in with phone OTP and choose a name. Share account IDs to start a chat. Both participants see incoming messages live, and accepted messages survive reload/logout. The latest 100 messages are loaded per conversation. Logout clears the browser UI and drafts and detaches database listeners. Firebase manages the authentication session; tokens and OTPs are not stored by application code.

There are no frontend frameworks, analytics, or third-party UI libraries. Message text is rendered with `textContent`. Firebase loads the required reCAPTCHA service for phone authentication. No API keys or credentials are committed.

Presence, typing, visible read receipts, phone-number discovery, App Check, attachments, and WebRTC remain unimplemented. Message access is secured by Firebase rules, not end-to-end encryption. See the setup guide for limitations and next steps.

## Appearance

Use the **Dark mode** toggle on the sign-in screen or beside the Gather logo. Inside a chat, the moon/sun button is available next to the call buttons, including on mobile. Its pressed state indicates dark mode is enabled.

Gather follows your system appearance until you choose a theme. Your choice is saved in this browser and survives reloads and logout; open tabs stay in sync. If browser storage is blocked, switching still works for the current page. Colors live in `src/theme.css`; `public/theme.js` applies the preference before the application loads to avoid a light flash. No Firebase records are changed.
