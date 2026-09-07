/**
 * Requires Node 22.12+, Java 21+, and Firebase CLI.
 * npm install --prefix tests
 * firebase emulators:exec --only database --project demo-gather "node tests/firebase.integration.mjs"
 * Tests use the local demo project only; no SMS, billing, or real Firebase data.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { initializeTestEnvironment, assertSucceeds, assertFails } = await import(process.env.GATHER_RULES_TEST_MODULE || '@firebase/rules-unit-testing');
import { initializeApp, deleteApp } from 'firebase/app';
import { ref, get, set, update, serverTimestamp, getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { createFirebaseRepository } from '../src/services/firebaseRepository.js';
const environment = await initializeTestEnvironment({
  projectId: 'demo-gather',
  database: { host: '127.0.0.1', port: 9000, rules: await readFile(new URL('../database.rules.json', import.meta.url), 'utf8') },
});
const apps = [];
function testDatabase(uid, provider = 'phone') {
  const app = initializeApp({ projectId: 'demo-gather', databaseURL: 'https://demo-gather.firebaseio.com' }, uid ?? 'anonymous');
  apps.push(app);
  const database = getDatabase(app);
  connectDatabaseEmulator(database, '127.0.0.1', 9000, uid ? { mockUserToken: { sub: uid, firebase: { sign_in_provider: provider } } } : undefined);
  return database;
}
const contexts = Object.fromEntries(['alice', 'bob', 'eve'].map(uid => [uid, testDatabase(uid)]));
const anonymous = testDatabase();
const password = testDatabase('password-user', 'password');
const { alice, bob, eve } = contexts;
const id = 'alice~bob';
let a;
let b;
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error(`Timed out: ${label}`);
}
try {
  await environment.clearDatabase();
  for (const [uid, db] of Object.entries(contexts)) await assertSucceeds(set(ref(db, `profiles/${uid}`), { displayName: uid }));
  await assertFails(get(ref(anonymous, 'profiles/alice')));
  await assertFails(get(ref(alice, 'profiles')));
  await assertFails(set(ref(password, 'profiles/password-user'), { displayName: 'not-phone' }));
  await assertFails(set(ref(eve, 'profiles/alice'), { displayName: 'Impersonation' }));
  await assertFails(set(ref(alice, 'profiles/alice/phoneNumber'), '+15550000001'));
  await assertFails(set(ref(alice, 'profiles/alice'), null));
  await assertFails(set(ref(eve, `chats/${id}`), { memberA: 'alice', memberB: 'bob' }));
  await assertFails(set(ref(alice, 'chats/arbitrary'), { memberA: 'alice', memberB: 'bob' }));
  await assertFails(set(ref(alice, 'chats/alice~ghost'), { memberA: 'alice', memberB: 'ghost' }));
  const errors = [];
  a = createFirebaseRepository(alice, { uid: 'alice' }, { displayName: 'alice' }, error => errors.push(error));
  b = createFirebaseRepository(bob, { uid: 'bob' }, { displayName: 'bob' }, error => errors.push(error));
  await until(() => a.connected && b.connected && a.loaded && b.loaded, 'initial connection');
  assert.equal(await a.addContact('bob'), id);
  await until(() => a.getContacts().length === 1 && b.getContacts().length === 1, 'both conversation indexes');
  await assertSucceeds(set(ref(bob, `chats/${id}`), { memberA: 'alice', memberB: 'bob' }));
  await assertFails(set(ref(alice, `chats/${id}`), { memberA: 'alice', memberB: 'eve' }));
  await assertFails(set(ref(alice, `chats/${id}`), null));
  await assertFails(update(ref(alice, `chats/${id}`), { extra: true }));
  await assertFails(get(ref(eve, `messages/${id}`)));
  await assertFails(get(ref(anonymous, `messages/${id}`)));
  await assertFails(get(ref(eve, 'userChats/alice')));
  await assertFails(set(ref(eve, `userChats/eve/${id}`), 'alice'));
  await assertFails(set(ref(alice, `userChats/bob/${id}`), 'eve'));
  const valid = { senderId: 'alice', text: 'Hello', timestamp: serverTimestamp() };
  await assertFails(set(ref(eve, `messages/${id}/outsider`), { ...valid, senderId: 'eve' }));
  await assertFails(set(ref(alice, `messages/${id}/spoof`), { ...valid, senderId: 'bob' }));
  await assertFails(set(ref(alice, `messages/${id}/oversize`), { ...valid, text: 'x'.repeat(4001) }));
  await assertFails(set(ref(alice, `messages/${id}/blank`), { ...valid, text: '' }));
  await assertFails(set(ref(alice, `messages/${id}/badtime`), { ...valid, timestamp: 1 }));
  await assertFails(set(ref(alice, `messages/${id}/extra`), { ...valid, admin: true }));
  const payload = '<img src=x onerror=alert(1)>\nReal multiline message';
  const key = await a.sendMessage(id, payload);
  await until(() => b.getMessages(id).some(message => message.text === payload), 'live delivery');
  assert.equal((await get(ref(bob, `messages/${id}/${key}`))).val().text, payload);
  await until(() => b.getContacts()[0].unread === 1, 'unread count');
  await b.markRead(id);
  await until(() => b.getContacts()[0].unread === 0, 'read state');
  await b.sendMessage(id, 'A reply from Bob');
  await until(() => a.getMessages(id).length === 2 && b.getMessages(id).length === 2, 'second message and both directions');
  assert.equal(a.getMessages(id).at(-1).text, 'A reply from Bob');
  assert.equal(a.getContacts()[0].preview, 'A reply from Bob');
  await assertFails(set(ref(alice, `readState/bob/${id}`), Date.now()));
  await assertFails(set(ref(alice, `messages/${id}/${key}/text`), 'edited'));
  await assertFails(set(ref(alice, `messages/${id}/${key}`), null));
  b.dispose();
  b = createFirebaseRepository(bob, { uid: 'bob' }, { displayName: 'bob' }, error => errors.push(error));
  await until(() => b.getMessages(id).length === 2, 'reload persistence');
  assert.equal(b.getMessages(id)[0].text, payload);
  assert.deepEqual(errors, []);
  a.dispose();
  await assert.rejects(a.sendMessage(id, 'After logout'));
  console.log('PASS: participant access, phone-only auth, profile ownership, immutable membership, forged/invalid writes rejected, live delivery, unread state, reload persistence, disposed sessions.');
} finally {
  a?.dispose(); b?.dispose();
  await Promise.all(apps.map(deleteApp));
  await environment.cleanup();
}
