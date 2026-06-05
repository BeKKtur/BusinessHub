import { expect, test } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("billing and subscriptions", () => {
  test("free user sees Free plan and limits", async ({ page }) => {
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/billing");
    await expect(page.getByText("Текущий план:").locator("..")).toContainText("Free");
    await expect(page.getByText("Лимиты: клиенты 50, записи 100")).toBeVisible();
    await expect(page.getByRole("button", { name: "Текущий план" })).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("upgrade Pro opens Paddle checkout", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { Paddle: typeof window.Paddle }).Paddle = {
        Environment: { set: () => undefined },
        Initialize: () => undefined,
        Checkout: {
          open: (options) => {
            window.localStorage.setItem("paddle-checkout-plan", options.customData.plan);
          }
        }
      };
    });
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/billing");
    await page.getByRole("button", { name: "Upgrade" }).first().click();
    await expect(page.getByText("Checkout открыт")).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("paddle-checkout-plan"))).resolves.toBe("pro");
  });

  test("upgrade Business opens Paddle checkout", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { Paddle: typeof window.Paddle }).Paddle = {
        Environment: { set: () => undefined },
        Initialize: () => undefined,
        Checkout: {
          open: (options) => {
            window.localStorage.setItem("paddle-checkout-plan", options.customData.plan);
          }
        }
      };
    });
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/billing");
    await page.getByRole("button", { name: "Upgrade" }).nth(1).click();
    await expect(page.getByText("Checkout открыт")).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("paddle-checkout-plan"))).resolves.toBe("business");
  });

  test("webhook updates subscription status", async ({ page }) => {
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/billing");
    await expect(page.getByText("Текущий план:").locator("..")).toContainText("Free");

    await page.evaluate(async () => {
      await fetch("/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "subscription.updated",
          data: {
            subscription_id: "sub_test",
            customer_id: "ctm_test",
            price_id: "pri_pro_test",
            status: "active"
          }
        })
      });
    });

    await page.reload();
    await expect(page.getByText("Текущий план:").locator("..")).toContainText("Pro");
  });

  test("free plan limit blocks client create", async ({ page }) => {
    const state = createTestBackend();
    state.clients = Array.from({ length: 50 }, (_, index) => ({
      id: `client-limit-${index}`,
      business_id: "test-business",
      name: `Client ${index}`,
      phone: `+996700000${String(index).padStart(3, "0")}`,
      email: null,
      notes: null,
      telegram: null,
      visits_count: 0,
      created_at: "2026-06-01T09:00:00Z"
    }));
    await authenticateE2E(page, "user");
    await mockCrudApi(page, state);

    await page.goto("/clients");
    await page.getByRole("button", { name: "Создать клиента" }).click();
    await page.getByLabel("Имя").fill("Over Limit");
    await page.getByLabel("Телефон").fill("+996 700 111 222");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Нужен тариф Pro")).toBeVisible();
    await expect(page.getByText("Достигнут лимит тарифа Free").first()).toBeVisible();
  });

  test("super admin can change user plan and billing reflects it", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page, "super_admin");
    await mockCrudApi(page, state);

    await page.goto("/admin");
    await page.getByLabel("Изменить план owner@businesshub.test").selectOption("business");
    await expect(page.getByText("План пользователя изменен")).toBeVisible();

    await authenticateE2E(page, "user");
    await page.goto("/billing");
    await expect(page.getByText("Текущий план:").locator("..")).toContainText("Business");
  });
});
