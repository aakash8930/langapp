import type { HTMLAttributes } from "react";

import "./Main.css";

type MainProps = HTMLAttributes<HTMLElement>;

export function Main({
  children,
  ...props
}: MainProps) {
  return (
    <main className="app-main" {...props}>
      {children}
    </main>
  );
}