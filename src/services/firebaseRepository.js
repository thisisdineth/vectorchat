import { ref, get, set, update, onValue, query, orderByChild, limitToLast, push, serverTimestamp } from 'firebase/database';
import { chatIdFor, validateMessage, initials } from './chatModel.js';

export async function loadProfile(database, user) {
  const snapshot = await get(ref(database, `profiles/${user.uid}`));
  return snapshot.val();
}
export async function saveProfile(database, user, name) {
  const displayName = name.trim();
  if (!displayName || displayName.length > 60) throw new Error('Choose a name between 1 and 60 characters.');
  await set(ref(database, `profiles/${user.uid}`), { displayName });
  return { displayName };
}

export function createFirebaseRepository(database, user, profile, onError) {
  const currentUser = { id: user.uid, name: profile.displayName };
  const contacts = new Map();
  const conversations = new Map();
  const chatListeners = new Map();
  const subscribers = new Set();
  const readThrough = new Map();
  let stopped = false;
  let connected = false;
  let loaded = false;
  const emit = () => { if (!stopped) subscribers.forEach(listener => listener()); };
  const fail = error => { if (!stopped) onError(error); };
  function updateConversationPreview(id) {
    const contact = contacts.get(id);
    const history = conversations.get(id) ?? [];
    const last = history.at(-1);
    contact.preview = last ? `${last.senderId === user.uid ? 'You: ' : ''}${last.text}` : 'Start a conversation';
    contact.timestamp = last?.timestamp ?? null;
    contact.unread = history.filter(message => message.senderId !== user.uid && message.timestamp > (readThrough.get(id) ?? 0)).length;
  }
  const stopConnection = onValue(ref(database, '.info/connected'), snapshot => { connected = snapshot.val() === true; emit(); }, fail);
  const stopIndex = onValue(ref(database, `userChats/${user.uid}`), snapshot => {
    const entries = snapshot.val() ?? {};
    for (const [id, stop] of chatListeners) {
      if (!(id in entries)) { stop(); chatListeners.delete(id); contacts.delete(id); conversations.delete(id); }
    }
    for (const [id, peerId] of Object.entries(entries)) {
      if (chatListeners.has(id)) continue;
      contacts.set(id, { id, peerId, name: 'Gather member', initials: 'GM', color: 'sage', online: null, status: 'Presence not enabled', unread: 0, preview: 'Loading messages…', timestamp: null });
      const stops = [];
      // Register before attaching callbacks, so each chat gets one listener set.
      chatListeners.set(id, () => stops.forEach(stop => stop()));
      stops.push(onValue(ref(database, `profiles/${peerId}`), result => {
        const contact = contacts.get(id);
        if (!contact || stopped) return;
        contact.name = result.val()?.displayName ?? 'Gather member';
        contact.initials = initials(contact.name);
        emit();
      }, fail));
      stops.push(onValue(ref(database, `readState/${user.uid}/${id}`), result => {
        if (stopped || !contacts.has(id)) return;
        readThrough.set(id, result.val() ?? 0);
        updateConversationPreview(id);
        emit();
      }, fail));
      stops.push(onValue(query(ref(database, `messages/${id}`), orderByChild('timestamp'), limitToLast(100)), result => {
        if (stopped || !contacts.has(id)) return;
        const history = [];
        // Firebase stops iterating if the callback returns true/truthy.
        result.forEach(child => { history.push({ id: child.key, ...child.val() }); });
        conversations.set(id, history);
        updateConversationPreview(id);
        emit();
      }, fail));
    }
    loaded = true;
    emit();
  }, fail);
  return {
    currentUser,
    get connected() { return connected; },
    get loaded() { return loaded; },
    getContacts: () => structuredClone([...contacts.values()]).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    getMessages: id => structuredClone(conversations.get(id) ?? []),
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    async addContact(peerId) {
      if (stopped) throw new Error('Please sign in again.');
      if (!connected) throw new Error('Reconnect before starting a chat.');
      const id = chatIdFor(user.uid, peerId.trim());
      const peer = await get(ref(database, `profiles/${peerId.trim()}`));
      if (!peer.exists()) throw new Error('Account not found. Ask your contact to sign in and choose a name first.');
      if (stopped) throw new Error('Please sign in again.');
      const [memberA, memberB] = id.split('~');
      // Idempotent immutable metadata makes concurrent conversation creation safe.
      await set(ref(database, `chats/${id}`), { memberA, memberB });
      if (stopped) throw new Error('Please sign in again.');
      await update(ref(database), {
        [`userChats/${user.uid}/${id}`]: peerId.trim(),
        [`userChats/${peerId.trim()}/${id}`]: user.uid,
      });
      return id;
    },
    async markRead(id) {
      if (stopped || !connected || !contacts.get(id)?.unread) return;
      const last = conversations.get(id)?.at(-1)?.timestamp;
      if (!last || last <= (readThrough.get(id) ?? 0)) return;
      readThrough.set(id, last);
      try { await set(ref(database, `readState/${user.uid}/${id}`), last); }
      catch (error) { readThrough.delete(id); throw error; }
    },
    async sendMessage(id, text) {
      if (stopped) throw new Error('Please sign in again.');
      if (!connected) throw new Error('You’re offline. Reconnect to send your message.');
      if (!contacts.has(id)) throw new Error('Select a conversation first.');
      const message = { senderId: user.uid, text: validateMessage(text), timestamp: serverTimestamp() };
      // onValue also emits local writes immediately; awaiting set confirms server acceptance.
      const location = push(ref(database, `messages/${id}`));
      await set(location, message);
      return location.key;
    },
    dispose() {
      stopped = true;
      stopIndex();
      stopConnection();
      chatListeners.forEach(stop => stop());
      chatListeners.clear();
      subscribers.clear();
      contacts.clear();
      conversations.clear();
      readThrough.clear();
    },
  };
}
