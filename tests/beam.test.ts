import { describe, expect, it } from "vitest";
import { buildDetail, type Detail } from "../src/detailing/model";
import { pieceDrawing } from "../src/detailing/drawing";
import { drawingDxf, drawingSvg, steelCsv } from "../src/detailing/exports";
import {
  beamArrangementActive,
  beamArrangementAvailable,
  beamLayout,
} from "../src/detailing/beam";
import { mandrelDiameter, samplePath } from "../src/detailing/geometry";
import { calculate } from "../src/domain/engine";
import { decodeProject, exampleProject, type Piece } from "../src/domain/model";
import { buildSceneModel } from "../src/visualization/model3d";
import { cantileverFixture, shortFixture } from "./fixtures";

const beamPiece = (base: Piece = shortFixture()): Piece => ({
  ...base,
  detailing: { ...base.detailing, barArrangement: "beam" },
});
// Deeper tip: the tip bends can develop lb,nec inside the outline.
const deepTip = (): Piece => {
  const p = shortFixture();
  p.geometry = { ...p.geometry, tipHeight: 450 };
  return beamPiece(p);
};
// Detail output without the derived calculation object (shared by both modes).
const comparable = (d: Detail) =>
  JSON.stringify({ ...d, result: undefined, piece: undefined });

describe("Armado como viga — disponibilidade e compatibilidade", () => {
  it("vem desligado e projetos antigos abrem no modo atual, após migração", () => {
    const project = exampleProject();
    const legacy = JSON.parse(JSON.stringify(project));
    for (const p of legacy.pieces) {
      delete p.detailing.barArrangement;
      delete p.detailing.beamBottomCount;
      delete p.detailing.beamBottomDiameter;
    }
    const decoded = decodeProject(JSON.stringify(legacy));
    expect(decoded.schemaVersion).toBe(5);
    for (const p of decoded.pieces) {
      expect(p.detailing.barArrangement).toBe("consolo");
      expect(p.detailing.beamBottomCount).toBe(2);
      expect(p.detailing.beamBottomDiameter).toBe(10);
      expect(beamArrangementActive(p)).toBe(false);
    }
  });

  it("com o modo desligado, barras, desenho e quadro ficam idênticos", () => {
    for (const fixture of [shortFixture(), cantileverFixture()]) {
      const legacy = JSON.parse(JSON.stringify(fixture));
      delete legacy.detailing.barArrangement;
      const before = buildDetail(legacy);
      const after = buildDetail({
        ...fixture,
        detailing: { ...fixture.detailing, barArrangement: "consolo" },
      });
      expect(comparable(after)).toBe(comparable(before));
      expect(after.arrangement).toBe("consolo");
      expect(after.bars.some((b) => b.family === "positive")).toBe(false);
      const project = { ...exampleProject(), pieces: [fixture] };
      expect(steelCsv([after])).toBe(steelCsv([before]));
      expect(drawingSvg(pieceDrawing(project, after))).toBe(
        drawingSvg(pieceDrawing(project, before)),
      );
    }
  });

  it("só fica disponível quando o concreto excedente é mantido", () => {
    const p = beamPiece();
    expect(beamArrangementAvailable(p)).toBe(true);
    expect(beamArrangementActive(p)).toBe(true);
    const cut = { ...p, design: { ...p.design, excessConcrete: "remove" } };
    expect(beamArrangementAvailable(cut as Piece)).toBe(false);
    const d = buildDetail(cut as Piece);
    expect(d.arrangement).toBe("consolo");
    expect(d.bars.some((b) => b.family === "positive")).toBe(false);
    expect(d.issues.find((i) => i.code === "beam-unavailable")).toMatchObject({
      severity: "review",
    });
  });

  it("não altera o cálculo", () => {
    const p = shortFixture();
    const a = calculate(p),
      b = calculate(beamPiece(p));
    expect({ ...b, fingerprint: "" }).toEqual({ ...a, fingerprint: "" });
    expect(b.fingerprint).toBe(a.fingerprint);
  });
});

