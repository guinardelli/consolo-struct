import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { exampleProject, number, type Piece } from "../../src/domain/model";
import { tieLayout } from "../../src/domain/engine";
test("edita, desfaz, salva, reabre, revisa e exporta", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "C01 · Apoio principal" }),
  ).toBeVisible();
  await page.getByLabel("Altura no pilar").fill("45,5");
  await page.getByLabel("Altura no pilar").press("Enter");
  await expect(page.locator("svg").getByText("h = 45,5")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByLabel("Altura no pilar")).toHaveValue("40");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(page.getByLabel("Altura no pilar")).toHaveValue("45,5");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  await expect(page.locator(".result-summary").first()).toContainText(
    "Há verificações não atendidas",
  );
  await page.getByLabel("Comprimento").fill("28");
  await page.getByLabel("Comprimento").press("Enter");
  await expect(
    page.getByText("Cálculo desatualizado", { exact: true }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const saved = await dl;
  const savedPath = await saved.path();
  const json = JSON.parse(await readFile(savedPath!, "utf8"));
  expect(json.pieces[0].geometry.height).toBe(455);
  await page.getByRole("tab", { name: "Modelo", exact: true }).click();
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await page.getByRole("tab", { name: "Início", exact: true }).click();
  await expect(page.getByRole("heading", { name: /C03/ })).toBeVisible();
  await page.getByLabel("Abrir arquivo de projeto").setInputFiles(savedPath!);
  await expect(
    page.getByRole("heading", { name: "C01 · Apoio principal" }),
  ).toBeVisible();
  await page.getByLabel("Posição da carga").fill("50");
  await page.getByLabel("Posição da carga").press("Enter");
  await expect(
    page.getByText(
      "A distância da carga deve estar dentro do comprimento do consolo.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Geometria para CAD/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Seção A–A", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Seção transversal do consolo C01" }),
  ).toBeVisible();
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: "Editar armaduras", exact: true })
    .click();
  await page.getByLabel("Diâmetro N1").selectOption("25");
  await expect(page.locator(".provided-area").first()).toContainText("19,63");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Memória de cálculo/ }).click();
  const pdf = await pdfEvent;
  await pdf.saveAs(testInfo.outputPath("memoria.pdf"));
  expect(
    (await readFile(testInfo.outputPath("memoria.pdf")))
      .subarray(0, 4)
      .toString(),
  ).toBe("%PDF");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const dxfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Geometria para CAD/ }).click();
  await (await dxfEvent).saveAs(testInfo.outputPath("geometria.dxf"));
  await page.getByRole("button", { name: "Peças do projeto" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Memória", exact: true })
    .click();
  await expect(
    page.getByText("Combinações e memória numérica", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "C01 · Elevação", exact: true })
    .click();
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByLabel("Diâmetro N1")).not.toBeVisible();
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: "Editar armaduras", exact: true })
    .click();
  await expect(page.getByLabel("Diâmetro N1")).toHaveValue("25");
  expect(errors).toEqual([]);
});
test("rejeita importação inválida e permanece utilizável", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Abrir arquivo de projeto").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.getByRole("status")).toContainText("Projeto inválido");
  await expect(
    page.getByRole("heading", { name: "C01 · Apoio principal" }),
  ).toBeVisible();
});
test("layout em notebook e celular sem transbordamento horizontal", async ({
  page,
}) => {
  for (const size of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "C01 · Apoio principal" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

async function editSectionField(field: Locator, value: string) {
  await field.fill(value);
  await field.press("Enter");
}

async function expectSectionDPrime(page: Page, piece: Piece) {
  const dimension = page.getByRole("img", {
    name: /^d’ = .* · topo ao centroide do tirante$/,
  });
  const layout = tieLayout(piece);
  await expect(dimension).toContainText(
    `d’ = ${number(layout.dPrime / 10, 1)} cm`,
  );
  const geometry = await dimension.evaluate((el) => {
    const model = el.closest('[data-testid="drawing-model"]')!;
    const concrete = model.querySelector("rect")!;
    const line = el.querySelector(":scope > path") as SVGPathElement;
    const start = line.getPointAtLength(0);
    const end = line.getPointAtLength(line.getTotalLength());
    const bars = [
      ...model.querySelectorAll<SVGCircleElement>(".steel-N1 circle"),
    ];
    return {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      left: concrete.x.baseVal.value,
      top: concrete.y.baseVal.value,
      height: concrete.height.baseVal.value,
      centroid:
        bars.reduce((sum, bar) => sum + bar.cy.baseVal.value, 0) / bars.length,
      count: bars.length,
    };
  });
  expect(geometry.start.x).toBeLessThan(geometry.left);
  expect(geometry.end.x).toBe(geometry.start.x);
  expect(geometry.start.y).toBeCloseTo(geometry.top, 4);
  expect(geometry.end.y).toBeCloseTo(
    geometry.top + (layout.dPrime * geometry.height) / piece.geometry.height,
    4,
  );
  expect(geometry.end.y).toBeCloseTo(geometry.centroid, 4);
  expect(geometry.count).toBe(piece.rebar.tieCount);
}

test("seção A–A: d’ acompanha o centroide, cobrimento, bitolas e camadas desiguais", async ({
  page,
}) => {
  const project = exampleProject();
  const piece = project.pieces[0];
  await page.addInitScript(
    (raw) => localStorage.setItem("consolostruct.project.v1", raw),
    JSON.stringify(project),
  );
  await page.goto("/");
  await expect(page.getByRole("img", { name: /^d’ =/ })).toHaveCount(0);
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Seção A–A", exact: true })
    .click();
  await expectSectionDPrime(page, piece);

  await editSectionField(
    page.getByLabel("Cobrimento nominal informado"),
    "3,5",
  );
  piece.geometry.cover = 35;
  await expectSectionDPrime(page, piece);
  const inspector = page.locator(".inspector-tabs");
  await inspector
    .getByRole("button", { name: "Editar armaduras", exact: true })
    .click();
  await page.getByLabel("Diâmetro N1").selectOption("16");
  piece.rebar.tieDiameter = 16;
  await expectSectionDPrime(page, piece);
  await page.getByLabel("Diâmetro N3").selectOption("8");
  piece.rebar.stirrupDiameter = 8;
  await expectSectionDPrime(page, piece);
  await editSectionField(
    page
      .locator(".rebar-editor")
      .filter({ hasText: "Tirante principal" })
      .getByLabel("Quantidade"),
    "5",
  );
  piece.rebar.tieCount = 5;
  await inspector
    .getByRole("button", { name: "Critérios da peça selecionada", exact: true })
    .click();
  await page.getByText("Durabilidade e disposição", { exact: true }).click();
  for (const layers of [2, 3]) {
    await editSectionField(
      page.getByLabel("Camadas do tirante"),
      String(layers),
    );
    piece.design.tieLayers = layers;
    await expectSectionDPrime(page, piece);
  }
  expect(tieLayout(piece).rows.map((row) => row.count)).toEqual([2, 2, 1]);
  await editSectionField(
    page.getByLabel("Afastamento adicional do tirante"),
    "10",
  );
  piece.design.extraTopCover = 10;
  await expectSectionDPrime(page, piece);
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  expect(
    JSON.parse(await readFile((await (await event).path())!, "utf8")),
  ).toEqual(project);
});

for (const layers of [1, 3]) {
  test(`seção A–A: d’ de consulta preserva navegação, edição e projeto (${layers} camada(s))`, async ({
    page,
  }, testInfo) => {
    const project = exampleProject();
    const piece = project.pieces[0];
    piece.design.tieLayers = layers;
    piece.rebar.tieCount = layers === 1 ? 4 : 7;
    await page.addInitScript(
      (raw) => localStorage.setItem("consolostruct.project.v1", raw),
      JSON.stringify(project),
    );
    await page.goto("/");
    const exportAudit = async () => {
      await page.getByRole("tab", { name: "Início", exact: true }).click();
      await page.getByRole("button", { name: "Exportar", exact: true }).click();
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: /Cálculo auditável/ }).click();
      const audit = JSON.parse(
        await readFile((await (await event).path())!, "utf8"),
      );
      delete audit.generatedAt;
      return audit;
    };
    const before = await exportAudit();
    await page
      .locator(".document-tabs")
      .getByRole("button", { name: "Seção A–A", exact: true })
      .click();
    await expectSectionDPrime(page, piece);
    const dimension = page.getByRole("img", { name: /^d’ =/ });
    await expect(dimension).not.toHaveAttribute("tabindex", "0");
    await dimension.locator("text").click();
    await expect(page.getByLabel("Valor da cota")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Desfazer", exact: true }),
    ).toBeDisabled();
    const section = page.getByRole("group", {
      name: "Seção transversal do consolo C01",
    });
    await expect(
      section.getByRole("button", { name: /^Editar [bh] =/ }),
    ).toHaveCount(2);
    await section
      .getByRole("button", { name: "Selecionar armadura N2", exact: true })
      .locator("circle")
      .first()
      .click();
    await expect(
      section.getByRole("button", {
        name: "Selecionar armadura N2",
        exact: true,
      }),
    ).toHaveClass(/steel-selected/);

    await page.getByRole("tab", { name: "Exibir", exact: true }).click();
    const ribbon = page.getByRole("tabpanel");
    for (const visible of [false, true]) {
      await ribbon
        .getByRole("button", { name: "Mostrar cotas", exact: true })
        .click();
      await expect(section.locator(".dimension")).toHaveCount(visible ? 3 : 0);
    }
    await ribbon
      .getByRole("button", { name: "Mostrar armaduras", exact: true })
      .click();
    await expect(section.locator(".steel")).toHaveCount(0);
    await expect(dimension).toBeVisible();
    await ribbon
      .getByRole("button", { name: "Mostrar armaduras", exact: true })
      .click();
    await expectSectionDPrime(page, piece);

    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "Alternar tema" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page
        .getByRole("button", { name: "Aumentar zoom no desenho" })
        .click();
      const canvas = page.locator(".canvas");
      const bounds = (await canvas.boundingBox())!;
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(
        bounds.x + bounds.width / 2 + 25,
        bounds.y + bounds.height / 2 + 20,
        { steps: 3 },
      );
      await page.mouse.up({ button: "middle" });
      await expect(page.getByTestId("drawing-model")).not.toHaveAttribute(
        "transform",
        "translate(400 300) scale(1) translate(-400 -300)",
      );
      await expectSectionDPrime(page, piece);
      const text = (await dimension.locator("text").boundingBox())!;
      expect(text.x).toBeGreaterThan(bounds.x);
      expect(text.y).toBeGreaterThan(bounds.y);
      expect(text.x + text.width).toBeLessThan(bounds.x + bounds.width);
      expect(text.y + text.height).toBeLessThan(bounds.y + bounds.height);
      for (const other of [
        section.locator(".steel-N1"),
        ...(await section.locator(".dimension[role=button] text").all()),
      ]) {
        const box = (await other.boundingBox())!;
        expect(
          text.x + text.width <= box.x ||
            box.x + box.width <= text.x ||
            text.y + text.height <= box.y ||
            box.y + box.height <= text.y,
        ).toBe(true);
      }
      await page
        .getByRole("button", { name: "Ajustar desenho à tela" })
        .click();
      await testInfo.attach(`secao-aa-${layers}-camadas-${theme}`, {
        body: await canvas.screenshot({
          path: testInfo.outputPath(`secao-aa-${layers}-camadas-${theme}.png`),
        }),
        contentType: "image/png",
      });
    }
    expect(await exportAudit()).toEqual(before);
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Salvar projeto", exact: true })
      .click();
    expect(
      JSON.parse(await readFile((await (await event).path())!, "utf8")),
    ).toEqual(project);

    for (const key of ["b", "h"]) {
      await section
        .getByRole("button", { name: new RegExp(`^Editar ${key} =`) })
        .click();
      await expect(page.getByLabel("Valor da cota")).toBeFocused();
      await page.getByLabel("Valor da cota").press("Escape");
    }
  });
}

