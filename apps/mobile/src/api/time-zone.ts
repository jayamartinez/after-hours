import { TIME_ZONE_HEADER } from '@after-hours/contracts';

/** The device's IANA time zone, if the runtime knows it. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Header telling the server the device's zone (the daily allowance resets at its midnight). */
export function timeZoneHeader(): Record<string, string> {
  const zone = deviceTimeZone();
  return zone ? { [TIME_ZONE_HEADER]: zone } : {};
}
