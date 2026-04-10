import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const targetUrl = new URL("/activity/session-chess-001", baseUrl).toString();

async function expectPiece(page, square, piece) {
  const locator = page.locator(`[data-square="${square}"]`);
  await locator.waitFor({ state: "visible" });
  const value = await locator.getAttribute("data-piece");
  if (value !== piece) {
    throw new Error(`Expected ${square} to contain ${piece}, found ${value ?? "empty"}`);
  }
}

async function clickMove(page, from, to) {
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/transition") && response.request().method() === "POST"
    ),
    page.locator(`[data-square="${from}"]`).click(),
  ]);
  await page.waitForTimeout(150);

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/transition") && response.request().method() === "POST"
    ),
    page.locator(`[data-square="${to}"]`).click(),
  ]);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const transitionRequests = [];
  const feedbackRequests = [];

  page.on("request", async (request) => {
    if (!request.url().includes("/api/activities/attempts/")) {
      return;
    }

    const body = request.postDataJSON();
    if (request.url().includes("/transition")) {
      transitionRequests.push(body);
      return;
    }

    if (request.url().includes("/feedback")) {
      feedbackRequests.push(body);
    }
  });

  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  if (!response || !response.ok()) {
    throw new Error(`Could not load learner activity route: ${response?.status() ?? "no response"}`);
  }

  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.locator("text=Find the checking move").first().waitFor({ state: "visible" });

  await expectPiece(page, "e2", "wq");
  await expectPiece(page, "e8", "bk");

  await clickMove(page, "e2", "e4");
  await expectPiece(page, "e2", "wq");
  await page.locator("text=does not match the expected move").first().waitFor({ state: "visible" });

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/transition") && response.request().method() === "POST"
    ),
    page.getByRole("button", { name: "Reset" }).click(),
  ]);
  await expectPiece(page, "e2", "wq");

  await clickMove(page, "e2", "b5");
  await expectPiece(page, "b5", "wq");
  await page.locator("text=matches the expected move").first().waitFor({ state: "visible" });

  if (transitionRequests.length < 5) {
    throw new Error(`Expected at least 5 transition requests, saw ${transitionRequests.length}`);
  }

  for (const body of transitionRequests) {
    if (body.componentId !== "mate-in-one" || body.componentType !== "interactive_widget") {
      throw new Error(`Unexpected transition payload: ${JSON.stringify(body)}`);
    }
  }

  if (feedbackRequests.length !== 0) {
    throw new Error(`Expected immediate feedback to come from transitions, saw feedback requests: ${feedbackRequests.length}`);
  }

  await browser.close();
  console.log(`Interactive widget smoke test passed against ${targetUrl}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
