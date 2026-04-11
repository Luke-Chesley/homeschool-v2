import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Auth error",
};

export default function AuthErrorPage() {
  return (
    <Card className="border-border/70 bg-card/85 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>Authentication error</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>The authentication flow could not be completed.</p>
        <p>
          Return to{" "}
          <Link href="/auth/login" className="text-foreground underline underline-offset-4">
            sign in
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
