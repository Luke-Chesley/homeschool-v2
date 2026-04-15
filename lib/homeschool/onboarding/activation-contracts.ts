export const ACTIVATION_PRODUCT_PROMISE =
  "Turn messy homeschool inputs into a clear teachable day, adapt when life happens, and keep records automatically.";

export const ACTIVATION_LAUNCH_WEDGE =
  "A homeschooling parent running day-to-day instruction for a mixed-curriculum household.";

export const ACTIVATION_EVENT_NAMES = {
  onboardingStarted: "onboarding_started",
  learnerNameSubmitted: "learner_name_submitted",
  intakeTypeSelected: "intake_type_selected",
  intakeSourceSubmitted: "intake_source_submitted",
  intakePackageCreated: "intake_package_created",
  intakeAssetUploaded: "intake_asset_uploaded",
  generationStarted: "generation_started",
  generationCompleted: "generation_completed",
  firstTodayOpened: "first_today_opened",
  todayOpened: "today_opened",
  firstPlanItemStatusChange: "first_plan_item_status_change",
  refinementPromptOpened: "refinement_prompt_opened",
  refinementCompleted: "refinement_completed",
  onboardingAbandonedBeforeToday: "onboarding_abandoned_before_today",
  activeLearnerSwitched: "active_learner_switched",
  activeLearnerSwitchFailed: "active_learner_switch_failed",
  secondLearnerCreated: "second_learner_created",
  curriculumSourceAdded: "curriculum_source_added",
  billingOfferViewed: "billing_offer_viewed",
  founderIntentCaptured: "founder_intent_captured",
  trialStarted: "trial_started",
  checkoutStarted: "checkout_started",
  checkoutCompleted: "checkout_completed",
  subscriptionActivated: "subscription_activated",
  subscriptionPaymentFailed: "subscription_payment_failed",
  billingPortalOpened: "billing_portal_opened",
  subscriptionCanceled: "subscription_canceled",
  subscriptionReactivated: "subscription_reactivated",
  returnedDay2: "returned_day_2",
  returnedDay7: "returned_day_7",
} as const;

export type ActivationEventName =
  (typeof ACTIVATION_EVENT_NAMES)[keyof typeof ACTIVATION_EVENT_NAMES];

export const ACTIVATION_EVENT_KEY: ActivationEventName =
  ACTIVATION_EVENT_NAMES.firstTodayOpened;

export const FIRST_WEEK_SUCCESS_METRIC_NAMES = {
  returnedDay2: "returned_day_2",
  returnedDay7: "returned_day_7",
  week1TodayOpens: "week_1_today_opens",
  week1StatusUpdates: "week_1_status_updates",
  week1LearnerAdditions: "week_1_learner_additions",
} as const;

export type FirstWeekSuccessMetricName =
  (typeof FIRST_WEEK_SUCCESS_METRIC_NAMES)[keyof typeof FIRST_WEEK_SUCCESS_METRIC_NAMES];

export const ONBOARDING_MILESTONES = [
  "fast_path_started",
  "first_day_ready",
  "household_defaults_completed",
  "week_ready",
] as const;

export type OnboardingMilestone = (typeof ONBOARDING_MILESTONES)[number];
