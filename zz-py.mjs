import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } });
for (const path of process.argv.slice(2)) {
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto("http://localhost:3100" + path, { waitUntil: "networkidle" });
  const r = page.getByTestId("pyrunner").first();
  await r.getByRole("button", { name: "Run ▶" }).click();
  await page.waitForFunction(() => { const el = document.querySelector('[data-testid="pyrunner-output"]'); return el && (/Traceback|Error/.test(el.textContent) || el.textContent.trim().split("\n").length > 7); }, null, { timeout: 240000 });
  await page.waitForTimeout(5000);
  console.log("=== " + path + " pageerrors=" + JSON.stringify(errs) + "\n" + (await r.getByTestId("pyrunner-output").textContent()));
  await page.close();
}
await browser.close();
