import { expect, test } from "@playwright/test";
import { authenticateE2E, createTestBackend, expectNoAppErrors, mockCrudApi } from "./helpers/businesshub-fixtures";

test.describe("clients services appointments CRUD", () => {
  test("client create, validation, edit, search, refresh and delete", async ({ page }) => {
    await authenticateE2E(page);
    await mockCrudApi(page);
    await page.goto("/clients");

    await expect(page.getByText("Алина Морозова")).toBeVisible();
    await page.getByRole("button", { name: "Создать клиента" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Client name is required")).toBeVisible();

    await page.getByLabel("Имя").fill("QA Client");
    await page.getByLabel("Телефон").fill("+996 555 000 111");
    await page.getByLabel("Email").fill("qa-client@example.com");
    await page.getByLabel("Telegram username или chat_id").fill("@qa_client");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Клиент создан")).toBeVisible();
    await expect(page.getByText("QA Client")).toBeVisible();

    await page.reload();
    await expect(page.getByText("QA Client")).toBeVisible();

    await page.getByPlaceholder("Поиск по имени, телефону или email").fill("qa-client");
    await expect(page.getByText("QA Client")).toBeVisible();
    await expect(page.getByText("Алина Морозова")).not.toBeVisible();

    await page.getByPlaceholder("Поиск по имени, телефону или email").fill("");
    await page.getByRole("button", { name: "Редактировать клиента" }).first().click();
    await page.getByLabel("Имя").fill("QA Client Edited");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Клиент обновлен")).toBeVisible();
    await expect(page.getByText("QA Client Edited")).toBeVisible();

    await page.getByRole("button", { name: "Удалить клиента" }).first().click();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Клиент удален")).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("service create, validation, edit, active toggle, refresh and delete", async ({ page }) => {
    await authenticateE2E(page);
    await mockCrudApi(page);
    await page.goto("/services");

    await expect(page.getByText("Стрижка")).toBeVisible();
    await page.getByRole("button", { name: "Создать услугу" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Service name is required")).toBeVisible();

    await page.getByLabel("Название услуги").fill("QA Service");
    await page.getByLabel("Категория").fill("QA");
    await page.getByLabel("Цена").fill("42");
    await page.getByLabel("Длительность в минутах").fill("45");
    await page.getByLabel("Описание").fill("E2E service");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Услуга создана")).toBeVisible();
    await expect(page.getByText("QA Service")).toBeVisible();

    await page.reload();
    await expect(page.getByText("QA Service")).toBeVisible();

    await page.getByText("Активна").first().click();
    await expect(page.getByText("Услуга деактивирована")).toBeVisible();

    await page.getByRole("button", { name: "Редактировать услугу" }).first().click();
    await page.getByLabel("Название услуги").fill("QA Service Edited");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Услуга обновлена")).toBeVisible();
    await expect(page.getByText("QA Service Edited")).toBeVisible();

    await page.getByRole("button", { name: "Удалить услугу" }).first().click();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Услуга удалена")).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("appointment create, active service filtering, conflict warning, calendar filtering, edit and delete", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page);
    await mockCrudApi(page, state);
    await page.goto("/appointments");

    await page.getByRole("button", { name: "Создать запись" }).first().click();
    await expect(page.getByRole("option", { name: "Стрижка" })).toHaveCount(1);
    await expect(page.getByRole("option", { name: "Архивная услуга" })).toHaveCount(0);

    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Выберите клиента.")).toBeVisible();

    await page.getByLabel("Клиент").selectOption("client-1");
    await page.getByLabel("Услуга").selectOption("service-1");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Время").fill("09:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Запись создана")).toBeVisible();
    await expect(page.getByText("Алина Морозова")).toBeVisible();

    await page.getByRole("button", { name: "Создать запись" }).first().click();
    await page.getByLabel("Клиент").selectOption("client-1");
    await page.getByLabel("Услуга").selectOption("service-1");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Время").fill("09:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByRole("heading", { name: "Это время уже занято. Выберите другое время." })).toBeVisible();
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();

    await page.reload();
    await page.getByRole("button", { name: "4", exact: true }).click();
    await expect(page.getByText("Алина Морозова")).toBeVisible();

    await page.getByRole("button", { name: "Редактировать запись" }).first().click();
    await page.getByLabel("Время").fill("10:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Запись обновлена")).toBeVisible();
    await expect(page.getByText("10:00")).toBeVisible();

    await page.getByRole("button", { name: "Удалить запись" }).first().click();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Запись удалена")).toBeVisible();
    await expectNoAppErrors(page);
  });

  test("appointment completion creates one automatic revenue and cancelled appointment does not", async ({ page }) => {
    const state = createTestBackend();
    await authenticateE2E(page);
    await mockCrudApi(page, state);
    await page.goto("/appointments");

    await page.getByRole("button", { name: "Создать запись" }).first().click();
    await page.getByLabel("Клиент").selectOption("client-1");
    await page.getByLabel("Услуга").selectOption("service-1");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Время").fill("12:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Запись создана")).toBeVisible();

    await page.getByRole("button", { name: "Завершить запись" }).first().click();
    await expect(page.getByText("Запись завершена, доход создан")).toBeVisible();
    await expect(page.getByText("Завершено")).toBeVisible();
    await expect(page.getByRole("button", { name: "Завершить запись" })).toHaveCount(0);
    expect(state.revenues).toHaveLength(1);
    expect(state.revenues[0]).toMatchObject({ category: "Оплата за услугу", amount: 25 });

    const completedId = state.appointments.find((appointment) => appointment.status === "completed")?.id;
    const duplicateResponse = await page.evaluate(async (id) => {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "complete" })
      });
      return { status: response.status, body: await response.json() };
    }, completedId);
    expect(duplicateResponse.status).toBe(409);
    expect(state.revenues).toHaveLength(1);

    await page.getByRole("button", { name: "Создать запись" }).first().click();
    await page.getByLabel("Клиент").selectOption("client-1");
    await page.getByLabel("Услуга").selectOption("service-1");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Время").fill("13:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Запись создана")).toBeVisible();

    await page.getByRole("button", { name: "Отменить запись" }).last().click();
    await expect(page.getByText("Запись отменена")).toBeVisible();
    await expect(page.getByText("Отменено")).toBeVisible();
    expect(state.revenues).toHaveLength(1);

    await page.getByRole("button", { name: "Создать запись" }).first().click();
    await page.getByLabel("Клиент").selectOption("client-1");
    await page.getByLabel("Услуга").selectOption("service-1");
    await page.getByLabel("Дата").fill("2026-06-04");
    await page.getByLabel("Время").fill("14:00");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Запись создана")).toBeVisible();

    await page.getByRole("button", { name: "Отметить неявку" }).last().click();
    await expect(page.getByText("Отмечено: клиент не пришёл")).toBeVisible();
    await expect(page.getByText("Не пришёл", { exact: true })).toBeVisible();
    expect(state.revenues).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Завершить запись" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Отменить запись" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Отметить неявку" })).toHaveCount(0);
    await expectNoAppErrors(page);
  });
});
