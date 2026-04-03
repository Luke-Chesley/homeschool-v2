"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CurriculumDeleteFormProps {
  action: (formData: FormData) => void | Promise<void>;
  sourceId: string;
  sourceTitle: string;
}

export function CurriculumDeleteForm({
  action,
  sourceId,
  sourceTitle,
}: CurriculumDeleteFormProps) {
  return (
    <form
      action={action}
      className="flex justify-end"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete "${sourceTitle}"? This removes its imported structure and related items.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sourceId" value={sourceId} />
      <DeleteButton sourceTitle={sourceTitle} />
    </form>
  );
}

function DeleteButton({ sourceTitle }: { sourceTitle: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
      aria-label={`Delete curriculum ${sourceTitle}`}
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
