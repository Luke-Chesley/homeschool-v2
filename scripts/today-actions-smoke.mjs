import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const organizationId = process.env.APP_ORG_ID;
const learnerId = process.env.APP_LEARNER_ID;
const todayDate = process.env.TODAY_DATE ?? new Date().toISOString().slice(0, 10);

if (!organizationId || !learnerId) {
  console.error("APP_ORG_ID and APP_LEARNER_ID are required.");
  process.exit(1);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1440, height: 1000 },
  });

  await context.addCookies([
    {
      name: "hsv2_org_id",
      value: organizationId,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "hsv2_learner_id",
      value: learnerId,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  try {
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error);
    });

    await page.goto(`/today?date=${encodeURIComponent(todayDate)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByText("Daily workspace", { exact: false }).first().waitFor({
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);

    const doneButton = page.getByRole("button", { name: "Mark done" }).first();
    const doneSavedButton = page.getByRole("button", { name: "Done saved" }).first();
    const undoButton = page.getByRole("button", { name: "Undo" }).first();

    const initialDoneCount = await doneButton.count();
    const initialSavedCount = await doneSavedButton.count();

    if (initialDoneCount === 0 && initialSavedCount === 0) {
      throw new Error("No actionable today item was visible.");
    }

    if (initialSavedCount > 0) {
      await undoButton.waitFor({ state: "visible", timeout: 10000 });
      await undoButton.click();
      await doneButton.waitFor({ state: "visible", timeout: 30000 });
    } else {
      await doneButton.waitFor({ state: "visible", timeout: 10000 });
    }

    await doneButton.click();

    await page.getByRole("button", { name: "Done saved" }).first().waitFor({
      state: "visible",
      timeout: 30000,
    });

    await undoButton.waitFor({ state: "visible", timeout: 10000 });
    await undoButton.click();

    await page.getByRole("button", { name: "Mark done" }).first().waitFor({
      state: "visible",
      timeout: 30000,
    });

    if (errors.length > 0) {
      throw new Error(errors[0]?.message ?? "Page emitted an error");
    }

    console.log("Today actions smoke passed");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
