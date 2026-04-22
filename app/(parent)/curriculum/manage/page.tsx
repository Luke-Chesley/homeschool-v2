import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BookMarked, Trash2 } from "lucide-react";

import { CurriculumDeleteForm } from "@/components/curriculum/curriculum-delete-form";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { deleteCurriculumSource, listCurriculumSources } from "@/lib/curriculum/service";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Manage Curriculum",
};

interface CurriculumManagePageProps {
  searchParams: Promise<{
    deleted?: string;
    error?: string;
  }>;
}

function formatUpdatedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function CurriculumManagePage({
  searchParams,
}: CurriculumManagePageProps) {
  const session = await requireAppSession();
  const organizationId = session.organization.id;
  const params = await searchParams;
  const sources = await listCurriculumSources(organizationId);
  const deletedTitle = typeof params.deleted === "string" ? params.deleted : undefined;
  const hasError = typeof params.error === "string";

  async function deleteAction(formData: FormData) {
    "use server";

    const sourceId = formData.get("sourceId");

    if (typeof sourceId !== "string" || sourceId.length === 0) {
      redirect("/curriculum/manage?error=missing-source");
    }

    const deleted = await deleteCurriculumSource(sourceId, organizationId);

    revalidatePath("/curriculum");
    revalidatePath("/curriculum/manage");
    revalidatePath("/planning");
    revalidatePath("/planning/month");
    revalidatePath("/today");
    revalidatePath("/tracking");
    revalidatePath("/assistant");

    if (!deleted) {
      redirect("/curriculum/manage?error=not-found");
    }

    redirect(`/curriculum/manage?deleted=${encodeURIComponent(deleted.title)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Parent workspace</p>
          <div>
            <h1 className="font-serif text-3xl leading-tight tracking-tight">Manage curriculum</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review imported sources and remove the ones you no longer need.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/curriculum" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to curriculum
          </Link>
          <Link href="/curriculum/new" className={buttonVariants({ size: "sm" })}>
            Add curriculum
          </Link>
        </div>
      </header>

      {deletedTitle ? (
        <Card className="border-primary/20 bg-primary/5">
          <div className="p-4 text-sm text-foreground">
            Deleted <span className="font-medium">{deletedTitle}</span>.
          </div>
        </Card>
      ) : null}

      {hasError ? (
        <Card className="border-destructive/25 bg-destructive/10">
          <div className="p-4 text-sm text-destructive">
            That curriculum could not be deleted. Refresh and try again.
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {sources.length === 0 ? (
            <Card>
              <div className="flex flex-col items-start gap-4 p-6">
                <div className="rounded-2xl bg-secondary/60 p-3 text-secondary-foreground">
                  <BookMarked className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-foreground">No curriculum sources</h2>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Add a source first, then come back here whenever you need to prune older drafts
                    or imports.
                  </p>
                </div>
                <Link href="/curriculum/new" className={buttonVariants({ size: "sm" })}>
                  Add curriculum
                </Link>
              </div>
            </Card>
          ) : (
            sources.map((source) => (
              <Card key={source.id}>
                <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/70 px-2.5 py-1 capitalize">
                          {source.kind.replace("_", " ")}
                        </span>
                        <span className="rounded-full border border-border/70 px-2.5 py-1 capitalize">
                          {source.status.replace("_", " ")}
                        </span>
                        <span className="rounded-full border border-border/70 px-2.5 py-1">
                          v{source.importVersion}
                        </span>
                      </div>
                      <div>
                        <h2 className="font-serif text-2xl text-foreground">{source.title}</h2>
                        {source.description ? (
                          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            {source.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {source.academicYear ? (
                        <span className="rounded-full bg-secondary/70 px-2.5 py-1">
                          {source.academicYear}
                        </span>
                      ) : null}
                      {source.subjects.map((subject) => (
                        <span key={subject} className="rounded-full bg-secondary/70 px-2.5 py-1 capitalize">
                          {subject}
                        </span>
                      ))}
                      {source.gradeLevels.map((gradeLevel) => (
                        <span key={gradeLevel} className="rounded-full bg-secondary/70 px-2.5 py-1">
                          Grade {gradeLevel}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Updated {formatUpdatedDate(source.updatedAt)}</span>
                      <Link
                        href={`/curriculum/${encodeURIComponent(source.id)}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Open in curriculum view
                      </Link>
                    </div>
                  </div>

                  <div className="flex min-w-[180px] flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Trash2 className="size-4 text-destructive" />
                        Delete source
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Use this when a draft or import is no longer needed.
                      </p>
                    </div>
                    <CurriculumDeleteForm
                      action={deleteAction}
                      sourceId={source.id}
                      sourceTitle={source.title}
                    />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <div className="space-y-4 p-5">
            <div>
              <p className="text-sm font-medium text-foreground">Management notes</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Deleting a source removes its imported curriculum structure for this household.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{sources.length} source{sources.length === 1 ? "" : "s"}</p>
              <p className="mt-1">
                Keep the main curriculum page focused on browsing, and use this view to clean up
                older imports.
              </p>
            </div>
            <Link
              href="/curriculum"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-center")}
            >
              Return to curriculum
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
