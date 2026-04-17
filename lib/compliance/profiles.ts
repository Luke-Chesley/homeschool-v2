import type { RequirementProfile } from "@/lib/compliance/types";

const coreSubjectGroups = [
  { key: "language_arts", label: "Language arts", aliases: ["writing", "reading", "ela"] },
  { key: "mathematics", label: "Mathematics", aliases: ["math"] },
  { key: "science", label: "Science" },
  { key: "social_studies", label: "Social studies", aliases: ["history", "geography", "civics"] },
];

const enrichmentGroups = [
  { key: "arts", label: "Arts", aliases: ["music", "visual arts"] },
  { key: "health", label: "Health and PE", aliases: ["physical education", "wellness"] },
];

export const requirementProfiles: RequirementProfile[] = [
  {
    jurisdictionCode: "US-GENERIC",
    jurisdictionLabel: "Generic US record pack",
    pathwayCode: "independent_recordkeeping",
    pathwayLabel: "Independent recordkeeping",
    version: "2026.04",
    attendanceMode: "days_or_hours",
    attendanceTargetDays: 180,
    attendanceTargetHoursElementary: 900,
    attendanceTargetHoursSecondary: 990,
    requiresPeriodicReports: false,
    periodicReportCadence: "annual",
    requiresAnnualEvaluation: false,
    requiresPortfolio: true,
    requiresTestEvidence: false,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "annual_summary",
        label: "Annual summary",
        description: "One year-end narrative summary that gathers attendance, progress, and evidence.",
      },
      {
        key: "portfolio_samples",
        label: "Portfolio samples",
        description: "A small set of saved work samples across the year.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_end",
        taskType: "attendance_summary",
        title: "Year-end attendance summary",
        offsetDays: 0,
        notes: "Export a clean attendance summary at year end.",
      },
      {
        kind: "offset_from_end",
        taskType: "portfolio_ready",
        title: "Portfolio ready for year-end review",
        offsetDays: -14,
        notes: "Confirm that saved evidence covers the major subjects.",
      },
    ],
    retentionHints: [
      "Keep attendance, saved work samples, and narrative summaries together.",
      "Use the generic pack until you confirm a state-specific profile.",
    ],
    suggestedExports: ["attendance_summary", "annual_summary", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: [
        "Summarize what was covered this period.",
        "Note where the learner showed stronger independence or understanding.",
        "List one or two adjustments for the next period.",
      ],
      annual: [
        "Summarize attendance and instructional time for the year.",
        "Describe growth across the core subjects.",
        "Reference saved work samples that illustrate progress.",
      ],
      evaluation: [
        "Summarize year-end readiness in plain language.",
        "Attach external evaluator or parent summary notes when available.",
      ],
    },
    framingNote:
      "Use this profile as a neutral recordkeeping baseline until a jurisdiction-specific pathway is selected.",
  },
  {
    jurisdictionCode: "US-TX",
    jurisdictionLabel: "Texas",
    pathwayCode: "homeschool_record_pack",
    pathwayLabel: "Minimal homeschool record pack",
    version: "2026.04",
    attendanceMode: "minimal",
    requiresPeriodicReports: false,
    periodicReportCadence: "none",
    requiresAnnualEvaluation: false,
    requiresPortfolio: true,
    requiresTestEvidence: false,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [
      ...coreSubjectGroups,
      { key: "citizenship", label: "Citizenship", aliases: ["civics"] },
    ],
    requiredDocuments: [
      {
        key: "subject_log",
        label: "Subject coverage log",
        description: "Keep a readable record that the required subjects were taught.",
      },
      {
        key: "portfolio_samples",
        label: "Optional portfolio samples",
        description: "Keep a small set of evidence in case it becomes useful later.",
        optional: true,
      },
    ],
    deadlineRules: [],
    retentionHints: [
      "The Texas pack is intentionally light: focus on subject coverage and a durable year record.",
    ],
    suggestedExports: ["annual_summary", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: ["Summarize what was taught and what moved forward."],
      annual: [
        "Summarize the year in plain language.",
        "Show the subject areas covered and representative work.",
      ],
      evaluation: ["Optional parent summary only."],
    },
    framingNote:
      "This pack keeps a simple operational record without adding deadline-heavy workflow.",
  },
  {
    jurisdictionCode: "US-FL",
    jurisdictionLabel: "Florida",
    pathwayCode: "home_education",
    pathwayLabel: "Home education program",
    version: "2026.04",
    attendanceMode: "days",
    attendanceTargetDays: 180,
    requiresPeriodicReports: false,
    periodicReportCadence: "annual",
    requiresAnnualEvaluation: true,
    requiresPortfolio: true,
    requiresTestEvidence: false,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "portfolio",
        label: "Portfolio",
        description: "Keep reading/material logs and representative work samples.",
      },
      {
        key: "annual_evaluation",
        label: "Annual evaluation",
        description: "Store the evaluator letter, portfolio review, or comparable annual proof.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_end",
        taskType: "annual_evaluation",
        title: "Annual evaluation due",
        offsetDays: 0,
        notes: "Prepare evaluator proof or equivalent annual evidence.",
      },
      {
        kind: "offset_from_end",
        taskType: "portfolio_ready",
        title: "Portfolio assembled for annual review",
        offsetDays: -21,
        notes: "Review reading/material logs and save work samples before the year closes.",
      },
    ],
    retentionHints: [
      "Keep a running portfolio; do not wait until year end to assemble evidence.",
    ],
    suggestedExports: ["attendance_summary", "annual_summary", "evaluation_packet", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: [
        "Capture strengths, needs more practice, and representative work since the last checkpoint.",
      ],
      annual: [
        "Summarize the year's attendance, progress, and representative portfolio pieces.",
      ],
      evaluation: [
        "Summarize the evidence packet for an annual evaluator review.",
      ],
    },
    framingNote:
      "The Florida pack emphasizes portfolio readiness and annual evaluation evidence rather than frequent state-facing reports.",
  },
  {
    jurisdictionCode: "US-NY",
    jurisdictionLabel: "New York",
    pathwayCode: "home_instruction",
    pathwayLabel: "Home instruction",
    version: "2026.04",
    attendanceMode: "hours",
    attendanceTargetHoursElementary: 900,
    attendanceTargetHoursSecondary: 990,
    requiresPeriodicReports: true,
    periodicReportCadence: "quarterly",
    requiresAnnualEvaluation: true,
    requiresPortfolio: true,
    requiresTestEvidence: true,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "notice",
        label: "Notice / intent record",
        description: "Keep the local notice and IHIP workflow together with deadlines.",
      },
      {
        key: "quarterly_reports",
        label: "Quarterly reports",
        description: "Keep one narrative snapshot per quarter with attendance and subject coverage.",
      },
      {
        key: "annual_evaluation",
        label: "Annual evaluation",
        description: "Store annual assessment or evaluator proof with year-end summary.",
      },
      {
        key: "test_evidence",
        label: "Assessment evidence",
        description: "Keep standardized testing or annual assessment support where needed.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_start",
        taskType: "notice",
        title: "Notice of intent recorded",
        offsetDays: 0,
        notes: "Capture the start-of-year notice timeline for this learner-year profile.",
      },
      {
        kind: "offset_from_start",
        taskType: "ihip",
        title: "IHIP due",
        offsetDays: 28,
        notes: "Prepare the instructional plan and required subjects list.",
      },
      {
        kind: "quarterly",
        taskType: "quarterly_report",
        title: "Quarterly report due",
        notes: "Use saved snapshots, attendance, and portfolio evidence to assemble each quarter.",
      },
      {
        kind: "offset_from_end",
        taskType: "annual_evaluation",
        title: "Annual evaluation ready",
        offsetDays: 0,
      },
    ],
    retentionHints: [
      "Keep hours, quarterly snapshots, and annual evaluation records together.",
    ],
    suggestedExports: [
      "attendance_summary",
      "quarterly_report",
      "annual_summary",
      "evaluation_packet",
      "portfolio_checklist",
    ],
    reportSectionPrompts: {
      quarterly: [
        "Summarize instructional hours and major work completed this quarter.",
        "Call out coverage across the required subjects.",
        "Note adjustments for the next quarter.",
      ],
      annual: [
        "Summarize yearly instructional hours, subject coverage, and the overall trajectory.",
      ],
      evaluation: [
        "Summarize the annual assessment or evaluator packet in a neutral, evidence-based way.",
      ],
    },
    framingNote:
      "The New York pack keeps quarterly and annual records structured without claiming legal completeness.",
  },
  {
    jurisdictionCode: "US-PA",
    jurisdictionLabel: "Pennsylvania",
    pathwayCode: "home_education",
    pathwayLabel: "Home education program",
    version: "2026.04",
    attendanceMode: "days_or_hours",
    attendanceTargetDays: 180,
    attendanceTargetHoursElementary: 900,
    attendanceTargetHoursSecondary: 990,
    requiresPeriodicReports: false,
    periodicReportCadence: "annual",
    requiresAnnualEvaluation: true,
    requiresPortfolio: true,
    requiresTestEvidence: false,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "affidavit",
        label: "Affidavit / filing record",
        description: "Keep the affidavit or equivalent start-of-year filing note.",
      },
      {
        key: "portfolio",
        label: "Portfolio",
        description: "Maintain work samples, reading/material records, and attendance support.",
      },
      {
        key: "annual_evaluation",
        label: "Annual evaluation",
        description: "Store the evaluator letter and year-end summary together.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_start",
        taskType: "affidavit",
        title: "Affidavit / filing recorded",
        offsetDays: 0,
      },
      {
        kind: "offset_from_end",
        taskType: "portfolio_ready",
        title: "Portfolio ready for annual review",
        offsetDays: -21,
      },
      {
        kind: "offset_from_end",
        taskType: "annual_evaluation",
        title: "Annual evaluation ready",
        offsetDays: 0,
      },
    ],
    retentionHints: [
      "Save enough work samples across the year so the portfolio is never a last-minute scramble.",
    ],
    suggestedExports: ["attendance_summary", "annual_summary", "evaluation_packet", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: ["Optional internal checkpoint only."],
      annual: [
        "Summarize attendance, subject coverage, and the representative work included in the portfolio.",
      ],
      evaluation: [
        "Summarize the annual portfolio review packet and evaluator note.",
      ],
    },
    framingNote:
      "The Pennsylvania pack centers on portfolio organization and annual evaluation readiness.",
  },
  {
    jurisdictionCode: "US-VA",
    jurisdictionLabel: "Virginia",
    pathwayCode: "home_instruction",
    pathwayLabel: "Home instruction",
    version: "2026.04",
    attendanceMode: "days",
    attendanceTargetDays: 180,
    requiresPeriodicReports: false,
    periodicReportCadence: "annual",
    requiresAnnualEvaluation: true,
    requiresPortfolio: true,
    requiresTestEvidence: true,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "notice",
        label: "Notice of intent",
        description: "Keep the annual notice record and supporting qualifier notes.",
      },
      {
        key: "annual_evidence",
        label: "Annual progress proof",
        description: "Store test results, evaluator letter, or other accepted annual evidence.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_start",
        taskType: "notice",
        title: "Notice / qualifier record prepared",
        offsetDays: 0,
      },
      {
        kind: "offset_from_end",
        taskType: "annual_evaluation",
        title: "Annual progress proof ready",
        offsetDays: 0,
      },
      {
        kind: "offset_from_end",
        taskType: "test_evidence",
        title: "Test or evaluator evidence attached",
        offsetDays: -14,
      },
    ],
    retentionHints: [
      "Track the annual proof method early so you know whether to keep portfolio or test evidence front and center.",
    ],
    suggestedExports: ["attendance_summary", "annual_summary", "evaluation_packet", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: ["Optional internal progress checkpoint only."],
      annual: [
        "Summarize the year, then point directly to the attached annual evidence.",
      ],
      evaluation: [
        "Summarize the chosen annual proof method and include the supporting document references.",
      ],
    },
    framingNote:
      "The Virginia pack keeps annual proof front and center without assuming one specific proof path.",
  },
  {
    jurisdictionCode: "US-CA",
    jurisdictionLabel: "California",
    pathwayCode: "private_school_affidavit",
    pathwayLabel: "Private school affidavit / home-based private school",
    version: "2026.04",
    attendanceMode: "days",
    attendanceTargetDays: 175,
    requiresPeriodicReports: false,
    periodicReportCadence: "annual",
    requiresAnnualEvaluation: false,
    requiresPortfolio: true,
    requiresTestEvidence: false,
    subjectCoverageMode: "required_subjects",
    requiredSubjectGroups: [...coreSubjectGroups, ...enrichmentGroups],
    requiredDocuments: [
      {
        key: "affidavit",
        label: "Private school affidavit record",
        description: "Keep the affidavit record and yearly recordkeeping packet together.",
      },
      {
        key: "attendance",
        label: "Attendance record",
        description: "Maintain a clean attendance ledger for the year.",
      },
      {
        key: "portfolio",
        label: "Representative work",
        description: "Keep samples that show the work actually taught and completed.",
      },
    ],
    deadlineRules: [
      {
        kind: "offset_from_start",
        taskType: "affidavit",
        title: "Affidavit filing window opened",
        offsetDays: 30,
        notes: "Capture the filing reminder and final confirmation in the same checklist.",
      },
      {
        kind: "offset_from_end",
        taskType: "attendance_summary",
        title: "Year-end attendance summary ready",
        offsetDays: 0,
      },
    ],
    retentionHints: [
      "This pack is recordkeeping-first: keep attendance, subject coverage, and representative work cleanly organized.",
    ],
    suggestedExports: ["attendance_summary", "annual_summary", "portfolio_checklist"],
    reportSectionPrompts: {
      quarterly: ["Optional internal checkpoint only."],
      annual: [
        "Summarize attendance, subject coverage, and representative work kept for the year.",
      ],
      evaluation: ["Optional parent summary only."],
    },
    framingNote:
      "The California pack focuses on filing reminders and a durable internal record pack.",
  },
];

export function getRequirementProfile(params: {
  jurisdictionCode: string;
  pathwayCode: string;
  version?: string | null;
}) {
  return (
    requirementProfiles.find(
      (profile) =>
        profile.jurisdictionCode === params.jurisdictionCode &&
        profile.pathwayCode === params.pathwayCode &&
        (params.version ? profile.version === params.version : true),
    ) ?? null
  );
}

export function getFallbackRequirementProfile() {
  return requirementProfiles[0] ?? null;
}

export function listRequirementProfiles() {
  return requirementProfiles;
}
