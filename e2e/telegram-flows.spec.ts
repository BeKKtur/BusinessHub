import { expect, test } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("telegram settings", () => {
  test("validates required fields before connecting Telegram", async ({ page }) => {
    await authenticateE2E(page);
    await mockCrudApi(page, createTestBackend());
    await page.goto("/telegram");

    await page.getByRole("button", { name: "Подключить Telegram" }).click();
    await expect(page.getByText("Bot Token is required")).toBeVisible();
    await expect(page.getByText("Chat ID is required")).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("checks token, saves settings, sends test message and persists after refresh", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page);
    await mockCrudApi(page, state);
    await page.goto("/telegram");

    await page.getByLabel("Bot Token").fill("123:test-token");
    await page.getByLabel("Chat ID").fill("777000");
    await page.getByRole("button", { name: "Проверить токен" }).click();
    await expect(page.getByText("Bot Token проверен успешно")).toBeVisible();

    await page.getByRole("button", { name: "Подключить Telegram" }).click();
    await expect(page.getByText("Telegram подключен и настройки сохранены")).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
    expect(state.telegramSettings.connected).toBe(true);

    await page.getByRole("button", { name: "Отправить тест" }).click();
    await expect(page.getByText("Тестовое сообщение отправлено")).toBeVisible();
    expect(state.telegramSettings.last_test_sent_at).not.toBeNull();

    await page.reload();
    await expect(page.getByLabel("Bot Token")).toHaveValue("123:test-token");
    await expect(page.getByLabel("Chat ID")).toHaveValue("777000");
    await expect(page.getByText("Connected")).toBeVisible();
    await expect(page.getByText("Тестовое сообщение еще не отправлялось")).toHaveCount(0);
    await expectNoAppErrors(page);
  });

  test("shows Telegram API errors clearly", async ({ page }) => {
    await authenticateE2E(page);
    await mockCrudApi(page, createTestBackend());
    await page.goto("/telegram");

    await page.getByLabel("Bot Token").fill("bad");
    await page.getByRole("button", { name: "Проверить токен" }).click();
    await expect(page.getByText("Telegram API: Unauthorized")).toBeVisible();
    await expectNoAppErrors(page);
  });
});
