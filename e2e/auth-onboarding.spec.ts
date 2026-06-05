import { expect, test } from "@playwright/test";
import { expectNoAppErrors } from "./helpers/businesshub-fixtures";

test.describe("auth and onboarding", () => {
  test("registration, login and onboarding screens load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "BusinessHub" })).toBeVisible();

    await page.getByRole("link", { name: "Начать" }).click();
    await expect(page.getByRole("heading", { name: "Регистрация" })).toBeVisible();
    await page.getByLabel("Имя").fill("QA Owner");
    await page.getByLabel("Email").fill("qa@example.com");
    await page.getByLabel("Пароль").fill("password123");
    await page.getByRole("link", { name: "Продолжить" }).click();

    await expect(page.getByRole("heading", { name: "Выберите тип бизнеса" })).toBeVisible();
    await page.getByRole("button", { name: "Барбершоп" }).click();
    await page.getByRole("link", { name: "Открыть BusinessHub" }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
    await page.getByLabel("Email").fill("qa@example.com");
    await page.getByLabel("Пароль").fill("password123");
    await page.getByRole("link", { name: "Войти" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expectNoAppErrors(page);
  });

  test("protected route currently opens without Supabase env and is documented as a setup limitation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expectNoAppErrors(page);
  });
});
