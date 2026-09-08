import { avatar, element, icon, timeLabel } from './dom.js';
import { openCallPreview } from './workspace.js';

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
    button.setAttribute('aria-label', `${label} design preview`);
    button.title = `${label} — design preview, not connected`;
    button.append(icon(name));
    button.addEventListener('click', () => openCallPreview(contact, button));
    actions.append(button);
  }
  container.dataset.contactName = contact.name;
  container.dataset.contactInitials = contact.initials;
  container.replaceChildren(back, avatar(contact), info, actions);
}

export function renderMessages(container, messages, userId, contact, { scroll = true, onRetry = () => {} } = {}) {
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
    row.dataset.messageId = message.id;
    row.setAttribute('aria-label', `${sent ? 'You' : contact.name} at ${timeLabel(message.timestamp)}`);
    if (!sent) { const face = avatar(contact); face.classList.add('message-avatar'); if (grouped) face.classList.add('invisible'); row.append(face); }
    const bubble = element('div', 'bubble');
    bubble.append(element('p', 'message-text', message.text));
    const time = element('time', 'message-time', timeLabel(message.timestamp));
    time.dateTime = new Date(message.timestamp).toISOString();
    const meta = element('div', 'message-meta');
    meta.append(time);
    if (sent) {
      const status = message.status ?? 'sent';
      const labels = { pending: 'Sending', sent: 'Sent', delivered: 'Delivered', seen: 'Seen', failed: 'Failed to send. Click to retry' };
      const indicator = element(status === 'failed' ? 'button' : 'span', `message-status status-${status}`);
      if (status !== 'failed') indicator.setAttribute('role', 'img');
      indicator.setAttribute('aria-label', labels[status]);
      indicator.title = status === 'failed' ? `${message.error ?? 'Failed to send'}. Click to retry.` : labels[status];
      if (status === 'failed') {
        indicator.type = 'button';
        indicator.textContent = '!';
        indicator.addEventListener('click', () => onRetry(message.id));
      } else if (status === 'pending') {
        indicator.append(element('span', 'status-clock'));
      } else {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 16');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('d', status === 'sent' ? 'M5 8l4 4L19 2' : 'M1 8l4 4L15 2M10 10l2 2L22 2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.7');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.append(path);
        indicator.append(svg);
      }
      meta.append(indicator);
    }
    bubble.append(meta);
    row.append(bubble);
    fragment.append(row);
  }
  if (!messages.length) fragment.append(element('p', 'empty-chat', `Say hello to ${contact.name.split(' ')[0]}.`));
  container.replaceChildren(fragment);
  if (scroll) container.scrollTop = container.scrollHeight;
}
