import { avatar, element, icon, timeLabel } from './dom.js';

export function renderChatHeader(container, contact, onBack, notify) {
  const back = element('button', 'icon-button back-button');
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to conversations');
  back.append(icon('back'));
  back.addEventListener('click', onBack);
  const info = element('div', 'header-info');
  info.append(element('h2', '', contact.name), element('span', `contact-status ${contact.online ? 'is-online' : ''}`, contact.status ?? (contact.online ? 'Online now' : 'Offline')));
  const actions = element('div', 'header-actions');
  for (const [name, label] of [['phone', 'Audio call'], ['video', 'Video call']]) {
    const button = element('button', 'icon-button call-button');
    button.type = 'button';
    button.setAttribute('aria-label', `${label} (coming soon)`);
    button.title = `${label} — coming soon`;
    button.append(icon(name));
    button.addEventListener('click', () => notify(`${label}s are coming soon. Gather supports messages only for now.`));
    actions.append(button);
  }
  container.replaceChildren(back, avatar(contact), info, actions);
}

export function renderMessages(container, messages, userId, contact, { scroll = true } = {}) {
  const fragment = document.createDocumentFragment();
  let previousDate = '';
  for (const [index, message] of messages.entries()) {
    const date = new Date(message.timestamp);
    const day = date.toDateString();
    if (day !== previousDate) {
      const label = day === new Date().toDateString() ? 'Today' : new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(date);
      fragment.append(element('div', 'date-divider', label));
      previousDate = day;
    }
    const sent = message.senderId === userId;
    const grouped = index > 0 && messages[index - 1].senderId === message.senderId && new Date(messages[index - 1].timestamp).toDateString() === day;
    const row = element('article', `message-row ${sent ? 'sent' : 'received'} ${grouped ? 'grouped' : ''}`);
    row.setAttribute('aria-label', `${sent ? 'You' : contact.name} at ${timeLabel(message.timestamp)}`);
    if (!sent) { const face = avatar(contact); face.classList.add('message-avatar'); if (grouped) face.classList.add('invisible'); row.append(face); }
    const bubble = element('div', 'bubble');
    bubble.append(element('p', 'message-text', message.text));
    const time = element('time', 'message-time', timeLabel(message.timestamp));
    time.dateTime = new Date(message.timestamp).toISOString();
    bubble.append(time);
    row.append(bubble);
    fragment.append(row);
  }
  if (!messages.length) fragment.append(element('p', 'empty-chat', `Say hello to ${contact.name.split(' ')[0]}.`));
  container.replaceChildren(fragment);
  if (scroll) container.scrollTop = container.scrollHeight;
}
