import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PromptChip({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "assistant-chip h-auto min-h-10 rounded-full px-3.5 py-2 text-left text-sm shadow-[var(--shadow-soft)]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
