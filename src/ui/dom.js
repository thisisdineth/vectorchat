export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const paths = {
  search: ['m21 21-4.4-4.4', 'M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0'],
  compose: ['M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7', 'm16 3 5 5-10 10-5 1 1-5Z', 'm14 5 5 5'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z'],
  video: ['m16 8 6-4v16l-6-4', 'M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
  back: ['m15 18-6-6 6-6'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  shield: ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z', 'm8 12 3 3 5-6'],
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.65', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
  for (const d of paths[name] ?? []) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
export function avatar(contact) {
  const node = element('div', `avatar avatar-${contact.color}`, contact.initials);
  node.setAttribute('aria-hidden', 'true');
  if (contact.online !== null) node.append(element('span', `presence ${contact.online ? 'online' : 'offline'}`));
  return node;
}
export function timeLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
