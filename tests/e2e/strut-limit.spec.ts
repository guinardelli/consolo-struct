import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { shortFixture } from "../fixtures";

const settingName = "Limite da biela da peça selecionada";
const command = (page: Page, action: string) =>
  page.locator(`.ribbon-panel [data-action="${action}"]`);
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true });
const selector = (scope: Page | Locator) =>
  scope.getByRole("combobox", {
    name: "Critério do limite da biela",
    exact: true,
  });
async function openSettings(page: Page) {
  await tab(page, "Configurações").click();
  await command(page, "strutLimit").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
async function download(page: Page, button: Locator) {
  const event = page.waitForEvent("download");
  await button.click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: await readFile((await file.path())!),
  };
}
async function saved(page: Page) {
  return JSON.parse(
    (
      await download(
        page,
        page
          .locator(".quick-access")
          .getByRole("button", { name: "Salvar projeto", exact: true }),
      )
    ).bytes.toString(),
  );
}
const project = () => {
  const piece = shortFixture();
  return {
    format: "lumeconsolo",
    schemaVersion: 4,
    name: "Limites de biela",
    author: "",
    client: "",
    pieces: [piece, { ...structuredClone(piece), id: "second", name: "C02" }],
  };
};
test.beforeEach(async ({ page }) => {
  const data = project();
  data.pieces.forEach((piece) => {
    delete (piece.design as Partial<typeof piece.design>).strutLimit;
  });
  await page.addInitScript(
    (raw) => localStorage.setItem("lumeconsolo.project.v1", raw),
    JSON.stringify(data),
  );
  await page.goto("/");
});

test("Configurações abre a peça sem mutação; edição participa do histórico e não atinge outras peças", async ({
  page,
}) => {
  await command(page, "calculate").click();
  await expect(page.locator(".result-summary").first()).toContainText(
    "Atende às verificações implementadas",
  );
  const before = await saved(page);
  const dialog = await openSettings(page);
  await expect(dialog).toContainText("Peça Curto-ELU");
  await expect(selector(dialog)).toHaveValue("fcd2");
  await expect(dialog).toContainText("11,3143 MPa");
  await expect(
    selector(dialog).locator('option[value="indirect085"]'),
  ).toHaveJSProperty("disabled", true);
  await page.keyboard.press("Escape");
  await expect(command(page, "strutLimit")).toBeFocused();
  await expect(page.locator(".document-tab.active")).toContainText("Elevação");
  expect(await saved(page)).toEqual(before);
  await openSettings(page);
  await selector(dialog).focus();
  await selector(dialog).press("ArrowDown");
  await expect(selector(dialog)).toHaveValue("fcd3");
  await expect(dialog).toContainText("13,5771 MPa");
  await expect(dialog).toContainText("Critério menos conservador");
  await dialog.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(
    page.getByText("Cálculo desatualizado", { exact: true }),
  ).toBeVisible();
  const changed = await saved(page);
  expect(changed.schemaVersion).toBe(5);
  expect(changed.pieces[0].design.strutLimit).toBe("fcd3");
  expect(changed.pieces[1]).toEqual(before.pieces[1]);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.locator(".result-summary").first()).toContainText(
    "Atende às verificações implementadas",
  );
  await openSettings(page);
  await expect(selector(dialog)).toHaveValue("fcd2");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await openSettings(page);
  await expect(selector(dialog)).toHaveValue("fcd3");
});

test("controle em Configurações e Cálculo usa a mesma peça e respeita introdução da carga", async ({
  page,
}) => {
  const dialog = await openSettings(page);
  await selector(dialog).selectOption("fcd3");
  await page.keyboard.press("Escape");
  await tab(page, "Modelo").click();
  await command(page, "design").click();
  await expect(selector(page.locator(".design-panel"))).toHaveValue("fcd3");
  await selector(page.locator(".design-panel")).selectOption("direct100");
  await openSettings(page);
  await expect(selector(dialog)).toHaveValue("direct100");
  await expect(dialog).toContainText("21,4286 MPa");
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Introdução da carga", exact: true })
    .selectOption("indirect");
  await openSettings(page);
  await expect(selector(dialog)).toHaveAttribute("aria-invalid", "true");
  await expect(
    selector(dialog).locator('option[value="direct100"]'),
  ).toHaveJSProperty("disabled", true);
  await expect(
    selector(dialog).locator('option[value="indirect085"]'),
  ).toHaveJSProperty("disabled", false);
  await expect(dialog.getByRole("alert")).toContainText("exige carga direta");
  await selector(dialog).selectOption("indirect085");
  await expect(dialog).toContainText("18,2143 MPa");
  await expect(selector(dialog)).toHaveAttribute("aria-invalid", "false");
  await page.keyboard.press("Escape");
  await tab(page, "Início").click();
  await command(page, "calculate").click();
  await expect(
    page.locator("tr").filter({ hasText: "Compressão da biela" }).first(),
  ).toContainText("18,214");
  await page.locator(".tree-piece").filter({ hasText: "C02" }).click();
  await openSettings(page);
  await expect(selector(dialog)).toHaveValue("fcd2");
});

