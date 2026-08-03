import type { AppShellProps } from "../../../types/layout";

import { Header } from "../AppHeader";
import { Sidebar } from "../Sidebar";
import { Main } from "../Main";
import { Footer } from "../Footer";

import "./AppShell.css";

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Header />

      <div className="app-shell__body">
        <Sidebar />

        <Main>{children}</Main>
      </div>

      <Footer />
    </div>
  );
}