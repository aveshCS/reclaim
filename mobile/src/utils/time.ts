/** Local-midnight start of the day containing `t` (uses the phone's time zone, handles DST). */
export function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start of the local day `days` days before the day containing `t`. */
export function startOfLocalDayDaysAgo(t: number, days: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

/** Local calendar date as YYYY-MM-DD (the user's time zone). */
export function localDateKey(t: number): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Short weekday for a local date key, e.g. "Mon". */
export function weekdayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short' });
}

/** "1 h 5 min", "12 min", "<1 min". Rounds down to whole minutes. */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60000);
  if (totalMin < 1) {
    return ms > 0 ? '<1 min' : '0 min';
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    return `${m} min`;
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
