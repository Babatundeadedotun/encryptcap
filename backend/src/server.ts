import { createApp } from './app.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { env } from './config/env.js';
import { seedIfEmpty } from './seed/bootstrap.js';
import { applyBreakGlassReset } from './seed/breakglass.js';

async function main(): Promise<void> {
  await connectDb();

  // A fresh database prepares itself: the demo book in development, the manager
  // login alone in production. No-op once any user exists.
  try {
    await seedIfEmpty();
    // After seeding, so it can rescue an account that already exists.
    await applyBreakGlassReset();
  } catch (err) {
    console.error('[setup] Could not prepare the database:', err);
    console.error('[setup] The API is still starting — see the README to retry by hand.');
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[api] allowing browser requests from ${env.clientOrigin}`);
  });

  // A busy port is the most common first-run stumble. Say so plainly instead of
  // throwing an unhandled 'error' event and a stack trace.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[api] Port ${env.port} is already in use.\n` +
          '      Something else is running there — most likely another copy of this API.\n' +
          '      Either stop it, or set a different PORT in backend/.env.\n' +
          `      Find it with:  lsof -i :${env.port}      (macOS/Linux)\n` +
          `                     netstat -ano | findstr :${env.port}   (Windows)\n`,
      );
    } else if (err.code === 'EACCES') {
      console.error(
        `\n[api] Not allowed to bind port ${env.port}. Ports below 1024 need elevated ` +
          'privileges — pick a higher PORT in backend/.env.\n',
      );
    } else {
      console.error('[api] Server error:', err);
    }
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down.`);
    server.close(() => {
      void disconnectDb().then(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);

  // Translate the usual MongoDB connection failures into something actionable.
  if (/bad auth|Authentication failed/i.test(message)) {
    console.error(
      '\n[api] MongoDB rejected those credentials.\n' +
        '      Check the username and password in MONGODB_URI (backend/.env).\n' +
        '      If the password contains @ : / ? # [ ] or %, URL-encode it — @ becomes %40.\n' +
        '      Still using the literal <db_password> placeholder? Replace it.\n',
    );
  } else if (/ENOTFOUND|querySrv|getaddrinfo/i.test(message)) {
    console.error(
      '\n[api] Could not resolve that MongoDB host.\n' +
        '      Check the cluster address in MONGODB_URI for typos, and that you are online.\n',
    );
  } else if (/timed out|ETIMEDOUT|ECONNREFUSED|ServerSelectionError/i.test(message)) {
    console.error(
      '\n[api] Could not reach MongoDB before timing out.\n' +
        '      On Atlas this is almost always the IP allowlist:\n' +
        '        Atlas → Network Access → Add IP Address → Allow access from anywhere\n' +
        '      Running locally? Make sure mongod is actually started.\n',
    );
  } else {
    console.error('[api] Failed to start:', err);
  }

  process.exit(1);
});
