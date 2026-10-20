# Run EncryptCap on your machine

Five minutes. You need [Node 20+](https://nodejs.org) and a MongoDB connection
string.

---

## 1. Install

From inside the `encryptcap` folder:

```bash
npm run install:all
```

## 2. Create the config files

```bash
npm run setup
```

That writes `backend/.env` with a freshly generated session secret.
The frontend needs no config to run locally.

## 3. Add your MongoDB URI

Open `backend/.env` and paste your string into the `MONGODB_URI=` line.

**MongoDB Atlas** (free tier is fine):

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com) and create a cluster
2. **Database Access** → add a user, and note the password
3. **Network Access** → Add IP Address → *Allow access from anywhere* while testing
4. **Connect** → **Drivers** → copy the string
5. Replace `<db_password>` with the real password, and put `encryptcap` as the
   database name before the `?`:

```
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.ab12c.mongodb.net/encryptcap?retryWrites=true&w=majority
```

If your password contains `@ : / ? # [ ] %`, URL-encode it — `@` becomes `%40`.

**Or a local MongoDB:**

```
MONGODB_URI=mongodb://127.0.0.1:27017/encryptcap
```

*You can skip this step entirely to take a quick look — the API will spin up a
temporary in-memory database instead. That data disappears when you stop it.*

## 4. Start it

```bash
npm run dev
```

Both servers start together:

- **web → http://localhost:5173**
- api → http://localhost:4000

The first launch notices the database is empty and loads 30 demo investor
accounts and 4 research articles by itself. Restarting will not wipe anything.

---

## Logging in

| Role | Email | Password |
| --- | --- | --- |
| **Manager** | `manager@encryptcap.com` | `ChangeMe!2026` |
| **Investor** | `tunde.adeyemi@example.com` | `Investor!2026` |

Both are asked to set a new password on first login — click **Not now** to skip
while you're exploring.

## Worth clicking through

**As the manager** (`/app/manager`)

- The book — sort any column, filter by tier
- Open any investor row → post a monthly report, and watch their equity, charts
  and fee update from it
- **Reset password** on an account page issues a new one-off password
- **Research** → write an article, attach a PDF, publish it, then find it live on
  the public Reports page

**As an investor** (`/app/investor`)

- Your equity, profit share, and the deposit line on the chart
- **Download PDF** on either statement — these are generated on the fly
- The four capital actions open a request form, then a pre-filled email

Try an investor who is **down** — their profit share and fee both show `$0`.
That's the high-water-mark rule: no fee is charged on an account below its
deposit.

---

## Troubleshooting

**`MongoServerError: bad auth`** — wrong password in the URI, or you left the
literal `<db_password>` in place.

**Hangs, then a timeout** — your IP isn't allowed. Atlas → Network Access.

**`EADDRINUSE`** — something else is on port 4000 or 5173. Change `PORT` in
`backend/.env`, or stop the other process.

**Login succeeds then immediately logs out** — `CLIENT_ORIGIN` in `backend/.env`
must exactly match the address in your browser bar, with no trailing slash.

**Starting over** — `npm run seed` wipes the database and reloads the demo book.

---

## Before hosting

**[DEPLOY.md](DEPLOY.md) walks through the whole thing** — MongoDB Atlas, then
Render for the API, then Netlify for the site, in that order, with the exact
values to paste into each.

Two things worth knowing before you start:

- **Netlify cannot run the backend.** It serves static files only. The API needs
  a host that runs Node — Render, Railway or Fly.
- **The API must be deployed first.** Its address is compiled into the frontend
  bundle at build time, so you need it before you run `npm run build`.
