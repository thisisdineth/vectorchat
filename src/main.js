import './style.css';
import './workspace.css';
import { initializeWorkspace, closeWorkspacePanels } from './ui/workspace.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeFirebase, missingConfig } from './services/firebase.js';
import { createFirebaseRepository, loadProfile, saveProfile } from './services/firebaseRepository.js';
import { initials } from './services/chatModel.js';
import { createPhoneLogin, friendlyError } from './ui/auth.js';
import { renderContacts } from './ui/contacts.js';
import { renderChatHeader, renderMessages } from './ui/chat.js';
import { icon, element, avatar } from './ui/dom.js';

const $ = selector => document.querySelector(selector);
const contactsNode = $('#contacts');
const messagesNode = $('#messages');
const input = $('#message-input');
const search = $('#contact-search');
const sendButton = $('#send-button');
const mobile = matchMedia('(max-width: 760px)');
const drafts = new Map();
let repository;
let firebase;
let phoneLogin;
let selectedId = null;
let sending = false;
let loggingOut = false;
let session = 0;
let toastTimer;

document.querySelectorAll('[data-icon]').forEach(node => node.append(icon(node.dataset.icon)));
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}
function resizeComposer() {
  input.style.height = 'auto';
  const contentHeight = input.scrollHeight + input.offsetHeight - input.clientHeight;
  input.style.height = `${Math.min(contentHeight, 144)}px`;
  input.style.overflowY = contentHeight > 144 ? 'auto' : 'hidden';
  input.disabled = !selectedId || !repository || loggingOut;
  sendButton.disabled = sending || input.disabled || !input.value.trim() || !repository?.connected;
}
function refreshContacts() {
  if (!repository) return;
  const contacts = repository.getContacts();
  $('#contact-count').textContent = `(${contacts.length})`;
  const unread = contacts.reduce((count, contact) => count + contact.unread, 0);
  $('#rail-unread').hidden = unread === 0;
  $('#rail-unread').textContent = unread > 99 ? '99+' : String(unread);
  const query = search.value.trim().toLocaleLowerCase();
  renderContacts(contactsNode, contacts.filter(contact => contact.name.toLocaleLowerCase().includes(query)), selectedId, openConversation);
  if (!contacts.length && !query) contactsNode.replaceChildren(element('p', 'empty-contacts', repository.loaded ? 'No conversations yet. Use the compose button to start your first chat.' : 'Loading conversations…'));
}
let readFrame;
function markVisibleRead() {
  cancelAnimationFrame(readFrame);
  readFrame = requestAnimationFrame(() => {
    if (!selectedId || !repository || document.hidden || (!$('#call-preview').hidden) || $('#settings-dialog').open || $('#new-chat-dialog').open) return;
    if (mobile.matches && !document.body.classList.contains('chat-open')) return;
    const viewport = messagesNode.getBoundingClientRect();
    const visible = [...messagesNode.querySelectorAll('.message-row.received')].filter(row => {
      const bounds = row.getBoundingClientRect();
      return bounds.top < viewport.bottom && bounds.bottom > viewport.top && viewport.height > 0;
    }).map(row => row.dataset.messageId);
    repository.markRead(selectedId, visible).catch(error => notify(friendlyError(error)));
  });
}
async function retryMessage(messageId) {
  try { await repository?.retryMessage(messageId); }
  catch (error) { if (!error.messageId) notify(friendlyError(error)); }
}
function refreshMessages(forceScroll = false) {
  const contact = repository?.getContacts().find(item => item.id === selectedId);
  if (!contact) {
    $('#chat-header').replaceChildren(element('h2', '', 'Welcome to Gather'));
    messagesNode.replaceChildren(element('p', 'empty-chat', 'Choose a conversation or start a new chat.'));
    return;
  }
  const nearBottom = messagesNode.scrollHeight - messagesNode.scrollTop - messagesNode.clientHeight < 100;
  renderMessages(messagesNode, repository.getMessages(selectedId), repository.currentUser.id, contact, { scroll: forceScroll || nearBottom, onRetry: retryMessage });
}
function refresh() {
  if (!repository) return;
  if (selectedId && !repository.getContacts().some(contact => contact.id === selectedId)) selectedId = null;
  refreshContacts();
  const contact = repository.getContacts().find(item => item.id === selectedId);
  // Update profile text without replacing focused call/back buttons on every message.
  if (contact && $('#chat-header h2')) {
    $('#chat-header h2').textContent = contact.name;
    $('#chat-header > .avatar')?.replaceWith(avatar(contact));
  }
  refreshMessages();
  $('#connection-status').textContent = repository.connected ? 'CONNECTED' : 'OFFLINE · RECONNECTING';
  resizeComposer();
  markVisibleRead();
}
function backToContacts() {
  document.body.classList.remove('chat-open');
  [...contactsNode.children].find(node => node.dataset.contactId === selectedId)?.focus();
}
function openConversation(id) {
  if (!repository || loggingOut) return;
  const contact = repository.getContacts().find(item => item.id === id);
  if (!contact) return;
  if (selectedId) drafts.set(selectedId, input.value);
  selectedId = id;
  closeWorkspacePanels();
  renderChatHeader($('#chat-header'), contact, backToContacts, notify);
  input.value = drafts.get(id) ?? '';
  document.body.classList.add('chat-open');
  resizeComposer();
  refreshContacts();
  refreshMessages(true);
  markVisibleRead();
  if (!mobile.matches) input.focus();
  else $('.back-button').focus();
}
async function sendMessage(event) {
  event.preventDefault();
  if (sending || !input.value.trim() || !selectedId || !repository || loggingOut) return;
  const current = session;
  const id = selectedId;
  const text = input.value;
  sending = true;
  input.value = '';
  drafts.delete(id);
  resizeComposer();
  try {
    await repository.sendMessage(id, text);
    if (current !== session) return;
    if (selectedId === id) refreshMessages(true);
  } catch (error) {
    if (current !== session) return;
    if (error.messageId) return; // Failed bubble retains the text and retry action.
    // Preserve anything typed while a server acknowledgement was pending.
    if (selectedId === id) input.value = [text, input.value].filter(Boolean).join('\n');
    else drafts.set(id, [text, drafts.get(id)].filter(Boolean).join('\n'));
    notify(friendlyError(error));
  } finally {
    if (current === session) { sending = false; resizeComposer(); }
  }
}
function clearSession() {
  session++;
  cancelAnimationFrame(readFrame);
  $('.settings-profile').hidden = true;
  $('#settings-dialog .account-actions').hidden = true;
  closeWorkspacePanels();
  $('#settings-dialog').close();
  document.body.classList.remove('sidebar-collapsed');
  $('#toggle-sidebar').setAttribute('aria-expanded', 'true');
  repository?.dispose();
  repository = undefined;
  selectedId = null;
  sending = false;
  drafts.clear();
  input.value = '';
  search.value = '';
  contactsNode.replaceChildren();
  messagesNode.replaceChildren();
  $('#chat-header').replaceChildren();
  $('#profile-name').textContent = '';
  $('#profile-phone').textContent = '';
  $('#profile-avatar').textContent = '';
  $('#new-chat-dialog').close();
  $('#new-chat-form').reset();
  $('#toast').hidden = true;
  $('.app-shell').hidden = true;
  document.body.classList.remove('chat-open');
  resizeComposer();
}
function startChat(user, profile) {
  $('.settings-profile').hidden = false;
  $('#settings-dialog .account-actions').hidden = false;
  $('#auth-screen').hidden = true;
  $('.app-shell').hidden = false;
  $('#profile-name').textContent = profile.displayName;
  $('#profile-phone').textContent = user.phoneNumber;
  $('#profile-avatar').textContent = initials(profile.displayName);
  repository = createFirebaseRepository(firebase.database, user, profile, error => notify(friendlyError(error)));
  repository.subscribe(refresh);
  refresh();
}
async function logout() {
  if (!firebase || loggingOut) return;
  loggingOut = true;
  resizeComposer();
  try { await signOut(firebase.auth); }
  catch (error) { notify(friendlyError(error)); }
  finally { loggingOut = false; resizeComposer(); }
}
async function boot() {
  if (missingConfig.length) {
    $('#setup-notice').hidden = false;
    $('#setup-notice').textContent = 'Firebase setup is needed. Follow FIREBASE_SETUP.md, copy .env.example to .env.local, add your project’s public configuration, and restart Vite. No SMS or database requests are made until configured.';
    return;
  }
  try {
    firebase = initializeFirebase();
    phoneLogin = createPhoneLogin(firebase.auth);
    $('#auth-status').textContent = 'Checking your session…';
    onAuthStateChanged(firebase.auth, async user => {
      clearSession();
      const current = session;
      phoneLogin.reset();
      $('#auth-screen').hidden = false;
      $('#login-controls').hidden = !!user;
      $('#profile-form').hidden = true;
      $('#auth-logout').hidden = !user;
      if (!user) return;
      $('#auth-status').textContent = 'Loading your profile…';
      try {
        const profile = await loadProfile(firebase.database, user);
        if (current !== session) return;
        $('#auth-status').textContent = '';
        if (profile) startChat(user, profile);
        else { $('#profile-form').hidden = false; $('#display-name').focus(); }
      } catch (error) {
        if (current === session) $('#auth-status').textContent = `${friendlyError(error)} After fixing the setup, reload this page.`;
      }
    }, error => { $('#auth-status').textContent = friendlyError(error); });
  } catch (error) { $('#auth-status').textContent = friendlyError(error); }
}
$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const user = firebase?.auth.currentUser;
  if (!user) return;
  const current = session;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const profile = await saveProfile(firebase.database, user, $('#display-name').value);
    if (current === session) startChat(user, profile);
  } catch (error) { if (current === session) $('#auth-status').textContent = friendlyError(error); }
  finally { button.disabled = false; }
});
$('#new-chat').addEventListener('click', () => {
  $('#new-chat-status').textContent = '';
  $('#new-chat-dialog').showModal();
});
$('#close-new-chat').addEventListener('click', () => $('#new-chat-dialog').close());
$('#new-chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!repository) return;
  const current = session;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  $('#new-chat-status').textContent = 'Opening conversation…';
  try {
    const id = await repository.addContact($('#contact-id').value);
    if (current !== session) return;
    $('#new-chat-dialog').close();
    $('#new-chat-form').reset();
    openConversation(id);
  } catch (error) { if (current === session) $('#new-chat-status').textContent = friendlyError(error); }
  finally { button.disabled = false; }
});
$('#copy-id').addEventListener('click', async () => {
  if (!repository) return;
  const id = repository.currentUser.id;
  try { await navigator.clipboard.writeText(id); notify('Account ID copied. Share it with someone you want to chat with.'); }
  catch { notify(`Your account ID: ${id}`); }
});
$('#auth-settings').addEventListener('click', () => $('#settings-dialog').showModal());
$('#logout').addEventListener('click', logout);
$('#auth-logout').addEventListener('click', logout);
search.addEventListener('input', refreshContacts);
input.addEventListener('input', resizeComposer);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) sendMessage(event);
});
$('#composer').addEventListener('submit', sendMessage);
document.addEventListener('keydown', event => {
  if (!repository || $('#new-chat-dialog').open || $('#settings-dialog').open || !$('#emoji-picker').hidden || !$('#call-preview').hidden) return;
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); backToContacts(); search.focus(); }
  if (event.key === 'Escape' && mobile.matches) backToContacts();
});
window.addEventListener('resize', () => { resizeComposer(); markVisibleRead(); });
messagesNode.addEventListener('scroll', markVisibleRead, { passive: true });
window.addEventListener('focus', markVisibleRead);
document.addEventListener('click', markVisibleRead);
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', markVisibleRead);
document.addEventListener('visibilitychange', markVisibleRead);
document.addEventListener('keyup', event => { if (event.key === 'Escape') markVisibleRead(); });
initializeWorkspace({ notify, input, backToContacts });
boot();
