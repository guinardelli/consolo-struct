import { describe, expect, it } from "vitest";
import {
  transverseGeometry,
  translatePath,
  pathsClash,
  projectedConstructiveSection,
  constructiveGeometry,
} from "../src/detailing/transverse";
import { samplePath, pathLength, steelMass } from "../src/detailing/geometry";
import { buildDetail } from "../src/detailing/model";
import { buildSceneModel } from "../src/visualization/model3d";
import { calculate } from "../src/domain/engine";
import { stirrupLayout } from "../src/domain/theory";
import { concreteProfile, bottomOffsetDepth } from "../src/domain/profile";
import { shortFixture } from "./fixtures";

const points = (
  p: ReturnType<typeof shortFixture>,
  s: ReturnType<typeof transverseGeometry>["sections"][number],
) =>
  samplePath(
    translatePath(s.path, s.offset, transverseGeometry(p).stirrupOffset),
    48,
  ).map((pt) => [s.x, pt.x, pt.y] as [number, number, number]);

describe("Revisão PR #41 — interferência N3/N3G", () => {
  it("o caso reportado não tem penetração entre estribo externo e grampo", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    const sections = transverseGeometry(p).sections;
    expect(sections).toHaveLength(10);
    for (let i = 0; i < sections.length; i += 2)
      expect(
        pathsClash(
          points(p, sections[i]),
          points(p, sections[i + 1]),
          p.rebar.stirrupDiameter,
        ),
      ).toBe(false);
  });

  it("mantém o passo externo e limita o passo dos grampos ao mesmo valor", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    const before = structuredClone(p),
      t = transverseGeometry(p),
      layout = stirrupLayout(p);
    expect(t.clearance).toBe(22.8);
    expect(t.innerShift).toBe(29.1);
    expect(t.problems).toEqual([]);
    expect(t.sections.filter((s) => !s.internal).map((s) => s.x)).toEqual(
      layout.positions,
    );
    const inner = t.sections
      .filter((s) => s.internal)
      .map((s) => s.x)
      .sort((a, b) => a - b);
    for (const [i, x] of inner.entries()) {
      expect(x).toBeGreaterThanOrEqual(layout.first);
      expect(x).toBeLessThanOrEqual(layout.last);
      if (i) expect(x - inner[i - 1]).toBeLessThanOrEqual(layout.pitch + 1e-8);
    }
    for (let i = 0; i < t.sections.length; i += 2)
      expect(Math.abs(t.sections[i].x - t.sections[i + 1].x)).toBeCloseTo(
        t.innerShift,
        10,
      );
    expect(p).toEqual(before);
    expect(calculate(p).values.stirrupProvided).toBeCloseTo(
      623.4490621048944,
      10,
    );
  });

  it.each(["keep", "remove"] as const)(
    "forma e eixos 3D acompanham o próprio plano no perfil %s",
    (excessConcrete) => {
      const p = shortFixture();
      p.rebar.stirrupBranches = 4;
      p.design.excessConcrete = excessConcrete;
      const t = transverseGeometry(p),
        scene = buildSceneModel(p),
        bars = scene.steel.filter((b) => b.id === "N3"),
        profile = concreteProfile(p);
      expect(bars).toHaveLength(10);
      t.sections.forEach((s, i) => {
        expect(s.height).toBe(
          bottomOffsetDepth(profile, s.x, t.stirrupOffset) - t.stirrupOffset,
        );
        expect(bars[i].points).toEqual(
          samplePath(translatePath(s.path, s.offset, t.stirrupOffset), 24).map(
            (pt) => [s.x, pt.x - p.geometry.width / 2, -pt.y],
          ),
        );
        for (const pt of samplePath(
          translatePath(s.path, s.offset, t.stirrupOffset),
          100,
        )) {
          expect(pt.x - p.rebar.stirrupDiameter / 2).toBeGreaterThanOrEqual(
            p.geometry.cover - 1e-6,
          );
          expect(pt.x + p.rebar.stirrupDiameter / 2).toBeLessThanOrEqual(
            p.geometry.width - p.geometry.cover + 1e-6,
          );
          expect(pt.y - p.rebar.stirrupDiameter / 2).toBeGreaterThanOrEqual(
            p.geometry.cover - 1e-6,
          );
          expect(pt.y).toBeLessThanOrEqual(
            bottomOffsetDepth(profile, s.x, t.stirrupOffset) + 1e-6,
          );
        }
      });
      // Distinct planes give a lower bound on distance for the complete curves, not just samples.
      for (let i = 0; i < t.sections.length; i++)
        for (let j = i + 1; j < t.sections.length; j++)
          expect(
            Math.abs(t.sections[i].x - t.sections[j].x),
          ).toBeGreaterThanOrEqual(t.innerShift - 1e-6);
    },
  );

  it("quadro mantém cinco peças de cada família, com comprimentos e massas do novo percurso", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    const t = transverseGeometry(p),
      d = buildDetail(p);
    expect(
      d.issues.filter(
        (i) =>
          i.code.startsWith("transverse-") ||
          i.code.startsWith("shape-stirrup"),
      ),
    ).toEqual([]);
    for (const [internal, family] of [
      [false, "stirrup"],
      [true, "stirrupInner"],
    ] as const) {
      const bars = d.bars.filter((b) => b.family === family),
        sections = t.sections.filter((s) => s.internal === internal);
      expect(bars.reduce((n, b) => n + b.quantity, 0)).toBe(5);
      for (const s of sections) {
        const b = bars.find((b) =>
          b.locations.some((l) => Math.abs(l.x - s.x) < 1e-8),
        )!;
        expect(b).toBeDefined();
        expect(b.path).toEqual(s.path);
        expect(b.exactLength).toBe(pathLength(s.path.segments));
        expect(b.cutLength).toBe(Math.ceil(b.exactLength - 1e-7));
      }
      const actual = bars.reduce(
        (sum, b) => sum + b.quantity * steelMass(b.cutLength, b.diameter),
        0,
      );
      const expected = sections.reduce(
        (sum, s) =>
          sum +
          steelMass(Math.ceil(s.path.length - 1e-7), p.rebar.stirrupDiameter),
        0,
      );
      expect(actual).toBeCloseTo(expected, 12);
    }
    const c = constructiveGeometry(p),
      projected = projectedConstructiveSection(c, t.sections.slice(0, 2));
    expect(projected).toHaveLength(4);
    expect(projected.map((pt) => pt.x)).toEqual([
      t.sections[0].x,
      t.sections[1].x,
      t.sections[1].x,
      t.sections[0].x,
    ]);
    for (const pt of projected)
      expect(pt.depth).toBeCloseTo(
        bottomOffsetDepth(concreteProfile(p), pt.x, c.offset),
        6,
      );
  });

  it("detecta a colisão em distribuição congestionada, sem alterar entradas ou reduzir folga", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    p.rebar.stirrupCount = 8;
    const before = structuredClone(p),
      t = transverseGeometry(p),
      d = buildDetail(p);
    expect(t.problems.map((i) => i.code)).toContain("transverse-clash");
    expect(d.issues).toContainEqual(
      expect.objectContaining({ code: "transverse-clash", severity: "error" }),
    );
    expect(d.issues).toContainEqual(
      expect.objectContaining({
        code: "transverse-clearance",
        severity: "error",
      }),
    );
    expect(p).toEqual(before);
  });

  it("sinaliza falta de cobrimento para um par que não cabe longitudinalmente", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    p.rebar.stirrupCount = 1;
    p.geometry.length = 70;
    const d = buildDetail(p);
    expect(d.issues).toContainEqual(
      expect.objectContaining({ code: "transverse-cover", severity: "error" }),
    );
  });

  it("aumentar agregado aumenta afastamento, sem mexer no passo de cálculo", () => {
    const p = shortFixture();
    p.rebar.stirrupBranches = 4;
    const layout = stirrupLayout(p),
      old = calculate(p);
    p.design.aggregate = 32;
    expect(transverseGeometry(p).innerShift).toBeCloseTo(44.7, 10);
    expect(stirrupLayout(p)).toEqual(layout);
    expect(calculate(p).values.stirrupProvided).toBe(
      old.values.stirrupProvided,
    );
    expect(
      buildDetail(p).issues.some((i) => i.code === "transverse-clearance"),
    ).toBe(true);
  });
});