for (const layers of [1, 3]) {
  test(`seção A–A: d’ cabe após enquadrar seções largas (${layers} camada(s))`, async ({
    page,
  }, testInfo) => {
    const project = exampleProject();
    const piece = project.pieces[0];
    piece.geometry.width = 1000;
    piece.design.tieLayers = layers;
    piece.rebar.tieCount = layers === 1 ? 4 : 7;
    await page.addInitScript(
      (raw) => localStorage.setItem("consolostruct.project.v1", raw),
      JSON.stringify(project),
    );
    await page.goto("/");
    await page
      .locator(".document-tabs")
      .getByRole("button", { name: "Seção A–A", exact: true })
      .click();
    const canvas = page.locator(".canvas");
    const dimension = page.getByRole("img", { name: /^d’ =/ });
    const expectInside = async () => {
      await expectSectionDPrime(page, piece);
      const bounds = (await canvas.boundingBox())!;
      const text = (await dimension.locator("text").boundingBox())!;
      expect(text.x).toBeGreaterThan(bounds.x);
      expect(text.y).toBeGreaterThan(bounds.y);
      expect(text.x + text.width).toBeLessThan(bounds.x + bounds.width);
      expect(text.y + text.height).toBeLessThan(bounds.y + bounds.height);
    };
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "Alternar tema" }).click();
      for (const width of [1000, 2000, 6000, 300, 1000]) {
        await editSectionField(
          page.getByRole("textbox", { name: /^Largura/ }),
          String(width / 10),
        );
        piece.geometry.width = width;
        await page
          .getByRole("button", { name: "Ajustar desenho à tela" })
          .click();
        await expectInside();
      }
      await page
        .getByRole("button", { name: "Diminuir zoom no desenho" })
        .click();
      const bounds = (await canvas.boundingBox())!;
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(
        bounds.x + bounds.width / 2 + 20,
        bounds.y + bounds.height / 2 + 15,
      );
      await page.mouse.up({ button: "middle" });
      await page
        .getByRole("button", { name: "Ajustar desenho à tela" })
        .click();
      await expectInside();
      await testInfo.attach(`secao-larga-dprime-${layers}-${theme}`, {
        body: await canvas.screenshot({
          path: testInfo.outputPath(
            `secao-larga-dprime-${layers}-${theme}.png`,
          ),
        }),
        contentType: "image/png",
      });
    }
  });
}
