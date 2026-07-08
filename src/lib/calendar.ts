/**
 * Google Calendar via the calendar's "secret address in iCal format".
 * No OAuth, no GCP project: Ridhi pastes the private ICS URL into
 * GOOGLE_CALENDAR_ICS_URL and the Concierge reads upcoming events.
 *
 * Deliberately dependency-free. Known limitation: recurring events
 * (RRULE) are skipped rather than expanded; appointment-schedule
 * bookings (discovery calls) are individual events, so they all show.
 */

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string;
  description: string;
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Convert wall-clock components in an IANA timezone to a UTC Date. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(utcGuess))) parts[p.type] = p.value;
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );
    return new Date(utcGuess - (asUtc - utcGuess));
  } catch {
    // Unknown TZID: treat as UTC rather than dropping the event.
    return new Date(utcGuess);
  }
}

/** Parse one ICS date value ("20260708", "20260708T140000Z", or "20260708T140000" + TZID). */
function parseIcsDate(value: string, tzid?: string): { date: Date; allDay: boolean } | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(d)), allDay: true };
  }
  const full = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!full) return null;
  const [, y, m, d, h, mi, s, z] = full;
  const nums = [Number(y), Number(m), Number(d), Number(h), Number(mi), Number(s)] as const;
  if (z === 'Z') {
    return { date: new Date(Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5])), allDay: false };
  }
  if (tzid) {
    return { date: zonedToUtc(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], tzid), allDay: false };
  }
  // Floating time: interpret in server-local time.
  return { date: new Date(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5]), allDay: false };
}

/** Parse an ICS feed into events. Cancelled and recurring events are skipped. */
export function parseIcs(text: string): CalendarEvent[] {
  // Unfold continuation lines (RFC 5545: CRLF followed by space or tab).
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: CalendarEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const ev = toEvent(cur);
        if (ev) events.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const semi = head.indexOf(';');
    const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
    const params = semi < 0 ? '' : head.slice(semi + 1);
    cur[name] = { params, value };
  }

  return events;
}

function toEvent(props: Record<string, { params: string; value: string }>): CalendarEvent | null {
  if (props.RRULE) return null; // recurring: not expanded (documented limitation)
  if (props.STATUS && props.STATUS.value.toUpperCase() === 'CANCELLED') return null;
  const dtstart = props.DTSTART;
  if (!dtstart) return null;

  const tzMatch = /TZID=([^;]+)/.exec(dtstart.params);
  const start = parseIcsDate(dtstart.value, tzMatch?.[1]);
  if (!start) return null;

  let end: Date | null = null;
  if (props.DTEND) {
    const endTz = /TZID=([^;]+)/.exec(props.DTEND.params);
    end = parseIcsDate(props.DTEND.value, endTz?.[1])?.date ?? null;
  }

  return {
    uid: props.UID?.value ?? '',
    summary: unescapeText(props.SUMMARY?.value ?? '(no title)'),
    start: start.date,
    end,
    allDay: start.allDay,
    location: unescapeText(props.LOCATION?.value ?? ''),
    description: unescapeText(props.DESCRIPTION?.value ?? ''),
  };
}

/** Fetch the ICS feed and return events starting within the next `windowHours`, soonest first. */
export async function fetchUpcomingEvents(icsUrl: string, windowHours = 48): Promise<CalendarEvent[]> {
  const res = await fetch(icsUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const text = await res.text();
  const now = Date.now();
  const until = now + windowHours * 3600_000;
  return parseIcs(text)
    .filter((e) => e.start.getTime() >= now && e.start.getTime() <= until)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** "Wed, Jul 8, 2:00 PM (EST)" style line in the owner's timezone. */
export function formatEventLine(ev: CalendarEvent, timeZone: string): string {
  if (ev.allDay) {
    const day = ev.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${day}, all day: ${ev.summary}`;
  }
  const opts: Intl.DateTimeFormatOptions = { timeZone, hour: 'numeric', minute: '2-digit' };
  const day = ev.start.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const startStr = ev.start.toLocaleTimeString('en-US', opts);
  const endStr = ev.end ? ` to ${ev.end.toLocaleTimeString('en-US', opts)}` : '';
  const loc = ev.location ? ` (${ev.location})` : '';
  return `${day}, ${startStr}${endStr}: ${ev.summary}${loc}`;
}
