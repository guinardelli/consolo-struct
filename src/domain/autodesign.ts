import { area, type Piece } from "./model";
import { calculate, tieLayout, type CalculationResult } from "./engine";
import { reactionGeometry, stirrupLayout, upperStitchLayout } from "./theory";
export interface DesignProposal {
  piece: Piece;
  result: CalculationResult;
  changed: boolean;
  message: string;
  candidates: number;
}
const isBeam = (r: CalculationResult) =>
  r.combinations.some((c) => c.method === "beam");
/** Beam model (1 < a/d ≤ 2): N3 must meet Atransv,nec and smáx, and N2 the stitch area,
 * before a tie candidate is judged. Stirrups never change VRd2, so a beamShear failure persists. */
function beamSecondary(p: Piece, r: CalculationResult) {
  const v = r.values;
  // Each load case has its own shear-dependent limit, independent of tie demand.
  const spacingLimit = Math.min(
    ...r.combinations.map((c) => c.values.beam_stirrupSpacingLimit),
  );
  if (v.stirrupRequired !== undefined && Number.isFinite(spacingLimit)) {
    const span = stirrupLayout(p).last - stirrupLayout(p).first;
    p.rebar.stirrupCount = Math.min(
      100,
      Math.max(
        1,
        Math.ceil(
          v.stirrupRequired /
            area(p.rebar.stirrupBranches ?? 2, p.rebar.stirrupDiameter),
        ),
        p.geometry.length <= spacingLimit
          ? 1
          : 1 + Math.ceil(span / spacingLimit),
      ),
    );
  }
  if (v.beam_stitchApplies && v.stitchRequired !== undefined)
    p.rebar.stitchCount = Math.min(
      100,
      Math.max(
        p.rebar.stitchCount,
        Math.ceil(v.stitchRequired / area(2, p.rebar.stitchDiameter)),
      ),
    );
}
/** Apply the former post-winner sizing to every candidate, without changing bar sizes. */
function designSecondary(p: Piece, result: CalculationResult) {
  const v = result.values;
  const beam = isBeam(result);
  // An invalid flexural domain omits demands. Counts cannot repair that domain;
  // retain its checks instead of turning an absent demand into a NaN count.
  const demands = [
    v.stirrupRequired,
    v.lowerRequired,
    v.splittingRequired,
    v.suspensionRequired,
  ];
  if (!beam || v.beam_stitchApplies) demands.push(v.stitchRequired);
  if (demands.some((value) => value === undefined || !Number.isFinite(value)))
    return;
  // A beam with h > 600 mm has skin reinforcement (review), not stitch: N2 stays as informed.
  if (!beam || v.beam_stitchApplies) {
    p.rebar.stitchCount = Math.max(
      1,
      Math.ceil(v.stitchRequired / area(2, p.rebar.stitchDiameter)),
      Math.ceil((2 * v.d) / 3 / Math.min(100, p.geometry.loadOffset)),
    );
    const actualStitch = upperStitchLayout(p, tieLayout(p));
    p.rebar.stitchCount = Math.max(
      p.rebar.stitchCount,
      1 +
        Math.ceil(
          (actualStitch.end - actualStitch.start) /
            Math.min(100, reactionGeometry(p).a),
        ),
    );
  }
  if (beam) beamSecondary(p, result);
  else
    p.rebar.stirrupCount = Math.max(
      1,
      Math.ceil(
        v.stirrupRequired /
          area(p.rebar.stirrupBranches ?? 2, p.rebar.stirrupDiameter),
      ),
    );
  p.design.lowerStitchCount =
    v.lowerRequired > 0
      ? Math.max(
          Math.ceil(v.lowerRequired / area(2, p.rebar.stitchDiameter)),
          Math.ceil(v.d / 3 / Math.min(100, p.geometry.loadOffset)),
        )
      : 0;
  p.design.splittingCount = Math.ceil(
    v.splittingRequired / area(2, p.design.splittingDiameter),
  );
  p.design.suspensionCount = Math.ceil(
    v.suspensionRequired / area(2, p.design.suspensionDiameter),
  );
}
/** Finite enumeration; each candidate recomputes d and all simultaneous combinations.
 * Never invents support reinforcement, weld resistance, joint preparation or an input confirmation. */
