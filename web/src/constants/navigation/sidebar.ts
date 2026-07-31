import type { SidebarItem } from "../../types/layout";

export const sidebarItems: SidebarItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "home",
    href: "/",
  },
  {
    id: "study",
    label: "Learn",
    icon: "book-open",
    href: "/study",
  },
  {
    id: "practice",
    label: "Practice",
    icon: "pen-square",
    href: "/practice",
  },
  {
    id: "review",
    label: "Review",
    icon: "refresh-cw",
    href: "/review",
  },
  {
    id: "social",
    label: "Community",
    icon: "users",
    href: "/social",
  },
  {
    id: "creator",
    label: "Creator",
    icon: "wand-2",
    href: "/creator",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: "trophy",
    href: "/leagues",
  },
];