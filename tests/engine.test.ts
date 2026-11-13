import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  anchorageAlpha,
  calculate,
  cantileverBeamModel,
  materialProperties,
  minimumFlexuralSteel,
  strutTieModel,
  tieLayout,
} from "../src/domain/engine";
import { suggestReinforcement } from "../src/domain/autodesign";
import {
  newPiece,
  area,
  decodeProject,
  exampleProject,
  fingerprint,
} from "../src/domain/model";
import { cantileverFixture, shortFixture } from "./fixtures";
const c = (p: ReturnType<typeof newPiece>, id: string) =>
  calculate(p).checks.find((x) => x.id === id)!;
describe("Referências independentes", () => {
  it("reproduz Araújo v.4 p.122–125 sem arredondar a tangente", () => {
    const m = strutTieModel({
      vertical: 140000,
      horizontal: 0,
      a: 100,
      d: 250,
      dPrime: 50,
      bearingLength: 100,
      width: 200,
    });
    expect(m.tangent).toBeCloseTo(4 / 3, 12);
    expect(m.sin).toBeCloseTo(0.8, 12);
    expect(m.cos).toBeCloseTo(0.6, 12);
    expect(m.strutWidth).toBeCloseTo(140, 10);
    expect(m.z).toBeCloseTo(400 / 3, 10);
    expect(m.tieForce).toBeCloseTo(105000, 8);
    expect(m.strutStress).toBeCloseTo(6.25, 10);
    expect(m.bearingStress).toBe(7);
    expect(m.tieForce / (500 / 1.15) / 100).toBeCloseTo(2.415, 10);
    expect(m.momentResidual).toBeCloseTo(0, 6);
  });
  it("não considera suficientes 3 estribos de 5 mm para 1,21 cm²", () => {
    expect(area(6, 5) / 100).toBeCloseTo(1.178097245, 8);
    expect(area(6, 5)).toBeLessThan(121);
  });
  it("fecha o equilíbrio com H e sua altura de aplicação", () => {
    const m = strutTieModel({
      vertical: 140000,
      horizontal: 20000,
      a: 100,
      d: 250,
      dPrime: 50,
      bearingLength: 100,
      width: 200,
      loadHeight: 20,
    });
    // z=133.333; T=105000+20000*(1+70/133.333)=135500 N.
    expect(m.tieForce).toBeCloseTo(135500, 8);
    expect(m.strutForce).toBeCloseTo(192500, 8);
    expect(m.momentResidual).toBeCloseTo(0, 6);
  });
  it("usa limite atual 0,27 alpha_v2 fcd no exemplo muito curto", () => {
    const r = calculate(newPiece(1)),
      v = r.values;
    expect(v.d).toBeCloseTo(358.7, 10);
    expect(v.vertical).toBeCloseTo(588000, 8);
    expect(v.horizontal).toBeCloseTo(161280, 8);
    expect(v.tieFriction).toBeCloseTo(1143.744, 8);
    expect(v.tauLimitConcrete).toBeCloseTo(5.09142857142857, 10);
    expect(v.tau).toBeCloseTo(588000 / (300 * 358.7), 10);
    expect(c(newPiece(1), "strut").status).toBe("fail");
  });
  it("distingue área total da costura de área por unidade de altura", () => {
    const p = shortFixture(),
      r = calculate(p),
      v = r.values;
    expect(v.stitchRequired).toBeCloseTo(0.4 * area(4, 16), 10);
    expect(v.stitchRate).toBeCloseTo(v.stitchRequired / ((2 * v.d) / 3), 10);
    expect(v.stitchProvided).toBeCloseTo(area(12, 6.3), 10);
  });
  it("aplica a resistência limitada a 8 MPa na faixa resistente alta", () => {
    const p = newPiece(1);
    p.materials.fck = 90;
    p.rebar.tieCount = 8;
    p.design.tieLayers = 2;
    expect(calculate(p).values.tauLimit).toBe(8);
  });
});
describe("Ações, materiais e consistência", () => {
  it("aprova o caso curto exclusivamente nas verificações implementadas", () => {
    const r = calculate(shortFixture());
    expect(r.reasons).toEqual([]);
    expect(r.checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(r.status).toBe("pass");
  });
  it("não majora novamente ações de cálculo", () => {
    const p = shortFixture(),
      v = calculate(p).values;
    expect(v.vertical).toBe(140000);
    expect(v.horizontal).toBe(15000);
    expect(v.factor).toBe(1);
  });
  it("adota gamma n mínimo 1,2 e registra a divergência para fábrica", () => {
    const p = newPiece(1);
    p.design.production = "factory";
    const v = calculate(p).values;
    expect(v.gammaN9062).toBe(1);
    expect(v.gammaN).toBe(1.2);
  });
  it("aceita gamma n superior por opção explícita", () => {
    const p = newPiece(1);
    p.design.gammaN = 1.4;
    expect(calculate(p).values.factor).toBeCloseTo(1.96);
  });
  it.each([
    ["dry", 0.8],
    ["mortar", 0.5],
    ["elastomer", 0.16],
    ["ptfe", 0.08],
    ["steel", 0.25],
    ["concreteSteel", 0.4],
  ] as const)("coeficiente de apoio %s", (type, coef) => {
    const p = newPiece(1);
    p.design.supportType = type;
    p.design.literatureRecommendations = false;
    p.loads.horizontal = 0;
    const v = calculate(p).values;
    expect(v.horizontal / v.vertical).toBeCloseTo(coef, 12);
  });
  it("ignora H favorável e não subtrai da estimativa", () => {
    const p = newPiece(1);
    p.loads.horizontal = -90000;
    p.design.literatureRecommendations = false;
    const v = calculate(p).values;
    expect(v.horizontalProvided).toBe(0);
    expect(v.horizontal).toBeCloseTo(0.16 * v.vertical, 8);
  });
  it("inclui o peso próprio só quando o braço adotado é conservador", () => {
    const p = newPiece(1);
    p.design.includeSelfWeight = true;
    expect(calculate(p).values.selfWeight).toBeCloseTo(562.5, 10);
    p.geometry.loadOffset = 50;
    expect(calculate(p).status).toBe("unsupported");
  });
  it("usa fctm e eta_c da edição fornecida para concretos de alta resistência", () => {
    const m = materialProperties(60, 500);
    expect(m.fctm).toBeCloseTo(2.12 * Math.log(7.8), 12);
    expect(m.etaC).toBeCloseTo((2 / 3) ** (1 / 3), 12);
    expect(m.fcd2).toBeCloseTo((0.6 * 0.76 * 60) / 1.4, 12);
  });
  it("dimensiona armadura mínima por Mmin além do piso absoluto", () => {
    const v = minimumFlexuralSteel(300, 400, 360, 30, 500);
    expect(v.moment).toBeCloseTo(
      ((0.8 * 300 * 400 ** 2) / 6) * 1.3 * 0.3 * 30 ** (2 / 3),
    );
    expect(v.required).toBeGreaterThanOrEqual(180);
  });
  it("CA-60 não recebe automaticamente eta1=2,25 de CA-50", () => {
    const p = shortFixture();
    const a = calculate(p).values.fbd;
    p.materials.fyk = 600;
    expect(calculate(p).values.fbd).toBeCloseTo(a / 2.25, 10);
  });
  it("calcula d pelo centroide ponderado das camadas", () => {
    const p = newPiece(1);
    p.rebar.tieCount = 6;
    p.design.tieLayers = 2;
    expect(tieLayout(p).dPrime).toBeCloseTo(61.3, 10);
    expect(tieLayout(p).d).toBeCloseTo(338.7, 10);
  });
  it("reforço de suspensão absorve 100% da carga indireta", () => {
    const p = shortFixture();
    p.design.loadType = "indirect";
    const v = calculate(p).values;
    expect(v.suspensionRequired).toBeCloseTo(140000 / (500 / 1.15), 10);
    expect(c(p, "suspension").status).toBe("fail");
  });
  it("fendilhamento transversal usa a largura real do apoio", () => {
    const p = shortFixture();
    p.design.bearingWidth = 200;
    const v = calculate(p).values;
    expect(v.splittingRequired).toBeCloseTo(
      (0.3 * 140000 * 0.5) / (500 / 1.15),
      10,
    );
    expect(c(p, "splitting").status).toBe("fail");
  });
  it("verifica ancoragem com comprimento e confinamento informados", () => {
    const p = shortFixture();
    p.design.supportAnchorLength = 50;
    p.design.anchorConfinementArea = 0;
    expect(c(p, "anchorage").status).toBe("fail");
    expect(c(p, "anchorConfinement").status).toBe("fail");
  });
  it("não usa redução de gancho quando cobrimento normal é insuficiente", () => {
    const p = shortFixture();
    p.design.supportAnchor = "hook";
    p.design.hookNormalCover = 20;
    expect(calculate(p).values.anchorAlpha).toBe(1);
    p.design.hookNormalCover = 48;
    expect(calculate(p).values.anchorAlpha).toBe(0.7);
    expect(c(p, "hookPath").status).toBe("review");
  });
  it("a barra transversal única soldada precisa ter o mesmo diâmetro", () => {
    const p = shortFixture();
    p.design.frontAnchor = "welded";
    p.design.weldedBarDiameter = 10;
    expect(c(p, "weldDiameter").status).toBe("fail");
    p.design.weldedBarDiameter = 16;
    expect(c(p, "weldDiameter").status).toBe("pass");
  });
  it("não dispensa estudo horizontal para apoio impedido", () => {
    const p = newPiece(1);
    p.design.supportType = "restrained";
    expect(calculate(p).status).toBe("unsupported");
  });
  it("a taxa mecânica é estritamente superior a 0,04", () => {
    const p = shortFixture();
    p.materials.fck = (area(4, 16) * 500) / (0.04 * 400 * tieLayout(p).d);
    expect(c(p, "mechanical").status).toBe("fail");
  });
});
describe("Limites, combinações e rastreabilidade", () => {
  it("a/d=0,5 usa a convenção muito curto da 9062", () => {
    const p = newPiece(1);
    p.geometry.length = 500;
    p.geometry.loadOffset = tieLayout(p).d / 2;
    expect(calculate(p).combinations[0].classification).toBe("veryShort");
    p.geometry.loadOffset += 1e-6;
    expect(calculate(p).combinations[0].classification).toBe("short");
  });
  it("a/d=1 é calculável; acima de 2 bloqueia", () => {
    const p = newPiece(1);
    p.geometry.length = 600;
    p.geometry.loadOffset = tieLayout(p).d;
    expect(calculate(p).status).not.toBe("unsupported");
    // Issue #6: 1 < a/d ≤ 2 is now calculated as a cantilever beam.
    p.geometry.loadOffset += 1e-6;
    expect(calculate(p).status).not.toBe("unsupported");
    expect(calculate(p).combinations[0].method).toBe("beam");
    p.geometry.length = 800;
    p.geometry.loadOffset = 2 * tieLayout(p).d + 1e-6;
    expect(calculate(p).status).toBe("unsupported");
  });
  it.each(["fatigue", "transverseForce", "transverseEccentricity"] as const)(
    "bloqueia %s",
    (key) => {
      const p = newPiece(1);
      if (key === "fatigue") p.design.fatigue = true;
      else p.design[key] = 1;
      expect(calculate(p).status).toBe("unsupported");
    },
  );
  it("bloqueia atrito em consolo curto", () => {
    const p = shortFixture();
    p.design.method = "friction";
    expect(calculate(p).status).toBe("unsupported");
  });
  it("não aprova ação nula, dimensão inválida ou número de barras não inteiro", () => {
    const p = newPiece(1);
    p.loads.vertical = 0;
    expect(calculate(p).status).toBe("unsupported");
    p.loads.vertical = 350000;
    p.geometry.height = -1;
    expect(calculate(p).status).toBe("invalid");
    p.geometry.height = 400;
    p.rebar.tieCount = 2.5;
    expect(calculate(p).status).toBe("invalid");
  });
  it("rejeita números não finitos sem produzir resultados aparentes", () => {
    const p = newPiece(1);
    p.loads.vertical = Infinity;
    const r = calculate(p);
    expect(r.status).toBe("invalid");
    expect(r.combinations).toEqual([]);
    expect(r.checks).toEqual([]);
  });
  it("a junta rugosa exige confirmação de preparação", () => {
    const p = newPiece(1);
    p.design.joint = "rough";
    expect(c(p, "roughness").status).toBe("review");
    p.design.roughnessConfirmed = true;
    expect(c(p, "roughness")).toBeUndefined();
    expect(calculate(p).values.mu).toBe(1);
  });
  it("combinações são simultâneas e o envelope preserva a origem", () => {
    const p = shortFixture();
    p.design.combinations = [
      { name: "H alto", vertical: 80000, horizontal: 80000, gamma: 1.4 },
      { name: "V alto", vertical: 200000, horizontal: 0, gamma: 1.4 },
    ];
    const r = calculate(p);
    expect(r.combinations).toHaveLength(3);
    expect(r.combinations[1].values.vertical).toBe(80000);
    expect(r.combinations[1].values.horizontal).toBe(80000);
    expect(r.values.tieRequired).toBe(
      Math.max(...r.combinations.map((c) => c.values.tieRequired)),
    );
    expect(r.checks.find((c) => c.id === "bearing")!.detail).toContain(
      "V alto",
    );
  });
  it("identifica pendências mesmo quando outra combinação tem menor índice", () => {
    const p = shortFixture();
    p.design.inputsConfirmed = false;
    p.design.combinations = [
      { name: "Baixa", vertical: 10000, horizontal: 0, gamma: 1.4 },
    ];
    expect(c(p, "reviewInputs").status).toBe("review");
  });
  it("qualquer parâmetro de cálculo altera a assinatura", () => {
    const p = shortFixture(),
      before = fingerprint(p);
    p.design.bearingWidth -= 5;
    expect(fingerprint(p)).not.toBe(before);
  });
  it("migra projeto v1 e exige conferir os novos dados", () => {
    const p = exampleProject();
    const old = {
      ...p,
      schemaVersion: 1,
      pieces: p.pieces.map(({ design, ...piece }) => {
        void design;
        return piece;
      }),
    };
    const restored = decodeProject(JSON.stringify(old));
    expect(restored.schemaVersion).toBe(5);
    expect(restored.pieces[0].design.inputsConfirmed).toBe(false);
  });
  it("os resultados são determinísticos e não alteram a entrada", () => {
    const p = shortFixture(),
      before = JSON.stringify(p);
    expect(calculate(p)).toEqual(calculate(p));
    expect(JSON.stringify(p)).toBe(before);
  });
  it("busca discreta recalcula as camadas e conserva os dados externos", () => {
    const p = shortFixture(),
      r = suggestReinforcement(p);
    expect(r.changed).toBe(true);
    expect(r.result.values.tieProvided).toBeGreaterThanOrEqual(
      r.result.values.tieRequired,
    );
    expect(r.result.checks.find((c) => c.id === "clearSpacing")!.status).toBe(
      "pass",
    );
    expect(r.piece.design.supportRebarArea).toBe(1000);
    expect(r.piece.design.anchorConfinementArea).toBe(100);
    expect(r.result.fingerprint).toBe(fingerprint(r.piece));
  });
  it("a sugestão não cria solução quando o concreto é insuficiente", () => {
    const p = shortFixture();
    p.loads.vertical = 1e7;
    const r = suggestReinforcement(p);
    expect(r.changed).toBe(false);
    expect(r.piece).toEqual(p);
  });
  it("verifica finitude em uma grade de seções e solicitações", () => {
    for (const h of [200, 400, 800])
      for (const b of [200, 400, 600])
        for (const V of [10000, 100000, 1000000]) {
          const p = newPiece(1);
          p.geometry.height = h;
          p.geometry.tipHeight = h / 2;
          p.geometry.width = b;
          p.loads.vertical = V;
          p.design.bearingWidth = b - 50;
          const r = calculate(p);
          for (const cc of r.combinations)
            for (const value of Object.values(cc.values))
              expect(Number.isFinite(value)).toBe(true);
        }
  });
});
describe("Contato e ancoragem frontal", () => {
  it("considera a excentricidade de H na pressão do apoio", () => {
    const p = shortFixture(),
      v = calculate(p).values;
    expect(v.bearingEccentricity).toBeCloseTo((15000 * 10) / 140000, 10);
    expect(v.bearingStress).toBeCloseTo(
      4 * (1 + (6 * ((15000 * 10) / 140000)) / 100),
      10,
    );
  });
  it("não extrapola a fórmula de contato integral para apoio que descola", () => {
    const p = shortFixture();
    p.loads.horizontal = 300000;
    expect(calculate(p).status).toBe("unsupported");
    expect(calculate(p).reasons.join()).toContain("contato parcial");
  });
  it("exige solda capaz de desenvolver o ramo integral, com reserva de 15%", () => {
    const p = shortFixture();
    p.design.frontAnchor = "welded";
    p.design.weldedBarDiameter = 16;
    const check = c(p, "weldForce");
    expect(check.demand).toBeCloseTo(1.15 * area(1, 16) * (500 / 1.15), 10);
    expect(check.status).toBe("fail");
  });
});
describe("Viga em balanço, 1 < a/d ≤ 2 (issue #6)", () => {
  // Values computed by hand in the issue; the engine keeps full precision.
  const close = (value: number | undefined, expected: number) => {
    expect(value).not.toBeUndefined();
    expect(Math.abs(value! - expected) / Math.abs(expected)).toBeLessThan(1e-4);
  };
  const only = (p: ReturnType<typeof newPiece>) => calculate(p).combinations[0];
  const find = (p: ReturnType<typeof newPiece>, id: string) =>
    calculate(p).checks.find((x) => x.id === id);
  it("caso A reproduz esforços, flexão, cisalhamento, estribos e costura", () => {
    const p = cantileverFixture();
    expect(tieLayout(p).dPrime).toBeCloseTo(41.3, 10);
    const c = only(p),
      v = c.values;
    expect(c.classification).toBe("cantilever");
    expect(c.method).toBe("beam");
    close(v.ratio, 1.3939);
    close(v.vertical, 252000);
    close(v.horizontal, 40320);
    close(v.beam_moment, 127.665e6);
    close(v.beam_kmd, 0.15435);
    close(v.beam_kx, 0.25248);
    close(v.beam_kz, 0.89901);
    close(v.beam_flexSteel, 910.55);
    close(v.beam_horizontalSteel, 92.74);
    close(v.tieModel, 1003.29);
    close(v.tieRequired, 1003.29);
    close(v.beam_shearLimit, 547890);
    close(v.beam_reducedShearLimit, 367090);
    close(v.beam_stirrupSpacingLimit, 215.22);
    close(v.beam_stirrupRateRequired * 1000, 1795.37);
    close(v.beam_stirrupRateMinimum * 1000, 347.58);
    close(v.beam_stirrupRate * 1000, 1795.37);
    close(v.beam_transverseRequired, 1077.22);
    close(v.beam_stitchRate, 1.1188);
    close(v.beam_stitchRequired, 267.54);
    expect(find(p, "beamDomain")!.status).toBe("pass");
    expect(find(p, "beamShear")!.status).toBe("pass");
    expect(find(p, "beamStitch")!.demand).toBeCloseTo(v.beam_stitchRequired, 8);
    expect(find(p, "beamSkin")).toBeUndefined();
  });
  it("caso B reprova por cisalhamento e reduz smáx", () => {
    const p = cantileverFixture({ vertical: 350000 });
    const v = only(p).values;
    close(v.vertical, 588000);
    close(v.horizontal, 94080);
    close(v.beam_moment, 297.886e6);
    close(v.beam_kmd, 0.36014);
    close(v.beam_kx, 0.76168);
    close(v.beam_kz, 0.69533);
    close(v.beam_flexSteel, 2746.99);
    close(v.beam_horizontalSteel, 216.38);
    close(v.beam_shearLimit, 547890);
    close(v.beam_stirrupSpacingLimit, 107.61);
    const shear = find(p, "beamShear")!;
    expect(shear.status).toBe("fail");
    expect(shear.demand).toBe(588000);
  });
  it("caso C: domínio inválido deixa As,flex indeterminada, sem número sentinela", () => {
    // a = 700 mm requires L ≥ 750 mm for the pad to stay inside the corbel.
    const p = cantileverFixture({
      vertical: 350000,
      loadOffset: 700,
      length: 800,
    });
    const r = calculate(p),
      c = r.combinations[0];
    expect(r.status).toBe("fail");
    close(c.values.ratio, 1.9515);
    close(c.values.beam_kmd, 0.50232);
    expect(c.values.beam_radicand).toBeLessThan(0);
    expect(c.values.beam_domainValid).toBe(0);
    for (const key of ["beam_kx", "beam_flexSteel", "tieModel", "tieRequired"])
      expect(c.values[key]).toBeUndefined();
    expect(r.values.tieRequired).toBeUndefined();
    expect(Object.values(c.values).every(Number.isFinite)).toBe(true);
    expect(find(p, "beamDomain")!.status).toBe("fail");
    const tie = find(p, "tie")!;
    expect(tie.status).toBe("fail");
    expect(tie.demand).toBeNull();
    expect(tie.capacity).toBeCloseTo(area(4, 20), 8);
    expect(find(p, "beamStitch")!.demand).toBeNull();
  });
  it("caso D e fronteira h = 600/601 mm: costura até 600 mm, pele em revisão acima", () => {
    const d = cantileverFixture({
      height: 700,
      loadOffset: 1000,
      length: 1100,
    });
    const v = only(d).values;
    expect(v.ratio).toBeGreaterThan(1);
    expect(v.ratio).toBeLessThanOrEqual(2);
    close(v.beam_skinPerFace, 210);
    close(v.beam_skinTotal, 420);
    const skin = find(d, "beamSkin")!;
    expect(skin.status).toBe("review");
    expect(skin.demand).toBeCloseTo(210, 10);
    expect(skin.detail).toContain("420");
    for (const id of ["beamStitch", "stitch", "stitchSpacing", "stitchZone"])
      expect(find(d, id)).toBeUndefined();
    const at = (height: number) =>
      cantileverFixture({ height, loadOffset: 800, length: 900 });
    expect(find(at(600), "beamStitch")).not.toBeUndefined();
    expect(find(at(600), "beamSkin")).toBeUndefined();
    expect(find(at(601), "beamStitch")).toBeUndefined();
    expect(find(at(601), "beamSkin")!.status).toBe("review");
  });
  it("fronteiras de a/d: 1 é consolo curto, 2 é viga em balanço, acima de 2 é unsupported", () => {
    const at = (ratio: number) => {
      const p = cantileverFixture({ length: 1000 });
      p.geometry.loadOffset = ratio * tieLayout(p).d;
      return p;
    };
    expect(calculate(at(1)).combinations[0].classification).toBe("short");
    expect(calculate(at(1)).combinations[0].method).toBe("strut");
    expect(calculate(at(1.0001)).combinations[0].method).toBe("beam");
    expect(calculate(at(1.5)).combinations[0].classification).toBe(
      "cantilever",
    );
    expect(calculate(at(2)).combinations[0].method).toBe("beam");
    const above = calculate(at(2.0001));
    expect(above.status).toBe("unsupported");
    expect(above.reasons).toContain("a/d > 2: fora do domínio de consolo.");
    expect(above.combinations).toEqual([]);
  });
  it.each(["strut", "friction"] as const)(
    "método %s explícito com a/d > 1 é unsupported e orienta para Automático",
    (method) => {
      const p = cantileverFixture();
      p.design.method = method;
      const r = calculate(p);
      expect(r.status).toBe("unsupported");
      expect(r.reasons.join(" ")).toContain("Automático");
      expect(r.reasons.join(" ")).not.toContain("a/d > 2");
    },
  );
  it("não gera bielas e tirantes nem complementos de El Debs e não expõe NaN", () => {
    const p = cantileverFixture();
    p.design.literatureRecommendations = true;
    const r = calculate(p),
      c = r.combinations[0];
    const ids = c.checks.map((x) => x.id);
    for (const id of [
      "strut",
      "angleMin",
      "nodeSupport",
      "ductility",
      "transverse",
      "stitch",
      "lowerStitch",
      "literatureTip",
      "literatureConcrete",
      "literatureStrut",
    ])
      expect(ids).not.toContain(id);
    for (const id of [
      "tie",
      "mechanical",
      "bearing",
      "anchorage",
      "cover",
      "supportRebar",
      "splitting",
      "beamDomain",
      "beamShear",
      "beamStirrups",
      "beamStirrupSpacing",
      "beamStitch",
      "literatureHorizontal",
    ])
      expect(ids).toContain(id);
    expect(c.checks.find((x) => x.id === "beamLiterature")!.status).toBe("na");
    expect(
      Object.keys(c.values).some(
        (k) =>
          k.startsWith("stm_") ||
          k.startsWith("elDebs_") ||
          ["tieFriction", "tie9062", "tieElDebs", "tau", "asV"].includes(k),
      ),
    ).toBe(false);
    expect(Object.values(r.values).every(Number.isFinite)).toBe(true);
    expect(JSON.stringify(r)).not.toContain("NaN");
    // The H ≥ 0,20 V floor is kept as an input-force rule.
    close(c.values.horizontal, 0.2 * c.values.vertical);
    expect(r.assumptions.join(" ")).toContain("viga em balanço");
  });
  it("estribos: Atransv inclui 0,0015bh e um único estribo compara L com smáx", () => {
    const p = cantileverFixture();
    const m = cantileverBeamModel({
      vertical: 1000,
      horizontal: 0,
      a: 500,
      d: 358.7,
      dPrime: 41.3,
      loadHeight: 0,
      width: 300,
      height: 400,
      length: 400,
      fcd: 30 / 1.4,
      fy: 500 / 1.15,
      alphaV2: 0.88,
      alphaC: 0.85,
      lambda: 0.8,
      fctm: 0.3 * 30 ** (2 / 3),
      fywd: 500 / 1.15,
      fykTransverse: 500,
    });
    expect(m.transverseRequired).toBe(0.0015 * 300 * 400);
    p.rebar.stirrupCount = 1;
    const spacing = find(p, "beamStirrupSpacing")!;
    expect(spacing.demand).toBe(600);
    expect(spacing.status).toBe("fail");
    p.rebar.stirrupCount = 20;
    const many = find(p, "beamStirrupSpacing")!;
    expect(many.demand).toBeCloseTo((600 - 2 * (25 + 6.3 / 2)) / 19, 10);
    expect(many.status).toBe("pass");
    expect(find(p, "beamStirrups")!.capacity).toBeCloseTo(area(40, 6.3), 8);
  });
  it("envelope: cada verificação traz a pior combinação", () => {
    const p = cantileverFixture({ length: 700 });
    p.design.combinations = [
      { name: "Horizontal", vertical: 120000, horizontal: 200000, gamma: 1.4 },
    ];
    const r = calculate(p);
    const [principal, horizontal] = r.combinations;
    expect(principal.values.vertical).toBeGreaterThan(
      horizontal.values.vertical,
    );
    expect(horizontal.values.tieRequired).toBeGreaterThan(
      principal.values.tieRequired,
    );
    expect(r.checks.find((x) => x.id === "beamShear")!.detail).toMatch(
      /^\[Principal\]/,
    );
    expect(r.checks.find((x) => x.id === "tie")!.detail).toMatch(
      /^\[Horizontal\]/,
    );
    expect(r.governingCase).toBe("Horizontal");
    expect(r.values.stirrupRequired).toBe(
      Math.max(
        principal.values.stirrupRequired,
        horizontal.values.stirrupRequired,
      ),
    );
  });
  it("envelope com combinação de domínio inválido mantém a armadura indeterminada", () => {
    const p = cantileverFixture({ length: 700 });
    p.design.combinations = [
      { name: "Extrema", vertical: 450000, horizontal: 0, gamma: 1.4 },
    ];
    const r = calculate(p);
    expect(r.combinations[0].values.tieRequired).not.toBeUndefined();
    expect(r.combinations[1].values.tieRequired).toBeUndefined();
    expect(r.values.tieRequired).toBeUndefined();
    expect(r.values.anchorRequired).toBeUndefined();
    expect(r.governingCase).toBe("Extrema");
    expect(r.checks.find((x) => x.id === "beamDomain")!.status).toBe("fail");
  });
  it("sugestão de armadura atende o modelo e não 'resolve' VRd2 com estribos", () => {
    const ok = suggestReinforcement(cantileverFixture({ length: 700 }));
    expect(ok.changed).toBe(true);
    for (const id of [
      "tie",
      "beamDomain",
      "beamShear",
      "beamStirrups",
      "beamStirrupSpacing",
      "beamStitch",
    ])
      expect(ok.result.checks.find((x) => x.id === id)!.status).toBe("pass");
    const shear = cantileverFixture({ vertical: 350000, length: 700 });
    const failed = suggestReinforcement(shear);
    expect(failed.changed).toBe(false);
    expect(failed.piece).toBe(shear);
    expect(failed.result.checks.find((x) => x.id === "beamShear")!.status).toBe(
      "fail",
    );
  });
});

describe("Sugestão da viga em balanço com combinações", () => {
  it("usa o menor smáx mesmo quando outra combinação governa o tirante", () => {
    const p = cantileverFixture({
      vertical: 287500,
      height: 500,
      length: 1000,
      loadOffset: 625,
    });
    p.geometry.tipHeight = 250;
    p.design.bearingWidth = 300;
    p.design.bearingLength = 200;
    p.rebar.stirrupDiameter = 16;
    // Keep this test focused on simultaneous shear spacing. The original 6.3 mm
    // stitch fails stitchClear; that rejection is covered in autodesign.test.ts.
    p.rebar.stitchDiameter = 10;
    p.design.loopInternalDiameter = 125;
    p.design.combinations = [
      { name: "H", vertical: 230000, horizontal: 150000, gamma: 1.4 },
    ];
    const proposal = suggestReinforcement(p);
    expect(proposal.changed).toBe(true);
    expect(proposal.result.governingCase).toBe("H");
    const [vertical, horizontal] = proposal.result.combinations;
    expect(vertical.values.beam_stirrupSpacingLimit).toBeLessThan(
      horizontal.values.beam_stirrupSpacingLimit,
    );
    for (const c of proposal.result.combinations)
      for (const id of [
        "tie",
        "beamShear",
        "beamStirrups",
        "beamStirrupSpacing",
      ])
        expect(c.checks.find((check) => check.id === id)!.status).toBe("pass");
  });
});
describe("Ancoragem no suporte: α e piso da razão (issue #12)", () => {
  // Reference: fck 30, CA-50, φ20, má aderência, As,ef = 4 Ø20.
  const anchorFixture = () => {
    const p = shortFixture();
    p.materials = { fck: 30, fyk: 500 };
    p.rebar.tieCount = 4;
    p.rebar.tieDiameter = 20;
    p.design.bond = "poor";
    p.design.gammaC = 1.4;
    p.design.gammaS = 1.15;
    return p;
  };
  /** Bisect the design vertical load until As,req/As,ef equals the target. */
  const withRatio = (target: number) => {
    const p = anchorFixture();
    const ratio = (v: number) => {
      p.loads.vertical = v;
      const r = calculate(p).values;
      return r.tieRequired / r.tieProvided;
    };
    // Above the minimum-steel plateau and inside the contact model's domain.
    let lo = 200000,
      hi = 2e6;
    expect(ratio(lo)).toBeLessThan(target);
    expect(ratio(hi)).toBeGreaterThan(target);
    for (let i = 0; i < 200 && hi - lo > 1e-9; i++) {
      const mid = (lo + hi) / 2;
      if (ratio(mid) < target) lo = mid;
      else hi = mid;
    }
    p.loads.vertical = (lo + hi) / 2;
    return p;
  };
  const setAlpha = (p: ReturnType<typeof newPiece>, alpha: number) => {
    p.design.supportAnchor = alpha === 1 ? "straight" : "hook";
    p.design.hookNormalCover = 60;
    p.design.supportWeldedBar = alpha === 0.5;
  };
  it.each([
    ["reta", "straight", 0, false, 1],
    ["gancho com cobrimento ≥ 3φ", "hook", 60, false, 0.7],
    ["gancho com cobrimento < 3φ", "hook", 59, false, 1],
    ["soldada sem gancho", "straight", 0, true, 0.7],
    ["gancho com cobrimento ≥ 3φ e soldada", "hook", 60, true, 0.5],
    ["gancho com cobrimento < 3φ e soldada", "hook", 59, true, 0.7],
  ] as const)("CA1/CA2: α para %s", (_, anchor, cover, welded, alpha) => {
    const q = {
      supportAnchor: anchor,
      hookNormalCover: cover,
      supportWeldedBar: welded,
    };
    expect(anchorageAlpha(q, 20)).toBe(alpha);
    const p = anchorFixture();
    p.design = { ...p.design, ...q };
    expect(calculate(p).values.anchorAlpha).toBe(alpha);
  });
  it("lb de referência reproduz fctd, fbd e lb da issue", () => {
    const v = calculate(anchorFixture()).values;
    expect(v.fbd).toBeCloseTo(2.28097, 5);
    expect(v.lb).toBeCloseTo(953.066, 3);
    expect(v.tieProvided).toBeCloseTo(1256.64, 2);
  });
  it.each([
    [0.8, 1, 762.45, 953.07],
    [0.8, 0.7, 533.72, 667.15],
    [0.8, 0.5, 381.23, 476.53],
    [1.2, 1, 1143.68, 1143.68],
    [1.2, 0.7, 800.58, 800.58],
    [1.2, 0.5, 571.84, 571.84],
  ])(
    "CA3: razão %s e α %s reproduzem lb,nec da tabela de referência",
    (ratio, alpha, off, on) => {
      const p = withRatio(ratio);
      setAlpha(p, alpha);
      const a = calculate(p).values;
      expect(a.tieRequired / a.tieProvided).toBeCloseTo(ratio, 9);
      expect(a.anchorAlpha).toBe(alpha);
      expect(a.anchorRatio).toBeCloseTo(ratio, 9);
      expect(a.anchorRatioFloor).toBe(0);
      expect(Math.abs(a.anchorRequired - off)).toBeLessThanOrEqual(0.01);
      p.design.anchorRatioFloor = true;
      const b = calculate(p).values;
      expect(b.anchorRatio).toBeCloseTo(Math.max(1, ratio), 9);
      expect(b.anchorRatioFloor).toBe(1);
      expect(Math.abs(b.anchorRequired - on)).toBeLessThanOrEqual(0.01);
    },
  );
  it("CA4: opções desligadas mantêm a expressão original, bit a bit", () => {
    for (const p of [shortFixture(), newPiece(1), cantileverFixture()]) {
      const r = calculate(p);
      for (const cs of r.combinations) {
        const v = cs.values;
        if (v.tieRequired === undefined) continue;
        expect(v.anchorRequired).toBe(
          Math.max(
            (v.anchorAlpha * v.lb * v.tieRequired) / v.tieProvided,
            0.3 * v.lb,
            10 * p.rebar.tieDiameter,
            100,
          ),
        );
      }
      expect(r.checks.some((ch) => ch.id === "anchorWeldedBar")).toBe(false);
    }
  });
  it("CA5: projeto salvo sem os campos abre com ambos falsos e mesmos números", () => {
    const file = readFileSync(
      new URL("../examples/casos-validacao.lume.json", import.meta.url),
      "utf8",
    );
    expect(file).not.toContain("supportWeldedBar");
    expect(file).not.toContain("anchorRatioFloor");
    const restored = decodeProject(file);
    expect(restored.schemaVersion).toBe(5);
    const explicit = decodeProject(file);
    for (const piece of explicit.pieces) {
      piece.design.supportWeldedBar = false;
      piece.design.anchorRatioFloor = false;
    }
    restored.pieces.forEach((piece, i) => {
      expect(piece.design.supportWeldedBar).toBe(false);
      expect(piece.design.anchorRatioFloor).toBe(false);
      expect(calculate(piece)).toEqual(calculate(explicit.pieces[i]));
    });
    // The file reproduces the regression fixture, so its results match it too.
    const short = calculate(shortFixture()).values;
    const loaded = calculate(restored.pieces[0]).values;
    expect(loaded.anchorRequired).toBe(short.anchorRequired);
    expect(loaded.anchorAlpha).toBe(1);
  });
  it("CA6: barra soldada gera nota 'conferir', nunca aprovação", () => {
    const p = shortFixture();
    expect(c(p, "anchorWeldedBar")).toBeUndefined();
    p.design.supportWeldedBar = true;
    const note = c(p, "anchorWeldedBar");
    expect(note.status).toBe("review");
    expect(note.detail).toContain("o programa não verifica a geometria");
    expect(note.reference).toContain("§9.4.2.2");
  });
  it("CA7: verificação de ancoragem mostra α, razão e piso", () => {
    const p = shortFixture();
    let a = c(p, "anchorage");
    expect(a.formula).toBe(
      "lb=max(φfyd/(4fbd);25φ); lb,nec=max(α·lb·razão;0,3lb;10φ;100)",
    );
    expect(a.detail).toContain("α = 1,0");
    expect(a.detail).toContain("(sem piso)");
    p.design.anchorRatioFloor = true;
    p.design.supportWeldedBar = true;
    a = c(p, "anchorage");
    expect(a.detail).toContain("α = 0,7");
    expect(a.detail).toContain("limitada ao mínimo de 1,0");
  });
  it("as novas opções alteram a assinatura do cálculo", () => {
    const p = shortFixture(),
      before = fingerprint(p);
    p.design.supportWeldedBar = true;
    const welded = fingerprint(p);
    expect(welded).not.toBe(before);
    p.design.anchorRatioFloor = true;
    expect(fingerprint(p)).not.toBe(welded);
  });
  it("no ramo de viga com domínio inválido a razão fica indeterminada", () => {
    const p = cantileverFixture({ vertical: 2_000_000 });
    p.design.anchorRatioFloor = true;
    const r = calculate(p);
    for (const cs of r.combinations)
      if (cs.values.tieRequired === undefined) {
        expect(cs.values.anchorRatio).toBeUndefined();
        const a = cs.checks.find((x) => x.id === "anchorage")!;
        expect(a.detail).toContain("indeterminada");
      }
  });
});
