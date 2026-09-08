import { avatar, element, icon } from './dom.js';

let previewTrigger;
function action(name, label, className = '') {
  const button = element('button', `preview-action ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(icon(name));
  return button;
}
export function closeWorkspacePanels() {
  document.querySelector('#call-preview').hidden = true;
  document.querySelector('#call-preview').replaceChildren();
  document.querySelector('#emoji-picker').hidden = true;
  document.querySelector('#emoji-button').setAttribute('aria-expanded', 'false');
  previewTrigger = null;
}
export function openCallPreview(contact, trigger) {
  const panel = document.querySelector('#call-preview');
  previewTrigger = trigger;
  const heading = element('div', 'preview-heading');
  heading.append(element('span', '', 'CALL DESIGN PREVIEW · NOT CONNECTED'));
  const close = action('close', 'Close call preview');
  close.addEventListener('click', () => {
    const restore = previewTrigger;
    closeWorkspacePanels();
    restore?.focus();
  });
  heading.append(close);
  function caller(status) {
    const row = element('div', 'preview-caller');
    const copy = element('div', 'preview-caller-copy');
    copy.append(element('strong', '', contact.name), element('span', 'preview-status', status));
    row.append(avatar({ ...contact, online: null }), copy);
    return row;
  }
  const incoming = element('div', 'call-card incoming-card');
  const incomingCaller = caller('Incoming call · preview');
  const answer = action('phone', 'Preview answering a call', 'answer-action');
  const decline = action('phone', 'Dismiss incoming call preview', 'end-action');
  answer.addEventListener('click', () => { incomingCaller.querySelector('.preview-status').textContent = 'Answered in preview only'; });
  decline.addEventListener('click', () => { incoming.hidden = true; close.focus(); });
  incoming.append(incomingCaller, answer, decline);

  const active = element('div', 'call-card active-card');
  const activeRow = element('div', 'active-call-row');
  const mute = action('mute', 'Mute preview microphone');
  const camera = action('video', 'Toggle preview camera');
  for (const button of [mute, camera]) {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')));
  }
  const end = action('phone', 'Dismiss active call preview', 'end-action');
  end.addEventListener('click', () => { active.hidden = true; close.focus(); });
  activeRow.append(caller('02:03 · sample duration'), mute, camera, end);
  const wave = element('div', 'audio-wave');
  wave.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 65; i++) {
    const bar = element('span');
    const envelope = Math.exp(-Math.pow((i - 33) / 12, 2));
    bar.style.height = `${2 + envelope * (8 + Math.abs(Math.sin(i * 2.3)) * 19)}px`;
    wave.append(bar);
  }
  active.append(activeRow, wave);

  const feedback = element('div', 'call-card feedback-card');
  feedback.append(element('p', '', 'How was the audio quality during the last call?'));
  const stars = element('div', 'rating-stars');
  stars.setAttribute('role', 'group');
  stars.setAttribute('aria-label', 'Sample call quality rating');
  const caption = element('span', 'rating-caption', 'Preview only · no feedback is sent');
  for (let score = 1; score <= 5; score++) {
    const star = element('button', score <= 3 ? 'star selected-star' : 'star', '★');
    star.type = 'button';
    star.setAttribute('aria-label', `Rate ${score} out of 5 in preview`);
    star.setAttribute('aria-pressed', String(score === 3));
    star.addEventListener('click', () => {
      [...stars.children].forEach((item, index) => {
        item.classList.toggle('selected-star', index < score);
        item.setAttribute('aria-pressed', String(index + 1 === score));
      });
      caption.textContent = `Preview rating: ${score} of 5 · not sent`;
    });
    stars.append(star);
  }
  feedback.append(stars, caption);
  panel.replaceChildren(heading, incoming, active, feedback);
  panel.hidden = false;
  close.focus();
}

export function initializeWorkspace({ notify, input, backToContacts }) {
  const menu = document.querySelector('#toggle-sidebar');
  const settings = document.querySelector('#settings-dialog');
  menu.addEventListener('click', () => {
    if (matchMedia('(max-width: 760px)').matches) backToContacts();
    else document.body.classList.toggle('sidebar-collapsed');
    menu.setAttribute('aria-expanded', String(!document.body.classList.contains('sidebar-collapsed')));
  });
  document.querySelector('#nav-inbox').addEventListener('click', () => {
    document.body.classList.remove('sidebar-collapsed');
    menu.setAttribute('aria-expanded', 'true');
    backToContacts();
    document.querySelector('#contact-search').focus();
  });
  document.querySelector('#nav-contacts').addEventListener('click', () => document.querySelector('#new-chat').click());
  for (const id of ['nav-settings', 'nav-profile']) document.getElementById(id).addEventListener('click', () => settings.showModal());
  document.querySelector('#close-settings').addEventListener('click', () => settings.close());
  document.querySelector('#nav-call-preview').addEventListener('click', event => {
    const header = document.querySelector('#chat-header');
    if (!header.querySelector('.header-info')) { notify('Open a conversation to preview the call design.'); return; }
    document.body.classList.add('chat-open');
    openCallPreview({ name: header.querySelector('h2').textContent, initials: header.querySelector('.avatar')?.textContent ?? '?', color: 'sage' }, header.querySelector('.call-button'));
  });
  document.querySelector('#attachment-button').addEventListener('click', () => notify('Attachments are coming soon. You can send text and emoji for now.'));
  const picker = document.querySelector('#emoji-picker');
  const emojiButton = document.querySelector('#emoji-button');
  for (const [emoji, label] of [['😊', 'Smile'], ['❤️', 'Heart'], ['👍', 'Thumbs up'], ['🎉', 'Celebrate'], ['😂', 'Laugh'], ['👋', 'Wave'], ['✨', 'Sparkles'], ['☕', 'Coffee']]) {
    const button = element('button', '', emoji);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      if (input.disabled) return;
      const selectionLength = input.selectionEnd - input.selectionStart;
      if (input.value.length - selectionLength + emoji.length > input.maxLength) { notify('Your message is at the character limit.'); return; }
      input.setRangeText(emoji, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      picker.hidden = true;
      emojiButton.setAttribute('aria-expanded', 'false');
      input.focus();
    });
    picker.append(button);
  }
  emojiButton.addEventListener('click', () => {
    if (input.disabled) { notify('Choose a conversation before adding an emoji.'); return; }
    picker.hidden = !picker.hidden;
    emojiButton.setAttribute('aria-expanded', String(!picker.hidden));
    if (!picker.hidden) picker.querySelector('button').focus();
  });
  document.addEventListener('click', event => {
    if (!picker.hidden && !picker.contains(event.target) && !emojiButton.contains(event.target)) {
      picker.hidden = true;
      emojiButton.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!picker.hidden) { picker.hidden = true; emojiButton.setAttribute('aria-expanded', 'false'); emojiButton.focus(); }
    if (!document.querySelector('#call-preview').hidden) {
      const restore = previewTrigger;
      closeWorkspacePanels();
      restore?.focus();
    }
  });
}
