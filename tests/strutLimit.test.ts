import { describe, expect, it } from "vitest";
import { calculate } from "../src/domain/engine";
import { defaultDesign } from "../src/domain/design";
import { strutLimitAllowed } from "../src/domain/strutLimit";
import {
  decodeProject,
  exampleProject,
  newPiece,
  type Piece,
} from "../src/domain/model";
import { suggestReinforcement } from "../src/domain/autodesign";
import { toCalculationJson, toCsv, toDxf, toSvg } from "../src/lib/exports";
import { cantileverFixture, shortFixture } from "./fixtures";

const strut = (p: Piece) => calculate(p).checks.find((c) => c.id === "strut")!;

describe("Critério selecionável do limite da biela — issue #5", () => {
  it("mantém fcd2 para peças novas e arquivos antigos, com os padrões após migrar para esquema 5", () => {
    expect(defaultDesign().strutLimit).toBe("fcd2");
    expect(newPiece(1).design.strutLimit).toBe("fcd2");
    const old = JSON.parse(JSON.stringify(exampleProject()));
    old.pieces.forEach((piece: any) => {
      delete piece.design.strutLimit;
    });
    const opened = decodeProject(JSON.stringify(old));
    expect(opened.schemaVersion).toBe(5);
    expect(
      opened.pieces.every((piece) => piece.design.strutLimit === "fcd2"),
    ).toBe(true);
  });

  it.each([
    ["fcd2", "direct", 11.314285714285717],
    ["fcd3", "direct", 13.577142857142857],
    ["indirect085", "indirect", 18.214285714285715],
    ["direct100", "direct", 21.42857142857143],
  ] as const)(
    "%s reproduz o limite para C30, γc=1,4, sem arredondar",
    (criterion, loadType, expected) => {
      const piece = shortFixture();
      piece.design.strutLimit = criterion;
      piece.design.loadType = loadType;
      const result = calculate(piece);
      const check = result.checks.find((c) => c.id === "strut")!;
      expect(check.capacity).toBeCloseTo(expected, 10);
      expect(check.utilization).toBeCloseTo(check.demand! / expected, 12);
      const review = result.checks.find((c) => c.id === "strutLimitCriterion");
      if (criterion === "fcd2") expect(review).toBeUndefined();
      else {
        expect(review?.status).toBe("review");
        expect(review?.detail).toContain("limite escolhido");
        expect(review?.detail).toContain("padrão fcd2 11,3143 MPa");
        expect(review?.detail).toContain("não aprova o projeto");
        expect(result.status).not.toBe("pass");
      }
    },
  );

  it.each([
    ["direct100", "indirect", "carga direta"],
    ["indirect085", "direct", "carga indireta"],
  ] as const)(
    "rejeita %s com carga %s inclusive em arquivo editado à mão",
    (criterion, loadType, message) => {
      const piece = shortFixture();
      piece.design.strutLimit = criterion;
      piece.design.loadType = loadType;
      expect(strutLimitAllowed(criterion, loadType)).toBe(false);
      const result = calculate(piece);
      expect(result.status).toBe("unsupported");
      expect(result.reasons.join(" ")).toContain(message);
      expect(result.combinations).toEqual([]);
      expect(result.values).toEqual({});
    },
  );

  it("padrão explícito e campo ausente têm números, fórmulas e estados idênticos", () => {
    const piece = shortFixture();
    const old = JSON.parse(JSON.stringify(piece));
    delete old.design.strutLimit;
    const { fingerprint: _oldFingerprint, ...legacy } = calculate(old);
    const { fingerprint: _newFingerprint, ...explicit } = calculate(piece);
    expect(explicit).toEqual(legacy);
    expect(strut(piece)).toMatchObject({
      demand: 4.161583229865512,
      capacity: 11.314285714285717,
      status: "pass",
    });
    expect(explicit.status).toBe("pass");
  });

  it("altera apenas strut e acrescenta a revisão; fixa nós, apoio, escoamento e inclinação", () => {
    const piece = shortFixture();
    const standard = calculate(piece);
    piece.design.strutLimit = "fcd3";
    const chosen = calculate(piece);
    expect(chosen.values).toEqual(standard.values);
    expect(chosen.assumptions).toEqual(standard.assumptions);
    const unaffected = (checks: typeof chosen.checks) =>
      checks.filter((c) => !["strut", "strutLimitCriterion"].includes(c.id));
    expect(unaffected(chosen.checks)).toEqual(unaffected(standard.checks));
    expect(chosen.status).toBe("review");
    for (const [id, demand, capacity] of [
      ["angleMin", 0.57, 1.204],
      ["nodeSupport", 1.6988716720765669, 16.02857142857143],
      ["bearing", 4.257142857142857, 13.577142857142857],
      ["ductility", 349672.92144303786, 362480.58367590385],
    ] as const) {
      const check = chosen.checks.find((c) => c.id === id)!;
      expect(check.demand).toBeCloseTo(demand, 10);
      expect(check.capacity).toBeCloseTo(capacity, 10);
    }
  });

  it("mantém limites complementares de El Debs e aplica o critério a todas as combinações", () => {
    const piece = shortFixture();
    piece.design.literatureRecommendations = true;
    piece.design.combinations = [
      { name: "Adicional", vertical: 120000, horizontal: 12000, gamma: 1.4 },
    ];
    const standard = calculate(piece);
    piece.design.strutLimit = "direct100";
    const chosen = calculate(piece);
    for (const [i, combination] of chosen.combinations.entries()) {
      expect(
        combination.checks.find((c) => c.id === "strut")?.capacity,
      ).toBeCloseTo(30 / 1.4, 12);
      expect(
        combination.checks.find((c) => c.id === "strutLimitCriterion")?.status,
      ).toBe("review");
      expect(
        combination.checks.find((c) => c.id === "literatureStrut"),
      ).toEqual(
        standard.combinations[i].checks.find((c) => c.id === "literatureStrut"),
      );
    }
  });

  it.each(["friction", "beam"] as const)(
    "não altera verificações do modelo %s",
    (model) => {
      const piece = model === "beam" ? cantileverFixture() : newPiece(1);
      const before = calculate(piece);
      piece.design.strutLimit = "fcd3";
      const after = calculate(piece);
      expect(after.combinations[0].method).toBe(model);
      expect(after.checks).toEqual(before.checks);
      expect(after.values).toEqual(before.values);
      expect(after.status).toBe(before.status);
    },
  );

  it("persistência e cálculo auditável registram o critério e a fórmula escolhidos", () => {
    const project = exampleProject();
    const piece = shortFixture();
    piece.design.strutLimit = "fcd3";
    project.pieces = [piece];
    const opened = decodeProject(JSON.stringify(project));
    expect(opened.pieces[0].design.strutLimit).toBe("fcd3");
    const audit = JSON.parse(toCalculationJson(opened, opened.pieces[0]));
    expect(audit.input.design.strutLimit).toBe("fcd3");
    expect(
      audit.result.checks.find((c: any) => c.id === "strut").formula,
    ).toContain("0,72·αv2·fcd");
    expect(
      audit.result.checks.find((c: any) => c.id === "strutLimitCriterion")
        .status,
    ).toBe("review");
    expect(toCsv(opened)).toContain('"review"');
    const standard = structuredClone(piece);
    standard.design.strutLimit = "fcd2";
    expect(toDxf(piece)).toBe(toDxf(standard));
    expect(toSvg(piece)).toBe(toSvg(standard));
  });

  it("a sugestão de armaduras conserva a pendência review do critério alternativo", () => {
    const piece = shortFixture();
    piece.design.strutLimit = "fcd3";
    const suggestion = suggestReinforcement(piece);
    expect(suggestion.piece.design.strutLimit).toBe("fcd3");
    expect(
      suggestion.result.checks.find((c) => c.id === "strutLimitCriterion")
        ?.status,
    ).toBe("review");
    expect(suggestion.result.status).not.toBe("pass");
  });
});
