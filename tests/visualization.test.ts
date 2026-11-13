import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { newPiece, fingerprint } from "../src/domain/model";
import { cantileverFixture } from "./fixtures";
import { buildSceneModel } from "../src/visualization/model3d";
import {
  corbelGeometry,
  createModelGroup,
  disposeGroup,
} from "../src/visualization/scene3d";
function meshVolume(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  let v = 0;
  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i),
      b = new THREE.Vector3().fromBufferAttribute(position, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}
describe("Geometria técnica 3D", () => {
  it("extruda o trapézio em mm, com Z vertical e Y transversal", () => {
    const m = buildSceneModel(newPiece(1)),
      g = corbelGeometry(m);
    expect(g.boundingBox!.min.toArray()).toEqual([0, -150, -400]);
    expect(g.boundingBox!.max.x).toBe(250);
    expect(g.boundingBox!.max.y).toBe(150);
    expect(g.boundingBox!.max.z).toBeCloseTo(0, 8);
    expect(meshVolume(g)).toBeCloseTo(22500000, 3);
    g.dispose();
  });
  it("a largura parametrizada modifica a profundidade e o volume do sólido", () => {
    const p = newPiece(1);
    p.geometry.width = 450;
    const g = corbelGeometry(buildSceneModel(p));
    expect(g.boundingBox!.min.y).toBe(-225);
    expect(g.boundingBox!.max.y).toBe(225);
    expect(meshVolume(g)).toBeCloseTo(33750000, 3);
    g.dispose();
  });
  it("mantém as seis cotas ligadas aos valores atuais da peça", () => {
    const p = newPiece(1);
    p.geometry.length = 325;
    const m = buildSceneModel(p);
    expect(m.dimensions.map((d) => d.id).sort()).toEqual(
      [
        "columnWidth",
        "height",
        "length",
        "loadOffset",
        "tipHeight",
        "width",
      ].sort(),
    );
    expect(m.dimensions.find((d) => d.id === "length")!.label).toBe(
      "L = 32,5 cm",
    );
    for (const d of m.dimensions) expect(d.value).toBe(p.geometry[d.id]);
  });
  it("cargas características conservam valor, direção e altura de aplicação", () => {
    const p = newPiece(1),
      m = buildSceneModel(p);
    const V = m.loads.find((l) => l.id === "vertical")!,
      H = m.loads.find((l) => l.id === "horizontal")!;
    expect(V.value).toBe(350000);
    expect(V.label).toBe("Vk = 350,0 kN");
    expect(V.from[2]).toBeGreaterThan(V.to[2]);
    expect(V.to).toEqual([125, 0, 10]);
    expect(H.label).toContain("H adicional");
    expect(H.to[0]).toBeGreaterThan(H.from[0]);
  });
  it("a seta horizontal negativa não é desenhada para o lado positivo", () => {
    const p = newPiece(1);
    p.loads.horizontal = -50000;
    const H = buildSceneModel(p).loads.find((l) => l.id === "horizontal")!;
    expect(H.to[0]).toBeLessThan(H.from[0]);
    expect(H.label).toContain("-50,0");
    p.loads.horizontal = 0;
    expect(buildSceneModel(p).loads).toHaveLength(1);
  });
  it("identifica as forças já de cálculo sem aplicar outra majoração", () => {
    const p = newPiece(1);
    p.design.forceMode = "design";
    p.design.horizontalMode = "analysis";
    const m = buildSceneModel(p);
    expect(m.loads[0].label).toBe("Vd = 350,0 kN");
    expect(m.loads[1].label).toBe("Hd total = 40,0 kN");
  });
  it("posiciona ramos do tirante por camada e conta estribos separadamente", () => {
    const p = newPiece(1);
    p.rebar.tieCount = 6;
    p.design.tieLayers = 2;
    const m = buildSceneModel(p),
      ties = m.steel.filter((b) => b.id === "N1");
    expect(ties).toHaveLength(6);
    expect(ties.slice(0, 3).every((b) => b.points[0][2] === -41.3)).toBe(true);
    expect(ties.slice(3).every((b) => b.points[0][2] === -81.3)).toBe(true);
    for (const path of m.steel.filter((b) => b.id === "N2"))
      expect(path.points[0]).toEqual(path.points.at(-1));
  });
  it("gera materiais e grupos finitos nas duas opções de renderização", () => {
    const m = buildSceneModel(newPiece(1));
    for (const lightweight of [false, true]) {
      const group = createModelGroup(m, {
        dark: false,
        rebar: true,
        dimensions: true,
        forces: true,
        grid: true,
        transparent: true,
        selectedBar: "N1",
        lightweight,
      });
      let bars = 0;
      group.traverse((o) => {
        if (o.userData.barId) bars++;
        expect(o.position.toArray().every(Number.isFinite)).toBe(true);
      });
      expect(bars).toBe(m.steel.length);
      disposeGroup(group);
    }
  });
  it("a representação não altera entradas nem a assinatura do cálculo", () => {
    const p = newPiece(1),
      before = JSON.stringify(p),
      f = fingerprint(p);
    buildSceneModel(p);
    expect(JSON.stringify(p)).toBe(before);
    expect(fingerprint(p)).toBe(f);
  });
});
describe("Viga em balanço (1 < a/d ≤ 2)", () => {
  it("monta a cena 3D de uma peça calculada como viga em balanço", () => {
    const m = buildSceneModel(cantileverFixture());
    const numbers: number[] = [];
    JSON.stringify(m, (_k, v) => (typeof v === "number" && numbers.push(v), v));
    expect(numbers.every(Number.isFinite)).toBe(true);
    const g = corbelGeometry(m);
    expect(g.boundingBox!.max.x).toBe(600);
    expect(meshVolume(g)).toBeGreaterThan(0);
    const group = createModelGroup(m, {
      dark: false,
      rebar: true,
      dimensions: true,
      forces: true,
      grid: true,
      transparent: true,
      selectedBar: "N1",
      lightweight: false,
    });
    let bars = 0;
    group.traverse((o) => {
      if (o.userData.barId) bars++;
      expect(o.position.toArray().every(Number.isFinite)).toBe(true);
    });
    expect(bars).toBe(m.steel.length);
    disposeGroup(group);
    g.dispose();
  });
});
