import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  area,
  decodeProject,
  exampleProject,
  fingerprint,
  newPiece,
  rebarSchema,
} from "../src/domain/model";
import { calculate, type CalculationResult } from "../src/domain/engine";
import { suggestReinforcement } from "../src/domain/autodesign";
import { stirrupLayout } from "../src/domain/theory";
import { bottomOffsetDepth, concreteProfile } from "../src/domain/profile";
import { buildDetail } from "../src/detailing/model";
import {
  samplePath,
  pathLength,
  steelMass,
  openStirrup,
} from "../src/detailing/geometry";
import {
  constructiveGeometry,
  transverseGeometry,
  sectionDepths,
  translatePath,
  pathsClash,
} from "../src/detailing/transverse";
import { pieceDrawing } from "../src/detailing/drawing";
import {
  drawingSvg,
  drawingDxf,
  drawingPdf,
  steelCsv,
} from "../src/detailing/exports";
import { toCalculationJson, toCsv, toPdf } from "../src/lib/exports";
import { buildSceneModel } from "../src/visualization/model3d";
import Drawing from "../src/components/Drawing";
import { cantileverFixture, shortFixture } from "./fixtures";

const numericResult = (r: CalculationResult) => ({
  status: r.status,
  values: r.values,
  checks: r.checks.map(({ id, status, demand, capacity }) => ({
    id,
    status,
    demand,
    capacity,
  })),
  combinations: r.combinations.map((c) => ({
    method: c.method,
    values: c.values,
    status: c.status,
    checks: c.checks.map(({ id, status, demand, capacity }) => ({
      id,
      status,
      demand,
      capacity,
    })),
  })),
});

