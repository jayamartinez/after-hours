/**
 * Calendar days in a user's own time zone, so the daily message allowance resets at their
 * midnight (D-045). Zones are IANA names already checked with `validTimeZone`; unset is UTC.
 */

interface Ymd {
  year: number;
  month: number;
  day: number;
}

function partsIn(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far `zone` is ahead of UTC at `date`, in milliseconds. */
function offsetMs(date: Date, zone: string): number {
  const p = partsIn(date, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant the local day `ymd` begins in `zone`. */
function midnight({ year, month, day }: Ymd, zone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  // Measured twice: the offset at midnight can differ from the guess's on a DST change day.
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day `now` falls in, as `YYYY-MM-DD` (the per-day tables' key). */
export function localDay(now: Date, zone = 'UTC'): string {
  const { year, month, day } = partsIn(now, zone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** When the local day containing `now` began. */
export function localDayStart(now: Date, zone = 'UTC'): Date {
  return midnight(partsIn(now, zone), zone);
}

/** The next local midnight after `now`: when the daily allowance resets. */
export function nextLocalMidnight(now: Date, zone = 'UTC'): Date {
  const { year, month, day } = partsIn(now, zone);
  // Date.UTC rolls day + 1 over month and year ends.
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return midnight(
    { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() },
    zone,
  );
}
