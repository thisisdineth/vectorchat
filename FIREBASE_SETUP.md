# Connect Gather to Firebase

The code is ready for Firebase, but you must create a project and configure it before real SMS or message storage will work. You do not need a server or Cloud Functions for this version.

## 1. Create the project and web app

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project, for example `gather-chat`. Analytics is optional and not used by this app.
2. In Project settings → General, add a **Web app** using the `</>` button. Give it a nickname such as `Gather Web`.
3. Keep the displayed `firebaseConfig` values handy. Do not paste its JavaScript snippet into `index.html`; this project already initializes Firebase.

## 2. Enable phone login

1. Open Authentication and get started. Under Sign-in method, enable **Phone** and save.
2. Under Authentication → Settings → SMS region policy, allow only the countries you need. For a Sri Lankan number, allow Sri Lanka.
3. To send real SMS, link a billing account / upgrade to **Blaze**. Review SMS pricing and configure budget alerts. Alerts notify you; they do not impose a spending cap.
4. For initial testing, add two **fictional test phone numbers** and six-digit codes under the Phone provider's testing section. These use the configured codes without sending SMS. Never publish test codes or use your personal number as a fictional test number.

Firebase's [phone login guide](https://firebase.google.com/docs/auth/web/phone-auth) covers provider settings, reCAPTCHA, regions, and testing. Real SMS requires billing; see [Authentication FAQ](https://firebase.google.com/docs/auth/faq-and-troubleshooting) and [usage limits](https://firebase.google.com/docs/auth/limits). Possession of the phone number grants account access, so protect your SIM and sign out on shared devices.

## 3. Create Realtime Database and publish the rules

1. Open **Realtime Database**, not Cloud Firestore, and choose Create database.
2. Choose a region close to your users. Start in **locked mode**.
3. Copy the database URL from the Data tab. It may end in `.firebaseio.com` or `.firebasedatabase.app`; use the exact URL shown.
4. Open the Rules tab. Replace the existing rules with the complete contents of `database.rules.json` in this project and click **Publish**.

Do not use public read/write rules or broad `auth != null` rules. The supplied rules validate message ownership, chat membership, immutable participant IDs, text length, server timestamps, and profile shape. Root reads and phone-number directory listing are not allowed. The authorization is enforced by Firebase, independently of the UI. See [Realtime Database Security Rules](https://firebase.google.com/docs/database/security).

Optional CLI deployment, once you have installed the Firebase CLI and signed in:

```sh
firebase deploy --only database --project YOUR_PROJECT_ID
```

`firebase.json` already points at the included rules file. Rules deployment is separate from deploying the frontend to Vercel.

## 4. Add your public configuration locally

From the project directory:

```sh
cp .env.example .env.local
```

Fill `.env.local` using the Web app configuration:

```dotenv
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-exact-database-url
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-web-app-id
```

Storage bucket and messaging sender ID are reserved and not required by this version. App Check is not initialized yet; leave its placeholder blank. Do not enforce App Check on the database until you add and test the App Check client integration.

These are **public browser configuration values**, not admin credentials. Never place service account JSON, private keys, billing credentials, or server secrets in a `VITE_` variable. `.env.local` is excluded from Git.

Install Node.js 22.12+ if `npm` is not found. Then:

```sh
npm install
npm run dev
```

Restart Vite after changing environment variables. Without configuration, Gather shows a setup screen rather than mock chats.

## 5. Deploy for real phone verification

1. Push the project to GitHub, excluding `.env.local`.
2. Import it into Vercel. Use preset **Vite**, build command `npm run build`, and output directory `dist`.
3. In Vercel → Project settings → Environment Variables, add the same five values above for the deployment environment you use. Redeploy after changing them; Vite reads them at build time.
4. Copy your stable HTTPS hostname, such as `gather-example.vercel.app`.
5. Add that hostname under Firebase Authentication → Settings → Authorized domains. Enter the hostname without `https://` or a path.
6. Open the deployed URL, enter your phone number in international format, accept the SMS notice, complete reCAPTCHA, and enter the SMS code.

Use the deployed, authorized HTTPS domain for real SMS verification. Firebase explicitly states that localhost is not an allowed hosted domain for phone authentication in its [web phone authentication guide](https://firebase.google.com/docs/auth/web/phone-auth). Do not disable app verification in production to work around domain errors. A separate reCAPTCHA site key is not needed for Firebase Phone Authentication's built-in verifier.

## 6. Test a complete conversation

1. Sign in with your phone, then choose a display name.
2. Click **Copy my account ID**. This is your Firebase user ID; it is not a password.
3. Have a second person sign in with a different number (or use a second fictional test account in a separate browser profile).
4. Click the compose icon above the contact list. Paste the other person's account ID and click Open chat. Both accounts receive the conversation in their lists.
5. Send a message. The sender sees “Message saved” after Firebase accepts it, and the other browser updates through a live listener.
6. Reload both browsers. The messages should remain. Sign out, sign in again, and confirm the conversation returns.
7. Click **Log out**. Chat state and drafts are cleared and listeners are detached. Stored messages remain in Firebase for the participants' next login.

Neither person needs to publish their phone number in the database. Only their display name is stored in `profiles`. In this version, known account IDs can be used to start chats without an approval request; share IDs with intended contacts. Adding phone-number discovery or blocking should be a separate feature with abuse controls.

## Data layout

```text
profiles/{uid}/displayName
chats/{sortedUidA~sortedUidB}/{memberA, memberB}
userChats/{uid}/{chatId} = otherParticipantUid
messages/{chatId}/{messageId} = { senderId, text, timestamp }
readState/{uid}/{chatId} = lastSeenMessageTimestamp
```

The UI currently loads the most recent **100 messages per conversation**. All accepted messages remain stored, but older-history pagination is not implemented. Unread badges count unread messages within that loaded window. Server timestamps define message order. Contact previews are derived from messages, avoiding a separately writable message-summary record.

Sending is disabled while disconnected. If a connection drops during an in-flight send, it waits for server acknowledgement; do not close the tab before “Message saved” if the message matters. Failed sends restore the text for retry. Browser drafts are not persisted. Messages use Firebase transport security and access rules; this is **not end-to-end encryption**.

Online presence, typing, recipient read receipts, attachments, phone-number discovery, App Check, and audio/video calling are still future work. The header does not pretend contacts are online.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Setup screen | Fill all five required `.env.local` values and restart Vite; on Vercel add variables and redeploy. |
| `auth/unauthorized-domain` | Add the exact deployed hostname in Authentication settings. |
| reCAPTCHA / app credential error | Check authorized hostname, API key and auth domain; allow Google reCAPTCHA through browser blockers; use HTTPS deployment. |
| No SMS | Check Blaze billing, allowed SMS region, Phone provider, full country code, quotas, and whether the number is a fictional test number. |
| Too many requests | Stop retrying and wait; use configured fictional numbers during development. |
| Database permission denied | Publish this project's rules to the database matching `VITE_FIREBASE_DATABASE_URL`; ensure Phone sign-in was used. |
| Empty contact list | Each user must sign in and choose a name. Start a chat with the other account's copied ID. |
| `npm` not found | Install a supported Node.js runtime and reopen your terminal. |

## Verification

`npm test` runs pure model and mock-adapter tests. `npm run build` validates the production bundle. Security-rule and repository integration tests are provided separately in `tests/firebase.integration.mjs`; their emulator setup is documented at the top of the file. They use a demo project and do not send SMS or touch production data.

A live project and a real device are still needed to verify carrier SMS delivery, deployed-domain reCAPTCHA, and production configuration.
