import {
  constructiveGeometry,
  transverseGeometry,
  translatePath,
} from "../detailing/transverse";
import { samplePath } from "../detailing/geometry";
import { number, type GeometryKey, type Piece } from "../domain/model";
import { tieLayout } from "../domain/engine";
import { reactionGeometry, upperStitchLayout } from "../domain/theory";
import { bottomReach, concreteProfile } from "../domain/profile";
import {
  beamArrangementActive,
  beamBarPositions,
  beamLayout,
} from "../detailing/beam";

/** World coordinates in mm: X = corbel length, Y = width, Z = up. */
export type Point3 = [number, number, number];
export interface Dimension3D {
  id: GeometryKey;
  label: string;
  from: Point3;
  to: Point3;
  witnesses: [Point3, Point3][];
  anchor: Point3;
  value: number;
}
export interface Load3D {
  id: "vertical" | "horizontal";
  label: string;
  from: Point3;
  to: Point3;
  anchor: Point3;
  value: number;
}
export interface SteelPath {
  /** N4 is mandatory constructive steel; P1 is the independent beam positive family. */
  id: "N1" | "N2" | "N3" | "N4" | "P1";
  points: Point3[];
  diameter: number;
}
export interface SceneModel {
  profile: [number, number][];
  width: number;
  support: { center: Point3; size: Point3 };
  bearing: { center: Point3; length: number; width: number };
  dimensions: Dimension3D[];
  loads: Load3D[];
  steel: SteelPath[];
  bounds: { min: Point3; max: Point3 };
  span: number;
}
const mid = (a: Point3, b: Point3): Point3 =>
  a.map((v, i) => (v + b[i]) / 2) as Point3;
