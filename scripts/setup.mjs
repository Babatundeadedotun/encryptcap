/**
 * Makes the project runnable with nothing but a MongoDB URI.
 *
 * Creates backend/.env on first run and generates a real JWT secret so sessions
 * survive restarts. Never overwrites an existing .env.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'backend', '.env');

/** Reads MONGODB_URI out of an existing .env, ignoring comments. */
export function readMongoUri() {
  if (!fs.existsSync(envPath)) return '';
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => /^\s*MONGODB_URI\s*=/.test(l));
  return line ? line.split('=').slice(1).join('=').trim() : '';
}

export function ensureEnv() {
  if (fs.existsSync(envPath)) return { created: false, path: envPath };

  const secret = randomBytes(48).toString('hex');
  const contents = `# ─────────────────────────────────────────────────────────────
# Paste your MongoDB connection string here and you are done.
#   local:  mongodb://127.0.0.1:27017/encryptcap
#   atlas:  mongodb+srv://<user>:<pass>@<cluster>/encryptcap
# Leave it empty to run against a throwaway in-memory database.
# ─────────────────────────────────────────────────────────────
MONGODB_URI=

PORT=4000
NODE_ENV=development

# Generated for this install. Keep it secret; changing it logs everyone out.
JWT_SECRET=${secret}
JWT_EXPIRES_IN=7d

CLIENT_ORIGIN=http://localhost:5173

# The manager login created by seeding. Change the password before going live.
SEED_MANAGER_EMAIL=manager@encryptcap.com
SEED_MANAGER_PASSWORD=ChangeMe!2026
`;

  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  return { created: true, path: envPath };
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { created, path: p } = ensureEnv();
  console.log(created ? `Created ${p} with a freshly generated JWT secret.` : `${p} already exists — left alone.`);
  if (!readMongoUri()) {
    console.log('\nAdd your MongoDB URI to the MONGODB_URI line in that file, then run: npm run dev');
  }
}
