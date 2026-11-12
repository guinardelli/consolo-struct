import type { Bar, Detail } from "./model";
import { at, type BarPath, type Point } from "./geometry";

// Projection of the detailing bars onto the modelling views. Drawing.tsx
// consumes these functions so the elevation and section A–A read the same
// physical geometry (mm) that feeds the fabrication drawing, instead of
// rebuilding a partial copy of it.

/** Elevation-plane (x, depth) geometry of the families seen in elevation. */
export type ElevationShape =
  | { kind: "path"; bar: Bar; path: BarPath }
  | { kind: "line"; bar: Bar; a: Point; b: Point }
  | { kind: "end-on"; bar: Bar; center: Point };

/**
 * Families projected here: porta-estribos (mounting), pins and the transverse
 * welded bar, which the modelling elevation did not draw. Tie, stitch,
 * stirrup and positive bars keep their dedicated renderers.
 */
export function elevationShapes(detail: Detail): ElevationShape[] {
  const { loadOffset } = detail.piece.geometry;
  const { pinProjection, pinEmbedment } = detail.piece.detailing;
  const shapes: ElevationShape[] = [];
  for (const bar of detail.bars) {
    if (bar.family === "mounting")
      shapes.push({ kind: "path", bar, path: bar.path });
    else if (bar.family === "pin")
      shapes.push({
        kind: "line",
        bar,
        a: { x: loadOffset, y: -pinProjection },
        b: { x: loadOffset, y: pinEmbedment },
      });
    else if (bar.family === "welded")
      // Perpendicular to the elevation plane: seen end-on.
      for (const loc of bar.locations)
        shapes.push({ kind: "end-on", bar, center: { x: loc.x, y: loc.z } });
  }
  return shapes;
}

/** A bar whose axis crosses the cut plane, with its position in the section. */
export type SectionCrossing = {
  bar: Bar;
  /** Distance from the left face of the piece, mm. */
  lateral: number;
  /** Depth below the top face, mm. */
  depth: number;
};

/**
 * Bars that physically cross the plane x = cutX. A bar is reported only when
 * its centre line spans that plane, so nothing is simulated in a cut it does
 * not intersect. Mounting bars lie in the two lower stirrup corners.
 */
export function sectionCrossings(detail: Detail, cutX = 0): SectionCrossing[] {
  const { cover, width } = detail.piece.geometry;
  const { stirrupDiameter } = detail.piece.rebar;
  const crossings: SectionCrossing[] = [];
  for (const bar of detail.bars) {
    if (bar.family !== "mounting") continue;
    const xs = bar.path.segments.flatMap((s) =>
      s.type === "line"
        ? [s.a.x, s.b.x]
        : [
            at(s.center, s.radius, s.start).x,
            at(s.center, s.radius, s.start + s.sweep).x,
          ],
    );
    if (cutX < Math.min(...xs) || cutX > Math.max(...xs)) continue;
    // Mounting locations are [x = 0 at the support face, x = tip end].
    const depth = bar.locations[0].z;
    const offset = cover + stirrupDiameter + bar.diameter / 2;
    for (const lateral of [offset, width - offset])
      crossings.push({ bar, lateral, depth });
  }
  return crossings;
}

/** SVG path data for a bar centre line, mapped by `X` and `Y` (mm → px). */
export function barPathData(
  path: BarPath,
  X: (x: number) => number,
  Y: (y: number) => number,
  scale: number,
) {
  return path.segments
    .map((seg, i) => {
      if (seg.type === "line") {
        const move = i === 0 ? `M${X(seg.a.x)} ${Y(seg.a.y)}` : "";
        return `${move}L${X(seg.b.x)} ${Y(seg.b.y)}`;
      }
      const start = at(seg.center, seg.radius, seg.start);
      const end = at(seg.center, seg.radius, seg.start + seg.sweep);
      const move = i === 0 ? `M${X(start.x)} ${Y(start.y)}` : "";
      return `${move}A${seg.radius * scale} ${seg.radius * scale} 0 ${Math.abs(seg.sweep) > Math.PI ? 1 : 0} ${seg.sweep > 0 ? 1 : 0} ${X(end.x)} ${Y(end.y)}`;
    })
    .join("");
}
