import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const open3d = async (page: import("@playwright/test").Page) => {
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Vista 3D", exact: true })
    .click();
  await expect(page.getByTestId("viewport-3d")).toHaveAttribute(
    "data-renderer",
    /webgl|svg/,
  );
};
test("navega no 3D com órbita, pan, zoom, vistas padrão e enquadramento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await open3d(page);
  const view = page.getByTestId("viewport-3d");
  await expect(view).toHaveAttribute("data-renderer", "webgl");
  await expect(
    view.getByRole("img", { name: "Modelo 3D do consolo C01" }),
  ).toBeVisible();
  await expect(
    view.getByLabel("Editar cota 3D length", { exact: true }),
  ).toContainText("25,0 cm");
  await expect(view.locator(".three-force-label")).toHaveCount(2);
  const initial = JSON.parse((await view.getAttribute("data-camera"))!);
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.4 + 90,
    box.y + box.height * 0.6 + 45,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        JSON.parse((await view.getAttribute("data-camera"))!).position,
    )
    .not.toEqual(initial.position);
  const orbit = JSON.parse((await view.getAttribute("data-camera"))!);
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(
    box.x + box.width * 0.35 + 55,
    box.y + box.height * 0.55 + 25,
    { steps: 5 },
  );
  await page.mouse.up({ button: "middle" });
  await expect
    .poll(
      async () => JSON.parse((await view.getAttribute("data-camera"))!).target,
    )
    .not.toEqual(orbit.target);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -250);
  await expect
    .poll(
      async () => JSON.parse((await view.getAttribute("data-camera"))!).zoom,
    )
    .toBeGreaterThan(1);
  await page
    .getByRole("button", { name: "Ajustar modelo 3D à tela", exact: true })
    .click();
  await expect
    .poll(
      async () => JSON.parse((await view.getAttribute("data-camera"))!).zoom,
    )
    .toBe(1);
  for (const option of ["front", "top", "side", "iso"]) {
    await page
      .getByLabel("Orientação 3D", { exact: true })
      .selectOption(option);
    await expect(page.getByLabel("Orientação 3D", { exact: true })).toHaveValue(
      option,
    );
  }
  expect(errors).toEqual([]);
});
test("edita a cota 3D e mantém elevação, arquivo e histórico sincronizados", async ({
  page,
}) => {
  await page.goto("/");
  await open3d(page);
  const length = page.getByRole("button", {
    name: "Editar cota 3D length",
    exact: true,
  });
  await length.click();
  const field = page.getByLabel("Valor da cota 3D", { exact: true });
  await expect(field).toBeFocused();
  await field.fill("32,5");
  await field.press("Enter");
  await expect(page.getByTestId("viewport-3d")).toHaveAttribute(
    "data-length-mm",
    "325",
  );
  await expect(length).toContainText("32,5 cm");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(length).toContainText("25,0 cm");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(length).toContainText("32,5 cm");
  await length.click();
  await field.fill("0");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("0,5 a 600");
  await field.press("Escape");
  await expect(field).not.toBeVisible();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const file = await event;
  const saved = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(saved.schemaVersion).toBe(5);
  expect(saved.pieces[0].geometry.length).toBe(325);
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "C01 · Elevação", exact: true })
    .click();
  await expect(
    page.locator(".dimension").filter({ hasText: "L =" }),
  ).toContainText("32,5");
});
test("camadas e tema afetam também a vista 3D, sem alterar o projeto", async ({
  page,
}) => {
  await page.goto("/");
  await open3d(page);
  const view = page.getByTestId("viewport-3d");
  const before = await view.getAttribute("data-camera");
  await page.getByRole("tab", { name: "Exibir", exact: true }).click();
  const ribbon = page.locator(".ribbon-panel");
  await ribbon
    .getByRole("button", { name: "Mostrar cotas", exact: true })
    .click();
  await expect(view.locator(".three-dimension-label")).toHaveCount(0);
  await ribbon
    .getByRole("button", { name: "Mostrar cargas", exact: true })
    .click();
  await expect(view.locator(".three-force-label")).toHaveCount(0);
  await ribbon
    .getByRole("button", { name: "Mostrar cotas", exact: true })
    .click();
  await ribbon
    .getByRole("button", { name: "Mostrar cargas", exact: true })
    .click();
  await ribbon
    .getByRole("button", { name: "Mostrar armaduras", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Alternar tema", exact: true })
    .click();
  await expect(view).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(view.locator(".three-dimension-label")).toHaveCount(6);
  expect(await view.getAttribute("data-camera")).toBe(before);
  await page
    .getByRole("button", { name: "Concreto translúcido", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Concreto translúcido", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("continua interativo no modo compatível quando WebGL está indisponível", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl2") return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof original;
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await open3d(page);
  const view = page.getByTestId("viewport-3d");
  await expect(view).toHaveAttribute("data-renderer", "svg");
  await expect(
    view.getByText("Modo compatível", { exact: true }),
  ).toBeVisible();
  expect(await view.locator("svg.three-surface path").count()).toBeGreaterThan(
    20,
  );
  const previousCamera = await view.getAttribute("data-camera");
  await page.getByLabel("Orientação 3D", { exact: true }).selectOption("front");
  // Aguarde o desenho da nova orientação antes de medir os frames em repouso.
  await expect
    .poll(() => view.getAttribute("data-camera"))
    .not.toBe(previousCamera);
  await expect(
    view.getByRole("button", { name: "Editar cota 3D height", exact: true }),
  ).toBeVisible();
  const frame = Number(await view.getAttribute("data-frame"));
  await page.waitForTimeout(200);
  expect(Number(await view.getAttribute("data-frame"))).toBe(frame);
  expect(errors).toEqual([]);
});
test("trocas entre vistas descartam a cena anterior e preservam o editor", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (let i = 0; i < 4; i++) {
    await open3d(page);
    await page
      .locator(".document-tabs")
      .getByRole("button", { name: "C01 · Elevação", exact: true })
      .click();
    await expect(page.getByTestId("viewport-3d")).toHaveCount(0);
  }
  await open3d(page);
  await expect(
    page
      .getByTestId("viewport-3d")
      .getByRole("img", { name: "Modelo 3D do consolo C01", exact: true }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
