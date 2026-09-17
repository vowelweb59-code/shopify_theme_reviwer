import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { connectToDatabase } from "@/lib/db/connect";

// Render's free tier has no persistent disk — anything written to local
// disk is wiped on every redeploy/restart. GridFS stores the ZIP bytes in
// the same MongoDB Atlas database everything else already uses, so no new
// infrastructure/service is needed for the first time this app actually
// keeps an uploaded theme ZIP around.
const BUCKET_NAME = "themeZips";

async function getBucket(): Promise<GridFSBucket> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection not ready.");
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

export async function storeZipBuffer(buffer: Buffer, filename: string): Promise<ObjectId> {
  const bucket = await getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename);
    uploadStream.once("error", reject);
    uploadStream.once("finish", () => resolve(uploadStream.id as ObjectId));
    Readable.from(buffer).pipe(uploadStream);
  });
}

export async function readZipBuffer(gridFsFileId: ObjectId | string): Promise<Buffer> {
  const bucket = await getBucket();
  const id = typeof gridFsFileId === "string" ? new ObjectId(gridFsFileId) : gridFsFileId;
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(id);
    downloadStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    downloadStream.once("error", reject);
    downloadStream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Best-effort — used only when cascade-deleting a Theme (models/theme.ts).
// Never called on the normal upload/audit path, since prior versions/zips
// are deliberately never deleted there.
export async function deleteZip(gridFsFileId: ObjectId | string): Promise<void> {
  const bucket = await getBucket();
  const id = typeof gridFsFileId === "string" ? new ObjectId(gridFsFileId) : gridFsFileId;
  await bucket.delete(id);
}
