import { constructiveGeometry } from "../detailing/transverse";
import { steelMass } from "../detailing/geometry";
import {
  calculate,
  classificationLabels,
  ENGINE_VERSION,
  methodLabels,
  POLICY,
} from "../domain/engine";
import { area, number, type Piece, type Project } from "../domain/model";
import { concreteProfile, pieceVolume } from "../domain/profile";
import { steelBondDescription, steelLabel } from "../domain/steel";

const anchorRatioLabel = (v: Record<string, number>) =>
  v.anchorRatioFloor
    ? "Razao As,req/As,ef usada (minimo 1,0)"
    : "Razao As,req/As,ef usada (sem piso)";
export function piecePoints(p: Piece): [number, number][] {
  const g = p.geometry;
  return [
    [0, 0],
    [g.length, 0],
    ...[...concreteProfile(p).bottom]
      .reverse()
      .map((v): [number, number] => [v.x, -v.depth]),
  ];
}
export function toSvg(p: Piece): string {
  const g = p.geometry;
  const xml = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const width = g.columnWidth + g.length + 180,
    height = g.height + 260;
  const path = piecePoints(p)
    .map(([x, y]) => `${x},${-y}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-g.columnWidth - 90} -170 ${width} ${height}"><rect x="${-g.columnWidth - 90}" y="-170" width="${width}" height="${height}" fill="white"/><g stroke="#3e4c60" stroke-width="2" fill="#f2f4f7"><rect x="${-g.columnWidth}" y="-80" width="${g.columnWidth}" height="${g.height + 140}"/><polygon points="${path}"/></g><g font-family="sans-serif" font-size="12" fill="#33445c"><text x="${-g.columnWidth}" y="-130">${xml(p.name)} - ConsoloStruct 0.7 | GEOMETRIA NAO EXECUTIVA</text><text x="${-g.columnWidth}" y="${g.height + 85}">Unidades: mm. Consultar memoria de calculo. Desenho nao executivo.</text></g></svg>`;
}
export function toDxf(p: Piece): string {
  const g = p.geometry;
  const lines: (string | number)[] = [
    0,
    "SECTION",
    2,
    "HEADER",
    9,
    "$ACADVER",
    1,
    "AC1015",
    9,
    "$INSUNITS",
    70,
    4,
    0,
    "ENDSEC",
    0,
    "SECTION",
    2,
    "ENTITIES",
  ];
  const polyline = (points: [number, number][], layer: string) =>
    lines.push(
      0,
      "LWPOLYLINE",
      100,
      "AcDbEntity",
      8,
      layer,
      100,
      "AcDbPolyline",
      90,
      points.length,
      70,
      1,
      ...points.flatMap(([x, y]) => [10, x, 20, y]),
    );
  polyline(piecePoints(p), "GEOMETRIA");
  polyline(
    [
      [-g.columnWidth, g.height * 0.5],
      [0, g.height * 0.5],
      [0, -g.height * 1.4],
      [-g.columnWidth, -g.height * 1.4],
    ],
    "PILAR",
  );
  lines.push(
    0,
    "TEXT",
    100,
    "AcDbEntity",
    8,
    "AVISO",
    100,
    "AcDbText",
    10,
    -g.columnWidth,
    20,
    g.height * 0.7,
    40,
    Math.max(g.height * 0.035, 8),
    1,
    "ConsoloStruct 0.7 - GEOMETRIA NAO EXECUTIVA - NAO EXECUTIVO",
  );
  lines.push(0, "ENDSEC", 0, "EOF");
  return lines.join("\n") + "\n";
}
const csvCell = (v: unknown) =>
  `"${String(v)
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
export function toCsv(project: Project) {
  const rows: unknown[][] = [
    [
      "ConsoloStruct 0.7 - Quantidades e verificacoes ELU; consultar memoria e pendencias",
    ],
    [
      "Peca",
      "Descricao",
      "Quantidade",
      "b (cm)",
      "h (cm)",
      "h2 (cm)",
      "L (cm)",
      "V (kN)",
      "H (kN)",
      "Tirante (barras)",
      "Diametro (mm)",
      "As fornecida (cm2)",
      "Volume consolo total (m3)",
      "Estado ELU",
      "As necessaria (cm2)",
      "Costura superior necessaria (cm2)",
      "Ancoragem necessaria (cm)",
      "Combinacao do tirante",
      "N3 ramos efetivos por posicao",
      "N3 area fornecida (mm2)",
      "N4 barras por peca",
      "N4 diametro (mm)",
      "N4 C unitario (cm)",
      "N4 massa total (kg)",
    ],
  ];
  for (const p of project.pieces) {
    const r = calculate(p);
    const n4 = constructiveGeometry(p);
    const n4Cut = Math.ceil(n4.path.length - 1e-7);
    rows.push([
      p.name,
      p.description,
      p.quantity,
      p.geometry.width / 10,
      p.geometry.height / 10,
      p.geometry.tipHeight / 10,
      p.geometry.length / 10,
      p.loads.vertical / 1000,
      p.loads.horizontal / 1000,
      p.rebar.tieCount,
      p.rebar.tieDiameter,
      number(area(p.rebar.tieCount, p.rebar.tieDiameter) / 100, 2),
      number(pieceVolume(p) * p.quantity, 3),
      r.status,
      r.values.tieRequired === undefined
        ? ""
        : number(r.values.tieRequired / 100, 3),
      r.values.stitchRequired === undefined
        ? ""
        : number(r.values.stitchRequired / 100, 3),
      r.values.anchorRequired === undefined
        ? ""
        : number(r.values.anchorRequired / 10, 3),
      r.governingCase,
      p.rebar.stirrupBranches ?? 2,
      number(
        area(
          (p.rebar.stirrupBranches ?? 2) * p.rebar.stirrupCount,
          p.rebar.stirrupDiameter,
        ),
        3,
      ),
      n4.branches,
      n4.diameter,
      n4.path.valid ? number(n4Cut / 10, 1) : "",
      n4.path.valid
        ? number(steelMass(n4Cut, n4.diameter) * n4.branches * p.quantity, 3)
        : "",
    ]);
  }
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
export function toCalculationJson(project: Project, p: Piece) {
  return JSON.stringify(
    {
      format: "lumeconsolo-calculation",
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      project: {
        name: project.name,
        client: project.client,
        author: project.author,
      },
      units: { length: "mm", force: "N", stress: "MPa", area: "mm2" },
      input: p,
      result: calculate(p),
    },
    null,
    2,
  );
}
export async function toPdf(project: Project, p: Piece): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const { pdfIcon } = await import("../branding/pdfIcon");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const result = calculate(p);
  const statuses = {
    pass: "ATENDE AS VERIFICACOES IMPLEMENTADAS",
    fail: "HA VERIFICACOES NAO ATENDIDAS",
    review: "CONFERENCIA COMPLEMENTAR NECESSARIA",
    invalid: "ENTRADAS INVALIDAS",
    unsupported: "FORA DO DOMINIO",
  };
  const ascii = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[γ]/g, "gamma")
      .replace(/α/g, "alpha")
      .replace(/β/g, "beta")
      .replace(/η/g, "eta")
      .replace(/θ/g, "theta")
      .replace(/σ/g, "sigma")
      .replace(/τ/g, "tau")
      .replace(/ρ/g, "rho")
      .replace(/φ|ϕ/g, "phi")
      .replace(/μ/g, "mu")
      .replace(/ω/g, "omega")
      .replace(/λ/g, "lambda")
      .replace(/Δ/g, "Delta")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/−|–|—/g, "-")
      .replace(/·|×/g, " x ")
      .replace(/′/g, "'")
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/ₛ/g, "s")
      .replace(/[^\x20-\x7E\n]/g, "");
  let y = 38;
  const header = () => {
    doc.addImage(pdfIcon, "PNG", 18, 9, 14, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(24, 33, 47);
    doc.text("ConsoloStruct | Memoria de calculo", 36, 15);
    doc.setFontSize(8);
    doc.setTextColor(52, 72, 209);
    doc.text("por OPENSTRUCT", 36, 21);
    doc.setFontSize(8);
    doc.setTextColor(70);
    doc.text(`Motor ${ENGINE_VERSION} | ${POLICY} | ELU estatico`, 18, 29);
    doc.setDrawColor(180);
    doc.line(18, 33, 192, 33);
    doc.setDrawColor(255, 138, 61);
    doc.line(18, 33, 48, 33);
    y = 41;
  };
  const page = () => {
    doc.addPage();
    header();
  };
  const line = (text: string, size = 9, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(ascii(text), 174) as string[];
    for (const l of lines) {
      if (y > 272) page();
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(40);
      doc.text(l, 18, y);
      y += size * 0.46;
    }
    y += 1.5;
  };
  const title = (s: string) => {
    if (y > 248) page();
    y += 4;
    line(s, 11, true);
  };
  const num = (n: number | null) =>
    n === null
      ? "--"
      : Number.isFinite(n)
        ? n.toLocaleString("pt-BR", { maximumFractionDigits: 5 })
        : "indisponivel";
  // Omitted beam values are indeterminate (invalid flexural domain), not unavailable.
  const beamNum = (n: number | undefined) =>
    n === undefined ? "indeterminado" : num(n);
  header();
  line(project.name, 13, true);
  line(`Peca: ${p.name} | ${p.description} | Quantidade: ${p.quantity}`);
  line(
    `Cliente: ${project.client} | Responsavel: ${project.author || "nao informado"}`,
  );
  line(`Emitido: ${new Date().toISOString()}`);
  title(statuses[result.status]);
  line(
    "O resultado se refere ao modelo e as verificacoes implementadas. Nao constitui verificacao integral da estrutura ou detalhamento executivo. Pendencias devem ser resolvidas pelo projetista.",
  );
  result.reasons.forEach((r) => line(r, 10, true));
  title("1. Hipoteses e alcance");
  result.assumptions.forEach((a, i) => line(`${i + 1}. ${a}`));
  title("2. Identificacao das entradas");
  line(
    `b=${p.geometry.width} mm; h=${p.geometry.height} mm; h2=${p.geometry.tipHeight} mm; L=${p.geometry.length} mm; a=${p.geometry.loadOffset} mm; cnom=${p.geometry.cover} mm; P=${p.geometry.columnWidth} mm.`,
  );
  if ((p.design.excessConcrete ?? "keep") === "remove")
    line(
      `Concreto excedente: remover. Situacao: ${concreteProfile(p).status === "removed" ? "recorte aplicado abaixo da biela" : "recorte nao aplicado, geometria original"}; ver nota excessConcrete.`,
    );
  line(
    `fck=${p.materials.fck} MPa; fyk=${p.materials.fyk} MPa. N1=${p.rebar.tieCount} ramos phi ${p.rebar.tieDiameter}; N2=${p.rebar.stitchCount} estribos phi ${p.rebar.stitchDiameter}; N3=${p.rebar.stirrupCount} posicoes, ${p.rebar.stirrupBranches ?? 2} ramos efetivos, phi ${p.rebar.stirrupDiameter}; N4=${p.rebar.stirrupBranches ?? 2} barras phi ${p.rebar.constructiveDiameter ?? 8}, sem contribuicao resistente.`,
  );
  line(
    `Tirante: ${steelLabel(p.materials.fyk)}; transversal: ${steelLabel(p.design.fykTransverse)}.`,
  );
  line(steelBondDescription(p.materials.fyk));
  line(
    `Acoes principais: V=${num(p.loads.vertical)} N; H=${num(p.loads.horizontal)} N; gammaf=${p.loads.gamma}. Os parametros completos constam do apendice.`,
  );
  const n4 = constructiveGeometry(p);
  line(
    `N4 construtiva: face inferior com dobra frontal e prolongamento no suporte; ${n4.branches} barras phi ${n4.diameter} mm; C unitario=${number(Math.ceil(n4.path.length - 1e-7) / 10, 1)} cm; massa total=${number(steelMass(Math.ceil(n4.path.length - 1e-7), n4.diameter) * n4.branches * p.quantity, 3)} kg. Consultar forma e pendencias no detalhamento.`,
  );
  n4.problems.forEach((message) => line(message, 10, true));
  title("3. Envelope de verificacoes");
  line(
    `Combinacao determinante da area do tirante: ${result.governingCase || "--"}. Cada verificacao e envelopada separadamente; nao se misturam V e H de casos diferentes.`,
  );
  for (const c of result.checks) {
    if (y > 243) page();
    line(`${c.status.toUpperCase()} | ${c.label}`, 9, true);
    if (c.demand !== null)
      line(
        `Exigencia: ${num(c.demand)} ${c.unit} | Disponivel/limite: ${num(c.capacity)} ${c.unit} | Razao: ${c.utilization === null ? "--" : num(c.utilization * 100) + "%"}`,
      );
    if (c.formula) line(c.formula);
    if (c.detail) line(c.detail, 8);
    line(`Ref.: ${c.reference}`, 8);
  }
  title("4. Memoria por combinacao");
  for (const [i, c] of result.combinations.entries()) {
    title(
      `${i + 1}. ${c.name} | ${classificationLabels[c.classification].toUpperCase()} | ${methodLabels[c.method].toUpperCase()}`,
    );
    const v = c.values;
    if (c.method === "beam") {
      for (const [label, val, unit] of [
        ["Vd", v.vertical, "N"],
        ["Hd total", v.horizontal, "N"],
        ["Hd informado positivo", v.horizontalProvided, "N"],
        ["Hd estimado no apoio", v.horizontalEstimated, "N"],
        ["Fator de majoracao aplicado", v.factor, ""],
        ["gamma n 9062", v.gammaN9062, ""],
        ["gamma n adotado", v.gammaN, ""],
        ["gamma c adotado", v.gammaC, ""],
        ["gamma s adotado", v.gammaS, ""],
        ["gamma c referencia da producao", v.gammaCReference, ""],
        ["gamma s referencia da producao", v.gammaSReference, ""],
        ["fcd", v.fcd, "MPa"],
        ["fyd adotado", v.fydLimited, "MPa"],
        ["d", v.d, "mm"],
        ["d'", v.dPrime, "mm"],
        ["a/d", v.ratio, ""],
        ["Centro fisico do apoio", v.bearingCenter, "mm"],
        ["a de calculo", v.a, "mm"],
        ["Excentricidade total no contato", v.bearingEccentricity, "mm"],
        ["Piso bibliografico para H", v.horizontalFloor, "N"],
        ["Parcela de H acrescentada pelo piso", v.horizontalFloorAdded, "N"],
        ["Complementos El Debs ativos (1=sim)", v.literatureEnabled, ""],
        ["Vsd", v.beam_shear, "N"],
        ["Msd = Vd a + Hd (hapoio + d')", v.beam_moment, "N.mm"],
        ["kmd", v.beam_kmd, ""],
        ["kmd limite (radicando = 0)", v.beam_kmdLimit, ""],
        ["Radicando", v.beam_radicand, ""],
        ["kx", v.beam_kx, ""],
        ["kz", v.beam_kz, ""],
        ["As,flex", v.beam_flexSteel, "mm2"],
        ["As,h = Hd/fy", v.beam_horizontalSteel, "mm2"],
        ["As modelo resistente", v.tieModel, "mm2"],
        ["As minima por flexao", v.tieMinimumFlexure, "mm2"],
        ["As minima mecanica", v.tieMinimumMechanical, "mm2"],
        ["As necessaria", v.tieRequired, "mm2"],
        ["As efetiva", v.tieProvided, "mm2"],
        ["VRd2", v.beam_shearLimit, "N"],
        ["0,67 VRd2", v.beam_reducedShearLimit, "N"],
        ["Vc (desconsiderado)", v.beam_concreteShear, "N"],
        ["(asw/s) necessario", v.beam_stirrupRateRequired, "mm2/mm"],
        ["(asw/s) minimo", v.beam_stirrupRateMinimum, "mm2/mm"],
        ["(asw/s) adotado", v.beam_stirrupRate, "mm2/mm"],
        ["Atransv necessaria", v.beam_transverseRequired, "mm2"],
        ["Atransv adotada", v.stirrupProvided, "mm2"],
        ["smax dos estribos", v.beam_stirrupSpacingLimit, "mm"],
        ["Passo real de N3 (ou L com um estribo)", v.beam_stirrupSpacing, "mm"],
        ...(v.beam_stitchApplies
          ? [
              ["(As/s) costura", v.beam_stitchRate, "mm2/mm"],
              ["As costura superior", v.beam_stitchRequired, "mm2"],
              ["Espacamento real da costura no detalhe", v.stitchSpacing, "mm"],
            ]
          : [
              ["As pele por face (revisar)", v.beam_skinPerFace, "mm2"],
              ["As pele total (revisar)", v.beam_skinTotal, "mm2"],
            ]),
        ["As fendilhamento transversal", v.splittingRequired, "mm2"],
        ["As suspensao", v.suspensionRequired, "mm2"],
        ["fbd", v.fbd, "MPa"],
        ["lb basico", v.lb, "mm"],
        ["alfa da ancoragem no suporte", v.anchorAlpha, ""],
        [anchorRatioLabel(v), v.anchorRatio, ""],
        ["lb necessario", v.anchorRequired, "mm"],
      ] as [string, number | undefined, string][])
        line(`${label} = ${beamNum(val)} ${val === undefined ? "" : unit}`, 9);
      line(
        "Viga em balanco (1 < a/d <= 2): flexao simples e cisalhamento pelo Modelo I com Vc = 0. Nao se aplicam bielas e tirantes nem os complementos de El Debs do consolo curto (mantido apenas o piso Hd >= 0,20 Vd, quando ativado). ELS, fissuracao e flecha nao verificados. Referencias citadas no GN Corbel, com conferencia pendente.",
        8,
      );
      for (const ch of c.checks)
        line(
          `${ch.status.toUpperCase()} | ${ch.label}: ${num(ch.demand)} / ${num(ch.capacity)} ${ch.unit}`,
          8,
        );
      continue;
    }
    for (const [label, val, unit] of [
      ["Vd", v.vertical, "N"],
      ["Hd total", v.horizontal, "N"],
      ["Hd informado positivo", v.horizontalProvided, "N"],
      ["Hd estimado no apoio", v.horizontalEstimated, "N"],
      ["Fator de majoracao aplicado", v.factor, ""],
      ["gamma n 9062", v.gammaN9062, ""],
      ["gamma n adotado", v.gammaN, ""],
      ["gamma c adotado", v.gammaC, ""],
      ["gamma s adotado", v.gammaS, ""],
      ["gamma c referencia da producao", v.gammaCReference, ""],
      ["gamma s referencia da producao", v.gammaSReference, ""],
      ["fcd", v.fcd, "MPa"],
      ["fyd adotado", v.fydLimited, "MPa"],
      ["d", v.d, "mm"],
      ["d'", v.dPrime, "mm"],
      ["a/d", v.ratio, ""],
      ["Centro fisico do apoio", v.bearingCenter, "mm"],
      ["a de calculo", v.a, "mm"],
      ["Deslocamento da reacao", v.reactionShift, "mm"],
      ["Excentricidade total no contato", v.bearingEccentricity, "mm"],
      [
        "Comprimento efetivo da subarea de apoio",
        v.effectiveBearingLength,
        "mm",
      ],
      ["Piso bibliografico para H", v.horizontalFloor, "N"],
      ["Parcela de H acrescentada pelo piso", v.horizontalFloorAdded, "N"],
      ["Complementos El Debs ativos (1=sim)", v.literatureEnabled, ""],
      ["As necessaria", v.tieRequired, "mm2"],
      ["As efetiva", v.tieProvided, "mm2"],
      ["As modelo resistente", v.tieModel, "mm2"],
      ["As minima por flexao", v.tieMinimumFlexure, "mm2"],
      ["As minima mecanica", v.tieMinimumMechanical, "mm2"],
      [
        "As modelo geometrico Araujo (auxiliar)",
        v.stm_tieForce / v.fydLimited,
        "mm2",
      ],
      ["As simplificado NBR 9062 (auxiliar)", v.tie9062, "mm2"],
      ["As El Debs equilibrio completo (3.18)", v.tieElDebs, "mm2"],
      [
        "As El Debs aproximacao 1,2 H (3.19), auxiliar",
        v.elDebs_tieForceApprox / v.fydLimited,
        "mm2",
      ],
      ["As atrito-cisalhamento (auxiliar)", v.tieFriction, "mm2"],
      ["Sigma biela simplificada El Debs (3.22)", v.elDebs_strutStress, "MPa"],
      ["Limite beta fcd da biela simplificada", v.elDebs_strutLimit, "MPa"],
      ["Termo Hd dh / (Vd a), mantido", v.elDebs_horizontalMomentRatio, ""],
      [
        "Tau limite simplificado sem termo de H (3.25), auxiliar",
        v.elDebs_tauLimit,
        "MPa",
      ],
      ["Asv para costura", v.asV, "mm2"],
      ["Costura por unidade de altura", v.stitchRate, "mm2/mm"],
      ["As costura superior", v.stitchRequired, "mm2"],
      ["As costura complementar El Debs (3.27)", v.stitchLiterature, "mm2"],
      ["Espacamento real da costura no detalhe", v.stitchSpacing, "mm"],
      ["As costura inferior", v.lowerRequired, "mm2"],
      ["As vertical construtiva", v.stirrupRequired, "mm2"],
      ["As fendilhamento transversal", v.splittingRequired, "mm2"],
      ["As suspensao", v.suspensionRequired, "mm2"],
      ["fbd", v.fbd, "MPa"],
      ["lb basico", v.lb, "mm"],
      ["alfa da ancoragem no suporte", v.anchorAlpha, ""],
      [anchorRatioLabel(v), v.anchorRatio, ""],
      ["lb necessario", v.anchorRequired, "mm"],
      ...(c.method === "strut"
        ? [
            ["theta", v.stm_theta, "graus"],
            ["z", v.stm_z, "mm"],
            ["c2", v.stm_strutWidth, "mm"],
            ["T", v.stm_tieForce, "N"],
            ["Fc", v.stm_strutForce, "N"],
            ["sigma b", v.stm_strutStress, "MPa"],
          ]
        : [
            ["mu", v.mu, ""],
            ["tau wd", v.tau, "MPa"],
            ["tau wu", v.tauLimit, "MPa"],
          ]),
    ])
      line(`${label} = ${num(Number(val))} ${unit}`, 9);
    for (const ch of c.checks)
      line(
        `${ch.status.toUpperCase()} | ${ch.label}: ${num(ch.demand)} / ${num(ch.capacity)} ${ch.unit}`,
        8,
      );
  }
  title("5. Referencias e criterios");
  line(
    "ABNT NBR 6118:2026: secoes 7, 8, 9, 17.3.5.2, 18.3.2.2, 22.2, 22.3, 22.5.1. ABNT NBR 9062:2017: secoes 6.3.4, 7.3, 9.2.1.1. Documentos fornecidos pelo usuario.",
  );
  line(
    "El Debs: Concreto pre-moldado, trecho cap.4, especialmente 4.3.1.1 e 4.4.4. Araujo: Curso de Concreto Armado, v.4, trecho cap.4, secao 4.5. Formulas historicas sao adaptadas segundo a politica documentada; nao se presume equivalencia normativa entre edicoes.",
  );
  line(
    "Material adicional: Base Consolo, trecho El Debs secao 3.5.1, pp.125-130, equacoes 3.18-3.27 e quadro 3.2. As recomendacoes bibliograficas sao identificadas separadamente das exigencias normativas. Modelos auxiliares nao sao aplicaveis fora de seu dominio.",
  );
  if (result.combinations.some((c) => c.method === "beam"))
    line(
      "Viga em balanco (1 < a/d <= 2): NBR 6118 secoes 14.6.4.3, 17.2, 17.3.5.2.3, 17.4.2.2 e 18.3.3.2; NBR 9062:2017 secoes 7.3.6 e 7.3.7.2, conforme citadas no GN Corbel. As referencias aguardam conferencia nos textos da ABNT pelo responsavel tecnico.",
    );
  line(
    "Veja docs/CRITERIOS-DE-CALCULO.md e docs/VALIDACAO-MOTOR.md no pacote de codigo. O arquivo .calc.json exporta todas as entradas e resultados com precisao completa.",
  );
  title("Apendice: snapshot integral das entradas (mm, N, MPa)");
  // Preserve exact field names for independent reproduction against the open-source schema.
  JSON.stringify(p, null, 2)
    .split("\n")
    .forEach((l) => line(l, 8));
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `ConsoloStruct 0.7 | OPENSTRUCT | Motor ${ENGINE_VERSION} | ${ascii(p.name).slice(0, 35)} | ${i}/${pages}`,
      18,
      287,
    );
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
