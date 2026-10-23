import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isChatConfigured } from "@/lib/chat/googleChat";
import { syncSpace } from "@/lib/chat/syncSpace";
import { ChatConnection } from "@/models/chat-connection";

/** Whether Google Chat is connected, as whom, and when it last synced. */
export async function GET() {
  await connectToDatabase();
  const connection = await ChatConnection.findOne({ key: "chat" }).select("email status lastSyncAt lastMessageAt lastError").lean();
  return NextResponse.json({
    configured: isChatConfigured(),
    connection: connection ? { email: connection.email, status: connection.status, lastSyncAt: connection.lastSyncAt, lastError: connection.lastError } : null,
  });
}

/** Reads the space's new messages and imports the time reports among them. */
export async function POST() {
  await connectToDatabase();
  try {
    return NextResponse.json(await syncSpace());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Syncing failed." }, { status: 502 });
  }
}
