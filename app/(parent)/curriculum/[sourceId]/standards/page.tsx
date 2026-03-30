"use client";

/**
 * Standards browsing & mapping page for a curriculum source.
 *
 * Lets the parent explore the standards hierarchy and see which standards
 * are already mapped to objectives in this curriculum.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandardsBrowser } from "@/components/curriculum/StandardsBrowser";
import type { Standard } from "@/lib/standards/types";

interface Props {
  params: Promise<{ sourceId: string }>;
}

export default function StandardsMappingPage({ params }: Props) {
  const [sourceId, setSourceId] = React.useState<string>("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Resolve params (client component workaround)
  React.useEffect(() => {
    params.then((p) => setSourceId(p.sourceId));
  }, [params]);

  function handleToggle(standard: Standard) {
    setSelectedIds((prev) =>
      prev.includes(standard.id)
        ? prev.filter((id) => id !== standard.id)
        : [...prev, standard.id]
    );
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/curriculum/${sourceId}`}>
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Standards Browser
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Browse Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <StandardsBrowser
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Selected Standards</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Select standards from the browser to map them to objectives.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {selectedIds.map((id) => (
                    <li key={id} className="text-xs font-mono text-foreground/80">
                      {id}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {selectedIds.length > 0 && (
            <Button className="w-full" disabled>
              Map to objective
              <span className="ml-2 text-xs opacity-70">(select an objective first)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
