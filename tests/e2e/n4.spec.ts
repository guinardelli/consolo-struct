import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { exampleProject } from "../../src/domain/model";
import { shortFixture } from "../fixtures";

async function seed(page: Page) {
  const first = shortFixture(),
    second = shortFixture();
  second.id = "second";
  second.name = "C02";
  const project = JSON.parse(
    JSON.stringify({
      ...exampleProject(),
      schemaVersion: 4,
      pieces: [first, second],
    }),
  );
  for (const p of project.pieces) {
    delete p.rebar.stirrupBranches;
    delete p.rebar.constructiveDiameter;
    Object.assign(p.detailing, { mounting: false, mountingDiameter: 16 });
    Object.assign(p.design, {
      splittingCount: 3,
      splittingDiameter: 10,
      suspensionCount: 7,
      suspensionDiameter: 12.5,
    });
  }
  await page.addInitScript((raw) => {
    if (!localStorage.getItem("consolostruct.project.v1"))
      localStorage.setItem("lumeconsolo.project.v1", raw);
  }, JSON.stringify(project));
  await page.goto("/");
}
async function rebar(page: Page) {
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: "Editar armaduras", exact: true })
    .click();
}
async function saved(page: Page) {
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const path = (await (await event).path())!;
  return { path, project: JSON.parse(await readFile(path, "utf8")) };
}
async function audit(page: Page) {
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: /Cálculo auditável/ }).click();
  return JSON.parse(await readFile((await (await event).path())!, "utf8"));
}

test("migra, edita ramos/bitola, desfaz/refaz e salva por peça", async ({
  page,
}) => {
  await seed(page);
  await rebar(page);
  await expect(page.getByLabel("Ramos efetivos de N3")).toHaveValue("2");
  await expect(page.getByLabel("Diâmetro N4")).toHaveValue("8");
  const n4 = page
    .locator(".rebar-editor")
    .filter({ has: page.getByLabel("Diâmetro N4") });
  await expect(n4).toContainText("2 barras");
  await expect(n4.locator("input")).toHaveCount(0);
  await page.getByLabel("Ramos efetivos de N3").selectOption("4");
  await expect(n4).toContainText("4 barras");
  await expect(
    page.locator(".rebar-editor").nth(2).locator(".provided-area"),
  ).toContainText("6,23");
  await page.getByLabel("Diâmetro N4").selectOption("10");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByLabel("Diâmetro N4")).toHaveValue("8");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(page.getByLabel("Diâmetro N4")).toHaveValue("10");
  const { path, project } = await saved(page);
  expect(project.schemaVersion).toBe(5);
  expect(project.pieces[0].rebar).toMatchObject({
    stirrupBranches: 4,
    constructiveDiameter: 10,
  });
  expect(project.pieces[1].rebar).toMatchObject({
    stirrupBranches: 2,
    constructiveDiameter: 8,
  });
  expect(project.pieces[0].design).toMatchObject({
    splittingCount: 3,
    suspensionCount: 7,
  });
  expect(project.pieces[0].detailing).not.toHaveProperty("mounting");
  await page.getByLabel("Abrir arquivo de projeto").setInputFiles(path);
  await rebar(page);
  await expect(page.getByLabel("Ramos efetivos de N3")).toHaveValue("4");
  await expect(page.getByLabel("Diâmetro N4")).toHaveValue("10");
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: "Critérios da peça selecionada", exact: true })
    .click();
  await page.getByText("Armaduras complementares", { exact: true }).click();
  await expect(page.getByLabel(/N5 · fendilhamento transversal/)).toHaveValue(
    "3",
  );
  await expect(page.getByLabel(/N6 · suspensão da carga indireta/)).toHaveValue(
    "7",
  );
});

