import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-[calc(var(--radius)+0.25rem)] border text-card-foreground transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-card/84 shadow-[var(--shadow-card)] backdrop-blur-[16px]",
        glass: "border-border/70 bg-[var(--glass-panel)] shadow-[var(--shadow-card)] backdrop-blur-[20px]",
        elevated: "border-border/80 bg-card shadow-[var(--shadow-elevated)]",
        muted: "border-border/60 bg-[var(--surface-muted)] shadow-[var(--shadow-soft)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2.5 p-5 sm:p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-serif text-xl leading-tight tracking-[-0.025em] sm:text-[1.45rem]", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle, cardVariants };
