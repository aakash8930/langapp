export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  disabled?: boolean;
}

export interface SidebarProps {
  collapsed?: boolean;
}