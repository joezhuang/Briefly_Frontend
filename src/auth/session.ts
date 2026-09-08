let accessToken: string | null = null;

export function setBrieflyAccessToken(token: string | null) {
  accessToken = token?.trim() || null;
}

export function getBrieflyAccessToken() {
  return accessToken;
}

export function clearBrieflyAccessToken() {
  accessToken = null;
}
