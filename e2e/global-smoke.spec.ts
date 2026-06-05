import { expect, test } from "@playwright/test";
import { expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("global pages and layout smoke", () => {
  test.beforeEach(async ({ page }) => {
    await mockCrudApi(page);
  });

  for (const route of ["/dashboard", "/finance", "/analytics", "/telegram", "/billing", "/admin"]) {
    test(`${route} loads without runtime errors`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expectNoAppErrors(page);
    });
  }

  test("sidebar navigation, theme toggle and notification button work", async ({ page }) => {
    await page.goto("/dashboard");
    const menuButton = page.getByRole("button", { name: "Открыть меню" });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    await page.getByRole("link", { name: "Клиенты" }).click();
    await expect(page).toHaveURL(/clients/);
    await page.getByRole("button", { name: "Переключить тему" }).click();
    await page.getByRole("button", { name: "Уведомления" }).click();
    await expectNoAppErrors(page);
  });

  test("appointments layout remains bounded with many records", async ({ page }) => {
    await page.goto("/appointments");
    const calendarBox = await page.getByRole("heading", { name: "Календарь" }).locator("..").locator("..").boundingBox();
    const scheduleBox = await page.getByRole("heading", { name: "Расписание" }).locator("..").locator("..").boundingBox();
    expect(calendarBox?.height ?? 0).toBeLessThan(520);
    expect(scheduleBox?.height ?? 0).toBeLessThan(700);
  });
});
