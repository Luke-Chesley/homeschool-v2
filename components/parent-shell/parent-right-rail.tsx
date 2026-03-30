import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const highlights = [
  "Future copilot rail",
  "Daily blockers and recovery suggestions",
  "Pinned standards and lesson evidence",
];

export function ParentRightRail() {
  return (
    <Card className="sticky top-4 border-border/70 bg-card/86">
      <CardHeader>
        <Badge variant="outline" className="w-fit rounded-full">
          Reserved space
        </Badge>
        <CardTitle className="text-2xl">Right rail for context, not clutter.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {highlights.map((item) => (
          <div key={item} className="rounded-2xl border border-border/70 bg-background/75 p-4">
            <p className="text-sm leading-6 text-muted-foreground">{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
