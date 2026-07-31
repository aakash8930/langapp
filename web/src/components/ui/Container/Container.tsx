import type { HTMLAttributes } from "react";
import { cn } from "../../../lib";

import "./container.css";


type ContainerProps = HTMLAttributes<HTMLDivElement>;

export function Container({
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn("ui-container", className)}
      {...props}
    >
      {children}
    </div>
  );
}