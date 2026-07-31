import type { HTMLAttributes } from "react";

import { cn } from "../../../lib";
import "./typography.css";

type Variant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "caption";

type TypographyProps = HTMLAttributes<HTMLElement> & {
  as?: keyof HTMLElementTagNameMap;
  variant?: Variant;
};

export function Typography({
  as = "p",
  variant = "body",
  className,
  children,
  ...props
}: TypographyProps) {
  const Component = as;

  return (
    <Component
      className={cn(`ui-text ui-text-${variant}`, className)}
      {...props}
    >
      {children}
    </Component>
  );
}