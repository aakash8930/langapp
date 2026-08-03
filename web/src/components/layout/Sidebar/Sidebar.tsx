import { sidebarItems } from "../../../constants/navigation";

import "./Sidebar.css";

export function Sidebar() {
  return (
    <aside className="app-sidebar">
      <nav>
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className="sidebar-item"
          >
            {item.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}