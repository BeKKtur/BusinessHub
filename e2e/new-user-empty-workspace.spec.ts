import { expect, test, type Page } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

function createEmptyBackend() {
  const state = createTestBackend();
  state.clients = [];
  state.services = [];
  state.appointments = [];
  return state;
}

async function mockEmptyWorkspace(page: Page) {
  return mockCrudApi(page, createEmptyBackend());
}

test.describe("new user empty workspace and demo isolation", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateE2E(page);
    await mockEmptyWorkspace(page);
  });

  test("registration can complete into an empty dashboard", async ({ page }) => {
    let registerPayload: Record<string, unknown> | undefined;
    let onboardingPayload: Record<string, unknown> | undefined;

    await page.route("**/api/auth/register", async (route) => {
      registerPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, json: { data: { userId: "new-user", nextPath: "/onboarding" } } });
    });
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { data: { nextPath: "/dashboard" } } });
    });

    await page.goto("/register");
    await page.getByLabel("Имя").fill("New Owner");
    await page.getByLabel("Название бизнеса").fill("Empty Studio");
    await page.getByLabel("Тип бизнеса").selectOption("Другое");
    await page.getByLabel("Email").fill("new-owner@example.com");
    await page.getByLabel("Пароль").fill("password123");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole("button", { name: "Другое" }).click();
    await page.getByRole("button", { name: "Открыть BusinessHub" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Доходов пока нет")).toBeVisible();
    await expect(page.getByText("Записей пока нет")).toBeVisible();
    await expect(page.getByText("Алина Морозова")).not.toBeVisible();
    expect(registerPayload).toMatchObject({ email: "new-owner@example.com", businessName: "Empty Studio" });
    expect(onboardingPayload).toMatchObject({ businessType: "Другое" });
    await expectNoAppErrors(page);
  });

  test("empty clients, services, appointments, finance and analytics stay empty", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Доходов пока нет")).toBeVisible();
    await expect(page.getByText("Записей пока нет")).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByText("Клиентов пока нет")).toBeVisible();
    await expect(page.getByText("Алина Морозова")).not.toBeVisible();

    await page.goto("/services");
    await expect(page.getByText("Услуг пока нет")).toBeVisible();
    await expect(page.getByText("Стрижка")).not.toBeVisible();

    await page.goto("/appointments");
    await expect(page.getByText("На выбранный день записей нет")).toBeVisible();

    await page.goto("/finance");
    await expect(page.getByRole("heading", { name: "Доходов пока нет" }).first()).toBeVisible();
    await expect(page.locator("main")).toContainText(/0\s*\$/);

    await page.goto("/analytics");
    await expect(page.getByText("Аналитики пока нет")).toBeVisible();
    await expect(page.getByText("Окрашивание")).not.toBeVisible();
    await expectNoAppErrors(page);
  });

  test("demo data is available only in demo mode", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText("Алина Морозова")).toBeVisible();
    await expect(page.getByText("Стрижка и укладка")).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByText("Клиентов пока нет")).toBeVisible();
    await expect(page.getByText("Алина Морозова")).not.toBeVisible();
  });

  test("user A does not see data prepared for user B", async ({ page }) => {
    const userBPrivateClient = "B Secret Client";

    await page.goto("/clients");
    await expect(page.getByText("Клиентов пока нет")).toBeVisible();
    await expect(page.getByText(userBPrivateClient)).not.toBeVisible();
    await expectNoAppErrors(page);
  });
});
