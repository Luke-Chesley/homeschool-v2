export type HomeschoolTranscriptCourse = {
  subject: string;
  title: string;
  term: string;
  status: "planned" | "in_progress" | "completed";
  notes?: string;
};
