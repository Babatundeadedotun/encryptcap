import mongoose from 'mongoose';
import { env } from '../config/env.js';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

interface MemoryServerModule {
  MongoMemoryServer: {
    create(): Promise<{ getUri(dbName?: string): string; stop(): Promise<boolean> }>;
  };
}

/**
 * The in-memory MongoDB is a development convenience and is not installed in
 * production. Holding the specifier in a variable keeps TypeScript from trying
 * to resolve it at build time, so a production install — which omits dev
 * dependencies — still compiles.
 */
const MEMORY_SERVER = 'mongodb-memory-server';

/**
 * Connect to MongoDB.
 *
 * With MONGODB_URI set, connects to that server. Without it (development only)
 * an in-memory MongoDB is started so the app runs with nothing installed —
 * convenient, but every restart begins from an empty database, so re-seed.
 */
export async function connectDb(): Promise<string> {
  let uri = env.mongoUri;

  if (!uri) {
    if (env.isProd) throw new Error('MONGODB_URI must be set in production.');

    try {
      const { MongoMemoryServer } = (await import(MEMORY_SERVER)) as MemoryServerModule;
      const server = await MongoMemoryServer.create();
      memoryServer = server;
      uri = server.getUri('encryptcap');
      console.warn(
        '[db] MONGODB_URI is empty — started an in-memory MongoDB.\n' +
          '     Data is discarded when this process exits. Set MONGODB_URI to persist.',
      );
    } catch (err) {
      // The in-memory server downloads a mongod binary on first use. Behind a
      // restricted network that download fails, and the fix is a real database
      // rather than anything in this codebase.
      throw new Error(
        'Could not start the in-memory MongoDB (it downloads a mongod binary on first run).\n' +
          'Point MONGODB_URI at a real database instead — either:\n' +
          '  local:  mongodb://127.0.0.1:27017/encryptcap\n' +
          '  atlas:  mongodb+srv://<user>:<pass>@<cluster>/encryptcap\n' +
          `Original error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
