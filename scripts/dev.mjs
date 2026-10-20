/**
 * Starts the API and the web app together, so `npm run dev` is the whole story.
 * Zero dependencies — just two child processes with prefixed output.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureEnv, readMongoUri } from './setup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const { created, path: envPath } = ensureEnv();
if (created) console.log(`[setup] created ${envPath} with a generated JWT secret.\n`);

if (!readMongoUri()) {
  console.log(
    '[setup] No MONGODB_URI set yet — starting a throwaway in-memory database.\n' +
      `        Data will vanish when you stop the server. To keep it, add your URI to:\n` +
      `        ${envPath}\n`,
  );
}

const children = [];

function run(name, cwd, colour) {
  const child = spawn(npm, ['run', 'dev'], { cwd: path.join(root, cwd), shell: false });
  children.push(child);

  const prefix = `\x1b[${colour}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${prefix}exited with code ${code}. Shutting the other process down.`);
      shutdown();
    }
  });

  return child;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('api', 'backend', '36');
run('web', 'frontend', '35');

console.log('  api  →  http://localhost:4000');
console.log('  web  →  http://localhost:5173\n');
