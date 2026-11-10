import { connectToDatabase } from "@/lib/db/connect";
import { ServiceChatConnection } from "@/models/service-chat";
import { syncAttendance } from "./sync";

// Reads the attendance space every 30 minutes (the last two months, for late or edited posts) while the Service Chat connection
// is active. Skipped until Chat is connected.
const INTERVAL_MS = Number(process.env.ATTENDANCE_SYNC_MINUTES ?? 30) * 60 * 1000;

const g = globalThis as typeof globalThis & { _attendanceScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean; running: boolean } };
const state = (g._attendanceScheduler ??= { timer: null, started: false, running: false });

async function runOnce() {
  if (state.running) return;
  state.running = true;
  try {
    await connectToDatabase();
    const conn = await ServiceChatConnection.findOne({ key: "service-chat" }).select("status").lean<{ status: string } | null>();
    if (conn?.status === "active") await syncAttendance(2);
  } catch (err) {
    console.error("[attendance] scheduled sync failed:", err instanceof Error ? err.message : err);
  } finally {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    const timer = setTimeout(() => void runOnce(), INTERVAL_MS);
    timer.unref?.();
    state.timer = timer;
  }
}

/** Called once from instrumentation.ts on server boot. */
export async function startAttendanceScheduler() {
  if (state.started) return;
  state.started = true;
  void runOnce();
}
