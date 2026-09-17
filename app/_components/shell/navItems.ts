import { LayoutDashboard, Palette, ShieldCheck, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/insights", label: "Audit Rules", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
