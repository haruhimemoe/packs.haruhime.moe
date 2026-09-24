/**
 * @file src/components/ui/Button.tsx
 * @desc Pill button primitive. Defaults to type="button".
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { ComponentProps } from "react";
import { type ButtonSize, type ButtonVariant, buttonClasses } from "@/components/ui/buttonStyles";

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