describe("N3/N4 — esquema e migração", () => {
  it("inicia no esquema 5, com dois ramos e N4 Ø8 obrigatória", () => {
    expect(exampleProject().schemaVersion).toBe(5);
    expect(newPiece(1).rebar).toMatchObject({
      stirrupBranches: 2,
      constructiveDiameter: 8,
    });
    expect(newPiece(1).detailing).not.toHaveProperty("mounting");
  });
  it.each([1, 2, 3, 4])(
    "migra esquema %s sem renomear campos semânticos nem restaurar resultados",
    (version) => {
      const legacy = JSON.parse(JSON.stringify(exampleProject()));
      legacy.schemaVersion = version;
      for (const p of legacy.pieces) {
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
      const before = fingerprint(legacy.pieces[0]);
      const project = decodeProject(
        JSON.stringify({ ...legacy, results: { old: "untrusted" } }),
      );
      expect(project.schemaVersion).toBe(5);
      for (const p of project.pieces) {
        expect(p.rebar).toMatchObject({
          stirrupBranches: 2,
          constructiveDiameter: 8,
        });
        expect(p.detailing).not.toHaveProperty("mounting");
        expect(p.detailing).not.toHaveProperty("mountingDiameter");
        expect(p.design).toMatchObject({
          splittingCount: 3,
          splittingDiameter: 10,
          suspensionCount: 7,
          suspensionDiameter: 12.5,
        });
      }
      expect(project).not.toHaveProperty("results");
      expect(fingerprint(project.pieces[0])).not.toBe(before);
      expect(decodeProject(JSON.stringify(project))).toEqual(project);
    },
  );
  it.each([0, 1, 3, 5, 2.5, NaN])(
    "rejeita quantidade de ramos %s",
    (stirrupBranches) => {
      expect(
        rebarSchema.safeParse({ ...newPiece(1).rebar, stirrupBranches })
          .success,
      ).toBe(false);
    },
  );
  it("valida a bitola e conserva as escolhas por peça", () => {
    const project = exampleProject();
    project.pieces[0].rebar.stirrupBranches = 4;
    project.pieces[0].rebar.constructiveDiameter = 12.5;
    expect(decodeProject(JSON.stringify(project))).toEqual(project);
    for (const d of [0, 4.9, 25.1, NaN, Infinity])
      expect(
        rebarSchema.safeParse({
          ...project.pieces[0].rebar,
          constructiveDiameter: d,
        }).success,
      ).toBe(false);
  });
});

describe("N3/N4 — cálculo e sugestão", () => {
  // Numeric snapshots captured in master fa8c890 before any implementation.
  it.each([
    [
      "strut",
      "d8c2927f538b25da3612e4073b3b615a186d202678aee2a0ba07cf61badc449c",
    ],
    [
      "friction",
      "9a0551cb3588386d39550c5f5ce6d4c2c600e1cf8300cb24322ba20067d090a4",
    ],
    [
      "beam",
      "fc70d81dbe1978079e24afef3f84f1cbea662b205d3117ab9ad3e37f85c7f0e8",
    ],
  ] as const)(
    "preserva todos os números e estados anteriores — %s",
    (method, expected) => {
      const p =
        method === "beam" ? cantileverFixture({ length: 700 }) : shortFixture();
      p.materials.fck = 20;
      Object.assign(p.design, {
        production: "cast",
        forceMode: "characteristic",
        method: method === "beam" ? "auto" : method,
      });
      if (method === "friction") p.geometry.loadOffset = 180;
      p.rebar.stirrupDiameter = 5;
      expect(
        createHash("sha256")
          .update(JSON.stringify(numericResult(calculate(p))))
          .digest("hex"),
      ).toBe(expected);
    },
  );

  it.each([shortFixture, cantileverFixture])(
    "duplica somente a área de N3 e conserva demanda e passo",
    (fixture) => {
      const p = fixture(),
        original = calculate(p),
        spacing = stirrupLayout(p);
      p.rebar.stirrupBranches = 4;
      const changed = calculate(p);
      expect(changed.values.stirrupProvided).toBeCloseTo(623.4490621048944, 9);
      expect(original.values.stirrupProvided).toBeCloseTo(311.7245310524472, 9);
      for (const key of [
        "stirrupRequired",
        "vertical",
        "horizontal",
        "tieRequired",
        "beam_stirrupSpacing",
        "beam_stirrupSpacingLimit",
      ])
        expect(changed.values[key]).toBe(original.values[key]);
      expect(stirrupLayout(p)).toEqual(spacing);
      const check = changed.checks.find(
        (c) =>
          c.id === (fixture === shortFixture ? "transverse" : "beamStirrups"),
      )!;
      expect(check.capacity).toBe(changed.values.stirrupProvided);
      expect(check.detail).toContain("4 ramos efetivos");
    },
  );
  it.each([shortFixture, cantileverFixture])(
    "usa os ramos na sugestão sem alterar N4 ou demandas",
    (fixture) => {
      const input = fixture();
      if (fixture === cantileverFixture) input.geometry.length = 700;
      input.rebar.stirrupBranches = 4;
      input.rebar.constructiveDiameter = 12.5;
      const proposal = suggestReinforcement(input);
      expect(proposal.changed).toBe(true);
      const p = proposal.piece,
        v = proposal.result.values;
      const areaCount = Math.ceil(
        v.stirrupRequired / ((4 * Math.PI * p.rebar.stirrupDiameter ** 2) / 4),
      );
      expect(p.rebar.stirrupCount).toBeGreaterThanOrEqual(areaCount);
      if (fixture === shortFixture)
        expect(p.rebar.stirrupCount).toBe(Math.max(1, areaCount));
      expect(p.rebar.stirrupBranches).toBe(4);
      expect(p.rebar.constructiveDiameter).toBe(12.5);
      expect(input.rebar.stirrupCount).toBe(5);
    },
  );
  it("a bitola isolada de N4 não muda resultados resistentes ou sugestão", () => {
    const p = shortFixture(),
      before = calculate(p),
      suggestion = suggestReinforcement(p);
    p.rebar.constructiveDiameter = 25;
    const after = calculate(p),
      other = suggestReinforcement(p);
    expect(numericResult(after)).toEqual(numericResult(before));
    expect(other.piece.rebar).toEqual({
      ...suggestion.piece.rebar,
      constructiveDiameter: 25,
    });
    expect(numericResult(other.result)).toEqual(
      numericResult(suggestion.result),
    );
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
  it("preserva fendilhamento/suspensão nos campos e áreas exclusivos", () => {
    const p = shortFixture();
    p.design.loadType = "indirect";
    Object.assign(p.design, {
      splittingCount: 3,
      splittingDiameter: 10,
      suspensionCount: 7,
      suspensionDiameter: 12.5,
    });
    const original = calculate(p);
    p.rebar.stirrupBranches = 4;
    p.rebar.constructiveDiameter = 16;
    const r = calculate(p);
    expect(r.values.splittingProvided).toBe(area(6, 10));
    expect(r.values.suspensionProvided).toBe(area(14, 12.5));
    for (const id of ["splitting", "suspension"])
      expect(r.checks.find((c) => c.id === id)).toEqual(
        original.checks.find((c) => c.id === id),
      );
    expect(r.assumptions.join()).toContain(
      "N5 (fendilhamento) e N6 (suspensão)",
    );
    expect(r.checks.find((c) => c.id === "transverse")?.detail).toContain(
      "N6 de suspensão",
    );
  });
});

describe("N3/N4 — geometria física e saídas", () => {
  it.each([6.3, 10, 16])(
    "grampo Ø%s conserva duas pontas retas completas e o desenvolvimento",
    (diameter) => {
      const mandrel = diameter <= 10 ? 3 * diameter : 5 * diameter,
        radius = (mandrel + diameter) / 2,
        tail = Math.max(5 * diameter, 50);
      const path = openStirrup(1000, 800, diameter, mandrel);
      expect(path.valid).toBe(true);
      expect(path.length).toBeCloseTo(
        2600 + (2.5 * Math.PI - 6) * radius + 2 * tail,
        8,
      );
      for (const segment of [path.segments[0], path.segments.at(-1)!]) {
        expect(segment.type).toBe("line");
        if (segment.type === "line")
          expect(
            Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y),
          ).toBeCloseTo(tail, 10);
      }
    },
  );

  it.each([2, 4] as const)(
    "produz %s barras N4 e somente as peças físicas de N3 configuradas",
    (branches) => {
      const p = shortFixture();
      p.rebar.stirrupBranches = branches;
      const d = buildDetail(p);
      const n4 = d.bars.filter((b) => b.family === "constructive");
      expect(n4).toHaveLength(1);
      expect(n4[0]).toMatchObject({
        mark: "N4",
        quantity: branches,
        diameter: 8,
      });
      expect(d.bars.some((b) => (b.family as string) === "mounting")).toBe(
        false,
      );
      expect(
        d.bars
          .filter((b) => b.family === "stirrup")
          .reduce((n, b) => n + b.quantity, 0),
      ).toBe(5);
      expect(
        d.bars
          .filter((b) => b.family === "stirrupInner")
          .reduce((n, b) => n + b.quantity, 0),
      ).toBe(branches === 4 ? 5 : 0);
      expect(n4[0].exactLength).toBe(pathLength(n4[0].path.segments));
      expect(
        d.issues.filter((i) => i.code.startsWith("constructive-")),
      ).toEqual([]);
      const t = transverseGeometry(p);
      const drawing = pieceDrawing({ ...exampleProject(), pieces: [p] }, d);
      for (const section of t.sections) {
        // The internal U keeps its own width also in the plan projection.
        expect(
          drawing.entities.some(
            (e) =>
              e.type === "line" &&
              e.layer === "ARMADURAS" &&
              Math.abs(e.a.x - e.b.x) < 1e-8 &&
              Math.abs(Math.abs(e.a.y - e.b.y) - section.width / 10) < 1e-8,
          ),
        ).toBe(true);
        expect(section.path.valid).toBe(true);
        if (section.internal) {
          const lines = section.path.segments.filter((s) => s.type === "line");
          for (const line of [lines[0], lines.at(-1)!])
            expect(
              Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y),
            ).toBeCloseTo(Math.max(5 * p.rebar.stirrupDiameter, 50), 10);
        }
        const arcs = section.path.segments.filter((s) => s.type === "arc");
        expect(
          arcs.filter(
            (s) => Math.abs(Math.abs(s.sweep) - (3 * Math.PI) / 4) < 1e-8,
          ),
        ).toHaveLength(2);
      }
    },
  );
  it.each(["keep", "remove"] as const)(
    "segue o perfil %s, com afastamento normal e dobra frontal vertical",
    (excessConcrete) => {
      const p = shortFixture();
      Object.assign(p.geometry, {
        height: 800,
        tipHeight: 400,
        length: 450,
        loadOffset: 390,
      });
      p.design.excessConcrete = excessConcrete;
      p.rebar.stirrupBranches = 4;
      const n4 = constructiveGeometry(p),
        profile = concreteProfile(p);
      expect(n4.path.valid).toBe(true);
      expect(n4.problems).toEqual([]);
      expect(n4.vertices[0].x).toBeLessThan(0);
      expect(n4.vertices.at(-1)!.x).toBe(n4.vertices.at(-2)!.x);
      expect(n4.vertices.at(-1)!.y).toBeLessThan(n4.vertices.at(-2)!.y);
      for (const pt of samplePath(n4.path, 200)) {
        expect(pt.y).toBeGreaterThanOrEqual(p.geometry.cover + n4.diameter / 2);
        if (pt.x >= 0)
          expect(pt.y).toBeLessThanOrEqual(
            bottomOffsetDepth(
              profile,
              pt.x,
              p.geometry.cover + n4.diameter / 2,
            ) + 1e-7,
          );
      }
      const points = sectionDepths(n4.path, 180);
      expect(points).toHaveLength(1);
      expect(points[0]).toBeCloseTo(
        bottomOffsetDepth(profile, 180, n4.offset),
        5,
      );
    },
  );
  it("as vistas 2D e 3D usam o mesmo eixo e o mesmo corte da N4 fabricada", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    const n4 = constructiveGeometry(p),
      d = buildDetail(p),
      scene = buildSceneModel(p);
    expect(d.bars.find((b) => b.family === "constructive")!.path).toEqual(
      n4.path,
    );
    const paths = scene.steel.filter((b) => b.id === "N4");
    expect(paths).toHaveLength(4);
    paths.forEach((bar, i) =>
      expect(bar.points).toEqual(
        samplePath(n4.path, 24).map((pt) => [
          pt.x,
          n4.positions[i] - p.geometry.width / 2,
          -pt.y,
        ]),
      ),
    );
    const props = {
      piece: p,
      rebar: true,
      dimensions: false,
      grid: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      forces: false,
      selectedBar: "N4",
      onDimension: () => {},
      onBar: () => {},
    };
    const elevation = renderToStaticMarkup(createElement(Drawing, props));
    expect(elevation.match(/data-transverse-position=/g)).toHaveLength(4);
    const section = renderToStaticMarkup(
      createElement(Drawing, { ...props, section: true }),
    );
    expect(section).toContain('data-n3-part="grampo"');
    expect(
      section.match(/steel-N4[^]*?<\/g>/)?.[0].match(/<circle/g),
    ).toHaveLength(4);
    const transverse = transverseGeometry(p);
    scene.steel
      .filter((b) => b.id === "N3")
      .forEach((bar, i) => {
        const section = transverse.sections[i];
        expect(bar.points).toEqual(
          samplePath(
            translatePath(
              section.path,
              section.offset,
              transverse.stirrupOffset,
            ),
            24,
          ).map((pt) => [section.x, pt.x - p.geometry.width / 2, -pt.y]),
        );
      });
  });
  it("não reduz bitola/mandril/cobrimento quando N4 não cabe", () => {
    const p = shortFixture();
    Object.assign(p.geometry, { width: 100, height: 200, tipHeight: 100 });
    p.rebar.constructiveDiameter = 25;
    p.rebar.stirrupBranches = 4;
    const before = structuredClone(p),
      d = buildDetail(p);
    expect(
      d.issues.some(
        (i) => i.severity === "error" && i.code.startsWith("constructive-"),
      ),
    ).toBe(true);
    expect(p).toEqual(before);
    expect(constructiveGeometry(p).mandrel).toBeGreaterThanOrEqual(5 * 25);
  });
  it("detecta invasão de N1 inclusive na perna de ancoragem no suporte", () => {
    const p = shortFixture();
    p.design.supportAnchor = "hook";
    p.detailing.supportHookProjection = 250;
    p.detailing.supportHookTail = 600;
    expect(buildDetail(p).issues).toContainEqual(
      expect.objectContaining({
        code: "constructive-tie-clash",
        severity: "error",
      }),
    );
    expect(
      pathsClash(
        [
          [0, 0, 0],
          [10, 0, 0],
        ],
        [
          [5, -10, 0],
          [5, 10, 0],
        ],
        1,
      ),
    ).toBe(true);
  });
  it("detecta colisão no arco de N1 mesmo sem perna reta no gancho", () => {
    const p = shortFixture();
    Object.assign(p.geometry, { height: 110, tipHeight: 100 });
    p.design.supportAnchor = "hook";
    p.detailing.supportHookProjection = 250;
    p.detailing.supportHookTail = 0;
    expect(buildDetail(p).issues).toContainEqual(
      expect.objectContaining({
        code: "constructive-tie-clash",
        severity: "error",
      }),
    );
  });
  it("preserva positiva P1 e informa a interferência com N4 sem duplicar porta-estribos", () => {
    const p = shortFixture();
    p.detailing.barArrangement = "beam";
    const d = buildDetail(p);
    expect(d.bars.find((b) => b.family === "positive")?.mark).toBe("P1");
    expect(d.bars.filter((b) => b.family === "constructive")).toHaveLength(1);
    expect(buildSceneModel(p).steel.filter((b) => b.id === "P1")).toHaveLength(
      2,
    );
    expect(d.issues.some((i) => i.code === "constructive-positive-clash")).toBe(
      true,
    );
  });
  it.each([2, 4] as const)(
    "quadro, CSV, SVG, DXF, PDF e auditoria registram N4 com %s barras",
    async (branches) => {
      const p = shortFixture();
      p.rebar.stirrupBranches = branches;
      p.quantity = 3;
      const project = { ...exampleProject(), pieces: [p] },
        d = buildDetail(p),
        bar = d.bars.find((b) => b.family === "constructive")!;
      const csv = steelCsv([d]),
        row = csv.split("\r\n").find((line) => line.includes('"N4"'))!;
      expect(row).toContain(`"8";"${branches}";"${branches * 3}"`);
      expect(row).toContain((bar.cutLength / 10).toFixed(1).replace(".", ","));
      expect(row).toContain(
        (steelMass(bar.cutLength, 8) * branches * 3)
          .toFixed(3)
          .replace(".", ","),
      );
      const drawing = pieceDrawing(project, d);
      expect(drawingSvg(drawing)).toContain("N4");
      expect(drawingDxf(drawing)).toContain("N4");
      if (branches === 4) {
        expect(csv).toContain('"N3G-1"');
        expect(drawingSvg(drawing)).toContain("Grampo interno");
      }
      const pdf = await drawingPdf([drawing]);
      const streams = [
        ...Buffer.from(pdf)
          .toString("latin1")
          .matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g),
      ]
        .map((m) => {
          try {
            return inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
          } catch {
            return m[1];
          }
        })
        .join("\n");
      expect(streams).toContain("N4");
      expect(new TextDecoder().decode(await toPdf(project, p))).toContain(
        "N4 construtiva",
      );
      const audit = JSON.parse(toCalculationJson(project, p));
      expect(audit.input.rebar).toMatchObject({
        stirrupBranches: branches,
        constructiveDiameter: 8,
      });
      expect(audit.result.values.stirrupProvided).toBeCloseTo(
        area(branches * 5, 6.3),
        10,
      );
      expect(toCsv(project)).toContain("N4 massa total");
      expect(d.totalMass).toBeCloseTo(d.mass * 3, 10);
    },
  );
});
