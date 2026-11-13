import { legacyN4Labels } from "./reference/legacy-n4-labels";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculate } from "../src/domain/engine";
import { exampleProject } from "../src/domain/model";
import {
  bondCoefficientEta1,
  bondCoefficientPending,
  fykOf,
  geometricPinFactor,
  loopPinDefined,
  loopPinFactor,
  requiresSupportHook,
  steelBondDescription,
  steelClassOf,
  steelClasses,
  steelLabel,
  steelOptionLabel,
  stirrupMandrelDefined,
} from "../src/domain/steel";
import { buildDetail } from "../src/detailing/model";
import { pieceDrawing } from "../src/detailing/drawing";
import { drawingDxf, drawingSvg, steelCsv } from "../src/detailing/exports";
import { mandrelDiameter } from "../src/detailing/geometry";
import { toCalculationJson, toPdf } from "../src/lib/exports";
import { shortFixture } from "./fixtures";

describe("Classes de aço e regras centralizadas", () => {
  it.each([
    ["CA-25", 250, 1, 4, 5, true, false],
    ["CA-50", 500, 2.25, 5, 8, false, false],
    ["CA-60", 600, 1, 6, 6, false, true],
  ] as const)(
    "mapeia %s nos dois sentidos e declara suas regras",
    (steel, fyk, eta1, small, large, hook, pending) => {
      expect(steelClassOf(fyk)).toBe(steel);
      expect(fykOf(steel)).toBe(fyk);
      expect(bondCoefficientEta1(steel)).toBe(eta1);
      expect(bondCoefficientPending(steel)).toBe(pending);
      expect(requiresSupportHook(steel)).toBe(hook);
      expect(loopPinFactor(steel, 19.999)).toBe(small);
      expect(loopPinFactor(steel, 20)).toBe(large);
      expect(loopPinDefined(steel, 19.999)).toBe(true);
      expect(loopPinDefined(steel, 20)).toBe(!pending);
      expect(stirrupMandrelDefined(steel, 10)).toBe(true);
      expect(stirrupMandrelDefined(steel, 10.001)).toBe(!pending);
      expect(mandrelDiameter(20, fyk)).toBe(large * 20);
      expect(mandrelDiameter(10, fyk, true)).toBe(30);
      expect(steelLabel(fyk)).toBe(steel);
      expect(steelOptionLabel(steel)).toBe(`${steel} · ${fyk} MPa`);
    },
  );
  it("não deriva classe por arredondamento, faixa ou exclusão", () => {
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      0,
      249,
      250.001,
      420,
      499.999,
      599.999,
      601,
    ])
      expect(steelClassOf(value)).toBeUndefined();
    expect(steelClasses).toEqual(["CA-25", "CA-50", "CA-60"]);
    expect(steelLabel(420)).toBe("Personalizado (420 MPa), não suportado");
    expect(steelLabel(420.5)).toBe("Personalizado (420,5 MPa), não suportado");
    expect(steelBondDescription(420)).not.toContain("η1");
    expect(steelBondDescription(600)).toContain(
      "η1 = 1,0 · pendente de confirmação",
    );
    expect(steelBondDescription(500)).toContain("η1 = 2,25");
  });
  it("preserva a prévia geométrica de um número legado sem atribuir classe", () => {
    expect(geometricPinFactor(420, 16)).toBe(5);
    expect(geometricPinFactor(420, 20)).toBe(8);
    expect(steelClassOf(420)).toBeUndefined();
    const p = shortFixture();
    p.materials.fyk = 420;
    expect(calculate(p).status).toBe("unsupported");
  });
});

describe("Regressão capturada no upstream e903617, antes da integração de classes", () => {
  it.each([
    [
      250,
      1.013763853835911,
      1072.1989323512282,
      751.4420173462395,
      100,
      "670f1ed3b4fa00fb2f785260aa490608dbe27f796bfde5159865f19c473220b6",
    ],
    [
      500,
      2.2809686711308,
      953.0657176455362,
      333.974229931662,
      160,
      "b8af3f1276ca2bac1dce5924c04fd13e7aacc2d194db22725bf7cc58a58d699a",
    ],
    [
      600,
      1.013763853835911,
      2573.277437642948,
      771.9832312928844,
      120,
      "deee9d8fcfd3fc553e8e6bca3dcb61a6174c9148f12d4db18fd6c92781366adb",
    ],
  ] as const)(
    "preserva todo o resultado e a ancoragem para fyk=%s MPa",
    (fyk, fbd, lb, lbNec, pin, hash) => {
      const p = shortFixture();
      p.materials.fyk = fyk;
      p.rebar.tieDiameter = 20;
      p.design.bond = "poor";
      // Mesmo projeto capturado antes do recorte; preserve o hash integral,
      // números/fingerprint preservados; somente rótulos públicos são normalizados
      // pelo helper documentado de N4. Campo ausente usa keep.
      delete (p.design as Partial<typeof p.design>).excessConcrete;
      delete (p.rebar as Partial<typeof p.rebar>).stirrupBranches;
      delete (p.rebar as Partial<typeof p.rebar>).constructiveDiameter;
      const result = legacyN4Labels(calculate(p));
      expect(result.values.fbd).toBe(fbd);
      expect(result.values.lb).toBe(lb);
      expect(result.values.anchorRequired).toBe(lbNec);
      expect(result.checks.find((c) => c.id === "loopPin")?.demand).toBe(pin);
      expect(
        createHash("sha256").update(JSON.stringify(result)).digest("hex"),
      ).toBe(hash);
    },
  );
});

describe("Rótulos nas saídas e persistência numérica", () => {
  it.each(steelClasses)(
    "usa %s nos desenhos, quadro, PDF e auditoria sem mudar a gravação",
    async (steel) => {
      const project = exampleProject(),
        p = shortFixture();
      p.materials.fyk = fykOf(steel);
      project.pieces = [p];
      const detail = buildDetail(p),
        drawing = pieceDrawing(project, detail);
      expect(drawingSvg(drawing)).toContain(`Tirante ${steel}`);
      expect(drawingDxf(drawing)).toContain(`Tirante ${steel}`);
      expect(steelCsv([detail])).toContain(`"${steel}"`);
      const pdf = new TextDecoder("latin1").decode(await toPdf(project, p));
      expect(pdf).toContain(`Tirante: ${steel}`);
      expect(pdf).toContain(`Aderencia do tirante ${steel}: eta1`);
      if (bondCoefficientPending(steel))
        expect(pdf).toContain("pendente de confirmacao");
      const audit = JSON.parse(toCalculationJson(project, p));
      expect(audit.input.materials.fyk).toBe(fykOf(steel));
      expect(audit.input.materials).not.toHaveProperty("steelClass");
      expect(audit.result).toEqual(calculate(p));
    },
  );
  it("um desconhecido é personalizado nos desenhos e PDF, sem rótulo CA-42", async () => {
    const project = exampleProject(),
      p = shortFixture();
    p.materials.fyk = 420;
    project.pieces = [p];
    const svg = drawingSvg(pieceDrawing(project, buildDetail(p)));
    expect(svg).toContain("Personalizado (420 MPa), não suportado");
    expect(svg).not.toContain("CA-42");
    const pdf = new TextDecoder("latin1").decode(await toPdf(project, p));
    expect(pdf).toContain("Personalizado");
    expect(pdf).not.toContain("CA-42");
  });
});