test("memória, PDF e cálculo auditável registram fórmula, limite e pendência review", async ({
  page,
}) => {
  const dialog = await openSettings(page);
  await selector(dialog).selectOption("fcd3");
  await page.keyboard.press("Escape");
  await tab(page, "Início").click();
  await command(page, "calculate").click();
  await expect(page.locator(".result-summary").first()).toContainText(
    "Requer conferência complementar",
  );
  await command(page, "report").click();
  const report = page.locator(".report-paper");
  const row = report
    .locator("tr")
    .filter({ hasText: "Compressão da biela" })
    .first();
  await row.locator("summary").click();
  await expect(row).toContainText("0,72·αv2·fcd");
  await expect(row).toContainText("13,577 MPa");
  const review = report
    .locator("tr")
    .filter({ hasText: "Critério alternativo do limite da biela" })
    .first();
  await review.locator("summary").click();
  await expect(review).toContainText("Conferir");
  await expect(review).toContainText("padrão fcd2 11,3143 MPa");
  const pdf = await download(
    page,
    page.getByRole("button", { name: "Baixar PDF", exact: true }),
  );
  expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.bytes.toString("latin1")).toContain("0,72");
  expect(pdf.bytes.toString("latin1")).toContain("13,5771 MPa");
  await command(page, "export").click();
  const auditFile = await download(
    page,
    page.getByRole("button", { name: /Cálculo auditável/ }),
  );
  const audit = JSON.parse(auditFile.bytes.toString());
  expect(audit.input.design.strutLimit).toBe("fcd3");
  expect(audit.result.status).toBe("review");
  expect(
    audit.result.checks.find((c: any) => c.id === "strut").capacity,
  ).toBeCloseTo(13.577142857142857, 10);
  expect(
    audit.result.checks.find((c: any) => c.id === "strutLimitCriterion").status,
  ).toBe("review");
  const file = await download(
    page,
    page
      .locator(".quick-access")
      .getByRole("button", { name: "Salvar projeto", exact: true }),
  );
  await page.getByLabel("Abrir arquivo de projeto").setInputFiles({
    name: file.name,
    mimeType: "application/json",
    buffer: file.bytes,
  });
  await openSettings(page);
  await expect(selector(dialog)).toHaveValue("fcd3");
});

for (const [criterion, loadType, reason] of [
  ["direct100", "indirect", "carga direta"],
  ["indirect085", "direct", "carga indireta"],
] as const) {
  test(`arquivo com ${criterion} e carga ${loadType} é unsupported e pode ser corrigido`, async ({
    page,
  }) => {
    const data = project();
    data.pieces[0].design.strutLimit = criterion;
    data.pieces[0].design.loadType = loadType;
    await page.getByLabel("Abrir arquivo de projeto").setInputFiles({
      name: "incompativel.consolo.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await command(page, "calculate").click();
    await expect(page.locator(".result-summary").first()).toContainText(
      "Fora do domínio do motor",
    );
    await expect(page.locator(".checks-body")).toContainText(
      `só é permitido com ${reason}`,
    );
    const dialog = await openSettings(page);
    await expect(selector(dialog)).toHaveAttribute("aria-invalid", "true");
    await selector(dialog).selectOption("fcd2");
    await page.keyboard.press("Escape");
    await tab(page, "Início").click();
    await command(page, "calculate").click();
    await expect(page.locator(".result-summary").first()).not.toContainText(
      "Fora do domínio do motor",
    );
  });
}

test("diálogo funciona nos dois temas e em janela estreita; fechar devolve foco", async ({
  page,
}) => {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const dark of [false, true]) {
      if (dark)
        await page
          .getByRole("button", { name: "Alternar tema", exact: true })
          .click();
      const dialog = await openSettings(page);
      await expect(
        dialog.getByRole("heading", { name: settingName, exact: true }),
      ).toBeVisible();
      await expect(selector(dialog)).toBeInViewport();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        dark ? "dark" : "light",
      );
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await dialog
        .getByRole("button", { name: "Concluir", exact: true })
        .click();
      await expect(command(page, "strutLimit")).toBeFocused();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
    }
    await page
      .getByRole("button", { name: "Alternar tema", exact: true })
      .click();
  }
});
