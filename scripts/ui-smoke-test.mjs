import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const routes = [
  "/planning",
  "/planning/month",
  "/today",
  "/curriculum",
  "/tracking",
  "/assistant",
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
];

function joinUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => {
    const element = document.documentElement;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      `${label} overflowed horizontally: scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}`,
    );
  }
}

async function assertPrimaryHeading(page, label) {
  const heading = page.locator("h1").first();
  if (!(await heading.isVisible())) {
    throw new Error(`${label} did not render a visible h1`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: viewports[0] });
  const failures = [];

  for (const route of routes) {
    for (const viewport of viewports) {
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      const label = `${route} @ ${viewport.width}x${viewport.height}`;

      try {
        const errors = [];
        page.on("pageerror", (error) => {
          errors.push(error);
        });

        const response = await page.goto(joinUrl(route), { waitUntil: "domcontentloaded" });
        if (!response || !response.ok()) {
          throw new Error(`${label} returned ${response?.status() ?? "no response"}`);
        }

        await page.waitForLoadState("networkidle").catch(() => undefined);
        await assertPrimaryHeading(page, label);
        await assertNoHorizontalOverflow(page, label);

        if (errors.length > 0) {
          throw new Error(`${label} emitted a page error: ${errors[0]?.message ?? "unknown error"}`);
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      } finally {
        await page.close();
      }
    }
  }

  await context.close();
  await browser.close();

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  console.log(`Smoke test passed against ${baseUrl}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