describe("Armado como viga — tirante (negativa) e positiva", () => {
  const p = deepTip();
  const g = p.geometry,
    r = p.rebar;
  const d = buildDetail(p);
  const layout = beamLayout(p);
  const ties = d.bars.filter((b) => b.family === "tie");
  const positive = d.bars.filter((b) => b.family === "positive");

  it("substitui alça/barra soldada e porta-estribos pelas barras de viga", () => {
    expect(d.arrangement).toBe("beam");
    expect(d.bars.some((b) => b.family === "welded")).toBe(false);
    expect(d.bars.filter((b) => b.family === "constructive")).toHaveLength(1);
    expect(ties.reduce((n, b) => n + b.quantity, 0)).toBe(r.tieCount);
    expect(positive).toHaveLength(1);
    expect(positive[0].quantity).toBe(p.detailing.beamBottomCount);
    expect(positive[0].diameter).toBe(p.detailing.beamBottomDiameter);
    expect(d.issues.some((i) => i.code === "beam-review")).toBe(true);
    expect(
      d.issues.some((i) => i.severity === "error" && /beam/.test(i.code)),
    ).toBe(false);
  });

  it("tirante: barra superior com dobras de 90° para baixo nas duas extremidades", () => {
    const tie = ties[0];
    const arcs = tie.path.segments.filter((s) => s.type === "arc");
    const lines = tie.path.segments.filter((s) => s.type === "line");
    expect(arcs).toHaveLength(2);
    expect(lines).toHaveLength(3);
    for (const a of arcs) expect(Math.abs(a.sweep)).toBeCloseTo(Math.PI / 2);
    const pts = samplePath(tie.path);
    const depth = d.tieRows[0].y;
    // Both ends below the top bar: bends go down.
    expect(pts[0].y).toBeGreaterThan(depth);
    expect(pts.at(-1)!.y).toBeGreaterThan(depth);
    // Cover respected at the tip face and at the back face of the support.
    const xs = pts.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(g.length - g.cover - r.tieDiameter / 2);
    expect(Math.min(...xs)).toBeCloseTo(
      -(g.columnWidth - g.cover - r.tieDiameter / 2),
    );
    // Tip leg stays above the bottom face with cover.
    const slope = (g.height - g.tipHeight) / g.length;
    const tip = pts.at(-1)!;
    expect(tip.y).toBeLessThanOrEqual(
      g.height -
        slope * tip.x -
        (g.cover + r.tieDiameter / 2) * Math.sqrt(1 + slope ** 2) +
        1e-6,
    );
    expect(tie.mandrel).toBe(mandrelDiameter(r.tieDiameter, p.materials.fyk));
  });

  it("dobras do tirante atingem lb,nec do cálculo e ao menos 8φ", () => {
    const lbNec = calculate(p).values.anchorRequired;
    expect(layout.lbNecTop).toBe(lbNec);
    for (const bar of layout.top)
      for (const end of [bar.back, bar.front]) {
        expect(end.fits).toBe(true);
        expect(end.leg).toBeGreaterThanOrEqual(8 * r.tieDiameter - 1e-9);
        expect(end.developed + 1e-6).toBeGreaterThanOrEqual(lbNec);
      }
  });

  it("positiva: barra inferior com dobras de 90° para cima nas duas extremidades", () => {
    const bar = positive[0];
    const pts = samplePath(bar.path);
    const bottom = layout.bottom;
    expect(pts[0].y).toBeLessThan(bottom.depthSupport);
    expect(pts.at(-1)!.y).toBeLessThan(bottom.depthTip);
    // Inside the tie legs, so the bends do not clash at the corners.
    const tieXs = samplePath(ties[0].path).map((v) => v.x);
    const xs = pts.map((v) => v.x);
    expect(Math.max(...xs)).toBeLessThan(Math.max(...tieXs));
    expect(Math.min(...xs)).toBeGreaterThan(Math.min(...tieXs));
    // Leg tops stay below the tie.
    expect(Math.min(...pts.map((v) => v.y))).toBeGreaterThan(d.tieRows[0].y);
    for (const end of [bottom.back, bottom.front]) {
      expect(end.leg).toBeGreaterThanOrEqual(8 * bar.diameter - 1e-9);
      if (end.fits)
        expect(end.developed + 1e-6).toBeGreaterThanOrEqual(layout.lbNecBottom);
    }
  });

  it("comprimento de corte inclui trechos retos e arcos das dobras", () => {
    for (const b of [...ties, ...positive]) {
      expect(b.exactLength).toBeCloseTo(b.path.length, 8);
      expect(b.cutLength).toBe(Math.ceil(b.exactLength - 1e-7));
      const segments = b.path.segments;
      const straight = segments
        .filter((s) => s.type === "line")
        .reduce((n, s) => n + Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0);
      const arc = segments
        .filter((s) => s.type === "arc")
        .reduce((n, s) => n + s.radius * Math.abs(s.sweep), 0);
      expect(b.exactLength).toBeCloseTo(straight + arc, 8);
    }
    const csv = steelCsv([d]);
    expect(csv).toContain("Armadura positiva dobrada");
  });

  it("aponta dobra insuficiente quando a ponta baixa não comporta lb,nec", () => {
    const tight = beamPiece(shortFixture());
    const detail = buildDetail(tight);
    expect(
      detail.issues.find((i) => i.code === "beam-top-anchor"),
    ).toMatchObject({ severity: "error" });
  });

  it("desenho, DXF e 3D trazem as dobras sem valores inválidos", () => {
    const project = { ...exampleProject(), pieces: [p] };
    const drawing = pieceDrawing(project, d);
    const svg = drawingSvg(drawing);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toContain("ARMADO COMO VIGA");
    expect(drawingDxf(drawing)).not.toMatch(/NaN/);
    const arcs = drawing.entities.filter(
      (e) => e.type === "arc" && e.layer === "ARMADURAS",
    );
    expect(arcs.length).toBeGreaterThanOrEqual(4);
    const scene = buildSceneModel(p);
    const n1 = scene.steel.filter((s) => s.id === "N1");
    const positive = scene.steel.filter((s) => s.id === "P1");
    expect(n1).toHaveLength(r.tieCount);
    expect(n1.every((s) => s.points.length === 4)).toBe(true);
    expect(positive).toHaveLength(p.detailing.beamBottomCount);
    expect(scene.steel.filter((s) => s.id === "N4")).toHaveLength(
      p.rebar.stirrupBranches,
    );
    // N4 is mandatory also in the conventional arrangement.
    expect(
      buildSceneModel(shortFixture()).steel.filter((s) => s.id === "N4"),
    ).toHaveLength(2);
  });

  it("vale também para viga em balanço", () => {
    const c = beamPiece(cantileverFixture());
    const detail = buildDetail(c);
    expect(detail.arrangement).toBe("beam");
    expect(detail.bars.some((b) => b.family === "positive")).toBe(true);
    expect(
      drawingSvg(pieceDrawing({ ...exampleProject(), pieces: [c] }, detail)),
    ).not.toMatch(/NaN/);
  });
});