export function suggestReinforcement(input: Piece): DesignProposal {
  let best: Piece | undefined;
  let score = Infinity,
    bestArea = Infinity,
    candidates = 0;
  const critical = new Set([
    "tie",
    "mechanical",
    "strut",
    "angleMin",
    "nodeSupport",
    "ductility",
    "bearing",
    "tieDepth",
    "clearSpacing",
    "tieDiameter",
    "tiePitch",
    "frontClearance",
    "loopPin",
    "loopWidth",
    "loopEven",
    "loopSteel",
    "cover",
    "literatureHorizontal",
    "literatureTip",
    "literatureConcrete",
    "literatureStrut",
    "beamDomain",
    "beamShear",
    "beamStirrups",
    "beamStirrupSpacing",
    "beamStitch",
    "stitch",
    "stitchSpacing",
    "stitchZone",
    "stitchClear",
    "stitchDiameter",
    "lowerStitch",
    "lowerSpacing",
    "transverse",
    "suspension",
    "splitting",
  ]);

  let commonFailures: Map<string, string> | undefined;
  let lastFailures = new Map<string, string>();
  let lastDiameter = -Infinity;
  let lastReasons: string[] = [];
  let secondaryExceeded = false;
  const secondaryDomainMessage =
    "As armaduras secundárias excedem o domínio de edição. Revise a seção e as bitolas.";

  for (const diameter of [6.3, 8, 10, 12.5, 16, 20, 25]) {
    for (
      let count = 2;
      count <= 24;
      count += input.design.frontAnchor === "loop" ? 2 : 1
    ) {
      const candidateArea = area(count, diameter);
      // Equality must survive: layers and count still break ties across diameters.
      if (candidateArea > bestArea) break;
      let viableCount = false;
      for (let layers = 1; layers <= 3; layers++) {
        const p = structuredClone(input);
        p.rebar.tieCount = count;
        p.rebar.tieDiameter = diameter;
        p.design.tieLayers = layers;
        if (
          layers > count ||
          (p.design.frontAnchor === "loop" &&
            tieLayout(p).rows.some((row) => row.count % 2))
        )
          continue;
        candidates++;
        let r = calculate(p);
        const initial = r;
        if (r.combinations.length) {
          if (isBeam(r)) {
            beamSecondary(p, r);
            r = calculate(p);
          }
          designSecondary(p, r);
          r = calculate(p);
          if (r.status === "invalid") secondaryExceeded = true;
        }
        // An out-of-range secondary count removes engine checks. Retain the
        // original critical failures (e.g. beamDomain) for the diagnostic only.
        const failures = new Map(
          (r.status === "invalid" ? initial.checks : r.checks)
            .filter((c) => critical.has(c.id) && c.status === "fail")
            .map((c) => [c.id, c.label]),
        );
        commonFailures =
          commonFailures === undefined
            ? new Map(failures)
            : new Map([...commonFailures].filter(([id]) => failures.has(id)));
        // External diameter order is increasing: keep the last assessed layout
        // of the greatest diameter, rather than a failure from a smaller one.
        if (diameter >= lastDiameter) {
          lastDiameter = diameter;
          lastFailures = failures;
          lastReasons = r.reasons;
        }
        if (r.status === "invalid" || !r.combinations.length || failures.size)
          continue;
        viableCount = true;
        const candidateScore = candidateArea + layers * 0.001 + count * 0.00001;
        if (candidateScore < score) {
          best = p;
          score = candidateScore;
          bestArea = candidateArea;
        }
      }
      // Assess every layer at this count; a failed count never abandons a diameter.
      if (viableCount) break;
    }
  }
  if (!best) {
    const labels = [
      ...(commonFailures?.size ? commonFailures : lastFailures).values(),
    ];
    const diagnostic =
      candidates === 0
        ? "Nenhum candidato chegou a ser avaliado: todos os arranjos foram descartados por camadas incompatíveis ou linhas ímpares na ancoragem em laço."
        : labels.length
          ? `Verificações bloqueadoras: ${labels.join("; ")}.`
          : lastReasons.length
            ? `Não foi possível dimensionar os candidatos: ${lastReasons.join("; ")}`
            : "Nenhum candidato produziu um resultado de cálculo válido.";
    return {
      piece: input,
      result: calculate(input),
      changed: false,
      candidates,
      message: [
        secondaryExceeded
          ? secondaryDomainMessage
          : "Nenhum arranjo de tirante atende ao modelo e ao espaço disponível nesta busca (φ 6,3–25; até 24 ramos; até 3 camadas).",
        diagnostic,
        "Nenhum dado foi alterado.",
      ].join(" "),
    };
  }
  const final = calculate(best);
  if (final.status === "invalid")
    return {
      piece: input,
      result: calculate(input),
      changed: false,
      candidates,
      message: secondaryDomainMessage,
    };
  return {
    piece: best,
    result: final,
    changed: JSON.stringify(best) !== JSON.stringify(input),
    candidates,
    message: `Arranjo sugerido entre ${candidates} candidatos. Verifique os resultados: ancoragens, suporte e pendências externas permanecem com os dados informados.`,
  };
}
