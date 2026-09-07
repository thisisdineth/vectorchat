import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockRepository } from './mockRepository.js';

test('sending changes only the chosen conversation and updates its preview', async () => {
  const repository = createMockRepository();
  const initial = repository.getMessages('alex').length;
  const other = repository.getMessages('sophie');
  let updates = 0;
  const unsubscribe = repository.subscribe(() => updates++);
  const text = '<img src=x onerror=alert(1)>\nA second line';
  await repository.sendMessage('alex', text);
  assert.equal(repository.getMessages('alex').length, initial + 1);
  assert.equal(repository.getMessages('alex').at(-1).text, text);
  assert.equal(repository.getContacts().find(contact => contact.id === 'alex').preview, `You: ${text}`);
  assert.deepEqual(repository.getMessages('sophie'), other);
  assert.equal(updates, 1);
  unsubscribe();
  await repository.sendMessage('alex', 'Another message');
  assert.equal(updates, 1);
});
test('snapshots are isolated, unread counts clear, and invalid sends are rejected', async () => {
  const repository = createMockRepository();
  const snapshot = repository.getMessages('alex');
  snapshot[0].text = 'Changed';
  assert.notEqual(repository.getMessages('alex')[0].text, 'Changed');
  await repository.markRead('sophie');
  assert.equal(repository.getContacts().find(contact => contact.id === 'sophie').unread, 0);
  await assert.rejects(repository.sendMessage('unknown', 'Hello'));
  await assert.rejects(repository.sendMessage('alex', '  '));
  await assert.rejects(repository.sendMessage('alex', 'x'.repeat(4001)));
});
