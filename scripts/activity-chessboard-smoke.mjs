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
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const feedbackRequests = [];

  page.on("request", async (request) => {
    if (!request.url().includes("/api/activities/attempts/") || !request.url().includes("/feedback")) {
      return;
    }

    const body = request.postDataJSON();
    feedbackRequests.push(body);
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
  await expectPiece(page, "e4", "wq");
  await page.waitForResponse((request) => request.url().includes("/feedback") && request.request().method() === "POST");
  await page.locator("text=does not match the expected move").first().waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Reset" }).click();
  await expectPiece(page, "e2", "wq");

  await clickMove(page, "e2", "b5");
  await expectPiece(page, "b5", "wq");
  await page.waitForResponse((request) => request.url().includes("/feedback") && request.request().method() === "POST");
  await page.locator("text=matches the expected move").first().waitFor({ state: "visible" });

  if (feedbackRequests.length < 2) {
    throw new Error(`Expected at least 2 feedback requests, saw ${feedbackRequests.length}`);
  }

  for (const body of feedbackRequests) {
    if (body.componentId !== "mate-in-one" || body.componentType !== "interactive_widget") {
      throw new Error(`Unexpected feedback payload: ${JSON.stringify(body)}`);
    }
  }

  await browser.close();
  console.log(`Interactive widget smoke test passed against ${targetUrl}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
