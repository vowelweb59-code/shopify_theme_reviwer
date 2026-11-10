import { handle } from "@/lib/service/api/http";
import { runActivityRules } from "@/lib/service/api/projects";

// Runs the 45-day On hold / Active rule now.
export async function POST() {
  return handle(() => runActivityRules());
}
