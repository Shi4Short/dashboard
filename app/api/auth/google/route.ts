import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID environment variable is not set" }, { status: 503 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
  const state = randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Forces Google to return a refresh_token even if this account already
    // consented before — without this, re-connecting after a lost token
    // silently fails to produce a new one.
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(`${AUTH_URL}?${params}`);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
