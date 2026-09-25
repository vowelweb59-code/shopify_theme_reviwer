import { BarChart3, Palette, ShieldCheck, Store, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/themes", label: "Themes", icon: Palette },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/demo-store", label: "Shopify Theme Store", icon: Store },
  { href: "/insights", label: "Audit Rules", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
