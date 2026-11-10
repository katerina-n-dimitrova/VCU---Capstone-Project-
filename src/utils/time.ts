/** Time helpers. Everything on the wire is ISO-8601; everything on screen is local time. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function toMillis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** "2:34 PM" — the format used in fault notifications. */
export function formatClock(iso: string | null | undefined): string {
  const ms = toMillis(iso);
  if (ms === null) return 'Unknown';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "2:34:07 PM" — used where a second matters, such as the live-data table. */
export function formatClockSeconds(iso: string | null | undefined): string {
  const ms = toMillis(iso);
  if (ms === null) return 'Unknown';
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "29 Sep, 2:34:07 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  const ms = toMillis(iso);
  if (ms === null) return 'Unknown';
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(
    [],
    { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  )}`;
}

/** "3 h 04 m 12 s" */
export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return 'Unknown';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} m`;
  if (minutes > 0) return `${minutes} m ${String(seconds).padStart(2, '0')} s`;
  return `${seconds} s`;
}

/** "just now", "12 s ago", "4 min ago". Returns null when the input is unusable. */
export function formatAge(iso: string | null | undefined, now = Date.now()): string {
  const ms = toMillis(iso);
  if (ms === null) return 'never';
  const delta = Math.max(0, now - ms);
  if (delta < 2000) return 'just now';
  if (delta < 60_000) return `${Math.floor(delta / 1000)} s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  return `${Math.floor(delta / 3_600_000)} h ago`;
}

/** Milliseconds since an ISO timestamp, or null when it cannot be worked out. */
export function ageMs(iso: string | null | undefined, now = Date.now()): number | null {
  const ms = toMillis(iso);
  return ms === null ? null : Math.max(0, now - ms);
}

/** Chart axis tick: "14:03:20" or "14:03" depending on the window width. */
export function formatAxisTime(t: number, windowMs: number): string {
  const d = new Date(t);
  const withSeconds = windowMs <= 5 * 60_000;
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  });
}
