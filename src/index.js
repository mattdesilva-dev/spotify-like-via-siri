// Cloudflare Worker: POST /like saves the currently playing Spotify track to Liked Songs.
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN, API_KEY

const API = "https://api.spotify.com/v1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/like") return text("Not found", 404);
    if (request.method !== "POST") return text("Method not allowed", 405, { Allow: "POST" });
    if (!(await apiKeyMatches(request.headers.get("x-api-key"), env.API_KEY))) {
      return text("Unauthorized", 401);
    }

    try {
      const token = await getAccessToken(env);

      const track = await getCurrentTrack(token);
      if (!track) return text("Nothing's playing.");
      if (track.is_local) return text(`Can't like local files: ${describe(track)}`, 422);

      await saveToLibrary(token, track.uri);
      return text(`Liked: ${describe(track)}`);
    } catch (err) {
      console.error(err);
      return text(`Error: ${err.message}`, 502);
    }
  },
};

// Hash both values so the comparison is constant-time regardless of length.
async function apiKeyMatches(provided, expected) {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function getAccessToken(env) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  if (data.refresh_token && data.refresh_token !== env.SPOTIFY_REFRESH_TOKEN) {
    // Secrets can't be updated from inside the Worker; the old token normally keeps working.
    console.warn("Spotify issued a new refresh token; re-run `npm run login` if requests start failing.");
  }
  return data.access_token;
}

// Returns the playing track object, or null if nothing (or a non-track, e.g. an ad or podcast) is playing.
async function getCurrentTrack(token) {
  const res = await fetch(`${API}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`currently-playing failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  if (data.currently_playing_type !== "track" || !data.item) return null;
  return data.item;
}

// PUT /me/library (Feb 2026) replaces PUT /me/tracks and takes Spotify URIs.
// The reference documents `uris` as a query parameter; the migration guide shows a JSON body,
// so fall back to the body form if the query form is rejected as a bad request.
async function saveToLibrary(token, uri) {
  const headers = { Authorization: `Bearer ${token}` };

  let res = await fetch(`${API}/me/library?uris=${encodeURIComponent(uri)}`, { method: "PUT", headers });
  if (res.status === 400) {
    res = await fetch(`${API}/me/library`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    });
  }
  if (!res.ok) throw new Error(`save to library failed (${res.status}): ${await res.text()}`);
}

function describe(track) {
  const artists = (track.artists ?? []).map((a) => a.name).join(", ");
  return artists ? `${track.name} by ${artists}` : track.name;
}

function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}
