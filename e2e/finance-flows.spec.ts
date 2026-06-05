import { expect, test } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("finance operations", () => {
  test("add income, add expense and export CSV", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page);
    await mockCrudApi(page, state);
    await page.goto("/finance");

    await page.getByRole("button", { name: "Добавить операцию" }).click();
    await page.getByLabel("Сумма").fill("120");
    await page.getByLabel("Категория").fill("Ручной доход");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Описание").fill("E2E income");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Операция сохранена")).toBeVisible();
    await expect(page.getByText("Ручной доход")).toBeVisible();
    await expect(page.locator("main")).toContainText(/120\s*\$/);

    await page.getByRole("button", { name: "Добавить операцию" }).click();
    await page.getByLabel("Тип").selectOption("expense");
    await page.getByLabel("Сумма").fill("40");
    await page.getByLabel("Категория").fill("Расход");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Операция сохранена")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Расход" }).first()).toBeVisible();
    expect(state.revenues).toHaveLength(1);
    expect(state.expenses).toHaveLength(1);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспорт" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("businesshub-finance");
    await expectNoAppErrors(page);
  });

  test("export empty finance shows toast", async ({ page }) => {
    await authenticateE2E(page);
    await mockCrudApi(page, createTestBackend());
    await page.goto("/finance");
    await page.getByRole("button", { name: "Экспорт" }).click();
    await expect(page.getByText("Нет данных для экспорта.")).toBeVisible();
  });
});
