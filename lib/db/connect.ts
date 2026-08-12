import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Cached across Next.js dev hot-reloads so we don't open a new connection per request/reload.
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose._mongooseCache ?? {
  conn: null,
  promise: null,
};
globalForMongoose._mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
