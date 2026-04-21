import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-medium shadow-[var(--shadow-soft)] outline-none transition-[transform,background-color,color,border-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-active)] hover:bg-primary/92",
        secondary: "border-secondary/20 bg-secondary/14 text-secondary-foreground hover:bg-secondary/22",
        outline: "border-border/80 bg-card/72 text-foreground hover:border-border hover:bg-card",
        ghost: "border-transparent bg-transparent text-foreground shadow-none hover:bg-muted/72",
        subtle: "border-border/70 bg-[var(--surface-muted)] text-foreground hover:bg-card",
      },
      size: {
        default: "h-11 px-4.5",
        sm: "h-9 px-3.5 text-sm",
        lg: "h-12 px-5.5 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? "span" : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
