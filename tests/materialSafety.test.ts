import { legacyN4Labels } from "./reference/legacy-n4-labels";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { designSchema } from "../src/domain/design";
import {
  calculate,
  materialProperties,
  minimumFlexuralSteel,
} from "../src/domain/engine";
import { materialSafetyReferences } from "../src/domain/materialSafety";
import { exampleProject, fingerprint } from "../src/domain/model";
import { toCalculationJson, toPdf } from "../src/lib/exports";
import { buildDetail } from "../src/detailing/model";
import { pieceDrawing } from "../src/detailing/drawing";
import { drawingSvg, drawingDxf } from "../src/detailing/exports";
import { shortFixture, cantileverFixture } from "./fixtures";
import { suggestReinforcement } from "../src/domain/autodesign";

describe("Coeficientes dos materiais — resistências em MPa", () => {
  // Resultados completos capturados antes desta alteração, no upstream 41c3a12.
  // A fixture mantém campos posteriores ausentes e normaliza os rótulos de N4,
  // além dos metadados de coeficientes/ancoragem já normalizados anteriormente.
  it.each([
    [
      "friction",
      20,
      0.35,
      "fa3190efa43d06c3db1eed2c520985647cff162750f8cbed81b04c9a23d7e037",
    ],
    [
      "strut",
      30,
      0.7,
      "8ca893ef323d153dbe7563e4777e006fc0e6352de74bdbcc80814f92b3b7adde",
    ],
    [
      "beam",
      30,
      0,
      "cb86344a673ccde3276b853c8424d657aab27c32a582b5bc995cc8494ceca6bf",
    ],
  ] as const)(
    "mantém o resultado completo anterior para %s com os padrões",
    (method, fck, ratio, expected) => {
      const p = method === "beam" ? cantileverFixture() : shortFixture();
      if (method !== "beam") {
        p.materials.fck = fck;
        p.geometry.loadOffset = ratio * 460.7;
        p.geometry.length = p.geometry.loadOffset + 90;
      }
      const legacy = JSON.parse(JSON.stringify(p));
      delete legacy.rebar.stirrupBranches;
      delete legacy.rebar.constructiveDiameter;
      delete legacy.design.gammaC;
      delete legacy.design.gammaS;
      // Projeto anterior ao recorte: campo ausente, sem normalizar o fingerprint.
      delete legacy.design.excessConcrete;
      // Issue #12: options off by default; only metadata and the anchorage
      // text (formula, α/ratio/lb detail) are new, the numbers are unchanged.
      delete legacy.design.supportWeldedBar;
      delete legacy.design.anchorRatioFloor;
      const metadata = new Set([
        "gammaC",
        "gammaS",
        "gammaCReference",
        "gammaSReference",
        "anchorRatio",
        "anchorRatioFloor",
        "anchorWeldedBar",
      ]);
      const raw = JSON.stringify(
        legacyN4Labels(calculate(legacy)),
        (key, value) =>
          metadata.has(key)
            ? undefined
            : value?.id === "anchorage"
              ? {
                  ...value,
                  formula:
                    "lb=max(φfyd/(4fbd);25φ); lb,nec=max(αlb As,calc/As,ef;0,3lb;10φ;100)",
                  detail: value.detail.replace(/α = .*lb = [\d.,]+ mm\./, ""),
                }
              : value,
      );
      expect(createHash("sha256").update(raw).digest("hex")).toBe(expected);
    },
  );
  it("reproduz C30/CA-50 e preserva a assinatura anterior", () => {
    const standard = materialProperties(30, 500);
    expect(standard).toEqual(materialProperties(30, 500, 500, 1.4, 1.15));
    expect(standard.fcd).toBeCloseTo(21.42857142857143, 12);
    expect(standard.fyd).toBeCloseTo(434.7826086956522, 12);
    const reduced = materialProperties(30, 500, 500, 1.3, 1.1);
    expect(reduced.fcd).toBeCloseTo(23.076923076923077, 12);
    expect(reduced.fyd).toBeCloseTo(454.5454545454545, 12);
    expect(reduced.fctd).toBeCloseTo((0.7 * 0.3 * 30 ** (2 / 3)) / 1.3, 12);
    expect(reduced.fydLimited).toBe(435);
    expect(reduced.fywd).toBe(435);
    expect(materialProperties(30, 250, 600, 1.3, 2).fywd).toBe(300);
    expect(materialProperties(30, 250, 600, 1.3, 1.1).fywd).toBe(435);
  });

  it.each(["strut", "friction", "beam"] as const)(
    "propaga resistências e mantém ações no modelo %s",
    (method) => {
      const p = method === "beam" ? cantileverFixture() : shortFixture();
      if (method === "friction") p.geometry.loadOffset = 180;
      if (method !== "beam") p.design.method = method;
      const old = calculate(p).values;
      Object.assign(p.design, { gammaC: 1.3, gammaS: 1.1 });
      const r = calculate(p),
        v = r.values;
      expect(r.combinations[0].method).toBe(method);
      expect(v.fcd).toBeCloseTo(30 / 1.3, 12);
      expect(v.fyd).toBeCloseTo(500 / 1.1, 12);
      expect(v.fydLimited).toBe(435);
      expect(v.fywd).toBe(435);
      expect(v.fcd1).toBeCloseTo((0.85 * 0.88 * 30) / 1.3, 12);
      expect(v.fcd2).toBeCloseTo((0.6 * 0.88 * 30) / 1.3, 12);
      expect(v.fcd3).toBeCloseTo((0.72 * 0.88 * 30) / 1.3, 12);
      expect(v.fbd / old.fbd).toBeCloseTo(1.4 / 1.3, 12);
      expect(v.tieMinimumFlexure).toBe(
        minimumFlexuralSteel(
          p.geometry.width,
          p.geometry.height,
          v.d,
          30,
          500,
          1.3,
          1.1,
        ).required,
      );
      for (const key of [
        "vertical",
        "horizontal",
        "factor",
        "gammaN",
        "gammaN9062",
        "mu",
      ])
        expect(v[key]).toBe(old[key]);
      expect(v.tieModel).toBeLessThan(old.tieModel);
    },
  );

  it("calcula o mínimo de flexão com ambos os coeficientes sem ficar oculto pelo piso geométrico", () => {
    const b = 200,
      h = 1000,
      d = 800,
      fck = 90,
      fyk = 250;
    const gammaC = 1.3,
      gammaS = 1.1;
    const fctm = 2.12 * Math.log(1 + 0.1 * (fck + 8));
    const moment = ((0.8 * b * h ** 2) / 6) * 1.3 * fctm;
    const stress =
      (0.85 * (1 - 40 / 200) * (40 / fck) ** (1 / 3) * fck) / gammaC;
    const depth = d - Math.sqrt(d ** 2 - (2 * moment) / (b * stress));
    const expected = (stress * b * depth) / (fyk / gammaS);
    expect(expected).toBeGreaterThan(0.0015 * b * h);
    const result = minimumFlexuralSteel(b, h, d, fck, fyk, gammaC, gammaS);
    expect(result.moment).toBeCloseTo(moment, 6);
    expect(result.required).toBeCloseTo(expected, 9);
    expect(result.required).not.toBe(
      minimumFlexuralSteel(b, h, d, fck, fyk).required,
    );
  });
});