describe("Armado como viga — composição com recursos atuais", () => {
  it("não usa desconto de barra soldada ausente no detalhamento", () => {
    const p = deepTip();
    p.design = {
      ...p.design,
      supportAnchor: "hook",
      hookNormalCover: 100,
      supportWeldedBar: true,
      anchorRatioFloor: true,
    };
    const values = calculate(p).values;
    const expected = Math.max(
      values.lb * values.anchorRatio,
      0.3 * values.lb,
      160,
      100,
    );
    expect(beamLayout(p).lbNecTop).toBeCloseTo(expected, 8);
    expect(calculate(p).values.anchorAlpha).toBe(0.5);
  });

  it("separa as pernas de camadas distintas e mantém a positiva abaixo da última", () => {
    const p = deepTip();
    p.geometry.tipHeight = 490;
    p.design.tieLayers = 2;
    p.design.anchorRatioFloor = true;
    const layout = beamLayout(p);
    expect(layout.top).toHaveLength(2);
    const [outer, inner] = layout.top;
    expect(inner.vertices[0].x - outer.vertices[0].x).toBeGreaterThanOrEqual(
      p.rebar.tieDiameter + 20,
    );
    expect(
      outer.vertices.at(-1)!.x - inner.vertices.at(-1)!.x,
    ).toBeGreaterThanOrEqual(p.rebar.tieDiameter + 20);
    const minDepth =
      inner.depth + (inner.diameter + layout.bottom.diameter) / 2;
    for (const point of [
      layout.bottom.vertices[0],
      layout.bottom.vertices.at(-1)!,
    ])
      expect(point.y).toBeGreaterThanOrEqual(minDepth - 1e-6);
  });

  it("bloqueia congestionamento da positiva sem mudar o cálculo", () => {
    const p = deepTip();
    p.detailing.beamBottomCount = 20;
    p.detailing.beamBottomDiameter = 25;
    expect(buildDetail(p).issues).toContainEqual(
      expect.objectContaining({
        code: "beam-bottom-spacing",
        severity: "error",
      }),
    );
    const normal = deepTip();
    expect(
      buildDetail(normal).issues.some((i) => i.code === "beam-bottom-spacing"),
    ).toBe(false);
    expect(calculate(p)).toEqual(calculate(normal));
  });
  it("confere a classe de aço da positiva e seu pino independentemente do tirante", () => {
    const p = deepTip();
    p.materials.fyk = 600;
    p.detailing.beamBottomDiameter = 20;
    expect(buildDetail(p).issues).toContainEqual(
      expect.objectContaining({
        code: "beam-bottom-mandrel",
        severity: "error",
      }),
    );
    p.detailing.beamBottomDiameter = 16;
    expect(
      buildDetail(p).issues.some((i) => i.code === "beam-bottom-mandrel"),
    ).toBe(false);
  });

  it("mede arco e perna frontal reais da positiva inclinada", () => {
    const p = deepTip();
    const bottom = beamLayout(p).bottom;
    const tail = bottom.path.segments.at(-1)!;
    expect(tail.type).toBe("line");
    if (tail.type !== "line") throw new Error("Ponta reta ausente");
    expect(Math.hypot(tail.b.x - tail.a.x, tail.b.y - tail.a.y)).toBeCloseTo(
      bottom.front.leg,
      8,
    );
    const arc = bottom.path.segments.at(-2)!;
    expect(arc.type).toBe("arc");
    if (arc.type !== "arc") throw new Error("Dobra ausente");
    const slope =
      (p.geometry.height - p.geometry.tipHeight) / p.geometry.length;
    expect(Math.abs(arc.sweep)).toBeCloseTo(Math.PI / 2 - Math.atan(slope), 8);
    expect(bottom.front.developed).toBeCloseTo(
      Math.max(bottom.front.straight, 0) +
        arc.radius * Math.abs(arc.sweep) +
        bottom.front.leg,
      8,
    );
  });

  it("inclui todas as barras positivas na projeção em planta", () => {
    const p = deepTip();
    const d = buildDetail(p);
    const drawing = pieceDrawing({ ...exampleProject(), pieces: [p] }, d);
    const bottom = beamLayout(p).bottom;
    const lines = drawing.entities.filter(
      (e) =>
        e.type === "line" &&
        e.layer === "ARMADURAS" &&
        e.dash &&
        Math.abs(e.a.y - e.b.y) < 1e-8 &&
        Math.abs(Math.abs(e.a.x - e.b.x) - bottom.span / 10) < 1e-8,
    );
    expect(lines).toHaveLength(bottom.count);
  });
});
