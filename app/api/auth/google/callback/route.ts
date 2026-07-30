import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, storeRefreshToken } from "@/lib/google-calendar";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${request.nextUrl.origin}/?calendar=error`);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
    const { refreshToken } = await exchangeCodeForTokens(code, redirectUri);
    if (!refreshToken) {
      // Shouldn't happen with prompt=consent, but Google occasionally omits
      // it anyway — surface as an error rather than silently doing nothing,
      // since without it the connection won't survive past this session.
      return NextResponse.redirect(`${request.nextUrl.origin}/?calendar=no-refresh-token`);
    }
    await storeRefreshToken(refreshToken);
  } catch {
    return NextResponse.redirect(`${request.nextUrl.origin}/?calendar=error`);
  }

  const response = NextResponse.redirect(`${request.nextUrl.origin}/?calendar=connected`);
  response.cookies.delete(STATE_COOKIE);
  return response;
}
