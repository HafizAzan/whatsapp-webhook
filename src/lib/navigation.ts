export type AppSection = "automation" | "business" | "export" | "analytics";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  section: AppSection;
  description?: string;
}

export const AUTOMATION_NAV: NavItem[] = [
  { href: "/connect", label: "Channel Link", short: "LNK", section: "automation" },
  { href: "/chats", label: "Conversations", short: "CHT", section: "automation" },
  { href: "/broadcasts", label: "Broadcasts", short: "BC", section: "automation" },
  { href: "/auto-replies", label: "Auto Replies", short: "AR", section: "automation" },
  { href: "/scheduled", label: "Scheduler", short: "SCH", section: "automation" },
  { href: "/chat-links", label: "Chat Links", short: "URL", section: "automation" },
  { href: "/webhooks", label: "Webhooks", short: "WH", section: "automation" },
];

export const SECTION_RAIL: { section: AppSection; label: string; href: string; prefix: string }[] = [
  { section: "automation", label: "Automation", href: "/chats", prefix: "/chats" },
  { section: "business", label: "Business", href: "/business", prefix: "/business" },
  { section: "export", label: "Export", href: "/export", prefix: "/export" },
  { section: "analytics", label: "Analytics", href: "/analytics", prefix: "/analytics" },
];

const AUTOMATION_PREFIXES = [
  "/connect",
  "/chats",
  "/broadcasts",
  "/auto-replies",
  "/scheduled",
  "/chat-links",
  "/webhooks",
];

export function getActiveSection(pathname: string): AppSection {
  if (pathname === "/" || pathname === "") return "automation";
  if (pathname.startsWith("/business")) return "business";
  if (pathname.startsWith("/export")) return "export";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (AUTOMATION_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "automation";
  }
  return "automation";
}

export function getPageMeta(pathname: string): { title: string; subtitle?: string } {
  const item = AUTOMATION_NAV.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
  );
  if (item) return { title: item.label, subtitle: "Automation" };

  if (pathname === "/chats") return { title: "Conversations", subtitle: "Automation" };
  if (pathname === "/broadcasts") return { title: "Broadcasts", subtitle: "Automation" };
  if (pathname.startsWith("/business")) return { title: "Business", subtitle: "Coming soon" };
  if (pathname.startsWith("/export")) return { title: "Export", subtitle: "Coming soon" };
  if (pathname.startsWith("/analytics")) return { title: "Analytics", subtitle: "Coming soon" };

  return { title: "PulseBridge", subtitle: undefined };
}
