import { newPiece } from "../src/domain/model";
export function shortFixture() {
  const p = newPiece(1);
  p.id = "short-validation";
  p.name = "Curto-ELU";
  p.description = "Caso de regressão do motor";
  p.quantity = 1;
  p.geometry = {
    width: 400,
    height: 500,
    tipHeight: 250,
    length: 450,
    loadOffset: 300,
    cover: 25,
    columnWidth: 900,
  };
  p.loads = { vertical: 140000, horizontal: 15000, gamma: 1.4 };
  p.rebar = {
    tieCount: 4,
    tieDiameter: 16,
    stitchCount: 6,
    stitchDiameter: 6.3,
    stirrupCount: 5,
    stirrupDiameter: 6.3,
    stirrupBranches: 2,
    constructiveDiameter: 8,
  };
  p.design = {
    ...p.design,
    literatureRecommendations: false,
    forceMode: "design",
    horizontalMode: "analysis",
    horizontalJustification:
      "Resultantes de cálculo simultâneas do caso de regressão; incluem γn.",
    bearingLength: 100,
    bearingWidth: 350,
    bearingHeight: 10,
    loopInternalDiameter: 100,
    supportAnchorLength: 850,
    anchorConfinementArea: 100,
    supportRebarArea: 1000,
    inputsConfirmed: true,
  };
  return p;
}
/** Issue #6, reference case A: 300 × 400 mm, L = 600, a = 500, c = 100,
 * d′ = 41,3 mm (d = 358,7; a/d = 1,3939), C30, CA-50, γf = 1,4, γn = 1,2,
 * elastomer (H/V = 0,16), hapoio = 0, Vk = 150 kN. */
export function cantileverFixture({
  vertical = 150000,
  loadOffset = 500,
  length = 600,
  height = 400,
}: {
  vertical?: number;
  loadOffset?: number;
  length?: number;
  height?: number;
} = {}) {
  const p = newPiece(1);
  p.id = "cantilever-validation";
  p.name = "Balanco-ELU";
  p.description = "Viga em balanço 1 < a/d ≤ 2";
  p.quantity = 1;
  p.geometry = {
    ...p.geometry,
    width: 300,
    height,
    tipHeight: 200,
    length,
    loadOffset,
    cover: 25,
  };
  p.loads = { vertical, horizontal: 0, gamma: 1.4 };
  p.materials = { fck: 30, fyk: 500 };
  p.rebar = {
    tieCount: 4,
    tieDiameter: 20,
    stitchCount: 6,
    stitchDiameter: 6.3,
    stirrupCount: 5,
    stirrupDiameter: 6.3,
    stirrupBranches: 2,
    constructiveDiameter: 8,
  };
  p.design = {
    ...p.design,
    literatureRecommendations: false,
    production: "precast",
    permanentPredominant: true,
    gammaN: 1.2,
    forceMode: "characteristic",
    horizontalMode: "estimated",
    supportType: "elastomer",
    bearingLength: 100,
    bearingHeight: 0,
    fykTransverse: 500,
  };
  return p;
}
