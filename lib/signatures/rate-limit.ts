const windows = new Map<string, { count: number; resetAt: number }>();

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  current.count += 1;
  return true;
}

export function resetRateLimitsForTests() {
  windows.clear();
}
