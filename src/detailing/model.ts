import { calculate, tieLayout, type CalculationResult } from "../domain/engine";
import { geometryErrors, type Piece } from "../domain/model";
import { stirrupLayout, upperStitchLayout } from "../domain/theory";
import {
  bottomOffsetDepth,
  bottomReach,
  concreteProfile,
} from "../domain/profile";
import {
  loopPinDefined,
  requiresSupportHook,
  steelClassOf,
  stirrupMandrelDefined,
} from "../domain/steel";
import {
  closedStirrup,
  mandrelDiameter,
  roundedPath,
  steelMass,
  samplePath,
  type BarPath,
} from "./geometry";
import { beamArrangementActive, beamLayout, beamBarPositions } from "./beam";
import type { BarArrangement } from "./settings";
import {
  constructiveGeometry,
  transverseGeometry,
  pathsClash,
} from "./transverse";

export type DetailIssue = {
  code: string;
  severity: "error" | "review";
  message: string;
};
export type Bar = {
  mark: string;
  family:
    | "tie"
    | "stitch"
    | "lower"
    | "stirrup"
    | "constructive"
    | "stirrupInner"
    | "pin"
    | "welded"
    | "positive";
  description: string;
  diameter: number;
  grade: number;
  quantity: number;
  path: BarPath;
  exactLength: number;
  cutLength: number;
  mandrel: number;
  width: number;
  height: number;
  hookTail: number;
  hookExtra: number;
  note: string;
  locations: { x: number; z: number; layer?: number }[];
};
export type Detail = {
  piece: Piece;
  bars: Bar[];
  issues: DetailIssue[];
  result: CalculationResult;
  mass: number;
  totalMass: number;
  arrangement: BarArrangement;
  tieRows: ReturnType<typeof tieLayout>["rows"];
  steelSummary: {
    grade: number;
    diameter: number;
    count: number;
    length: number;
    mass: number;
  }[];
};
const rounded = (n: number) => Math.round(n * 1000) / 1000;
const cm = (mm: number) =>
  (mm / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
export function pinCenters(p: Piece): number[] {
  const s = p.detailing;
  const pitch =
    s.pinSpacing > 0 ? s.pinSpacing : p.design.bearingWidth / (s.pins + 1);
  return Array.from(
    { length: s.pins },
    (_, i) =>
      p.geometry.width / 2 + s.pinCenterOffset + (i - (s.pins - 1) / 2) * pitch,
  );
}
export function buildDetail(piece: Piece): Detail {
  const p = piece,
    g = p.geometry,
    r = p.rebar,
    q = p.design,
    s = p.detailing;
  const layout = tieLayout(p),
    bars: Bar[] = [],
    issues: DetailIssue[] = [];
  const issue = (
    code: string,
    message: string,
    severity: DetailIssue["severity"] = "error",
  ) => {
    if (!issues.some((i) => i.code === code))
      issues.push({ code, message, severity });
  };
  geometryErrors(p).forEach((message, i) => issue(`geometry-${i}`, message));
  const add = (b: Omit<Bar, "mark" | "exactLength" | "cutLength">) => {
    const exactLength = b.path.length + b.hookExtra;
    if (!Number.isFinite(exactLength) || exactLength <= 0 || !b.path.valid) {
      issue(
        `shape-${b.family}`,
        `A forma de ${b.description.toLowerCase()} não comporta o mandril e as pontas informados.`,
      );
      return;
    }
    const key = JSON.stringify([
      b.family,
      b.grade,
      b.diameter,
      rounded(b.width),
      rounded(b.height),
      rounded(exactLength),
      b.note,
    ]);
    const existing = bars.find(
      (x) =>
        JSON.stringify([
          x.family,
          x.grade,
          x.diameter,
          rounded(x.width),
          rounded(x.height),
          rounded(x.exactLength),
          x.note,
        ]) === key,
    );
    if (existing) {
      existing.quantity += b.quantity;
      existing.locations.push(...b.locations);
    } else
      bars.push({
        ...b,
        mark: "",
        exactLength,
        cutLength: Math.ceil(exactLength - 1e-7),
      });
  };
  const result = calculate(p);
  const beam = beamArrangementActive(p);
  const beamBars = beam ? beamLayout(p, result.values) : null;
  if (s.barArrangement === "beam" && !beam)
    issue(
      "beam-unavailable",
      "O detalhamento “Armado como viga” só se aplica quando o concreto excedente é mantido. Com o recorte, a peça foi detalhada no modo de consolo atual.",
      "review",
    );
  const mainD = mandrelDiameter(r.tieDiameter, p.materials.fyk);
  const steel = steelClassOf(p.materials.fyk);
  if (requiresSupportHook(steel))
    issue(
      "smooth-detail",
      "Barras lisas CA-25 exigem ancoragem com gancho semicircular. A forma completa desse gancho não está implementada no gerador; detalhar especificamente antes da execução.",
    );
  const mainR = (mainD + r.tieDiameter) / 2;
  const mainFront = g.length - g.cover - r.tieDiameter / 2;
  const back =
    q.supportAnchor === "hook"
      ? s.supportHookProjection
      : q.supportAnchorLength;
  if (
    !beam &&
    back >
      g.columnWidth -
        g.cover -
        (q.supportAnchor === "hook" ? r.tieDiameter / 2 : 0)
  )
    issue(
      "tie-back",
      "O tirante ultrapassa o cobrimento na face posterior do suporte.",
    );
  if (!beam && q.supportAnchor === "hook") {
    if (s.supportHookTail < 8 * r.tieDiameter)
      issue(
        "hook-tail",
        "A ponta reta do gancho de 90° do tirante deve ter pelo menos 8 diâmetros.",
      );
    const available = back - mainR + (Math.PI * mainR) / 2 + s.supportHookTail;
    if (available + 1e-6 < q.supportAnchorLength)
      issue(
        "hook-available",
        "O percurso real do gancho é menor que o comprimento disponível declarado no cálculo.",
      );
    if (
      back < mainR ||
      layout.maxDepth + mainR + s.supportHookTail > g.height - g.cover
    )
      issue(
        "hook-fit",
        "O gancho do tirante não cabe no trecho de suporte representado; reveja projeção, ponta e altura.",
      );
  }
  if (!loopPinDefined(steel, r.tieDiameter))
    issue(
      "main-grade",
      "A tabela de mandris não define este diâmetro de CA-60 para a ancoragem adotada.",
    );
  layout.rows
    .filter((row) => row.count)
    .forEach((row, layer) => {
      const beamTop = beamBars?.top[layer];
      if (beamTop) {
        const { back: b, front: f } = beamTop;
        if (!b.fits || !f.fits)
          issue(
            "beam-top-anchor",
            `As dobras do tirante não alcançam a ancoragem necessária (lb,nec = ${cm(beamBars!.lbNecTop)} cm) dentro do contorno com o cobrimento informado. Reveja altura, bitola ou o comprimento do suporte.`,
          );
        add({
          family: "tie",
          description: "Tirante (negativa) dobrado",
          diameter: r.tieDiameter,
          grade: p.materials.fyk,
          quantity: row.count,
          path: beamTop.path,
          mandrel: beamTop.mandrel,
          width: 0,
          height: beamTop.span,
          hookTail: 0,
          hookExtra: 0,
          note: `Camada ${layer + 1}; armado como viga: dobras de 90° no suporte (${cm(b.leg)} cm) e na ponta (${cm(f.leg)} cm)`,
          locations: Array.from({ length: row.count }, (_, i) => ({
            x: i,
            z: row.y,
            layer,
          })),
        });
        return;
      }
      if (q.frontAnchor === "loop") {
        if (row.count % 2)
          issue(
            "tie-even",
            "Alças horizontais exigem número par de ramos em cada camada. Ajuste a quantidade ou as camadas.",
          );
        const specifiedD =
          layer > 0 && s.secondLoopDiameter > 0
            ? s.secondLoopDiameter
            : q.loopInternalDiameter;
        const loops = Math.floor(row.count / 2),
          d = Math.max(specifiedD, mainD);
        if (specifiedD < mainD)
          issue(
            "loop-mandrel",
            "O diâmetro interno da alça informado é menor que o mandril mínimo do tirante.",
          );
        const radius = (d + r.tieDiameter) / 2;
        const outerWidth =
          g.width - 2 * (g.cover + r.stirrupDiameter) - r.tieDiameter;
        const gap = layout.spacingHorizontalMin + r.tieDiameter;
        const maxPitch = Math.min(layout.d, 15 * r.tieDiameter);
        const innerTarget = Math.min(
          maxPitch,
          outerWidth - 2 * gap * (loops - 1),
        );
        const nestingPitch =
          loops > 1 ? (outerWidth - innerTarget) / (2 * (loops - 1)) : 0;
        if (loops === 1 && outerWidth > maxPitch + 1e-6)
          issue(
            "tie-real-pitch",
            "A distância real entre os ramos da alça ultrapassa o limite em planta. Use mais alças por camada ou reveja a largura.",
          );
        for (let i = 0; i < loops; i++) {
          const width = outerWidth - 2 * i * nestingPitch;
          if (width < 2 * radius) {
            issue(
              "nested-loops",
              "As alças do tirante se sobrepõem transversalmente. Aumente b, reduza ramos ou distribua em mais camadas.",
            );
            continue;
          }
          const startX = -back + (q.supportAnchor === "hook" ? mainR : 0);
          const path = roundedPath(
            [
              { x: startX, y: 0 },
              { x: mainFront, y: 0 },
              { x: mainFront, y: width },
              { x: startX, y: width },
            ],
            radius,
          );
          const hookExtra =
            q.supportAnchor === "hook"
              ? 2 * ((Math.PI * mainR) / 2 + s.supportHookTail)
              : 0;
          add({
            family: "tie",
            description: "Tirante em alça",
            diameter: r.tieDiameter,
            grade: p.materials.fyk,
            quantity: 1,
            path,
            mandrel: d,
            width,
            height: mainFront + back,
            hookTail: q.supportAnchor === "hook" ? s.supportHookTail : 0,
            hookExtra,
            note: `Camada ${layer + 1}; 2 ramos por alça${q.supportAnchor === "hook" ? "; 2 ganchos de 90° fora do plano" : "; ancoragem reta no suporte"}`,
            locations: [{ x: i, z: row.y, layer }],
          });
        }
        if (
          mainFront - radius - r.tieDiameter / 2 <
          g.loadOffset + q.bearingLength / 2
        )
          issue(
            "bearing-loop",
            "A curva frontal da alça invade a projeção da placa de apoio. Aumente a distância da placa à ponta.",
          );
      } else {
        const path = roundedPath(
          [
            { x: -back + (q.supportAnchor === "hook" ? mainR : 0), y: 0 },
            { x: mainFront, y: 0 },
          ],
          0,
        );
        add({
          family: "tie",
          description: "Tirante reto",
          diameter: r.tieDiameter,
          grade: p.materials.fyk,
          quantity: row.count,
          path,
          mandrel: mainD,
          width: 0,
          height: mainFront + back,
          hookTail: q.supportAnchor === "hook" ? s.supportHookTail : 0,
          hookExtra:
            q.supportAnchor === "hook"
              ? (Math.PI * mainR) / 2 + s.supportHookTail
              : 0,
          note: `Camada ${layer + 1}; ancoragem frontal soldada${q.supportAnchor === "hook" ? "; gancho de 90° no suporte" : ""}`,
          locations: Array.from({ length: row.count }, (_, i) => ({
            x: i,
            z: row.y,
            layer,
          })),
        });
        add({
          family: "welded",
          description: "Barra transversal soldada",
          diameter: q.weldedBarDiameter,
          grade: p.materials.fyk,
          quantity: 1,
          path: roundedPath(
            [
              { x: 0, y: 0 },
              { x: g.width - 2 * g.cover, y: 0 },
            ],
            0,
          ),
          mandrel: 0,
          width: 0,
          height: g.width - 2 * g.cover,
          hookExtra: 0,
          hookTail: 0,
          note: `Camada ${layer + 1}; solda conforme especificação do projeto`,
          locations: [{ x: mainFront, z: row.y, layer }],
        });
        issue(
          "weld-review",
          "Conferir soldas e a ligação do tirante à barra transversal conforme a especificação e qualificação do processo.",
          "review",
        );
      }
    });
  // Bottom face, with the excess-concrete cut when it applies.
  const concrete = concreteProfile(p);
  const bottomAt = (x: number, offset: number) =>
    bottomOffsetDepth(concrete, x, offset);
  if (
    !stirrupMandrelDefined(steelClassOf(q.fykTransverse), r.stitchDiameter) ||
    !stirrupMandrelDefined(steelClassOf(q.fykTransverse), r.stirrupDiameter)
  )
    issue(
      "transverse-mandrel",
      "A tabela 9.2 não define mandril de estribo CA-60 para bitola superior a 10 mm; adote aço/bitola compatíveis.",
    );
  const addHorizontal = (
    count: number,
    start: number,
    end: number,
    family: "stitch" | "lower",
  ) => {
    if (count > 0 && end < start) {
      issue(
        `zone-${family}`,
        "Não há altura suficiente para distribuir a costura preservando o cobrimento e a separação das barras.",
      );
      return;
    }
    const step = (end - start) / Math.max(count - 1, 1);
    for (let i = 0; i < count; i++) {
      const z = count === 1 ? (start + end) / 2 : start + i * step;
      const front = Math.min(
        g.length - g.cover - r.stitchDiameter / 2,
        bottomReach(concrete, z, g.cover + r.stitchDiameter / 2, g.length),
      );
      const embedment = s.stitchEmbedment;
      const width =
        g.width - 2 * (g.cover + r.stirrupDiameter) - r.stitchDiameter;
      const depth = front + embedment,
        mandrel = mandrelDiameter(r.stitchDiameter, q.fykTransverse, true);
      if (front < g.cover + r.stitchDiameter / 2)
        issue(
          "horizontal-front",
          "Uma costura não alcança o consolo mantendo cobrimento na face inferior. Reveja a distribuição vertical.",
        );
      if (
        embedment > g.columnWidth - g.cover - r.stitchDiameter / 2 ||
        embedment <= 0
      )
        issue(
          "stitch-back",
          "A penetração da costura no suporte é incompatível com a sua dimensão e cobrimento.",
        );
      add({
        family,
        description:
          family === "stitch" ? "Costura superior" : "Costura inferior",
        diameter: r.stitchDiameter,
        grade: q.fykTransverse,
        quantity: 1,
        path: closedStirrup(depth, width, r.stitchDiameter, mandrel),
        mandrel,
        width: depth,
        height: width,
        hookExtra: 0,
        hookTail: Math.max(5 * r.stitchDiameter, 50),
        note: `Fechado; 2 ganchos de 135°; c/${(step / 10).toFixed(1)} cm`,
        locations: [{ x: front, z }],
      });
    }
    if (
      count > 1 &&
      step - r.stitchDiameter <
        Math.max(20, r.stitchDiameter, 0.5 * q.aggregate)
    )
      issue(
        `spacing-${family}`,
        "O espaçamento livre da costura é insuficiente no arranjo desenhado.",
      );
    if (count > 1 && step > Math.min(100, g.loadOffset))
      issue(
        `max-spacing-${family}`,
        "O espaçamento real da costura ultrapassa o limite adotado no cálculo.",
      );
  };
  const upperStitch = upperStitchLayout(p, layout);
  const stitchStart = upperStitch.start;
  const stitchEnd = upperStitch.end;
  if (stitchStart >= stitchEnd)
    issue(
      "stitch-zone",
      "Não há altura disponível para a costura abaixo de todas as camadas do tirante.",
    );
  addHorizontal(r.stitchCount, stitchStart, stitchEnd, "stitch");
  const lowerEnd = bottomAt(
    g.cover +
      r.stitchDiameter / 2 +
      (mandrelDiameter(r.stitchDiameter, q.fykTransverse, true) +
        r.stitchDiameter) /
        2,
    g.cover + r.stitchDiameter / 2,
  );
  addHorizontal(
    q.lowerStitchCount,
    stitchEnd +
      Math.max(20, r.stitchDiameter, 0.5 * q.aggregate) +
      r.stitchDiameter,
    lowerEnd,
    "lower",
  );
  const { offset: transverseOffset, pitch } = stirrupLayout(p);
  const transverse = transverseGeometry(p);
  transverse.problems.forEach(({ code, message }) => issue(code, message));
  for (const section of transverse.sections) {
    add({
      family: section.internal ? "stirrupInner" : "stirrup",
      description: section.internal
        ? "N3 · Grampo interno"
        : "N3 · Estribo vertical externo",
      diameter: r.stirrupDiameter,
      grade: q.fykTransverse,
      quantity: 1,
      path: section.path,
      mandrel: transverse.mandrel,
      width: section.width,
      height: section.height,
      hookExtra: 0,
      hookTail: Math.max(5 * r.stirrupDiameter, 50),
      note: `${section.internal ? "Grampo interno" : "Fechado externo"}; 2 ramos; 2 ganchos de 135°${pitch ? `; c/${(pitch / 10).toFixed(1)} cm` : ""}${section.internal ? `; pareado com N3, afastamento longitudinal ${(transverse.innerShift / 10).toFixed(2)} cm para o interior` : ""}`,
      locations: [{ x: section.x, z: transverseOffset }],
    });
  }
  if (
    r.stirrupCount > 1 &&
    pitch - r.stirrupDiameter <
      Math.max(20, r.stirrupDiameter, 1.2 * q.aggregate)
  )
    issue(
      "stirrup-spacing",
      "Há congestionamento de estribos verticais; reveja a quantidade e o agregado.",
    );
  if (beamBars) {
    const bottom = beamBars.bottom;
    if (!loopPinDefined(steel, bottom.diameter))
      issue(
        "beam-bottom-mandrel",
        "O pino de dobramento da positiva CA-60 com bitola ≥ 20 mm não está definido na tabela 9.1. A forma mostrada é esquemática; detalhar especificamente antes da execução.",
      );
    const edge = g.cover + r.stirrupDiameter + bottom.diameter / 2;
    const gap = (g.width - 2 * edge) / (bottom.count - 1) - bottom.diameter;
    if (gap < Math.max(20, bottom.diameter, 1.2 * q.aggregate))
      issue(
        "beam-bottom-spacing",
        "As barras da armadura positiva não cabem na largura com o espaçamento livre mínimo. Reveja a quantidade, a bitola ou a largura da peça.",
      );
    if (!bottom.back.fits || !bottom.front.fits)
      issue(
        "beam-bottom-anchor",
        `As dobras da armadura positiva não alcançam a ancoragem de referência (lb,nec = ${cm(beamBars.lbNecBottom)} cm) sem interferir no tirante. Reveja a bitola da positiva ou a altura da peça.`,
        "review",
      );
    add({
      family: "positive",
      description: "Armadura positiva dobrada",
      diameter: bottom.diameter,
      grade: p.materials.fyk,
      quantity: bottom.count,
      path: bottom.path,
      mandrel: bottom.mandrel,
      width: 0,
      height: bottom.span,
      hookTail: 0,
      hookExtra: 0,
      note: `Armado como viga: dobras de 90° no suporte (${cm(bottom.back.leg)} cm) e na ponta (${cm(bottom.front.leg)} cm); não computada como armadura resistente`,
      locations: [
        { x: 0, z: bottom.depthSupport },
        { x: bottom.vertices.at(-1)!.x, z: bottom.depthTip },
      ],
    });
    issue(
      "beam-review",
      "Armado como viga: a ancoragem do tirante na ponta é feita por dobra, e não por alça ou barra transversal soldada (NBR 9062 §7.3.3.6–7). O cálculo por bielas e tirantes não muda, e a armadura positiva não entra como armadura resistente. Conferir a adequação do modo à peça e as interferências das dobras.",
      "review",
    );
  }
  const constructive = constructiveGeometry(p);
  constructive.problems.forEach((message, i) =>
    issue(`constructive-fit-${i}`, message),
  );
  if (!loopPinDefined(steelClassOf(q.fykTransverse), constructive.diameter))
    issue(
      "constructive-mandrel",
      "O mandril de N4 não está definido para esta classe de aço e bitola; conferir especificamente.",
    );
  add({
    family: "constructive",
    description: "N4 · Armadura construtiva",
    diameter: constructive.diameter,
    grade: q.fykTransverse,
    quantity: constructive.branches,
    path: constructive.path,
    mandrel: constructive.mandrel,
    width: 0,
    height: g.height - g.tipHeight,
    hookTail: constructive.tail,
    hookExtra: 0,
    note: `${constructive.branches} barras, uma por vértice inferior de N3; dobra frontal e prolongamento no suporte; sem contribuição resistente`,
    locations: constructive.positions.map((v) => ({ x: v, z: 0 })),
  });
  // Segment distances catch crossings between vertices, not only coincident samples.
  const n4Paths = constructive.positions.map((v) =>
    samplePath(constructive.path, 24).map((pt): [number, number, number] => [
      pt.x,
      v,
      pt.y,
    ]),
  );
  for (const other of bars.filter(
    (b) => b.family === "tie" || b.family === "positive",
  )) {
    const paths: [number, number, number][][] = [];
    if (beam) {
      for (const v of beamBarPositions(p, other.quantity, other.diameter))
        paths.push(samplePath(other.path, 24).map((pt) => [pt.x, v, pt.y]));
    } else if (q.frontAnchor === "loop") {
      const inset = (g.width - other.width) / 2;
      for (const loc of other.locations)
        paths.push(
          samplePath(other.path, 24).map((pt) => [pt.x, inset + pt.y, loc.z]),
        );
    } else {
      for (const v of beamBarPositions(p, other.quantity, other.diameter))
        paths.push(
          samplePath(other.path, 24).map((pt) => [
            pt.x,
            v,
            other.locations[0].z,
          ]),
        );
    }
    if (!beam && q.supportAnchor === "hook" && other.family === "tie") {
      const inset = q.frontAnchor === "loop" ? (g.width - other.width) / 2 : 0;
      const transverse =
        q.frontAnchor === "loop"
          ? [inset, g.width - inset]
          : beamBarPositions(p, other.quantity, other.diameter);
      for (const loc of other.locations)
        for (const v of transverse)
          paths.push(
            samplePath(
              roundedPath(
                [
                  { x: -back + mainR, y: loc.z },
                  { x: -back, y: loc.z },
                  { x: -back, y: loc.z + mainR + s.supportHookTail },
                ],
                mainR,
              ),
              24,
            ).map((pt) => [pt.x, v, pt.y]),
          );
    }
    const minimum = (other.diameter + constructive.diameter) / 2;
    if (
      n4Paths.some((n4) => paths.some((path) => pathsClash(n4, path, minimum)))
    )
      issue(
        other.family === "tie"
          ? "constructive-tie-clash"
          : "constructive-positive-clash",
        other.family === "tie"
          ? "N4 interfere com N1; rever o arranjo sem reduzir cobrimento, bitola ou dobra."
          : "N4 e a positiva P1 do modo viga interferem. Compatibilize o arranjo; ambas foram mantidas e quantificadas separadamente.",
      );
  }
  if (s.pins > 0) {
    const len = s.pinEmbedment + s.pinProjection;
    add({
      family: "pin",
      description: "Pino de ligação",
      diameter: s.pinDiameter,
      grade: 500,
      quantity: s.pins,
      path: roundedPath(
        [
          { x: 0, y: 0 },
          { x: 0, y: len },
        ],
        0,
      ),
      mandrel: 0,
      width: 0,
      height: len,
      hookExtra: 0,
      hookTail: 0,
      note: `Embutido ${(s.pinEmbedment / 10).toFixed(1)} cm; espera ${(s.pinProjection / 10).toFixed(1)} cm; verificar ligação`,
      locations: [{ x: g.loadOffset, z: 0 }],
    });
    issue(
      "pins",
      "Pinos representados e quantificados; a resistência da ligação e seu embutimento exigem verificação específica.",
      "review",
    );
    if (s.pinEmbedment > bottomAt(g.loadOffset, g.cover) || s.pinEmbedment <= 0)
      issue(
        "pin-fit",
        "O embutimento do pino ultrapassa a face inferior do consolo.",
      );
    const centers = pinCenters(p);
    const pinGap =
      centers.length > 1 ? centers[1] - centers[0] - s.pinDiameter : Infinity;
    if (s.pins > 1 && pinGap < Math.max(20, s.pinDiameter, 1.2 * q.aggregate))
      issue(
        "pin-spacing",
        "Os pinos não cabem na largura do apoio com espaçamento livre suficiente.",
      );
    const padEdge = (g.width - q.bearingWidth) / 2;
    if (
      centers.some(
        (v) =>
          v - s.pinDiameter / 2 < padEdge ||
          v + s.pinDiameter / 2 > g.width - padEdge,
      )
    )
      issue(
        "pin-pad",
        "Um pino ultrapassa a largura do apoio. Reveja o espaçamento e o deslocamento transversal.",
      );
    for (const b of bars.filter((b) => b.family === "tie")) {
      const positions =
        q.frontAnchor === "loop" && !beam
          ? [(g.width - b.width) / 2, (g.width + b.width) / 2]
          : Array.from(
              { length: b.quantity },
              (_, i) =>
                g.cover +
                r.stirrupDiameter +
                r.tieDiameter / 2 +
                (i *
                  (g.width -
                    2 * (g.cover + r.stirrupDiameter) -
                    r.tieDiameter)) /
                  Math.max(b.quantity - 1, 1),
            );
      if (
        b.locations.some((loc) => loc.z <= s.pinEmbedment) &&
        positions.some((v) =>
          centers.some(
            (c) => Math.abs(c - v) < (s.pinDiameter + b.diameter) / 2,
          ),
        )
      )
        issue(
          "pin-tie-clash",
          "Há interferência geométrica entre pino e tirante. Ajuste o espaçamento ou o deslocamento transversal dos pinos.",
        );
    }
    for (const b of bars.filter((b) => b.family === "stirrup"))
      if (
        b.locations.some(
          (loc) =>
            Math.abs(loc.x - g.loadOffset) < (s.pinDiameter + b.diameter) / 2,
        )
      )
        issue(
          "pin-stirrup-clash",
          "O eixo de um pino coincide com o estribo vertical. Compatibilize a posição dos pinos e a distribuição dos estribos.",
        );
  }
  if (q.splittingCount || q.suspensionCount)
    issue(
      "special-bars",
      "A armadura de fendilhamento ou suspensão informada no cálculo requer definição própria de forma e ancoragem; não foi incluída no quadro. Detalhe este reforço antes da execução.",
    );
  const familyMark: Record<Bar["family"], string> = {
    tie: "N1",
    stitch: "N2",
    lower: "N2I",
    stirrup: "N3",
    stirrupInner: "N3G",
    constructive: "N4",
    positive: "P1",
    welded: "TS",
    pin: "PINO",
  };
  for (const b of bars) {
    const group = bars.filter((v) => v.family === b.family);
    b.mark =
      familyMark[b.family] +
      (group.length > 1 ? `-${group.indexOf(b) + 1}` : "");
  }
  if (result.status !== "pass")
    issue(
      "calculation",
      `O cálculo desta peça tem situação ${result.status === "fail" ? "não atende" : result.status === "review" ? "pendente de revisão" : result.status === "unsupported" ? "fora do escopo" : "inválida"}. Consulte a memória.`,
      result.status === "fail" ||
        result.status === "invalid" ||
        result.status === "unsupported"
        ? "error"
        : "review",
    );
  issue(
    "support-review",
    "Conferir interferências com as barras do pilar, armadura local de ancoragem e ligação à peça apoiada no projeto de conjunto.",
    "review",
  );
  const mass = bars.reduce(
    (sum, b) => sum + steelMass(b.cutLength, b.diameter) * b.quantity,
    0,
  );
  const steelSummary: Detail["steelSummary"] = [];
  for (const b of bars) {
    let group = steelSummary.find(
      (v) => v.grade === b.grade && v.diameter === b.diameter,
    );
    if (!group) {
      group = {
        grade: b.grade,
        diameter: b.diameter,
        count: 0,
        length: 0,
        mass: 0,
      };
      steelSummary.push(group);
    }
    group.count += b.quantity;
    group.length += b.quantity * b.cutLength;
    group.mass += steelMass(b.cutLength, b.diameter) * b.quantity;
  }
  return {
    piece: p,
    bars,
    issues,
    result,
    mass,
    totalMass: mass * p.quantity,
    arrangement: beam ? "beam" : "consolo",
    tieRows: layout.rows,
    steelSummary: steelSummary.sort(
      (a, b) => a.grade - b.grade || a.diameter - b.diameter,
    ),
  };
}
