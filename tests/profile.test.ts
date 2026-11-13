import { describe, expect, it } from "vitest";
import { calculate, strutTieModel, tieLayout } from "../src/domain/engine";
import {
  decodeProject,
  exampleProject,
  newPiece,
  volume,
  type Piece,
} from "../src/domain/model";
import {
  bottomDepth,
  bottomOffsetDepth,
  bottomReach,
  concreteProfile,
  pieceVolume,
} from "../src/domain/profile";
import { reactionGeometry } from "../src/domain/theory";
import { buildDetail } from "../src/detailing/model";
import { pieceDrawing } from "../src/detailing/drawing";
import { buildSceneModel } from "../src/visualization/model3d";
import { piecePoints } from "../src/lib/exports";
import { cantileverFixture, shortFixture } from "./fixtures";

const withOption = (p: Piece, value: "keep" | "remove"): Piece => ({
  ...p,
  design: { ...p.design, excessConcrete: value },
});
const strutLowerEdge = (p: Piece) => {
  const layout = tieLayout(p),
    reaction = reactionGeometry(p);
  const m = strutTieModel({
    vertical: 1,
    horizontal: 0,
    a: reaction.a,
    d: layout.d,
    dPrime: layout.dPrime,
    bearingLength: reaction.effectiveLength,
    width: p.design.bearingWidth,
    loadHeight: p.design.bearingHeight,
  });
  return (x: number) =>
    layout.d +
    (m.strutWidth / 2) * Math.sqrt(1 + m.tangent ** 2) -
    m.tangent * x;
};
// a/d ≈ 0,61: resolved to the strut-and-tie model (newPiece alone is shear-friction).
const strutPiece = () => {
  const p = newPiece(1);
  p.geometry = { ...p.geometry, length: 320, loadOffset: 220 };
  return p;
};
const caseChecks = (p: Piece) => calculate(p).combinations[0].checks;
const withoutNote = (p: Piece) =>
  caseChecks(p).filter((c) => c.id !== "excessConcrete");

