export const storageBuckets = {
  curriculum: "curriculum-assets",
  artifacts: "generated-artifacts",
  learnerUploads: "learner-uploads",
} as const;

export type StorageBucketName = (typeof storageBuckets)[keyof typeof storageBuckets];
