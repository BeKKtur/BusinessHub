import { expect, test } from "@playwright/test";
import { authenticateE2E, expectNoAppErrors } from "./helpers/businesshub-fixtures";

test.describe("auth, onboarding and demo mode", () => {
  for (const route of ["/clients", "/services", "/appointments"]) {
    test(`unauthorized user cannot access ${route}`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
    });
  }

  test("landing auth links go to login/register and demo does not open app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/");
    await page.getByRole("link", { name: "Создать аккаунт" }).first().click();
    await expect(page).toHaveURL(/\/register/);

    await page.goto("/");
    await page.getByRole("link", { name: "Открыть demo" }).click();
    await expect(page).toHaveURL(/\/demo/);
    await expect(page.getByRole("heading", { name: "Demo mode" })).toBeVisible();
  });

  test("login with unknown account shows registration error", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: "Аккаунт не найден. Сначала зарегистрируйтесь." }
      });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("missing@example.com");
    await page.getByLabel("Пароль").fill("password123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Аккаунт не найден. Сначала зарегистрируйтесь.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Создать аккаунт" })).toBeVisible();
  });

  test("register creates user and business, then onboarding completes", async ({ page }) => {
    let registerPayload: Record<string, unknown> | undefined;
    let onboardingPayload: Record<string, unknown> | undefined;
    await authenticateE2E(page);

    await page.route("**/api/auth/register", async (route) => {
      registerPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        json: { data: { userId: "user-1", nextPath: "/onboarding" } }
      });
    });
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { data: { nextPath: "/dashboard" } } });
    });

    await page.goto("/register");
    await page.getByLabel("Имя").fill("QA Owner");
    await page.getByLabel("Название бизнеса").fill("QA Studio");
    await page.getByLabel("Тип бизнеса").selectOption("Барбершоп");
    await page.getByLabel("Email").fill("qa@example.com");
    await page.getByLabel("Пароль").fill("password123");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    expect(registerPayload).toMatchObject({
      name: "QA Owner",
      businessName: "QA Studio",
      businessType: "Барбершоп",
      email: "qa@example.com"
    });

    await page.getByRole("button", { name: "Фитнес" }).click();
    await page.getByRole("button", { name: "Открыть BusinessHub" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(onboardingPayload).toMatchObject({ businessType: "Фитнес" });
  });

  test("logout clears session and sends user to landing page", async ({ page }) => {
    await authenticateE2E(page);
    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({
        json: { ok: true }
      });
    });

    await page.goto("/dashboard");
    const menuButton = page.getByRole("button", { name: "Открыть меню" });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    await expect(page.getByRole("heading", { name: "BusinessHub" })).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("demo mode is read-only and invites registration", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("link", { name: "Создать аккаунт" })).toBeVisible();
    await page.getByRole("button", { name: "Создать клиента" }).click();
    await expect(page.getByText("Это демо-режим. Зарегистрируйтесь, чтобы сохранять данные.")).toBeVisible();
    await expectNoAppErrors(page);
  });
});
