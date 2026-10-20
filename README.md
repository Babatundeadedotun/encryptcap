# EncryptCap

The v3 design built as a MERN application: a public marketing site, a private
investor desk, and a manager console that runs the book.

```
encryptcap/
├── backend/     Express + MongoDB (Mongoose) + TypeScript
├── frontend/    React + Vite + TypeScript
└── scripts/     setup and dev runners
```

Both folders carry a fully commented `.env.example` listing every URL, URI and
key the project uses or will use. Copy each to `.env` and fill in what you need
— only `MONGODB_URI` is required to run.

---

## Running it

You need Node 20+ and a MongoDB connection string. That string is the only
thing you have to provide.

```bash
npm run install:all
npm run setup            # writes backend/.env with a generated JWT secret
```

Open `backend/.env`, paste your URI into the `MONGODB_URI=` line, then:

```bash
npm run dev              # starts the API and the web app together
```

- web → http://localhost:5173
- api → http://localhost:4000

That is the whole setup. On first boot the API notices the database is empty and
loads the demo book itself, so there is no seed step to remember. It never does
this in production, and never when any user already exists — restarting is safe
and will not touch your data.

If you skip the URI entirely, the API falls back to a throwaway in-memory
database so you can still look around; that data disappears when you stop it.

### Connection strings

```
mongodb://127.0.0.1:27017/encryptcap                     # local
mongodb+srv://<user>:<pass>@<cluster>/encryptcap         # Atlas
```

### Seeded logins

| Who | Email | Password |
| --- | --- | --- |
| Manager | `manager@encryptcap.com` | `ChangeMe!2026` (set by `SEED_MANAGER_PASSWORD`) |
| 30 investors | `tunde.adeyemi@example.com`, … | `Investor!2026` |

Everyone seeded is flagged must-change-password. **These are invented people and
invented figures — clear them and rotate the passwords before this touches a
real customer.** `npm run seed` re-runs the load from scratch and is destructive.

---

## What's here

### Public site
Home, About Us, Pricing, and a Reports hub with individual article pages.
Heroes on Home and About carry the faint market-chart overlay; the what-we-do
cards are deep blue with a gold icon per subheading. "Open an account" requires
every field before the submit button unlocks, then composes a pre-filled email —
account opening stays a human conversation, as designed.

### Investor desk (`/app/investor`)
Equity, lifetime P&L, the deposit line, and the Capital Performance section:
a monthly performance report (opening balance, NFP trade, realised P/L, closing
equity, broker-verified) and a capital position statement (deposited capital,
current equity, profit this cycle, projected share, next distribution). Both
download as branded PDFs. The four capital actions open a name + figure form
that logs the request and composes an email.

An investor can only ever load their own account. The API enforces it —
`/api/accounts` returns 403 for them, and so do another investor's account,
reports and statements.

### Manager console (`/app/manager`)
Firm-wide KPIs, the AUM curve, tier breakdown, risk guards, and the sortable,
filterable book. From here a manager can:

- **create investor accounts** — issues the login and portfolio together, and
  shows a one-off password to pass on
- **reset a forgotten password** — issues a fresh one-off password and forces a
  change at next login; this is the only recovery path
- **post monthly reports** — opening balance, NFP result, closing equity;
  realised P&L is derived so it can't contradict them
- **work the request queue** — capital actions investors have submitted
- **publish research** — write articles and upload the PDF/PPTX readers download

---

## The money rules

All of it lives in `backend/src/services/domain.ts` and runs on the server. The
client renders what the API returns and never computes a fee itself.

- Fee is **33.3% of profit only**; the investor keeps **66.7%**
- Fee applies only **above the account's high-water mark**, so an account that
  fell and recovered pays nothing until it clears its previous peak
- A losing account pays **no fee** and carries **no debt**
- Current equity is the **latest posted closing equity**, or deposited capital
  before any report exists

`npm test` covers these rules, including the worked example on the pricing page.

> The pricing page illustrates a $2,000 profit as $1,334 / $666. That's the
> rounded 66.7% / 33.3% figures from the design copy; the code uses exact thirds
> and produces $1,333.33 / $666.67. The marketing illustration was left as
> designed — say the word if you'd rather they match to the cent.

---

## Checks

```bash
npm test          # domain rules — fee split, high-water mark, distributions
npm run typecheck # both packages
npm run smoke     # end-to-end API walk against a throwaway database
npm run build     # production build of both
```

`npm run smoke` boots the real app against a database, seeds it, and walks 42
assertions: manager login, the book, account creation, posting a report,
investor login, statement PDFs, password resets, and the privacy boundary
between investors. It is destructive — point `MONGODB_URI` at a scratch
database, not your real one.

---

## The two sign-in doors

