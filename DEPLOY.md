# Going live

Backend on **Render**, frontend on **Netlify**, database on **MongoDB Atlas**.
About 30 minutes end to end.

Do them in this order. The frontend needs the API's address before it is built,
so the API goes first.

---

## Before you start

You need three free accounts: [MongoDB Atlas](https://cloud.mongodb.com),
[Render](https://render.com), [Netlify](https://netlify.com).

Have these two values written down — you'll paste them several times:

| | Example | Yours |
| --- | --- | --- |
| API address | `https://encryptcap-api.onrender.com` | *filled in at step 2* |
| Site address | `https://encryptcap.netlify.app` | *filled in at step 3* |

---

## Step 1 — Database (Atlas)

1. **Create a cluster** — [cloud.mongodb.com](https://cloud.mongodb.com) → *Build a Database* → **M0 free** → pick the region nearest Lagos (Frankfurt or Ireland).
2. **Create a database user** — *Database Access* → *Add New Database User*. Username and password, *Read and write to any database*. **Write the password down.**
3. **Allow Render to connect** — *Network Access* → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`).

   Render's free tier has no fixed outbound IP, so there is nothing narrower to
   allow. Your database is still protected by the username and password.
4. **Copy the connection string** — *Database* → **Connect** → **Drivers** → copy.

Now edit that string in a text editor:

```
mongodb+srv://myuser:<db_password>@cluster0.ab12c.mongodb.net/?retryWrites=true&w=majority
                     ^^^^^^^^^^^^^                            ^
                     replace with your real password          add: encryptcap
```

Finished result:

```
mongodb+srv://myuser:MyRealPassword@cluster0.ab12c.mongodb.net/encryptcap?retryWrites=true&w=majority
```

> If your password contains `@ : / ? # [ ] %`, URL-encode it — `@` becomes `%40`,
> `#` becomes `%23`. Otherwise the connection fails with *bad auth*.

---

## Step 2 — API (Render)

Your code must be on GitHub first. If it isn't:

```bash
cd encryptcap
git init && git add -A && git commit -m "EncryptCap"
git branch -M main
git remote add origin https://github.com/<you>/encryptcap.git
git push -u origin main
```

Then in Render:

1. **New** → **Web Service** → connect your GitHub repo.
2. Set these exactly:

   | Field | Value |
   | --- | --- |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

3. **Environment variables** — add all six:

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | the string you built in step 1 |
   | `JWT_SECRET` | run `openssl rand -hex 48` and paste the result |
   | `CLIENT_ORIGIN` | `https://encryptcap.netlify.app` — your Netlify address, **no trailing slash** |
   | `SEED_MANAGER_EMAIL` | the email you want to sign in with |
   | `SEED_MANAGER_PASSWORD` | a real password, 10+ characters |

   You don't know your Netlify address yet. Put a placeholder now and come back
   at step 4 — that's what step 4 is for.

4. **Create Web Service** and watch the log. Success looks like:

   ```
   [setup] Empty database — created the manager login and nothing else.
           Sign in as: you@example.com
   [api] listening on http://localhost:10000 (production)
   ```

5. **Copy your API address** from the top of the page —
   `https://encryptcap-api.onrender.com`.

6. **Check it works** — open `https://your-api.onrender.com/api/health` in a
   browser. You should see `{"ok":true,"env":"production",...}`.

> **The API refuses to start rather than come up misconfigured.** If a variable
> is wrong the log tells you which one and how to fix it. Fix it in
> *Environment*, then *Manual Deploy → Deploy latest commit*.

> **Free tier sleeps after 15 minutes idle.** The first request afterwards takes
> ~50 seconds while it wakes. That is Render, not your app. $7/month removes it.

---

## Step 3 — Build the frontend

On your own machine. **This step bakes the API address into the files**, so it
must come after step 2.

1. Create `frontend/.env`:

   ```
   VITE_API_BASE=https://encryptcap-api.onrender.com
   ```

   Your Render address from step 2.5. No trailing slash.

   > Netlify's own environment variables will **not** help you here — you are
   > building on your laptop, so the value must be in this file before you build.

2. Build:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

   This creates `frontend/dist`.

3. **Deploy** — go to [app.netlify.com/drop](https://app.netlify.com/drop) and
   **drag the whole `dist` folder** onto the page.

   Drag the folder itself, not the files inside it.

4. Netlify gives you an address like `https://spontaneous-marzipan-a1b2c3.netlify.app`.
   Rename it under *Site configuration → Change site name* if you like.

> `dist` already contains a `_redirects` file, so refreshing `/about` works
> instead of 404ing. Don't delete it.

---

## Step 4 — Introduce them to each other

The API only accepts requests from origins it knows, so tell it about your real
site address.

1. Render → your service → **Environment**
2. Set `CLIENT_ORIGIN` to your Netlify address, exactly, no trailing slash:

   ```
   https://spontaneous-marzipan-a1b2c3.netlify.app
   ```

3. **Save** — Render redeploys automatically. Wait for it to finish.

---

## Step 5 — Check it's live

1. Open your Netlify address.
2. The homepage, pricing, about and reports pages should load.
3. **Sign in at `/admin`** — e.g. `https://encryptcap.netlify.app/admin` — with
   `SEED_MANAGER_EMAIL` and `SEED_MANAGER_PASSWORD`.

   That is the staff door. It is deliberately not linked from anywhere on the
   site, so **write the address down**. Investors sign in at `/login`, and that
   page will not let them anywhere near the console.
4. You'll be asked to set your own password. **Do it now.**
5. **Generate your recovery codes** — *Security → Generate codes*. Ten codes
   appear once. Print them, or put them in a password manager that is not this
   site. They are the way back in if you forget your password and there is no
   second manager yet.

   A brand-new database prints a set into the Render log on first boot. A
   database that already has a manager does not, so if you are upgrading an
   existing deployment, this step is how you get them.
6. If you are ever locked out and have no code left, set
   `MANAGER_PASSWORD_RESET` on Render to a new password, redeploy, sign in with
   it, then **delete the variable again**.
5. The console will be empty — no investors, no figures. That's correct: you
   chose a clean launch. Add real accounts with **New account**.

If login fails, see *If something's wrong* below.

---

## Updating later

**Backend** — push to GitHub; Render redeploys on its own.

**Frontend** — rebuild and drop the new `dist` again:

```bash
cd frontend && npm run build
```

Then drag `dist` onto your existing site's *Deploys* tab (not the /drop page, or
you'll create a second site).

---

## If something's wrong

**Login works, then immediately logs out.**
`CLIENT_ORIGIN` doesn't exactly match your site address. Check for a trailing
slash, `http` vs `https`, or `www.` being present on one side only.

**Every request fails, console shows a CORS error.**
Same cause. The address in `CLIENT_ORIGIN` must be character-for-character what
the browser shows in the address bar.

**The site loads but nothing has data.**
Open `https://your-api.onrender.com/api/health` directly. If it doesn't respond,
the API is asleep (wait 50s) or failed to start (check the Render log).

**Build fails with `Cannot find name 'console'`, `Cannot find name 'process'`, or
`Could not find a declaration file for module '...'`.**

The build compiled TypeScript without its type packages installed. This happens
when the host skips devDependencies — which `NODE_ENV=production` makes `npm ci`
do by default.

Both `package.json` files already keep the build toolchain (TypeScript, the
`@types/*` packages, Vite) in `dependencies` for exactly this reason, so
`npm ci && npm run build` works with or without `NODE_ENV` set. If you have
edited them and hit this, either move those packages back into `dependencies`,
or change the Render build command to:

```
npm ci --include=dev && npm run build
```

**`bad auth` in the Render log.**
Wrong database password in `MONGODB_URI`, or you left `<db_password>` in place.

**Connection times out in the Render log.**
Atlas *Network Access* is not allowing `0.0.0.0/0`.

**Login fails with "Could not reach the server", and DevTools shows
`api/auth/login` returning 404.**

Look at the request URL in the Network tab. If it starts with your *site*
address rather than your Render address, the bundle was built without
`VITE_API_BASE`, so every API call is going to Netlify.

Check the built files:

```bash
grep -o "https://[a-z0-9-]*\.onrender\.com" dist/assets/*.js
```

Nothing printed means the address was not baked in. Create `frontend/.env` with
`VITE_API_BASE=https://your-api.onrender.com`, run `npm run build` again, and
re-drop `dist`.

This is the single most common deployment mistake here, because the value is
compiled into the bundle at build time — setting it in Netlify's dashboard has
no effect when you build on your own machine.

**Refreshing a page gives 404.**
The `_redirects` file didn't make it into `dist`. Rebuild and redeploy.

**Uploaded a research PDF and it's gone.**
It shouldn't be — attachments are stored in the database precisely so they
survive deploys. If it happens, check the file was under 15 MB.

---

## Once you have real investors

- **Custom domain** — Netlify → *Domain management*. Then add the new address to
  `CLIENT_ORIGIN` on Render (comma-separate to keep both).
- **Paid Render tier** ($7/mo) — removes the cold start, which matters once
  people are logging in daily.
- **Atlas backups** — the M0 free tier has none. Upgrade to M2 before real money
  is being tracked.
- **Tighten Atlas access** — a paid Render plan gives you static outbound IPs you
  can allow specifically instead of `0.0.0.0/0`.
