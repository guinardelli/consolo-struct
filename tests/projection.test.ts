import { describe, expect, it } from "vitest";
import { buildDetail } from "../src/detailing/model";
import {
  barPathData,
  elevationShapes,
  sectionCrossings,
} from "../src/detailing/projection";
import { cantileverFixture, shortFixture } from "./fixtures";

function withMounting() {
  const p = shortFixture();
  p.detailing.mounting = true;
  return p;
}

describe("Projeção do detalhamento nas vistas de modelagem", () => {
  it("projeta na elevação cada família que o modelo não desenhava", () => {
    const p = withMounting();
    p.detailing.pins = 2;
    const d = buildDetail(p);
    const shapes = elevationShapes(d);
    for (const family of ["mounting", "pin"] as const)
      if (d.bars.some((b) => b.family === family))
        expect(shapes.some((s) => s.bar.family === family)).toBe(true);
    expect(shapes.some((s) => s.bar.family === "mounting")).toBe(true);
  });

  it("não projeta famílias que já têm renderizador próprio", () => {
    const shapes = elevationShapes(buildDetail(withMounting()));
    for (const s of shapes)
      expect(["mounting", "pin", "welded"]).toContain(s.bar.family);
  });

  it("o corte mostra as barras que cruzam o plano e nenhuma que não cruza", () => {
    const d = buildDetail(withMounting());
    const at0 = sectionCrossings(d, 0);
    expect(at0).toHaveLength(2);
    const tip = d.piece.geometry.length + 1000;
    expect(sectionCrossings(d, tip)).toHaveLength(0);
    expect(sectionCrossings(d, -1e6)).toHaveLength(0);
  });

  it("porta-estribos fica dentro do estribo, simétrico e com profundidade do modelo", () => {
    const d = buildDetail(withMounting());
    const g = d.piece.geometry;
    const [left, right] = sectionCrossings(d, 0);
    const bar = left.bar;
    const min = g.cover + d.piece.rebar.stirrupDiameter + bar.diameter / 2;
    expect(left.lateral).toBeCloseTo(min);
    expect(right.lateral).toBeCloseTo(g.width - min);
    expect(left.depth).toBe(bar.locations[0].z);
    expect(left.depth).toBeGreaterThan(0);
    expect(left.depth).toBeLessThan(g.height);
  });

  it("sem porta-estribos (ou armado como viga) não inventa barras no corte", () => {
    const p = shortFixture();
    p.detailing.mounting = false;
    expect(sectionCrossings(buildDetail(p))).toHaveLength(0);
    const c = cantileverFixture();
    c.detailing.mounting = true;
    for (const s of elevationShapes(buildDetail(c)))
      expect(s.bar.family).not.toBe("positive");
  });

  it("converte arcos e retas do eixo em traçado SVG contínuo", () => {
    const d = buildDetail(withMounting());
    const bar = d.bars.find((b) => b.family === "mounting")!;
    const data = barPathData(
      bar.path,
      (x) => x,
      (y) => y,
      1,
    );
    expect(data.startsWith("M")).toBe(true);
    expect(data.match(/M/g)).toHaveLength(1);
    expect(data).toMatch(/[LA]/);
  });
});
