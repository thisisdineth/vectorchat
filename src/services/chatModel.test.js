import test from 'node:test';
import assert from 'node:assert/strict';
import { chatIdFor, validateMessage, initials } from './chatModel.js';

test('chat IDs are symmetric and reject ambiguous paths or self chats', () => {
  assert.equal(chatIdFor('alice', 'bob'), chatIdFor('bob', 'alice'));
  assert.notEqual(chatIdFor('ab', 'c'), chatIdFor('a', 'bc'));
  for (const invalid of ['a/b', 'a.b', 'a~b', '', 'a'.repeat(129)]) assert.throws(() => chatIdFor('alice', invalid));
  assert.throws(() => chatIdFor('alice', 'alice'));
});
test('message validation preserves literal content and line breaks', () => {
  assert.equal(validateMessage('  <script>literal</script>\nline two  '), '<script>literal</script>\nline two');
  assert.equal(validateMessage('x'.repeat(4000)).length, 4000);
  assert.throws(() => validateMessage(' \n '));
  assert.throws(() => validateMessage('x'.repeat(4001)));
  assert.equal(initials('Jamie Davis'), 'JD');
});
