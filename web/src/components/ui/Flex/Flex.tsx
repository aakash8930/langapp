import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "../../../lib";

type FlexProps = HTMLAttributes<HTMLDivElement> & {
  direction?: CSSProperties["flexDirection"];
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
  gap?: number | string;
  wrap?: CSSProperties["flexWrap"];
};

export function Flex({
  direction = "row",
  justify = "flex-start",
  align = "stretch",
  wrap = "nowrap",
  gap,
  style,
  className,
  children,
  ...props
}: FlexProps) {
  return (
    <div
      className={cn("ui-flex", className)}
      style={{
        display: "flex",
        flexDirection: direction,
        justifyContent: justify,
        alignItems: align,
        flexWrap: wrap,
        gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}