import { avatar, element, timeLabel } from './dom.js';

export function renderContacts(container, contacts, selectedId, onSelect) {
  const fragment = document.createDocumentFragment();
  if (!contacts.length) fragment.append(element('p', 'empty-contacts', 'No conversations found. Try another name.'));
  for (const contact of contacts) {
    const button = element('button', `contact ${contact.id === selectedId ? 'selected' : ''}`);
    button.type = 'button';
    button.dataset.contactId = contact.id;
    button.setAttribute('aria-pressed', String(contact.id === selectedId));
    button.setAttribute('aria-label', `${contact.name}, ${contact.status ?? (contact.online ? 'online' : 'offline')}${contact.unread ? `, ${contact.unread} unread messages` : ''}`);
    button.append(avatar(contact));
    const content = element('div', 'contact-content');
    const top = element('div', 'contact-top');
    top.append(element('strong', '', contact.name), element('span', 'contact-time', contact.timestamp ? timeLabel(contact.timestamp) : ''));
    const bottom = element('div', 'contact-bottom');
    bottom.append(element('span', 'preview', contact.preview));
    if (contact.unread) bottom.append(element('span', 'unread', String(contact.unread)));
    content.append(top, bottom);
    button.append(content);
    button.addEventListener('click', () => onSelect(contact.id));
    fragment.append(button);
  }
  const focusedId = container.contains(document.activeElement) ? document.activeElement.dataset.contactId : null;
  container.replaceChildren(fragment);
  if (focusedId) [...container.children].find(node => node.dataset.contactId === focusedId)?.focus();
}