| Door | Who it is for | Behaviour |
| --- | --- | --- |
| `/login` | Investors | Accepts either role. A manager signing in here is sent to the console, not the investor desk. |
| `/admin` | Staff | **Managers only.** An investor's own, correct password is refused with a message pointing them at `/login`. |

`/admin` is not linked from anywhere in the UI — it is reached by typing the
address. That keeps the staff door off every crawler and bot that walks the
navigation, but obscurity is not the protection: the protections are the
password, the rate limit on the login endpoint, and the server refusing a
non-manager at that door regardless of what the browser sends. The rule lives in
`backend/src/services/doors.ts` and is covered by its own tests.

Once signed in, a **Manager Console** link appears in the navbar on every page,
including the public ones. Investors never see it, and `/app/manager` is guarded
by both the route check and a 403 from every manager endpoint.

---

## Losing and regaining access

**Recovery codes.** Ten single-use codes, issued from *Security → Generate
codes* in the console. Each works once at `/admin` → *Lost access?* to set a new
password. Issuing a set asks for your current password, so a borrowed session
cannot mint long-lived access. A new set replaces the old one completely, used
codes or not.

They are stored as SHA-256 digests, so a lost set cannot be read back, only
replaced. Hashed rather than bcrypt on purpose: a slow KDF makes *guessable*
secrets expensive to attack, and these carry ~59 bits of entropy from the system
CSPRNG, so brute force is already out of reach.

**Break-glass reset.** If the password is lost and no code is to hand, set
`MANAGER_PASSWORD_RESET` in the host's environment to a new password of at least
10 characters. On the next boot the manager password becomes that value, every
existing session is signed out, and the log says so.

It is not a weakening: setting it requires access to the host's environment
variables, and anyone who has that already holds `MONGODB_URI` and could rewrite
the account directly. It simply replaces hand-editing a bcrypt hash into the
database, which is easy to get wrong and leaves no trace.

**Remove the variable once you are back in.** While it is set, every deploy
resets the password to it again.

**Every password change signs out every device.** Each account carries a
`tokenVersion`, bumped whenever the password is set by any route, and sessions
carry the version they were signed with. Before this a stolen session outlived
the reset meant to stop it. Investor resets are covered too. The device doing
the changing is re-issued a session, so you are not logged out of your own tab.

---

## Deploying

**[DEPLOY.md](DEPLOY.md) is the step-by-step guide** — Atlas, then Render, then
Netlify, in the order they have to be done.

In brief:

**Backend** needs `NODE_ENV=production`, a real `MONGODB_URI`, a generated
`JWT_SECRET` (`openssl rand -hex 48`), `CLIENT_ORIGIN` set to your site's
address, and a `SEED_MANAGER_PASSWORD` of your own. It refuses to start if any
of those is missing or left at a documented default, and the log names the
variable and the fix. Build with `npm run build`, run with `npm start`.

On an empty database, production creates **only** the manager login — no demo
investors, no invented figures. Development still loads the full demo book.

**Frontend** — `npm --prefix frontend run build` emits `frontend/dist`.

Serve it behind the same origin as the API if you can: the session cookie stays
first-party, and `VITE_API_BASE` can stay empty. Splitting the hosts (Netlify +
Render) works too — set `VITE_API_BASE` to the API's address and add the site's
address to `CLIENT_ORIGIN`. The cookie then needs `SameSite=None; Secure`, which
the backend already sets in production.

`dist` ships a `_redirects` file so unknown paths fall back to `index.html`,
which is what a client-routed app needs. That covers Netlify, including
drag-and-drop deploys where `netlify.toml` is never read.

**Uploads** are stored in MongoDB, not on disk, so research attachments survive
the deploys and restarts that wipe a container's filesystem. The ceiling is
15 MB per file — a MongoDB document cannot exceed 16 MB.

---

## Not wired up

Honest list of what is stubbed:

- **Sending the research email.** Sign-ups are stored and the manager can see
  the count, but nothing sends mail. Export the list into whatever you use.
- **Self-service password reset.** "Forgot password?" tells the investor to
  contact their manager, who can now reset it from the account page. There is no
  emailed reset link.
- **Phone number** on the About page reads "Add before launch" until you set
  `VITE_CONTACT_PHONE` in `frontend/.env`.
- **Capital requests** are logged to the database *and* composed as an email, so
  nothing is lost if the email is never sent. Settling one is a deliberate
  manager action, but it is no longer only a status change: it pays out,
  crystallises the fee and ratchets the high-water mark.

## Before this handles real money

- Replace the seeded investors and rotate every seeded password
- Put HTTPS in front of the API — the session cookie depends on it
- Add backups for the database and the uploads directory
- Have someone review the auth and authorization boundaries independently
