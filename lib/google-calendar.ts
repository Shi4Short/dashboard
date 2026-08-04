import { getSetting, setSetting } from "./db";

const REFRESH_TOKEN_KEY = "google_refresh_token";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | null; // ISO datetime, or date-only for all-day events
  end: string | null;
  allDay: boolean;
  url: string | null;
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables are not set");
  }
  return { clientId, clientSecret };
}

export async function isCalendarConnected(): Promise<boolean> {
  return (await getSetting(REFRESH_TOKEN_KEY)) !== null;
}

export async function storeRefreshToken(refreshToken: string): Promise<void> {
  await setSetting(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Exchanges the stored refresh token for a fresh access token. Fetched fresh
 * per call rather than cached — a serverless function invocation is too
 * short-lived for in-memory caching to matter, and this keeps the code
 * simple instead of reasoning about expiry windows.
 */
async function getAccessToken(): Promise<string> {
  const refreshToken = await getSetting(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error("Google Calendar is not connected yet");
  }
  const { clientId, clientSecret } = getCredentials();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Google access token: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const { clientId, clientSecret } = getCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to exchange Google auth code: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null };
}

interface GoogleEventTime {
  date?: string; // all-day
  dateTime?: string; // timed
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  htmlLink?: string;
}

export async function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken();
  // Start of today, not the exact current moment — otherwise an event
  // that already started earlier today drops out of every future sync
  // permanently (timeMin always advances with "now"), so a task tied to
  // it can never get its time backfilled once its start time has passed.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    timeMin: startOfToday.toISOString(),
    maxResults: "20",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(`${EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Calendar events: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { items?: GoogleEvent[] };

  return (body.items ?? []).map((e) => ({
    id: e.id,
    title: e.summary ?? "(untitled event)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    allDay: !!e.start?.date && !e.start?.dateTime,
    url: e.htmlLink ?? null,
  }));
}
