import { describe, expect, it } from "vitest";
import { calculate } from "../src/domain/engine";
import { suggestReinforcement } from "../src/domain/autodesign";
import { concreteProfile, pieceVolume } from "../src/domain/profile";
import { buildDetail } from "../src/detailing/model";
import { samplePath } from "../src/detailing/geometry";
import { buildSceneModel } from "../src/visualization/model3d";
import { shortFixture } from "./fixtures";

function distanceToFace(
  x: number,
  depth: number,
  p: ReturnType<typeof concreteProfile>,
) {
  return Math.min(
    ...p.bottom.slice(1).map((b, i) => {
      const a = p.bottom[i],
        dx = b.x - a.x,
        dy = b.depth - a.depth;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - a.x) * dx + (depth - a.depth) * dy) / (dx * dx + dy * dy),
        ),
      );
      return Math.hypot(x - a.x - t * dx, depth - a.depth - t * dy);
    }),
  );
}
const cutPiece = () => {
  const p = shortFixture();
  p.design.excessConcrete = "remove";
  return p;
};

describe("Composição do recorte com armaduras e peso próprio", () => {
  it("integra área e primeiro momento por faixas, independentemente do polígono", () => {
    const p = cutPiece(),
      profile = concreteProfile(p);
    let area = 0,
      moment = 0;
    for (let i = 1; i < profile.bottom.length; i++) {
      const a = profile.bottom[i - 1],
        b = profile.bottom[i],
        width = b.x - a.x;
      area += (width * (a.depth + b.depth)) / 2;
      moment +=
        (a.x * width * (a.depth + b.depth)) / 2 +
        (width * width * (a.depth + 2 * b.depth)) / 6;
    }
    expect(profile.area).toBeCloseTo(area, 8);
    expect(profile.centroidX).toBeCloseTo(moment / area, 10);
  });

  it.each([5, 6.3, 10, 16])(
    "mantém cobrimento nas dobras de N4 φ%s",
    (diameter) => {
      const p = cutPiece();
      Object.assign(p.geometry, {
        height: 800,
        tipHeight: 400,
        length: 450,
        loadOffset: 390,
      });
      p.rebar.constructiveDiameter = diameter;
      const profile = concreteProfile(p),
        detail = buildDetail(p);
      const mounting = detail.bars.find((b) => b.family === "constructive")!;
      expect(mounting.path.valid).toBe(true);
      for (const point of samplePath(mounting.path, 100)) {
        if (point.x < 0 || point.x > p.geometry.length) continue;
        expect(
          distanceToFace(point.x, point.y, profile) - diameter / 2,
        ).toBeGreaterThanOrEqual(p.geometry.cover - 1e-8);
      }
      for (const bar of buildSceneModel(p).steel.filter(
        (b) => b.id === "N2" || b.id === "N3",
      ))
        for (const [x, , z] of bar.points) {
          if (x < 0) continue;
          expect(
            distanceToFace(x, -z, profile) - bar.diameter / 2,
          ).toBeGreaterThanOrEqual(p.geometry.cover - 1e-8);
        }
    },
  );

  it.each([1, 1000, 140000])(
    "recalcula perfil e peso por candidato com Vk=%s N, sem ciclo",
    (vertical) => {
      const p = cutPiece();
      Object.assign(p.design, {
        includeSelfWeight: true,
        forceMode: "characteristic",
      });
      Object.assign(p.loads, { vertical, horizontal: 0 });
      const original = structuredClone(p),
        profile = concreteProfile(p),
        r = calculate(p);
      expect(r.values.stm_tangent).toBe(profile.cutLine!.tangent);
      expect(r.values.stm_strutWidth).toBe(profile.cutLine!.strutWidth);
      expect(r.values.selfWeight).toBe(pieceVolume(p) * 25000);
      const proposal = suggestReinforcement(p);
      expect(proposal.changed).toBe(true);
      expect(p).toEqual(original);
      expect(proposal.piece.design.excessConcrete).toBe("remove");
      expect(proposal.result).toEqual(calculate(proposal.piece));
      expect(proposal.result.values.selfWeight).toBe(
        pieceVolume(proposal.piece) * 25000,
      );
      expect(proposal.result.values.stm_tangent).toBe(
        concreteProfile(proposal.piece).cutLine!.tangent,
      );
      expect(suggestReinforcement(p)).toEqual(proposal);
    },
  );
});
