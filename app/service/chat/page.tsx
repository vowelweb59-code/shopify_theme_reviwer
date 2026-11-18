import { redirect } from "next/navigation";

// The Chat connection now lives in Settings > Service Chat (owner, 2026-11-18). Old links and bookmarks land there.
export default function ServiceChatPage() {
  redirect("/settings?tab=service-chat");
}
