import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  const project = await readFile(
    "examples/detalhamento/consolos-detalhados.lume.json",
    "utf8",
  );
  await page.addInitScript(
    (raw) => localStorage.setItem("lumeconsolo.project.v1", raw),
    project,
  );
  await page.goto("/");
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Detalhamento", exact: true })
    .click();
});

test("detalhe individual e de todos: DXF em cm, quadro CSV e PDF vetorial", async ({
  page,
}) => {
  const canvas = page.locator(".detail-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toContainText("RELAÇÃO DO AÇO");
  await expect(canvas).toContainText("C01");
  let event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Detalhes DXF", exact: true }).click();
  let download = await event;
  let dxf = await readFile((await download.path())!, "utf8");
  expect(dxf).toContain("$INSUNITS\n70\n5");
  expect(dxf).toContain("C01");
  expect(dxf).not.toContain("C02");
  expect(dxf).toContain("AcDbArc");
  await page.getByLabel("Escopo dos detalhes").selectOption("all");
  await page.getByLabel("Peça do detalhamento").selectOption("double-tie");
  await expect(canvas).toContainText("C02");
  await expect(canvas).toContainText("TIRANTE DUPLO");
  event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Detalhes DXF", exact: true }).click();
  download = await event;
  dxf = await readFile((await download.path())!, "utf8");
  expect(dxf).toContain("C01");
  expect(dxf).toContain("C02");
  event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Quadro CSV", exact: true }).click();
  download = await event;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain('"C01"');
  expect(csv).toContain('"C02"');
  expect(csv).toContain("C unitário (cm)");
  event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Detalhes PDF", exact: true }).click();
  download = await event;
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(10000);
});

test("tirante duplo, revisão e notas persistem e participam do histórico", async ({
  page,
}) => {
  await page.getByLabel("Disposição do tirante").selectOption("2");
  await expect(page.locator(".detail-canvas")).toContainText("TIRANTE DUPLO");
  await page.getByLabel("Revisão do detalhe").fill("R03");
  await page
    .getByLabel("Notas do detalhamento")
    .fill("Conferir posição com a forma do pilar.");
  await expect(page.locator(".detail-canvas")).toContainText("R03");
  await expect(page.locator(".detail-canvas")).toContainText(
    "Conferir posição com a forma do pilar.",
  );
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const project = JSON.parse(
    await readFile((await (await event).path())!, "utf8"),
  );
  expect(project.schemaVersion).toBe(5);
  expect(project.pieces[0].design.tieLayers).toBe(2);
  expect(project.pieces[0].detailing.revision).toBe("R03");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByLabel("Notas do detalhamento")).toHaveValue("");
});

test("pan e zoom, tema escuro e campo inválido bloqueando exportação", async ({
  page,
}) => {
  const canvas = page.locator(".detail-canvas"),
    model = page.getByTestId("detail-model");
  await page.getByRole("button", { name: "Ajustar detalhes à tela" }).click();
  const before = await model.getAttribute("transform");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + 150, box.y + 140, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  expect(await model.getAttribute("transform")).not.toBe(before);
  await page
    .getByRole("button", { name: "Aumentar detalhes", exact: true })
    .click();
  await expect(page.locator(".detail-view-tools")).toContainText("125%");
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator(".detail-viewport")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  const length = page.getByRole("textbox", {
    name: "Penetração da costura cm",
    exact: true,
  });
  await length.fill("-5");
  await length.press("Enter");
  await page.getByRole("button", { name: "Detalhes DXF", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("campo inválido");
});
