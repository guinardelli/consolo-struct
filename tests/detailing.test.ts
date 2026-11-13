import { describe, expect, it } from "vitest";
import {
  closedStirrup,
  roundedPath,
  samplePath,
  steelMass,
} from "../src/detailing/geometry";
import { buildDetail } from "../src/detailing/model";
import { combineDrawings, pieceDrawing } from "../src/detailing/drawing";
import { drawingDxf, drawingSvg, steelCsv } from "../src/detailing/exports";
import { decodeProject, exampleProject } from "../src/domain/model";
import { stirrupLayout } from "../src/domain/theory";
import { toCsv, toDxf, toSvg } from "../src/lib/exports";
import { cantileverFixture, shortFixture } from "./fixtures";

describe("Centro de gravidade das barras e comprimentos de oficina", () => {
  it("alça U inclui duas curvas de 90° sem somar os cantos virtuais", () => {
    const r = 58;
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 300 },
        { x: 0, y: 300 },
      ],
      r,
    );
    expect(path.valid).toBe(true);
    expect(path.length).toBeCloseTo(2300 + (Math.PI - 4) * r, 8);
    expect(path.segments.filter((s) => s.type === "arc")).toHaveLength(2);
    const points = samplePath(path);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 0, y: 300 });
  });
  it("estribo fechado soma três cantos de 90° e dois ganchos de 135°", () => {
    const path = closedStirrup(300, 400, 6.3, 18.9),
      radius = 12.6;
    expect(path.valid).toBe(true);
    expect(path.length).toBeCloseTo(1400 + (3 * Math.PI - 8) * radius + 100, 8);
    const arcs = path.segments.filter((s) => s.type === "arc");
    expect(arcs).toHaveLength(5);
    expect(arcs.reduce((s, a) => s + Math.abs(a.sweep), 0)).toBeCloseTo(
      3 * Math.PI,
      10,
    );
  });
  it("não reduz mandris para fazer uma forma impossível caber", () => {
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
        ],
        40,
      ).valid,
    ).toBe(false);
    expect(closedStirrup(30, 40, 16, 80).valid).toBe(false);
  });
  it("massa usa comprimento desenvolvido e densidade de 7850 kg/m³", () => {
    expect(steelMass(1000, 10)).toBeCloseTo(0.616537558, 8);
  });
});
describe("Posições, tirante duplo e quadro de aço", () => {
  it("quatro ramos são duas alças e não quatro alças", () => {
    const detail = buildDetail(shortFixture());
    expect(detail.issues.filter((i) => i.severity === "error")).toEqual([]);
    const loops = detail.bars.filter((b) => b.family === "tie");
    expect(loops.reduce((n, b) => n + b.quantity, 0)).toBe(2);
    expect(loops).toHaveLength(2); // nested loops have different cut lengths
  });
  it("a segunda camada tem posição, mandril, comprimento e altura útil próprios", () => {
    const p = shortFixture();
    p.design.tieLayers = 2;
    p.detailing.secondLoopDiameter = 160;
    const detail = buildDetail(p),
      ties = detail.bars.filter((b) => b.family === "tie");
    expect(ties).toHaveLength(2);
    expect(ties[0].mandrel).toBe(100);
    expect(ties[1].mandrel).toBe(160);
    expect(ties[0].locations[0].z).toBeLessThan(ties[1].locations[0].z);
    expect(ties[0].cutLength).not.toBe(ties[1].cutLength);
    expect(detail.result.fingerprint).toContain('"tieLayers":2');
  });
  it("separa comprimentos variáveis dos estribos em cada x", () => {
    const p = shortFixture(),
      detail = buildDetail(p);
    const stirrups = detail.bars.filter((b) => b.family === "stirrup");
    expect(stirrups).toHaveLength(5);
    expect(new Set(stirrups.map((b) => b.cutLength)).size).toBe(5);
    expect(stirrups[0].cutLength).toBeGreaterThan(stirrups[4].cutLength);
    expect(stirrups.flatMap((b) => b.locations).at(-1)!.x).toBeCloseTo(
      p.geometry.length - p.geometry.cover - p.rebar.stirrupDiameter / 2,
      8,
    );
  });
  it("quantidades do tipo multiplicam barras e massa uma única vez", () => {
    const p = shortFixture();
    p.quantity = 7;
    const d = buildDetail(p);
    expect(d.totalMass).toBeCloseTo(d.mass * 7, 10);
    expect(d.steelSummary.reduce((s, v) => s + v.mass, 0)).toBeCloseTo(
      d.mass,
      10,
    );
    for (const b of d.bars) {
      expect(b.cutLength).toBeGreaterThanOrEqual(b.exactLength - 1e-6);
      expect(b.cutLength - b.exactLength).toBeLessThan(1.00001);
    }
  });
  it("denuncia alças que não cabem e ramos ímpares por camada", () => {
    const p = shortFixture();
    p.geometry.width = 220;
    expect(buildDetail(p).issues.some((i) => i.code === "nested-loops")).toBe(
      true,
    );
    p.geometry.width = 400;
    p.rebar.tieCount = 6;
    p.design.tieLayers = 2;
    expect(buildDetail(p).issues.some((i) => i.code === "tie-even")).toBe(true);
  });
  it("verifica o percurso real do gancho em vez de reutilizar o valor declarado", () => {
    const p = shortFixture();
    p.design.supportAnchor = "hook";
    p.detailing.supportHookProjection = 250;
    p.detailing.supportHookTail = 200;
    expect(buildDetail(p).issues.some((i) => i.code === "hook-available")).toBe(
      true,
    );
  });
  it("pinos não ganham aprovação estrutural por serem desenhados", () => {
    const p = shortFixture();
    p.detailing.pins = 2;
    const d = buildDetail(p);
    expect(d.bars.find((b) => b.family === "pin")?.quantity).toBe(2);
    expect(d.issues.find((i) => i.code === "pins")?.severity).toBe("review");
  });
  it("detecta pino atravessando o tirante e permite ajustar a distribuição transversal", () => {
    const p = shortFixture();
    p.detailing.pins = 2;
    p.detailing.pinSpacing = 321.4;
    expect(buildDetail(p).issues.some((i) => i.code === "pin-tie-clash")).toBe(
      true,
    );
    p.detailing.pinSpacing = 0;
    expect(buildDetail(p).issues.some((i) => i.code === "pin-tie-clash")).toBe(
      false,
    );
  });
});
describe("Interoperabilidade e arquivos", () => {
  it("migra esquemas 1 e 2 sem inventar aprovação do detalhamento", () => {
    const project = exampleProject();
    const legacy = {
      ...project,
      schemaVersion: 2,
      pieces: project.pieces.map(({ detailing: _d, ...p }) => p),
    };
    const converted = decodeProject(JSON.stringify(legacy));
    expect(converted.schemaVersion).toBe(5);
    expect(converted.pieces[0].detailing.revision).toBe("R00");
    converted.pieces[0].detailing.notes = "Dobra conferida";
    expect(decodeProject(JSON.stringify(converted))).toEqual(converted);
  });
  it("DXF trabalha em cm e mantém arcos e textos editáveis", () => {
    const p = shortFixture(),
      project = { ...exampleProject(), pieces: [p] };
    const drawing = pieceDrawing(project, buildDetail(p));
    const dxf = drawingDxf(drawing);
    expect(dxf).toContain("$INSUNITS\n70\n5\n");
    expect(dxf).toContain("\nARC\n");
    expect(dxf).toContain("AcDbText");
    expect(dxf).toContain("C unit cm");
    expect(dxf).toContain("FORMAS");
    expect(dxf).not.toContain("NaN");
  });
  it("exporta todos os tipos, com marcas locais e identidade preservada", () => {
    const project = exampleProject();
    project.pieces = [
      shortFixture(),
      { ...shortFixture(), id: "second", name: "Outro" },
    ];
    const drawings = project.pieces.map((p) =>
      pieceDrawing(project, buildDetail(p)),
    );
    const combined = combineDrawings(drawings);
    expect(drawingSvg(combined)).toContain("Outro");
    expect(combined.height).toBeGreaterThan(
      drawings[0].height + drawings[1].height,
    );
  });
  it("escapa SVG e fórmulas CSV nos campos editáveis", () => {
    const p = shortFixture();
    p.name = '=HYPERLINK("x")';
    p.detailing.notes = '<script>alert("x")</script>';
    const project = { ...exampleProject(), pieces: [p] };
    const svg = drawingSvg(pieceDrawing(project, buildDetail(p)));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(steelCsv([buildDetail(p)])).toContain("\"'=HYPERLINK");
  });
});
describe("Viga em balanço (1 < a/d ≤ 2)", () => {
  it("detalha, desenha e exporta sem depender de valores de bielas", () => {
    for (const p of [
      cantileverFixture(),
      cantileverFixture({ vertical: 350000, loadOffset: 700, length: 800 }),
      cantileverFixture({ height: 700, loadOffset: 1000, length: 1100 }),
    ]) {
      const detail = buildDetail(p);
      expect(detail.result.combinations[0].method).toBe("beam");
      expect(detail.bars.length).toBeGreaterThan(0);
      const project = { ...exampleProject(), pieces: [p] };
      const drawing = pieceDrawing(project, detail);
      for (const text of [
        drawingDxf(drawing),
        drawingSvg(drawing),
        steelCsv([detail]),
        toCsv(project),
        toDxf(p),
        toSvg(p),
      ])
        expect(text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it("o passo de N3 verificado pelo motor é o mesmo do detalhamento", () => {
    const p = cantileverFixture();
    p.rebar.stirrupCount = 7;
    const drawn = buildDetail(p)
      .bars.filter((b) => b.family === "stirrup")
      .map((b) => b.locations[0].x);
    const layout = stirrupLayout(p);
    expect(drawn).toEqual(layout.positions);
    expect(drawn[1] - drawn[0]).toBeCloseTo(layout.pitch, 10);
    const spacing = buildDetail(p).result.checks.find(
      (c) => c.id === "beamStirrupSpacing",
    )!;
    expect(spacing.demand).toBeCloseTo(layout.pitch, 10);
  });
});
