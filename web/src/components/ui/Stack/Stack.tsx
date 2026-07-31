import type { HTMLAttributes } from "react";

import { cn } from "../../../lib";

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: number | string;
};

export function Stack({
  gap = "var(--s-lg)",
  className,
  style,
  children,
  ...props
}: StackProps) {
  return (
    <div
      className={cn("ui-stack", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}