export function buildSceneModel(p: Piece): SceneModel {
  const g = p.geometry,
    q = p.design,
    r = p.rebar;
  const span = Math.max(g.columnWidth + g.length, g.height, g.width);
  const reaction = reactionGeometry(p);
  const margin = Math.max(22, span * 0.075),
    side = g.width / 2;
  const layout = tieLayout(p);
  const concrete = concreteProfile(p);
  const { d, dPrime, rows } = layout;
  const dim = (
    id: GeometryKey,
    symbol: string,
    from: Point3,
    to: Point3,
    witnesses: [Point3, Point3][],
  ): Dimension3D => ({
    id,
    label: `${symbol} = ${number(g[id] / 10, 1)} cm`,
    from,
    to,
    anchor: mid(from, to),
    witnesses,
    value: g[id],
  });
  const dimensions: Dimension3D[] = [
    dim(
      "length",
      "L",
      [0, -side - margin, margin],
      [g.length, -side - margin, margin],
      [
        [
          [0, -side, 0],
          [0, -side - margin, margin],
        ],
        [
          [g.length, -side, 0],
          [g.length, -side - margin, margin],
        ],
      ],
    ),
    dim(
      "columnWidth",
      "P",
      [-g.columnWidth, -side - margin, margin],
      [0, -side - margin, margin],
      [
        [
          [-g.columnWidth, -side, margin * 0.5],
          [-g.columnWidth, -side - margin, margin],
        ],
        [
          [0, -side, 0],
          [0, -side - margin, margin],
        ],
      ],
    ),
    dim(
      "loadOffset",
      "a",
      [0, -side - margin, margin * 2.5],
      [g.loadOffset, -side - margin, margin * 2.5],
      [
        [
          [0, -side, 0],
          [0, -side - margin, margin * 2.5],
        ],
        [
          [g.loadOffset, -side, 0],
          [g.loadOffset, -side - margin, margin * 2.5],
        ],
      ],
    ),
    dim(
      "height",
      "h",
      [g.length + margin * 2.5, -side, 0],
      [g.length + margin * 2.5, -side, -g.height],
      [
        [
          [g.length, -side, 0],
          [g.length + margin * 2.5, -side, 0],
        ],
        [
          [0, -side, -g.height],
          [g.length + margin * 2.5, -side, -g.height],
        ],
      ],
    ),
    dim(
      "tipHeight",
      "h₂",
      [g.length + margin, -side, 0],
      [g.length + margin, -side, -g.tipHeight],
      [
        [
          [g.length, -side, 0],
          [g.length + margin, -side, 0],
        ],
        [
          [g.length, -side, -g.tipHeight],
          [g.length + margin, -side, -g.tipHeight],
        ],
      ],
    ),
    dim(
      "width",
      "b",
      [g.length, -side, -g.tipHeight - margin * 1.5],
      [g.length, side, -g.tipHeight - margin * 1.5],
      [
        [
          [g.length, -side, -g.tipHeight],
          [g.length, -side, -g.tipHeight - margin * 1.5],
        ],
        [
          [g.length, side, -g.tipHeight],
          [g.length, side, -g.tipHeight - margin * 1.5],
        ],
      ],
    ),
  ];
  const loads: Load3D[] = [];
  const vLabel = q.forceMode === "design" ? "Vd" : "Vk";
  const hLabel =
    q.horizontalMode === "estimated"
      ? "H adicional"
      : q.forceMode === "design"
        ? "Hd total"
        : "Hk total";
  if (p.loads.vertical !== 0)
    loads.push({
      id: "vertical",
      label: `${vLabel} = ${number(p.loads.vertical / 1000, 1)} kN${reaction.shift ? ` · a_calc ${number(reaction.a / 10, 1)} cm` : ""}`,
      value: p.loads.vertical,
      from: [reaction.a, 0, q.bearingHeight + span * 0.26],
      to: [reaction.a, 0, q.bearingHeight],
      anchor: [reaction.a, 0, q.bearingHeight + span * 0.29],
    });
  if (p.loads.horizontal !== 0)
    loads.push({
      id: "horizontal",
      label: `${hLabel} = ${number(p.loads.horizontal / 1000, 1)} kN`,
      value: p.loads.horizontal,
      from: [reaction.a, 0, q.bearingHeight],
      to: [
        reaction.a + Math.sign(p.loads.horizontal) * span * 0.24,
        0,
        q.bearingHeight,
      ],
      anchor: [
        reaction.a + Math.sign(p.loads.horizontal) * span * 0.27,
        0,
        q.bearingHeight + margin * 0.65,
      ],
    });
  const steel: SteelPath[] = [];
  const back = -Math.max(
    0,
    Math.min(q.supportAnchorLength, g.columnWidth - g.cover),
  );
  // Beam arrangement: axes through the bend vertices of the detailed bars (arcs omitted).
  const beam = beamArrangementActive(p) ? beamLayout(p) : null;
  if (beam) {
    for (const bar of beam.top)
      for (const v of beamBarPositions(p, bar.count, bar.diameter))
        steel.push({
          id: "N1",
          diameter: bar.diameter,
          points: bar.vertices.map((pt) => [pt.x, v - side, -pt.y] as Point3),
        });
    for (const v of beamBarPositions(
      p,
      beam.bottom.count,
      beam.bottom.diameter,
    ))
      steel.push({
        id: "P1",
        diameter: beam.bottom.diameter,
        points: beam.bottom.vertices.map(
          (pt) => [pt.x, v - side, -pt.y] as Point3,
        ),
      });
  }
  // Axes of N1 only: no inferred bends or executable anchorage geometry.
  for (const row of beam ? [] : rows) {
    const edge = side - g.cover - r.stirrupDiameter - r.tieDiameter / 2;
    for (let i = 0; i < row.count; i++) {
      const y = row.count === 1 ? 0 : -edge + (2 * edge * i) / (row.count - 1);
      steel.push({
        id: "N1",
        diameter: r.tieDiameter,
        points: [
          [back, y, -row.y],
          [g.length - g.cover - r.tieDiameter / 2, y, -row.y],
        ],
      });
    }
  }
  const costura = (depth: number) => {
    const y = side - g.cover - r.stitchDiameter / 2;
    const end =
      concrete.status === "removed"
        ? Math.min(
            g.length - g.cover - r.stitchDiameter / 2,
            bottomReach(
              concrete,
              depth,
              g.cover + r.stitchDiameter / 2,
              g.length,
            ),
          )
        : g.height === g.tipHeight || depth <= g.tipHeight - g.cover
          ? g.length - g.cover
          : Math.max(
              0,
              (g.length * (g.height - depth - g.cover)) /
                (g.height - g.tipHeight),
            );
    const points: Point3[] = [
      [back, -y, -depth],
      [end, -y, -depth],
      [end, y, -depth],
      [back, y, -depth],
      [back, -y, -depth],
    ];
    steel.push({ id: "N2", diameter: r.stitchDiameter, points });
  };
  for (const depth of upperStitchLayout(p, layout).levels) costura(depth);
  if (reaction.a / d <= 0.5)
    for (let i = 0; i < q.lowerStitchCount; i++)
      costura(dPrime + (2 * d) / 3 + ((i + 0.5) * d) / 3 / q.lowerStitchCount);
  const transverse = transverseGeometry(p);
  for (const section of transverse.sections)
    steel.push({
      id: "N3",
      diameter: r.stirrupDiameter,
      points: samplePath(
        translatePath(section.path, section.offset, transverse.stirrupOffset),
        24,
      ).map((pt) => [section.x, pt.x - side, -pt.y] as Point3),
    });
  const constructive = constructiveGeometry(p);
  for (const v of constructive.positions)
    steel.push({
      id: "N4",
      diameter: constructive.diameter,
      points: samplePath(constructive.path, 24).map(
        (pt) => [pt.x, v - side, -pt.y] as Point3,
      ),
    });
  const cap = Math.max(60, g.height * 0.2);
  const support = {
    center: [-g.columnWidth / 2, 0, -g.height / 2] as Point3,
    size: [g.columnWidth, g.width, g.height + 2 * cap] as Point3,
  };
  const points: Point3[] = [
    [-g.columnWidth, -side, -g.height - cap],
    [g.length, -side, cap],
    ...dimensions.flatMap((x) => [x.from, x.to]),
    ...loads.flatMap((x) => [x.from, x.to, x.anchor]),
  ];
  const bounds = {
    min: [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i]))) as Point3,
    max: [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i]))) as Point3,
  };
  return {
    profile: [
      [0, 0],
      [g.length, 0],
      ...[...concrete.bottom]
        .reverse()
        .map((v): [number, number] => [v.x, -v.depth]),
    ],
    width: g.width,
    support,
    bearing: {
      center: [g.loadOffset, 0, 0],
      length: q.bearingLength,
      width: q.bearingWidth,
    },
    dimensions,
    loads,
    steel,
    bounds,
    span,
  };
}
