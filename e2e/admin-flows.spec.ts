import { expect, test } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("admin access and actions", () => {
  test("ordinary user cannot open /admin", async ({ page }) => {
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/admin?e2e_role=user", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("У вас нет доступа к админ-панели.")).toBeVisible();
    await expect(page.getByText("root@businesshub.test")).not.toBeVisible();
  });

  test("ordinary user does not see Admin in sidebar", async ({ page }) => {
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/dashboard");
    const menuButton = page.getByRole("button", { name: "Открыть меню" });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("ordinary user cannot call admin API", async ({ page }) => {
    await authenticateE2E(page, "user");
    await mockCrudApi(page, createTestBackend());

    const response = await page.request.get("/api/admin/users", {
      headers: {
        "x-businesshub-e2e-auth": "1",
        "x-businesshub-e2e-role": "user"
      }
    });

    expect(response.status()).toBe(403);
  });

  test("super admin sees platform users, businesses and subscriptions", async ({ page }) => {
    await authenticateE2E(page, "super_admin");
    await mockCrudApi(page, createTestBackend());

    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("root@businesshub.test")).toBeVisible();
    await expect(page.getByText("QA Studio")).toBeVisible();
    await expect(page.getByText("Активные подписки")).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("super admin can block, unblock and change plan to free pro business", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page, "super_admin");
    await mockCrudApi(page, state);

    await page.goto("/admin");
    await page.getByRole("button", { name: "Заблокировать пользователя owner@businesshub.test" }).click();
    await expect(page.getByText("Пользователь заблокирован")).toBeVisible();
    expect(state.adminUsers.find((user) => user.email === "owner@businesshub.test")?.blocked).toBe(true);

    await page.getByRole("button", { name: "Разблокировать пользователя owner@businesshub.test" }).click();
    await expect(page.getByText("Пользователь разблокирован")).toBeVisible();
    expect(state.adminUsers.find((user) => user.email === "owner@businesshub.test")?.blocked).toBe(false);

    for (const plan of ["free", "pro", "business"] as const) {
      await page.getByLabel("Изменить план owner@businesshub.test").selectOption(plan);
      await expect(page.getByText("План пользователя изменен")).toBeVisible();
      expect(state.adminSubscriptions[0]?.plan).toBe(plan);
    }

    await authenticateE2E(page, "user");
    await page.goto("/billing");
    await expect(page.getByText("Текущий план:").locator("..")).toContainText("Business");
    await expectNoAppErrors(page);
  });
});
