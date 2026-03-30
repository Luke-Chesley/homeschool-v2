const config = {
  appId: "homeschool-v2",
  baseUrl: process.env.INNGEST_BASE_URL ?? "http://127.0.0.1:8288",
  eventKeyEnv: "INNGEST_EVENT_KEY",
  signingKeyEnv: "INNGEST_SIGNING_KEY",
  servePath: "/api/inngest",
};

export default config;
