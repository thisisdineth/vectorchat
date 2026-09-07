import { contacts as seedContacts, currentUser } from '../data/contacts.js';
import { messages as seedMessages } from '../data/messages.js';

// UI consumes snapshots and subscriptions, never the mock fixtures directly.
// A Firebase adapter can implement this contract with onValue/onChildAdded.
export function createMockRepository() {
  const contacts = structuredClone(seedContacts);
  const conversations = structuredClone(seedMessages);
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener());
  function updateConversationPreview(id) {
    const contact = contacts.find(item => item.id === id);
    const last = conversations[id]?.at(-1);
    if (contact) {
      contact.preview = last ? `${last.senderId === currentUser.id ? 'You: ' : ''}${last.text}` : 'Start a conversation';
      contact.timestamp = last?.timestamp ?? null;
    }
  }
  contacts.forEach(contact => updateConversationPreview(contact.id));
  return {
    currentUser,
    getContacts: () => structuredClone(contacts).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    getMessages: id => structuredClone(conversations[id] ?? []),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async markRead(id) { const contact = contacts.find(item => item.id === id); if (contact?.unread) { contact.unread = 0; emit(); } },
    async sendMessage(id, text) {
      const clean = text.trim();
      if (!contacts.some(contact => contact.id === id)) throw new Error('Contact not found.');
      if (!clean || clean.length > 4000) throw new Error('Messages must contain between 1 and 4,000 characters.');
      const message = { id: crypto.randomUUID(), senderId: currentUser.id, text: clean, timestamp: new Date().toISOString() };
      (conversations[id] ??= []).push(message);
      updateConversationPreview(id);
      emit();
      return structuredClone(message);
    },
  };
}
