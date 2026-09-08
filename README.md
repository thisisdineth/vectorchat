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

Presence, typing, phone-number discovery, App Check, attachments, and WebRTC remain unimplemented. Message access is secured by Firebase rules, not end-to-end encryption. See the setup guide for limitations and next steps.

## Appearance

All appearance controls are in **Settings**. Open it using the gear/profile icon in the inbox, or Settings on the sign-in screen. Dark mode follows your system until you choose a theme; the choice persists in this browser and synchronizes across tabs.

## Inbox design

The chat workspace follows the supplied dark inbox reference: a full-viewport shell, narrow navigation rail, compact conversation list, subtle message wallpaper, cyan unread/compose accents, and a pill-shaped composer. The light theme uses the same layout. Mobile switches between the inbox and full-screen conversation.

Use the rail to open the inbox, start a conversation, view your profile/settings, or preview the call design. Account ID sharing and logout are now under Settings (also accessible through your rail avatar). The desktop menu button collapses the inbox.

The emoji picker inserts emoji into the existing message draft. Attachments remain a coming-soon placeholder. Header call buttons open an explicitly labeled, local-only design preview of the incoming, active, and feedback cards. These previews do not use the microphone/camera, make calls, create chat events, or submit feedback. Firebase messaging remains unchanged.

Workspace styling is in `src/workspace.css`, the local SVG wallpaper in `public/chat-pattern.svg`, and UI-only navigation, emoji, and call previews in `src/ui/workspace.js`.

## Message status and required rules update

Publish the updated **database.rules.json** in Firebase Console → Realtime Database → Rules before using delivery/seen status. Vercel deployment does not publish database rules. Existing messages remain intact.

- A small clock means the send is waiting for Firebase acknowledgement.
- One gray tick: Firebase accepted the message; recipient delivery is not acknowledged yet.
- Two gray ticks: the recipient's signed-in app loaded the message.
- Two blue ticks: the received message was visible in the recipient's foreground conversation.
- Red **!**: the send failed. Click it to retry the same message. Unsent/failed items are held in memory and cleared by reload or logout.

Delivery requires the recipient to run the app; this is not a push-notification or phone-level delivery signal. Seen tracks viewport visibility, not whether a person actually read the text. A hidden tab, closed mobile conversation, or open settings/call preview does not mark messages seen. Only loaded messages (latest 100) are acknowledged. Old messages receive receipts when loaded by the recipient after this update.

Receipts are stored separately at `receipts/{chatId}/{messageId}/{recipientUid}` with `delivered` and optional `seen` flags. Only the actual recipient may write their acknowledgement; neither the sender nor outsiders can forge it. These flags cannot be cleared once set. The old `readState` data remains for compatibility; new seen acknowledgements use message IDs, avoiding timestamp collisions.