describe("Referências por processo e pendência rastreável", () => {
  it("o limite alternativo de biela usa γc da peça e preserva ambas as pendências", () => {
    const p = shortFixture();
    Object.assign(p.design, { gammaC: 1.3, gammaS: 1.1, strutLimit: "fcd3" });
    const r = calculate(p);
    expect(r.checks.find((c) => c.id === "strut")?.capacity).toBeCloseTo(
      (0.72 * 0.88 * 30) / 1.3,
      12,
    );
    expect(r.checks.find((c) => c.id === "strutLimitCriterion")?.status).toBe(
      "review",
    );
    expect(r.checks.find((c) => c.id === "materialSafety")?.status).toBe(
      "review",
    );
  });
  it("a sugestão de armaduras não elimina a revisão nem altera os coeficientes", () => {
    const p = shortFixture();
    Object.assign(p.design, { gammaC: 1.3, gammaS: 1.1 });
    const proposal = suggestReinforcement(p);
    expect(proposal.piece.design).toMatchObject({ gammaC: 1.3, gammaS: 1.1 });
    expect(
      proposal.result.checks.find((c) => c.id === "materialSafety")?.status,
    ).toBe("review");
    expect(proposal.result.status).not.toBe("pass");
  });
  it.each(Object.entries(materialSafetyReferences))(
    "compara estritamente o par de %s",
    (production, reference) => {
      const p = shortFixture();
      p.design.production = production as keyof typeof materialSafetyReferences;
      Object.assign(p.design, {
        gammaC: reference.gammaC,
        gammaS: reference.gammaS,
      });
      expect(
        calculate(p).checks.find((c) => c.id === "materialSafety"),
      ).toBeUndefined();
      Object.assign(p.design, { gammaC: 2, gammaS: 2 });
      expect(
        calculate(p).checks.find((c) => c.id === "materialSafety"),
      ).toBeUndefined();
      Object.assign(p.design, {
        gammaC: reference.gammaC - 0.01,
        gammaS: reference.gammaS,
      });
      let warning = calculate(p).checks.find((c) => c.id === "materialSafety")!;
      expect(warning.status).toBe("review");
      expect(warning.detail).toContain("γc adotado");
      expect(warning.detail).not.toContain("γs adotado");
      Object.assign(p.design, {
        gammaC: reference.gammaC,
        gammaS: reference.gammaS - 0.01,
      });
      warning = calculate(p).checks.find((c) => c.id === "materialSafety")!;
      expect(warning.status).toBe("review");
      expect(warning.detail).toContain("γs adotado");
      expect(warning.detail).not.toContain("γc adotado");
    },
  );

  it("lista os dois coeficientes de pré-moldado e preserva review em todas as combinações", () => {
    const p = shortFixture();
    Object.assign(p.design, {
      gammaC: 1.3,
      gammaS: 1.1,
      combinations: [
        { name: "Reduzida", vertical: 100000, horizontal: 10000, gamma: 1.4 },
      ],
    });
    const r = calculate(p);
    expect(r.status).toBe("review");
    for (const c of r.combinations) {
      const warning = c.checks.find((c) => c.id === "materialSafety")!;
      expect(warning.status).toBe("review");
      expect(warning.detail).toContain("γc adotado 1,3, referência 1,4");
      expect(warning.detail).toContain("γs adotado 1,1, referência 1,15");
      expect(c.values).toMatchObject({
        gammaC: 1.3,
        gammaS: 1.1,
        gammaCReference: 1.4,
        gammaSReference: 1.15,
      });
    }
    p.design.production = "factory";
    expect(
      calculate(p).checks.find((c) => c.id === "materialSafety"),
    ).toBeUndefined();
    expect(calculate(p).values).toMatchObject({
      gammaCReference: 1.3,
      gammaSReference: 1.1,
    });
  });

  it("a troca de produção mantém os valores explicitamente adotados", () => {
    const p = shortFixture();
    p.design.production = "factory";
    const before = structuredClone(p);
    expect(calculate(p).values).toMatchObject({
      gammaC: 1.4,
      gammaS: 1.15,
      gammaCReference: 1.3,
      gammaSReference: 1.1,
    });
    expect(p).toEqual(before);
    expect(fingerprint(p)).toBe(fingerprint(before));
  });
});

