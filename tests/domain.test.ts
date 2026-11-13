import { describe, expect, it } from "vitest";
import {
  area,
  decodeProject,
  exampleProject,
  fingerprint,
  geometryErrors,
  volume,
} from "../src/domain/model";
import { calculate } from "../src/domain/engine";
import { toCsv, toDxf, toSvg } from "../src/lib/exports";

describe("Geometria em unidades canônicas", () => {
  it("calcula o volume de um prisma trapezoidal em m³", () => {
    const p = exampleProject().pieces[0];
    expect(volume(p.geometry)).toBeCloseTo(0.0225, 10);
    expect(volume({ ...p.geometry, width: 600 })).toBeCloseTo(0.045, 10);
  });
  it("calcula a área fornecida de quatro barras de 20 mm, sem afirmar dimensionamento", () => {
    expect(area(4, 20) / 100).toBeCloseTo(12.56637, 5);
  });
  it("detecta carga fora da peça e altura invertida sem quebrar o editor", () => {
    const p = exampleProject().pieces[0];
    p.geometry.loadOffset = 300;
    p.geometry.tipHeight = 500;
    expect(geometryErrors(p)).toHaveLength(2);
  });
  it("detecta arranjo que não cabe em uma camada", () => {
    const p = exampleProject().pieces[0];
    p.rebar.tieCount = 30;
    expect(geometryErrors(p).join()).toContain("camadas informadas");
  });
});
describe("Arquivos e invalidação dos resultados", () => {
  it("abre aço legado personalizado, preserva o número e mantém unsupported", () => {
    const project = exampleProject();
    project.pieces[0].materials.fyk = 420;
    const opened = decodeProject(JSON.stringify(project));
    expect(opened).toEqual(project);
    expect(opened.schemaVersion).toBe(5);
    const result = calculate(opened.pieces[0]);
    expect(result.status).toBe("unsupported");
    expect(result.reasons).toContain(
      "O motor admite aço do tirante CA-25, CA-50 ou CA-60; informe fyk 250, 500 ou 600 MPa.",
    );
    expect(result.combinations).toEqual([]);
    expect(decodeProject(JSON.stringify(opened)).pieces[0].materials.fyk).toBe(
      420,
    );
  });
  it("abre projeto antigo com os coeficientes padrão após migrar para esquema 5", () => {
    const original = exampleProject();
    const legacy = JSON.parse(JSON.stringify(original));
    for (const p of legacy.pieces) {
      delete p.design.gammaC;
      delete p.design.gammaS;
    }
    const decoded = decodeProject(JSON.stringify(legacy));
    expect(decoded.schemaVersion).toBe(5);
    for (const p of decoded.pieces) {
      expect(p.design.gammaC).toBe(1.4);
      expect(p.design.gammaS).toBe(1.15);
    }
    expect(decoded).toEqual(original);
  });
  it("preserva coeficientes próprios de cada peça ao salvar e reabrir", () => {
    const project = exampleProject();
    project.pieces[0].design.gammaC = 1.3;
    project.pieces[0].design.gammaS = 1.1;
    expect(decodeProject(JSON.stringify(project))).toEqual(project);
  });
  it("preserva todos os parâmetros no round-trip JSON", () => {
    const p = exampleProject();
    expect(decodeProject(JSON.stringify(p))).toEqual(p);
  });
  it.each([
    "{}",
    "null",
    "{erro",
    JSON.stringify({ ...exampleProject(), schemaVersion: 99 }),
    JSON.stringify({ ...exampleProject(), pieces: [] }),
  ])("rejeita arquivo incompatível: %s", (raw) => {
    expect(() => decodeProject(raw)).toThrow();
  });
  it("rejeita ids repetidos e parâmetros de controle ilimitados", () => {
    const p = exampleProject();
    p.pieces.push(p.pieces[0]);
    expect(() => decodeProject(JSON.stringify(p))).toThrow();
    const q = exampleProject();
    q.pieces[0].rebar.tieCount = 1000000;
    expect(() => decodeProject(JSON.stringify(q))).toThrow();
  });
  it("não restaura resultados serializados como verificação atual", () => {
    const project = exampleProject();
    const p = project.pieces[0];
    const result = calculate(p);
    expect(result.kind).toBe("calculated");
    p.geometry.height += 10;
    expect(fingerprint(p)).not.toBe(result.fingerprint);
    expect(
      decodeProject(
        JSON.stringify({ ...project, results: { [p.id]: result } }),
      ),
    ).not.toHaveProperty("results");
  });
  it("exporta geometria DXF em milímetros e com aviso", () => {
    const dxf = toDxf(exampleProject().pieces[0]);
    expect(dxf).toContain("$INSUNITS\n70\n4");
    expect(dxf).toContain("10\n250\n20\n-200");
    expect(dxf).toContain("NAO EXECUTIVO");
  });
  it("escapa texto no SVG e neutraliza fórmula na planilha", () => {
    const p = exampleProject();
    p.pieces[0].name = "<script>&";
    expect(toSvg(p.pieces[0])).toContain("&lt;script&gt;&amp;");
    p.pieces[0].description = "=1+1";
    expect(toCsv(p)).toContain('"\'=1+1"');
  });
});
