import "@/lib/server-only";

export function shouldShowTranscriptTools(gradeLevel: string | null | undefined) {
  if (!gradeLevel) {
    return false;
  }

  return /(^[7-9]$)|(^1[0-2]$)|middle|high/i.test(gradeLevel);
}
