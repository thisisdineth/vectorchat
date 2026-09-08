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
  const readThrough = new Map(); // Legacy unread markers from the previous version.
  const receipts = new Map();
  const outbox = new Map();
  const acknowledging = new Set();
  const receiptFailures = new Set();
  let receiptErrorReported = false;
  let stopped = false;
  let connected = false;
  let loaded = false;
  const emit = () => { if (!stopped) subscribers.forEach(listener => listener()); };
  const fail = error => { if (!stopped) onError(error); };
  function historyFor(id) {
    const history = new Map((conversations.get(id) ?? []).map(message => [message.id, { ...message }]));
    for (const message of outbox.values()) {
      if (message.chatId === id) history.set(message.id, { ...history.get(message.id), ...message });
    }
    const peerId = contacts.get(id)?.peerId;
    return [...history.values()].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)).map(message => {
      if (message.senderId === user.uid && !outbox.has(message.id)) {
        const acknowledgement = receipts.get(id)?.[message.id]?.[peerId];
        message.status = acknowledgement?.seen ? 'seen' : acknowledgement?.delivered ? 'delivered' : 'sent';
      }
      return message;
    });
  }
  async function acknowledge(id, messages, seen = false) {
    if (stopped || !connected) return;
    const patch = {};
    const keys = [];
    for (const message of messages) {
      if (message.senderId === user.uid) continue;
      const own = receipts.get(id)?.[message.id]?.[user.uid];
      const key = `${id}/${message.id}/${seen ? 'seen' : 'delivered'}`;
      if (own?.[seen ? 'seen' : 'delivered'] || acknowledging.has(key) || receiptFailures.has(key)) continue;
      acknowledging.add(key);
      keys.push(key);
      patch[`receipts/${id}/${message.id}/${user.uid}/delivered`] = true;
      if (seen) patch[`receipts/${id}/${message.id}/${user.uid}/seen`] = true;
    }
    if (!keys.length) return;
    try { await update(ref(database), patch); }
    catch (error) {
      keys.forEach(key => receiptFailures.add(key));
      if (!stopped && !receiptErrorReported) { receiptErrorReported = true; fail(error); }
    } finally { keys.forEach(key => acknowledging.delete(key)); }
  }
  async function commitMessage(message) {
    message.status = 'pending';
    delete message.error;
    outbox.set(message.id, message);
    updateConversationPreview(message.chatId);
    emit();
    try {
      if (!connected) throw new Error('You’re offline. Reconnect, then click ! to retry.');
      await set(ref(database, `messages/${message.chatId}/${message.id}`), {
        senderId: user.uid, text: message.text, timestamp: serverTimestamp(),
      });
      if (!stopped) outbox.delete(message.id);
      return message.id;
    } catch (error) {
      if (!stopped) {
        message.status = 'failed';
        message.error = String(error.message || 'Message failed to send.');
      }
      error.messageId = message.id;
      throw error;
    } finally {
      if (!stopped) { updateConversationPreview(message.chatId); emit(); }
    }
  }
  function updateConversationPreview(id) {
    const contact = contacts.get(id);
    if (!contact) return;
    const history = historyFor(id);
    const last = history.at(-1);
    contact.preview = last ? `${last.senderId === user.uid ? 'You: ' : ''}${last.text}` : 'Start a conversation';
    contact.timestamp = last?.timestamp ?? null;
    contact.unread = history.filter(message => message.senderId !== user.uid && !receipts.get(id)?.[message.id]?.[user.uid]?.seen && message.timestamp > (readThrough.get(id) ?? 0)).length;
  }
  const stopConnection = onValue(ref(database, '.info/connected'), snapshot => {
    connected = snapshot.val() === true;
    if (connected) {
      receiptFailures.clear();
      receiptErrorReported = false;
      for (const [id, messages] of conversations) void acknowledge(id, messages);
    }
    emit();
  }, fail);
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
      stops.push(onValue(ref(database, `receipts/${id}`), result => {
        if (stopped || !contacts.has(id)) return;
        receipts.set(id, result.val() ?? {});
        updateConversationPreview(id);
        emit();
      }, error => {
        if (!receiptErrorReported) { receiptErrorReported = true; fail(error); }
      }));
      stops.push(onValue(query(ref(database, `messages/${id}`), orderByChild('timestamp'), limitToLast(100)), result => {
        if (stopped || !contacts.has(id)) return;
        const history = [];
        // Firebase stops iterating if the callback returns true/truthy.
        result.forEach(child => { history.push({ id: child.key, ...child.val() }); });
        conversations.set(id, history);
        void acknowledge(id, history);
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
    getMessages: id => structuredClone(historyFor(id)),
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
    async markRead(id, visibleIds = []) {
      const visible = new Set(visibleIds);
      await acknowledge(id, (conversations.get(id) ?? []).filter(message => visible.has(message.id)), true);
    },
    async sendMessage(id, text) {
      if (stopped) throw new Error('Please sign in again.');
      if (!contacts.has(id)) throw new Error('Select a conversation first.');
      const clean = validateMessage(text);
      const location = push(ref(database, `messages/${id}`));
      return commitMessage({ id: location.key, chatId: id, senderId: user.uid, text: clean, timestamp: Date.now(), status: 'pending' });
    },
    async retryMessage(messageId) {
      if (stopped) throw new Error('Please sign in again.');
      const message = outbox.get(messageId);
      if (!message || message.status !== 'failed') return;
      return commitMessage(message);
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
      receipts.clear();
      outbox.clear();
      acknowledging.clear();
      receiptFailures.clear();
    },
  };
}
