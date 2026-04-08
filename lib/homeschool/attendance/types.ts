export type HomeschoolAttendanceStatus =
  | "present"
  | "partial"
  | "absent"
  | "field_trip"
  | "holiday";

export type HomeschoolAttendanceRecord = {
  id: string;
  date: string;
  status: HomeschoolAttendanceStatus;
  minutes: number | null;
  note: string | null;
};
