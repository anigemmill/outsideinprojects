/*
  Browser check of the sign-in pages (npm run test:pages). Needs a running app at BASE_URL
  (default http://localhost:3100). Checks that need no Supabase Auth server:
  - every public page renders with no axe violations (WCAG 2.2 AA rules) in light and dark mode,
    and without horizontal scrolling at phone width;
  - signed-out visitors to /account are sent to sign-in, keeping where they were going;
  - a crafted ?next= pointing at another site is replaced by a same-site page;
  - invalid input shows an error linked to its field;
  - when Supabase Auth can't be reached, sign-in says so instead of blaming the password.
  Real sign-ins are checked separately against Supabase Auth (docs/development.md).
  Set SCREENSHOTS=dir to save screenshots of the sign-in page.
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";


const require = createRequire(import.meta.url);
// Playwright is pre-installed globally in this environment, so it is loaded with require (NODE_PATH).
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PAGES = ["/sign-in", "/sign-up", "/forgot-password", "/check-email"];
const failures = [];

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const path of PAGES) {
    const res = await page.goto(BASE + path);
    if (res?.status() !== 200) failures.push(`${scheme} ${path}: HTTP ${res?.status()}`);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
    for (const v of result.violations) failures.push(`${scheme} ${path}: ${v.id} (${v.nodes.length}) ${v.help}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) failures.push(`${scheme} ${path}: horizontal scroll at 390px`);
    console.log(`${failures.length ? "…" : "✓"} ${scheme} ${path}: ${result.violations.length} violation(s)`);
  }
  await context.close();
}
// Behaviour checks (light mode, phone width).
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const expect = (ok, what) => { if (!ok) failures.push(what); console.log(`${ok ? "✓" : "✗"} ${what}`); };

  await page.goto(BASE + "/account");
  expect(new URL(page.url()).pathname === "/sign-in" && new URL(page.url()).searchParams.get("next") === "/account", "signed-out /account redirects to /sign-in?next=/account");

  await page.goto(BASE + "/sign-in?next=" + encodeURIComponent("https://evil.example/steal"));
  const next = await page.locator('form input[name="next"]').first().inputValue();
  expect(next === "/account", `off-site next is replaced (got ${next})`);

  await page.getByLabel("Email").first().fill("not-an-email");
  await page.getByLabel("Password").fill("whatever");
  await page.getByRole("button", { name: "Sign in" }).click();
  const emailField = page.getByLabel("Email").first();
  await emailField.and(page.locator('[aria-invalid="true"]')).waitFor({ timeout: 5000 }).catch(() => {});
  const describedBy = (await emailField.getAttribute("aria-describedby")) ?? "";
  const linked = describedBy ? await page.locator(`[id="${describedBy.split(" ").pop()}"]`).innerText().catch(() => "") : "";
  expect(/valid email/.test(linked) && (await emailField.getAttribute("aria-invalid")) === "true", "invalid email shows a linked field error");

  await page.getByLabel("Email").first().fill("someone@example.com");
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Next.js adds its own empty role="alert" route announcer, so target the form message itself.
  const alert = await page.locator("main p[role=alert]").first().innerText({ timeout: 15000 }).catch(() => "");
  expect(/temporarily unavailable/.test(alert), `unreachable Auth gives an honest message (got "${alert}")`);

  if (process.env.SCREENSHOTS) {
    for (const scheme of ["light", "dark"]) {
      const shot = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
      const p = await shot.newPage();
      await p.goto(BASE + "/sign-in");
      await p.screenshot({ path: `${process.env.SCREENSHOTS}/sign-in-${scheme}.png` });
      await shot.close();
    }
  }
  await context.close();
}
await browser.close();
if (failures.length) {
  console.error(`✗ ${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ sign-in pages pass the accessibility and behaviour checks");
