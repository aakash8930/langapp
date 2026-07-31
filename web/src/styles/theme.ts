import { colors } from "./colors";
import { spacing } from "./spacing";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { typography } from "./typography";
import { motion } from "./motion";

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
};

export type Theme = typeof theme;