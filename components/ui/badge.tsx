import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em] shadow-[var(--shadow-soft)]",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/10 text-primary",
        secondary: "border-secondary/20 bg-secondary/18 text-secondary-foreground",
        outline: "border-border bg-background/82 text-muted-foreground",
        success: "border-secondary/20 bg-secondary/18 text-secondary-foreground",
        warning: "border-[color:color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--warning)_18%,transparent)] text-foreground",
        glass: "border-border/70 bg-card/78 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
