export function chatIdFor(first, second) {
  if (![first, second].every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))) {
    throw new Error('Enter a valid Gather account ID.');
  }
  if (first === second) throw new Error('Use another person’s account ID.');
  return [first, second].sort().join('~');
}
export function validateMessage(text) {
  const clean = text.trim();
  if (!clean || clean.length > 4000) throw new Error('Messages must contain between 1 and 4,000 characters.');
  return clean;
}
export function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
}
