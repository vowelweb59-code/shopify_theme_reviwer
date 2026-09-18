import { redirect } from "next/navigation";

// The app has no standalone dashboard — Themes (with its own Compare
// Themes table) is the natural landing page.
export default function RootPage() {
  redirect("/themes");
}
