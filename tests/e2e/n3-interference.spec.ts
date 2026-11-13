import { test, expect, type Page } from "@playwright/test";
import { exampleProject } from "../../src/domain/model";
import { shortFixture } from "../fixtures";
async function seed(page: Page, count = 5) {
  const p = shortFixture();
  p.rebar.stirrupBranches = 4;
  p.rebar.stirrupCount = count;
  await page.addInitScript(
    (raw) => localStorage.setItem("consolostruct.project.v1", raw),
    JSON.stringify({ ...exampleProject(), pieces: [p] }),
  );
  await page.goto("/");
}
test("N3G tem plano próprio e seção indica a projeção, com N4 em cada plano", async ({
  page,
}) => {
  await seed(page);
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Seção A–A", exact: true })
    .click();
  const outer = page.locator('[data-n3-part="externo"]'),
    inner = page.locator('[data-n3-part="grampo"]');
  const x = Number(await outer.getAttribute("data-longitudinal-position")),
    xi = Number(await inner.getAttribute("data-longitudinal-position"));
  expect(x).toBe(28.15);
  expect(xi - x).toBeCloseTo(29.1, 10);
  await expect(page.locator("#piece-drawing")).toContainText("projeção do par");
  const planes = await page
    .locator(".steel-N4 circle")
    .evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute("data-longitudinal-position"))),
    );
  expect(planes).toEqual([x, xi, xi, x]);
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Detalhamento", exact: true })
    .click();
  await expect(page.locator(".detail-canvas")).toContainText("N3G projetado");
  await expect(page.locator(".detail-issues")).not.toContainText(
    "Há interferência física entre estribos",
  );
});
test("arranjo congestionado exibe erro físico específico de N3/N3G", async ({
  page,
}) => {
  await seed(page, 8);
  await page
    .locator(".document-tabs")
    .getByRole("button", { name: "Detalhamento", exact: true })
    .click();
  await expect(
    page.locator(".detail-issues .error").filter({
      hasText: "Há interferência física entre estribos N3 e/ou grampos N3G",
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".detail-issues .error")
      .filter({ hasText: "Falta espaço longitudinal" }),
  ).toBeVisible();
});
