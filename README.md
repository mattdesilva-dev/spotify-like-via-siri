# Spotify Liked Songs via Siri

Say **"Hey Siri, like this song"** and whatever is playing on Spotify gets saved to your Liked Songs. It works whether the music is playing on your phone, laptop, speaker, or anywhere else.

## How it works

```
Siri Shortcut ──POST /like──▶ Cloudflare Worker ──▶ Spotify Web API
                (with your secret key)               1. what's playing?
                                                     2. save it to Liked Songs
```

The Worker is a small program hosted for free on Cloudflare. It holds your Spotify credentials, so your phone only needs a URL and a secret key. Siri then reads back the Worker's reply, such as *"Liked: Song Name by Artist"*.

## What you need

- A **Spotify account**. Spotify limits developer-mode apps, and may require the app owner to have **Premium**.
- A free **Cloudflare account**: <https://dash.cloudflare.com/sign-up>
- **Node.js 18 or newer** on your computer: <https://nodejs.org>
- An **iPhone, iPad, or Mac** with the Shortcuts app

Plan on about 15 minutes.

---

## Step 1: Download the project

```sh
git clone https://github.com/mattdesilva-dev/spotify-like-via-siri.git
cd spotify-like-via-siri
npm install
```

(Or click **Code → Download ZIP** on GitHub, unzip it, open a terminal in that folder, and run `npm install`.)

## Step 2: Create a Spotify developer app

This gives you the "keys" that let the Worker talk to Spotify on your behalf.

1. Go to <https://developer.spotify.com/dashboard> and log in with your Spotify account.
2. Click **Create app**.
3. Fill it in:
   - **App name:** anything, e.g. `Siri Like Button`
   - **App description:** anything
   - **Redirect URI:** `http://127.0.0.1:8888/callback`. Type it **exactly** like this and click **Add**.
   - **Which API/SDKs are you planning to use?** Tick **Web API**.
4. Agree to the terms and click **Save**.
5. Open the app's **Settings**. Copy the **Client ID**, then click **View client secret** and copy the **Client Secret**. Keep both somewhere handy for the next step.

> The Client Secret is like a password. Don't share it or paste it anywhere public.

## Step 3: Get your Spotify refresh token

A refresh token is a long-lived pass that lets the Worker act for your account without you logging in every time.

```sh
npm run login
```

1. Paste your **Client ID** and **Client Secret** when asked.
2. A browser window opens. Log in to Spotify and click **Agree**.
3. Go back to the terminal. It prints your **refresh token**. Copy it.

If you see `INVALID_CLIENT: Invalid redirect URI`, go back to Step 2 and check that the Redirect URI is exactly `http://127.0.0.1:8888/callback`.

## Step 4: Log in to Cloudflare

```sh
npx wrangler login
```

A browser window opens. Log in to Cloudflare and click **Allow**.

## Step 5: Deploy the Worker

```sh
npm run deploy
```

When it finishes, it prints your Worker's address. It looks like this:

```
https://spotify-like-current.<your-subdomain>.workers.dev
```

**Save this URL.** You'll need it for the Siri shortcut.

(If this is your first Worker, Cloudflare may ask you to choose a `workers.dev` subdomain. Pick any name.)

## Step 6: Add your secrets

Secrets are stored encrypted by Cloudflare, not in the code. Run each command below and paste the value when it asks:

```sh
npx wrangler secret put SPOTIFY_CLIENT_ID       # from Step 2
npx wrangler secret put SPOTIFY_CLIENT_SECRET   # from Step 2
npx wrangler secret put SPOTIFY_REFRESH_TOKEN   # from Step 3
npx wrangler secret put API_KEY                 # a password you make up (see below)
```

**`API_KEY`** stops strangers who find your URL from using it. Make it long and random. You can generate one with:

```sh
openssl rand -hex 32
```

Save the `API_KEY` value, because the Siri shortcut needs it too.

## Step 7: Test it

Start playing something on Spotify, then run (with your own URL and key):

```sh
curl -X POST -H "x-api-key: YOUR_API_KEY" https://spotify-like-current.<your-subdomain>.workers.dev/like
```

You should see `Liked: <song> by <artist>`, and the song should show up in your Liked Songs.

## Step 8: Build the Siri shortcut

On your iPhone (or Mac), open the **Shortcuts** app:

1. Tap **+** to create a new shortcut.
2. Tap **Add Action**, search for **Get Contents of URL**, and add it.
3. Tap the **URL** placeholder and enter your Worker URL with `/like` on the end:
   `https://spotify-like-current.<your-subdomain>.workers.dev/like`
4. Tap the **›** arrow on the action to show more options:
   - **Method:** `POST`
   - **Headers:** tap **Add new header**
     - Key: `x-api-key`
     - Value: your `API_KEY`
5. Add a second action: search for **Speak Text** (or **Show Result**) and add it. It should automatically use **Contents of URL** as its input.
6. Tap the name at the top and rename the shortcut to **Like This Song**. The shortcut's name is the phrase you say to Siri.
7. Tap **Done**.

Now say **"Hey Siri, like this song."** 🎉

**Tip:** You can also add the shortcut to your Home Screen, the Action Button, Back Tap (*Settings → Accessibility → Touch → Back Tap*), or your Apple Watch.

---

## Troubleshooting

| Siri / curl says | What it means |
|---|---|
| `Unauthorized` | The `x-api-key` header doesn't match your `API_KEY` secret. Check for extra spaces. |
| `Nothing's playing.` | Spotify isn't playing anything, or it's playing an ad or podcast. |
| `Can't like local files` | The track is a local file, not a Spotify track. |
| `Error: token refresh failed (400) ...` | The refresh token is invalid or expired. Re-run `npm run login` and update `SPOTIFY_REFRESH_TOKEN` (Step 6). |
| `Error: ... (403) ...` | Your Spotify account may not be allowed to use the app. In the Spotify dashboard, open your app → **User Management** and add your account's email. |

To see live logs from the Worker:

```sh
npx wrangler tail
```

## Local development (optional)

```sh
cp .dev.vars.example .dev.vars   # then fill in your values
npm run dev
```

`.dev.vars` is git-ignored so your secrets stay off GitHub.

## Security notes

- Your Spotify credentials only live in Cloudflare's encrypted secrets and never go to your phone.
- Anyone who has **both** your Worker URL and your `API_KEY` can like songs on your account. If you think the key has leaked, set a new one with `npx wrangler secret put API_KEY` and update the shortcut.
- The Worker only asks Spotify for two permissions: reading what's currently playing and saving to your library.

## License

[MIT](LICENSE)
