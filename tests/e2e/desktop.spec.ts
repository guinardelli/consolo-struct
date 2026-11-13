import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("cotas paramétricas: validação, confirmar, cancelar, histórico e arquivo", async ({
  page,
}) => {
  await page.goto("/");
  const length = () => page.locator(".dimension").filter({ hasText: "L =" });
  await length().click();
  const edit = page.getByLabel("Valor da cota");
  await expect(edit).toBeFocused();
  await edit.fill("0");
  await edit.press("Enter");
  await expect(page.getByRole("alert")).toContainText("0.5 a 600");
  await expect(page.getByLabel("Comprimento", { exact: false })).toHaveValue(
    "25",
  );
  await edit.press("Escape");
  await expect(edit).not.toBeVisible();
  await length().click();
  await edit.fill("32,5");
  await edit.press("Enter");
  await expect(length()).toContainText("32,5");
  await expect(page.getByLabel("Comprimento")).toHaveValue("32,5");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(length()).toContainText("25,0");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(length()).toContainText("32,5");
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Seção A–A", exact: true })
    .click();
  await page.locator(".dimension").filter({ hasText: "b =" }).click();
  await edit.fill("42.75");
  await edit.press("Enter");
  await expect(
    page.locator(".inspector").getByLabel("Largura", { exact: false }),
  ).toHaveValue("42,75");
  await page.locator(".dimension").filter({ hasText: "b =" }).click();
  await edit.fill("44");
  const downloadEvent = page.waitForEvent("download");
  await edit.press("Control+s");
  const download = await downloadEvent;
  const project = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(project.schemaVersion).toBe(5);
  expect(project.pieces[0].geometry.width).toBe(440);
  expect(project.pieces[0].geometry.length).toBe(325);
});

test("pan livre por botão central, Espaço e ferramenta; zoom ancorado no cursor", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator(".canvas");
  const box = (await canvas.boundingBox())!;
  const model = page.getByTestId("drawing-model");
  const center = () =>
    model.evaluate((el) => {
      const m = (el as SVGGraphicsElement).getScreenCTM()!;
      const p = new DOMPoint(400, 300).matrixTransform(m);
      return { x: p.x, y: p.y };
    });
  const before = await center();
  await page.mouse.move(box.x + 100, box.y + 120);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + 190, box.y + 175, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  const after = await center();
  expect(after.x - before.x).toBeCloseTo(90, 0);
  expect(after.y - before.y).toBeCloseTo(55, 0);
  await page.getByRole("button", { name: "Pan no desenho" }).click();
  await expect(canvas).toHaveClass(/pan-ready/);
  await page.getByRole("button", { name: "Selecionar no desenho" }).click();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 80, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const space = await center();
  expect(space.x - after.x).toBeCloseTo(-50, 0);
  await page.getByRole("button", { name: "Pan no desenho" }).click();
  await page.mouse.move(box.x + 90, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 95, { steps: 3 });
  await page.mouse.up();
  expect((await center()).x - space.x).toBeCloseTo(40, 0);
  await page.getByRole("button", { name: "Ajustar desenho à tela" }).click();
  const point = {
    x: Math.round(box.x + box.width * 0.62),
    y: Math.round(box.y + box.height * 0.55),
  };
  const world = () =>
    model.evaluate((el, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        (el as SVGGraphicsElement).getScreenCTM()!.inverse(),
      );
      return { x: p.x, y: p.y };
    }, point);
  const w1 = await world();
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -330);
  await expect(page.locator(".status-view")).not.toContainText("100%");
  const w2 = await world();
  expect(w2.x).toBeCloseTo(w1.x, 1);
  expect(w2.y).toBeCloseTo(w1.y, 1);
  await page.keyboard.press("f");
  await expect(model).toHaveAttribute(
    "transform",
    "translate(400 300) scale(1) translate(-400 -300)",
  );
  await page.keyboard.press("Escape");
  await expect(canvas).not.toHaveClass(/pan-ready/);
});

test("ribbon, redimensionamento dos painéis, camadas e temas", async ({
  page,
}) => {
  await page.goto("/");
  const browser = page.locator(".project-browser");
  const separator = page.getByRole("separator", {
    name: "Largura do navegador",
  });
  await separator.focus();
  await separator.press("ArrowRight");
  expect((await browser.boundingBox())!.width).toBe(220);
  const properties = page.getByRole("separator", {
    name: "Largura das propriedades",
  });
  const bounds = (await properties.boundingBox())!;
  await page.mouse.move(bounds.x + 2, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 38, bounds.y + 80);
  await page.mouse.up();
  expect((await page.locator(".property-dock").boundingBox())!.width).toBe(318);
  await page
    .getByRole("button", { name: "Fechar navegador do projeto" })
    .click();
  await expect(browser).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar navegador do projeto" })
    .click();
  await expect(browser).toBeVisible();
  await page.getByRole("button", { name: "Fechar propriedades" }).click();
  await page.getByRole("button", { name: "Mostrar propriedades" }).click();
  await expect(page.getByLabel("Altura no pilar")).toBeVisible();
  await page.getByRole("tab", { name: "Exibir", exact: true }).click();
  const ribbon = page.locator(".ribbon-panel");
  await ribbon
    .getByRole("button", { name: "Mostrar cotas", exact: true })
    .click();
  await expect(page.locator(".dimension")).toHaveCount(0);
  await ribbon
    .getByRole("button", { name: "Mostrar cotas", exact: true })
    .click();
  await expect(page.locator(".dimension")).toHaveCount(5);
  await ribbon
    .getByRole("button", { name: "Mostrar cargas", exact: true })
    .click();
  await expect(page.locator(".force-label")).toHaveCount(0);
  await ribbon
    .getByRole("button", { name: "Mostrar cargas", exact: true })
    .click();
  await expect(page.locator(".force-label")).toHaveCount(2);
  await expect(page.locator(".canvas")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator(".canvas")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("interface ocupa a janela e mantém desenho acessível em telas menores", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 960, height: 640 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > innerWidth,
      y: document.documentElement.scrollHeight > innerHeight,
    }));
    expect(overflow).toEqual({ x: false, y: false });
    expect(
      (await page.locator(".canvas").boundingBox())!.height,
    ).toBeGreaterThan(250);
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Mostrar propriedades" }).click();
      await expect(page.getByLabel("Altura no pilar")).toBeVisible();
      await page.getByRole("button", { name: "Fechar propriedades" }).click();
    }
  }
});
