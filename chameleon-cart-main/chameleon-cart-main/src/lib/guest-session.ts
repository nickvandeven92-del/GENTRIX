const KEY = 'kameleon_guest_session';

export function getOrCreateGuestSessionId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}
