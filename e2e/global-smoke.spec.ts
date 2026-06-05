import { expect, test } from "@playwright/test";
import { authenticateE2E, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("global pages and layout smoke", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateE2E(page);
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

  test("topbar new appointment opens appointment modal from any page", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Новая запись" }).click();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.getByRole("heading", { name: "Создание записи" })).toBeVisible();
  });

  test("dashboard quick action opens menu", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Быстрое действие" }).click();
    await expect(page.getByRole("menuitem", { name: "Создать клиента" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Создать запись" })).toBeVisible();
  });

  test("appointments layout remains bounded with many records", async ({ page }) => {
    await page.goto("/appointments");
    const calendarBox = await page.getByRole("heading", { name: "Календарь" }).locator("..").locator("..").boundingBox();
    const scheduleBox = await page.getByRole("heading", { name: "Расписание" }).locator("..").locator("..").boundingBox();
    expect(calendarBox?.height ?? 0).toBeLessThan(520);
    expect(scheduleBox?.height ?? 0).toBeLessThan(700);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("dashboard handles duplicate activity labels without key warnings", async ({ page }) => {
    const duplicateKeyWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Encountered two children with the same key")) {
        duplicateKeyWarnings.push(message.text());
      }
    });

    await page.goto("/dashboard");
    await expect(page.getByText("Запись на 09:00")).toHaveCount(2);
    expect(duplicateKeyWarnings).toHaveLength(0);
  });

  test("contact page opens with owner contact details", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Связаться с поддержкой" })).toBeVisible();
    await expect(page.getByText("batyrbekovbektur0@gmail.com")).toBeVisible();
    await expect(page.getByText("@batyrbekovbektur0")).toBeVisible();
  });
});