describe("Concreto excedente — opção manter/remover", () => {
  it("usa “manter” por padrão e em projetos salvos sem o campo", () => {
    expect(newPiece(1).design.excessConcrete).toBe("keep");
    const project = exampleProject();
    for (const piece of project.pieces)
      delete (piece.design as Partial<Piece["design"]>).excessConcrete;
    const decoded = decodeProject(JSON.stringify(project));
    expect(
      decoded.pieces.every((p) => p.design.excessConcrete === "keep"),
    ).toBe(true);
  });

  it("“manter” preserva a geometria original e o volume, sem nota", () => {
    const p = shortFixture();
    const profile = concreteProfile(p);
    expect(profile.status).toBe("kept");
    expect(profile.bottom).toEqual([
      { x: 0, depth: p.geometry.height },
      { x: p.geometry.length, depth: p.geometry.tipHeight },
    ]);
    expect(pieceVolume(p)).toBe(volume(p.geometry));
    expect(caseChecks(p).some((c) => c.id === "excessConcrete")).toBe(false);
    const slope =
      (p.geometry.height - p.geometry.tipHeight) / p.geometry.length;
    for (const x of [0, 50, 200, 449])
      expect(bottomOffsetDepth(profile, x, 30)).toBe(
        p.geometry.height - slope * x - 30 * Math.sqrt(1 + slope ** 2),
      );
  });

  it("“remover” recorta abaixo da biela, mantendo h no suporte e h₂ na ponta", () => {
    for (const base of [strutPiece(), shortFixture()]) {
      const p = withOption(base, "remove");
      const g = p.geometry;
      const profile = concreteProfile(p);
      expect(profile.status).toBe("removed");
      expect(profile.bottom[0]).toEqual({ x: 0, depth: g.height });
      expect(profile.bottom.at(-1)).toEqual({
        x: g.length,
        depth: g.tipHeight,
      });
      expect(profile.removedArea).toBeGreaterThan(0);
      expect(pieceVolume(p)).toBeLessThan(volume(g));
      expect(pieceVolume(p)).toBeCloseTo(
        volume(g) - (g.width * profile.removedArea) / 1e9,
        12,
      );
      const edge = strutLowerEdge(p);
      const original = (x: number) =>
        g.height - ((g.height - g.tipHeight) * x) / g.length;
      for (let i = 0; i <= 200; i++) {
        const x = (g.length * i) / 200,
          depth = bottomDepth(profile, x);
        // Never adds concrete, never goes above h2, and never cuts the strut.
        expect(depth).toBeLessThanOrEqual(original(x) + 1e-9);
        expect(depth).toBeGreaterThanOrEqual(g.tipHeight - 1e-9);
        expect(depth).toBeGreaterThanOrEqual(
          Math.min(original(x), edge(x)) - 1e-9,
        );
      }
    }
  });

  it("não altera nenhuma verificação além da nota de conferência", () => {
    for (const base of [strutPiece(), shortFixture()]) {
      const kept = withoutNote(base);
      const removed = caseChecks(withOption(base, "remove"));
      expect(removed.filter((c) => c.id !== "excessConcrete")).toEqual(kept);
      const note = removed.find((c) => c.id === "excessConcrete");
      expect(note?.status).toBe("review");
    }
  });

  it("reduz o peso próprio automático conforme o volume recortado", () => {
    const base = strutPiece();
    base.design = { ...base.design, includeSelfWeight: true };
    const kept = calculate(base).combinations[0];
    const removed = calculate(withOption(base, "remove")).combinations[0];
    expect(removed.values.vertical).toBeLessThan(kept.values.vertical);
  });

  it("não recorta fora do modelo de bielas e tirantes nem sem região dispensável", () => {
    const friction = withOption(newPiece(1), "remove");
    expect(concreteProfile(friction).status).toBe("notStrut");
    expect(
      caseChecks(friction).find((c) => c.id === "excessConcrete")?.status,
    ).toBe("na");
    const beam = withOption(cantileverFixture(), "remove");
    expect(concreteProfile(beam).status).toBe("notStrut");
    expect(pieceVolume(beam)).toBe(volume(beam.geometry));
    const rectangular = withOption(strutPiece(), "remove");
    rectangular.geometry.tipHeight = rectangular.geometry.height;
    expect(concreteProfile(rectangular).status).toBe("nothingToRemove");
  });

  it("propaga o recorte ao detalhamento, desenhos, 3D e exportações", () => {
    const base = strutPiece();
    const p = withOption(base, "remove");
    const profile = concreteProfile(p);
    const keptDetail = buildDetail(base),
      cutDetail = buildDetail(p);
    // N4 is new and can require a longer front bend after cutting; keep all prior errors.
    expect(
      cutDetail.issues.filter(
        (i) => i.severity === "error" && !i.code.startsWith("constructive-"),
      ),
    ).toEqual(keptDetail.issues.filter((i) => i.severity === "error"));
    const heights = (d: typeof keptDetail) =>
      d.bars.filter((b) => b.family === "stirrup").map((b) => b.height);
    heights(cutDetail).forEach((h, i) =>
      expect(h).toBeLessThanOrEqual(heights(keptDetail)[i] + 1e-9),
    );
    // Each stirrup keeps the cover to the cut face.
    const offset = p.geometry.cover + p.rebar.stirrupDiameter / 2;
    for (const bar of cutDetail.bars.filter((b) => b.family === "stirrup"))
      expect(bar.height + offset).toBeCloseTo(
        bottomOffsetDepth(profile, bar.locations[0].x, offset),
        9,
      );
    for (const bar of cutDetail.bars.filter(
      (b) => b.family === "stitch" || b.family === "lower",
    ))
      expect(bar.locations[0].x).toBeLessThanOrEqual(
        bottomReach(
          profile,
          bar.locations[0].z,
          p.geometry.cover + p.rebar.stitchDiameter / 2,
          p.geometry.length,
        ) + 1e-9,
      );
    expect(piecePoints(p)).toHaveLength(2 + profile.bottom.length);
    expect(buildSceneModel(p).profile).toEqual(piecePoints(p));
    const drawing = pieceDrawing(exampleProject(), cutDetail);
    expect(JSON.stringify(drawing)).toContain("Face inferior recortada");
  });
});
