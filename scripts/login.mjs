// One-time local login: gets a Spotify refresh token via the Authorization Code flow.
// Usage: npm run login   (or set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in the environment)

import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import readline from "node:readline/promises";

const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SCOPES = "user-read-currently-playing user-library-modify";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clientId = process.env.SPOTIFY_CLIENT_ID || (await rl.question("Spotify Client ID: ")).trim();
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || (await rl.question("Spotify Client Secret: ")).trim();
rl.close();

// Random state guards against another site completing the login on your behalf.
const state = crypto.randomBytes(16).toString("hex");
const authUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    show_dialog: "true",
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const finish = (status, message) => {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }).end(message);
    server.close();
  };

  if (url.searchParams.get("error")) return finish(400, `Spotify returned an error: ${url.searchParams.get("error")}`);
  if (url.searchParams.get("state") !== state) return finish(400, "State mismatch; try again.");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await tokenRes.json();

  if (!tokenRes.ok || !data.refresh_token) {
    console.error("\nToken exchange failed:", data);
    process.exitCode = 1;
    return finish(500, "Token exchange failed. Check the terminal.");
  }

  console.log("\nSuccess! Granted scopes:", data.scope);
  console.log("\nYour refresh token (paste it when `wrangler secret put SPOTIFY_REFRESH_TOKEN` asks):\n");
  console.log(data.refresh_token + "\n");
  finish(200, "Logged in. You can close this tab and go back to the terminal.");
});

server.listen(8888, "127.0.0.1", () => {
  console.log("\nOpening Spotify login in your browser. If it doesn't open, visit:\n\n" + authUrl + "\n");
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
  exec(`${opener} "${authUrl}"`);
});