test("N3 altera a área; N4 invalida a memória mas não altera resistência", async ({
  page,
}) => {
  await seed(page);
  await rebar(page);
  await page.getByLabel("Ramos efetivos de N3").selectOption("4");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  const before = await audit(page);
  expect(before.result.values.stirrupProvided).toBeCloseTo(623.449, 3);
  await rebar(page);
  await page.getByLabel("Diâmetro N4").selectOption("12.5");
  await expect(
    page.getByText("Cálculo desatualizado", { exact: true }),
  ).toBeVisible();
  const after = await audit(page);
  expect(after.result.values).toEqual(before.result.values);
  expect(after.result.checks).toEqual(before.result.checks);
  expect(after.result.fingerprint).not.toBe(before.result.fingerprint);
});

for (const dark of [false, true])
  test(`seção e elevação com 2/4 ramos — ${dark ? "escuro" : "claro"}`, async ({
    page,
  }, info) => {
    await seed(page);
    await rebar(page);
    if (dark) await page.getByRole("button", { name: "Alternar tema" }).click();
    await page
      .locator(".document-tabs")
      .getByRole("button", { name: "Seção A–A", exact: true })
      .click();
    await expect(page.locator(".steel-N4 circle")).toHaveCount(2);
    await page.getByLabel("Ramos efetivos de N3").selectOption("4");
    await expect(page.locator(".steel-N4 circle")).toHaveCount(4);
    await expect(page.locator('[data-n3-part="grampo"]')).toHaveCount(1);
    await page.locator(".steel-N4").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".rebar-editor.selected")).toContainText(
      "Armadura construtiva",
    );
    await page.locator(".steel-N4").evaluate((el) => (el as SVGElement).blur());
    await page.screenshot({
      path: info.outputPath(`n4-secao-${dark ? "escuro" : "claro"}.png`),
    });
    await page
      .locator(".document-tabs")
      .getByRole("button", { name: "Curto-ELU · Elevação", exact: true })
      .click();
    await expect(page.locator(".steel-N4 path")).toHaveCount(4);
    await page.screenshot({
      path: info.outputPath(`n4-elevacao-${dark ? "escuro" : "claro"}.png`),
    });
  });

test("detalhamento exporta N4 e grampo interno com quantidades e forma", async ({
  page,
}) => {
  await seed(page);
  await rebar(page);
  await page.getByLabel("Ramos efetivos de N3").selectOption("4");
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Detalhamento", exact: true })
    .click();
  await expect(page.locator(".detail-canvas")).toContainText("N4");
  await expect(page.locator(".detail-canvas")).toContainText("Grampo interno");
  await expect(
    page.getByText("Porta-estribos inferior (2 barras)", { exact: true }),
  ).toHaveCount(0);
  for (const [button, needle] of [
    ["Quadro CSV", '"8";"4";"4"'],
    ["Detalhes SVG", "N4"],
    ["Detalhes DXF", "N4"],
    ["Detalhes PDF", "%PDF-"],
  ] as const) {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    expect(await readFile((await (await event).path())!, "utf8")).toContain(
      needle,
    );
  }
});

test("3D e janela estreita continuam navegáveis com N4", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await rebar(page);
  await page.getByLabel("Ramos efetivos de N3").selectOption("4");
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Vista 3D", exact: true })
    .click();
  await expect(page.getByTestId("viewport-3d")).toHaveAttribute(
    "data-renderer",
    /webgl|svg/,
  );
  await page
    .getByRole("button", { name: "Concreto translúcido", exact: true })
    .click();
  await page
    .locator(".drawing-legend")
    .getByRole("button", { name: /N4 Construtiva/ })
    .click();
  await page.screenshot({ path: info.outputPath("n4-3d.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Diâmetro N4").scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Diâmetro N4")).toBeVisible();
  await page.getByLabel("Diâmetro N4").selectOption("10");
  await expect(page.getByLabel("Diâmetro N4")).toHaveValue("10");
  await page.screenshot({ path: info.outputPath("n4-estreita.png") });
  expect(errors).toEqual([]);
});