describe("Validação e saídas", () => {
  it.each(["gammaC", "gammaS"] as const)(
    "rejeita %s inválido com mensagem em português e aceita extremos",
    (field) => {
      const p = shortFixture();
      for (const value of [
        0.999,
        2.001,
        NaN,
        Infinity,
        -Infinity,
        "1,3",
        null,
      ]) {
        const result = designSchema.safeParse({ ...p.design, [field]: value });
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues[0].message).toContain(
            "deve ser um número finito entre 1,0 e 2,0",
          );
        const invalid = structuredClone(p);
        Object.assign(invalid.design, { [field]: value });
        expect(calculate(invalid).status).toBe("invalid");
      }
      for (const value of [1, 2])
        expect(
          designSchema.safeParse({ ...p.design, [field]: value }).success,
        ).toBe(true);
    },
  );

  it.each([shortFixture, cantileverFixture])(
    "inclui adotados, referências e review no cálculo auditável e PDF",
    async (fixture) => {
      const p = fixture(),
        project = exampleProject();
      Object.assign(p.design, { gammaC: 1.3, gammaS: 1.1 });
      project.pieces = [p];
      const json = JSON.parse(toCalculationJson(project, p));
      expect(json.input.design).toMatchObject({ gammaC: 1.3, gammaS: 1.1 });
      expect(json.result.values).toMatchObject({
        gammaC: 1.3,
        gammaS: 1.1,
        gammaCReference: 1.4,
        gammaSReference: 1.15,
      });
      expect(json.result.assumptions.join(" ")).toContain("γc=1,3 e γs=1,1");
      const pdf = new TextDecoder("latin1").decode(await toPdf(project, p));
      for (const label of [
        "gamma c adotado",
        "gamma s adotado",
        "gamma c referencia da producao",
        "gamma s referencia da producao",
      ])
        expect(pdf).toContain(label);
    },
  );

  it("registra valores alterados e pendências nas notas de SVG e DXF de detalhamento", () => {
    const p = shortFixture(),
      project = exampleProject();
    Object.assign(p.design, { gammaC: 1.3, gammaS: 1.1 });
    project.pieces = [p];
    const drawing = pieceDrawing(project, buildDetail(p));
    const texts = drawing.entities
      .flatMap((e) => (e.type === "text" ? [e.text] : []))
      .join(" ");
    expect(texts).toContain("Materiais: γc = 1,3; γs = 1,1");
    expect(texts).toContain("γc adotado 1,3, abaixo da referência 1,4");
    expect(texts).toContain("γs adotado 1,1, abaixo da referência 1,15");
    expect(drawingSvg(drawing)).toContain("Materiais:");
    expect(drawingDxf(drawing)).toContain("Materiais:");
  });
});
