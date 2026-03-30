import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParentNav } from "@/components/navigation/parent-nav";

export function ParentSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/88">
      <CardHeader className="border-b border-border/70 bg-gradient-to-br from-card via-card to-primary/8">
        <Badge className="w-fit">Parent workspace</Badge>
        <CardTitle className="max-w-xs text-3xl">
          Calm operations for the school day and the work around it.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4">
        <ParentNav onNavigate={onNavigate} />

        <div className="rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            This week
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-primary/9 p-3">
              <div className="text-2xl font-serif">18</div>
              <p className="text-xs text-muted-foreground">Planned lessons</p>
            </div>
            <div className="rounded-2xl bg-secondary/18 p-3">
              <div className="text-2xl font-serif">4</div>
              <p className="text-xs text-muted-foreground">Carryover items</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
