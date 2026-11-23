/** Only same-app paths are allowed as a post-login destination (no open redirect). */
export function safeNext(value) {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith('/login') || value.startsWith('/setup')) return '/';
  return value;
}
