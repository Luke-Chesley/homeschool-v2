import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Auth error",
};

export default function AuthErrorPage() {
  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/76 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <AlertTriangle className="size-3.5" />
          Authentication issue
        </div>
        <CardTitle className="mt-3">Authentication error</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>The authentication flow could not be completed.</p>
        <Link href="/auth/login" className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl")}>
          Return to sign in
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
