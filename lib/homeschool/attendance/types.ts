export type HomeschoolAttendanceStatus =
  | "present"
  | "partial"
  | "absent"
  | "excused"
  | "non_instructional"
  | "field_trip"
  | "holiday";

export type HomeschoolAttendanceSource = "manual" | "derived_from_sessions" | "imported";

export type HomeschoolAttendanceRecord = {
  id: string;
  date: string;
  status: HomeschoolAttendanceStatus;
  minutes: number | null;
  note: string | null;
  source: HomeschoolAttendanceSource;
  derivedSessionIds: string[];
};
