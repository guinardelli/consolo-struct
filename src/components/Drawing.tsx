import { tieLayout } from "../domain/engine";
import { reactionGeometry, upperStitchLayout } from "../domain/theory";
import {
  bottomOffsetDepth,
  bottomReach,
  concreteProfile,
} from "../domain/profile";
import { useId, useMemo } from "react";
import {
  beamArrangementActive,
  beamBarPositions,
  beamLayout,
} from "../detailing/beam";
import { buildDetail } from "../detailing/model";
import {
  barPathData,
  elevationShapes,
  sectionCrossings,
} from "../detailing/projection";
import { number, type Piece, type GeometryKey } from "../domain/model";
type Props = {
  piece: Piece;
  section?: boolean;
  rebar: boolean;
  dimensions: boolean;
  grid: boolean;
  zoom: number;
  pan: { x: number; y: number };
  forces: boolean;
  focus?: GeometryKey;
  selectedBar: string;
  onDimension: (key: GeometryKey, anchor: { x: number; y: number }) => void;
  onBar: (id: string) => void;
};
function Dim({
  x1,
  y1,
  x2,
  y2,
  label,
  active,
  onClick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  active?: boolean;
  onClick: (anchor: { x: number; y: number }) => void;
}) {
  const vertical = x1 === x2;
  return (
    <g
      className={`dimension ${active ? "dimension-active" : ""}`}
      role="button"
      aria-label={`Editar ${label}`}
      tabIndex={0}
      onClick={(e) => {
        const r = e.currentTarget
          .querySelector("rect")!
          .getBoundingClientRect();
        onClick({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget
            .querySelector("rect")!
            .getBoundingClientRect();
          onClick({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
      }}
    >
      <path
        d={`M${x1} ${y1}L${x2} ${y2} M${x1 - 4} ${y1 + 4}l8 -8 M${x2 - 4} ${y2 + 4}l8 -8`}
        fill="none"
      />
      <rect
        x={vertical ? x1 - 16 : (x1 + x2) / 2 - 35}
        y={vertical ? (y1 + y2) / 2 - 34 : y1 - 23}
        width={vertical ? 26 : 70}
        height={vertical ? 68 : 24}
        rx="0"
      />
      <text
        x={vertical ? x1 + 4 : (x1 + x2) / 2}
        y={vertical ? (y1 + y2) / 2 : y1 - 7}
        textAnchor="middle"
        transform={
          vertical ? `rotate(-90 ${x1 + 4} ${(y1 + y2) / 2})` : undefined
        }
      >
        {label}
      </text>
    </g>
  );
}
export default function Drawing({
  piece: p,
  section = false,
  rebar,
  dimensions,
  grid,
  zoom,
  pan,
  forces,
  focus,
  selectedBar,
  onDimension,
  onBar,
}: Props) {
  const uid = useId().replaceAll(":", "");
  const g = p.geometry;
  const reaction = reactionGeometry(p);
  const layout = tieLayout(p);
  const stitchLevels = [
    ...upperStitchLayout(p, layout).levels,
    ...(reaction.a / layout.d <= 0.5
      ? Array.from(
          { length: p.design.lowerStitchCount },
          (_, i) =>
            layout.dPrime +
            (2 * layout.d) / 3 +
            ((i + 0.5) * layout.d) / 3 / p.design.lowerStitchCount,
        )
      : []),
  ];
  const beam = useMemo(
    () => (beamArrangementActive(p) ? beamLayout(p) : null),
    [p],
  );
  // Families shared with the fabrication drawing, projected by one module.
  const detail = useMemo(() => (rebar ? buildDetail(p) : null), [p, rebar]);
  const shapes = useMemo(
    () => (detail ? elevationShapes(detail) : []),
    [detail],
  );
  const crossings = useMemo(
    () => (detail ? sectionCrossings(detail) : []),
    [detail],
  );
  const s = Math.min(480 / (g.columnWidth + g.length), 340 / (g.height + 80));
  const sectionLeft = 400 - (g.width * s) / 2;
  const stitchRadius = (p.rebar.stitchDiameter * s) / 2;
  const stitchInset = (depth: number) => {
    // Erode N3's rounded centerline by the complete N2 symbol and both
    // half-strokes. This graphical clearance does not change bar levels
    // or define an additional physical reinforcement spacing rule.
    const corner = Math.min(
      8,
      ((g.width - 2 * g.cover) * s) / 2,
      ((g.height - 2 * g.cover) * s) / 2,
    );
    const clearance = stitchRadius + s / 2 + 2.5 / 2;
    const edgeDistance =
      Math.min(depth - g.cover, g.height - g.cover - depth) * s;
    const innerCorner = Math.max(0, corner - clearance);
    const cornerInset =
      corner -
      Math.sqrt(
        Math.max(0, innerCorner ** 2 - Math.max(0, corner - edgeDistance) ** 2),
      );
    return (
      g.cover * s +
      Math.max(
        (p.rebar.stirrupDiameter + p.rebar.stitchDiameter / 2) * s,
        clearance,
        cornerInset,
      ) +
      s / 2
    );
  };
  const sectionCentroid = 140 + layout.dPrime * s;
  const dPrimeLabel = `d’ = ${number(layout.dPrime / 10, 1)} cm`;
  const ox = (800 - (g.columnWidth + g.length) * s) / 2 + g.columnWidth * s,
    oy = 185;
  const X = (x: number) => ox + x * s,
    Y = (y: number) => oy + y * s;
  const concrete = concreteProfile(p);
  const cut = concrete.status === "removed";
  const bottomPath = [...concrete.bottom]
    .reverse()
    .map((v) => `L${X(v.x)} ${Y(v.depth)}`)
    .join("");
  const path = `M${X(-g.columnWidth)} ${Y(-100)}H${X(0)}V${Y(0)}H${X(g.length)}${bottomPath}V${Y(g.height + 80)}H${X(-g.columnWidth)}Z`;
  // Original face, shown dashed where the excess concrete was cut away.
  const removedPath = cut
    ? `M${X(0)} ${Y(g.height)}L${X(g.length)} ${Y(g.tipHeight)}`
    : "";
  const polyline = (pts: { x: number; y: number }[]) =>
    pts.map((v, i) => `${i ? "L" : "M"}${X(v.x)} ${Y(v.y)}`).join("");
  const groupProps = (id: string) => ({
    className: `steel steel-${id} ${selectedBar === id ? "steel-selected" : ""}`,
    role: "button",
    tabIndex: 0,
    "aria-label": `Selecionar armadura ${id}`,
    onClick: () => onBar(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onBar(id);
      }
    },
  });
  const cm = (key: GeometryKey) =>
    `${key === "width" ? "b" : key === "height" ? "h" : key === "tipHeight" ? "h₂" : key === "length" ? "L" : key === "loadOffset" ? "a" : "P"} = ${number(g[key] / 10, 1)}`;
  return (
    <svg
      id="piece-drawing"
      className="technical-drawing"
      viewBox="0 0 800 600"
      role="group"
      aria-label={`${section ? "Seção transversal" : "Elevação"} do consolo ${p.name}`}
    >
      <defs>
        <pattern
          id={`${uid}grid`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".7" fill="var(--grid-dot)" />
        </pattern>
        <pattern
          id={`${uid}concrete`}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="5" r=".8" fill="var(--line-muted)" opacity=".23" />
          <path d="M9 8l2 2" stroke="var(--line-muted)" opacity=".25" />
        </pattern>
        <marker
          id={`${uid}arrow`}
          markerWidth="9"
          markerHeight="9"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0 0L6 3L0 6Z" fill="var(--force)" />
        </marker>
      </defs>
      {grid && <rect width="800" height="600" fill={`url(#${uid}grid)`} />}
      <g
        data-testid="drawing-model"
        transform={`translate(${400 + pan.x} ${300 + pan.y}) scale(${zoom}) translate(-400 -300)`}
      >
        {section ? (
          <>
            <rect
              x={400 - (g.width * s) / 2}
              y={140}
              width={g.width * s}
              height={g.height * s}
              fill="var(--concrete)"
              stroke="var(--line)"
              strokeWidth="1.5"
            />
            <rect
              x={400 - (g.width * s) / 2}
              y={140}
              width={g.width * s}
              height={g.height * s}
              fill={`url(#${uid}concrete)`}
            />
            {rebar && (
              <>
                <rect
                  {...groupProps("N3")}
                  x={400 - (g.width * s) / 2 + g.cover * s}
                  y={140 + g.cover * s}
                  width={(g.width - 2 * g.cover) * s}
                  height={(g.height - 2 * g.cover) * s}
                  rx="8"
                  fill="none"
                  strokeWidth="2.5"
                />
                <g {...groupProps("N1")}>
                  {layout.rows.flatMap((row, j) =>
                    Array.from({ length: row.count }, (_, i) => {
                      const start =
                        -g.width / 2 +
                        g.cover +
                        p.rebar.stirrupDiameter +
                        p.rebar.tieDiameter / 2;
                      const span = -2 * start;
                      return (
                        <circle
                          key={`${j}-${i}`}
                          cx={
                            400 +
                            (row.count === 1
                              ? 0
                              : start + (span * i) / (row.count - 1)) *
                              s
                          }
                          cy={140 + row.y * s}
                          r={Math.max(3, (p.rebar.tieDiameter * s) / 2)}
                          strokeWidth="1"
                        />
                      );
                    }),
                  )}
                </g>
                {beam && (
                  <g
                    className="steel-positive"
                    data-testid="beam-positive-section"
                  >
                    {beamBarPositions(
                      p,
                      beam.bottom.count,
                      beam.bottom.diameter,
                    ).map((v, i) => (
                      <circle
                        key={i}
                        cx={400 + (v - g.width / 2) * s}
                        cy={140 + beam.bottom.depthSupport * s}
                        r={Math.max(3, (beam.bottom.diameter * s) / 2)}
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                )}
                {crossings.length > 0 && (
                  <g
                    className="steel-mounting"
                    data-testid="mounting-section"
                    strokeWidth="1"
                  >
                    {crossings.map((c, i) => (
                      <circle
                        key={i}
                        cx={sectionLeft + c.lateral * s}
                        cy={140 + c.depth * s}
                        r={Math.max(3, (c.bar.diameter * s) / 2)}
                      />
                    ))}
                  </g>
                )}
                <g {...groupProps("N2")} strokeWidth={s}>
                  {stitchLevels.map((y, t) => (
                    <g key={t}>
                      <circle
                        cx={sectionLeft + stitchInset(y)}
                        cy={140 + y * s}
                        r={stitchRadius}
                      />
                      <circle
                        cx={sectionLeft + g.width * s - stitchInset(y)}
                        cy={140 + y * s}
                        r={stitchRadius}
                      />
                    </g>
                  ))}
                </g>
              </>
            )}
            {dimensions && (
              <>
                <g
                  className="dimension dimension-derived"
                  role="img"
                  aria-label={`${dPrimeLabel} · topo ao centroide do tirante`}
                >
                  <title>
                    Distância do topo ao centroide de todas as barras do tirante
                  </title>
                  <path
                    d={`M${sectionLeft - 40} 140V${sectionCentroid}`}
                    fill="none"
                  />
                  <path
                    d={`M${sectionLeft - 44} 144l8 -8 M${sectionLeft - 44} ${sectionCentroid + 4}l8 -8`}
                    fill="none"
                  />
                  <g className="dimension-extension" fill="none">
                    <path
                      d={`M${sectionLeft} 140H${sectionLeft - 48} M${sectionLeft} ${sectionCentroid}H${sectionLeft - 48}`}
                    />
                  </g>
                  <text
                    x={sectionLeft - 54}
                    y={(140 + sectionCentroid) / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {dPrimeLabel}
                  </text>
                </g>
                <Dim
                  x1={400 - (g.width * s) / 2}
                  y1={110}
                  x2={400 + (g.width * s) / 2}
                  y2={110}
                  label={cm("width")}
                  onClick={(anchor) => onDimension("width", anchor)}
                  active={focus === "width"}
                />
                <Dim
                  x1={440 + (g.width * s) / 2}
                  y1={140}
                  x2={440 + (g.width * s) / 2}
                  y2={140 + g.height * s}
                  label={cm("height")}
                  onClick={(anchor) => onDimension("height", anchor)}
                  active={focus === "height"}
                />
              </>
            )}
            <text
              className="drawing-caption"
              x="400"
              y={Math.min(555, 170 + g.height * s)}
              textAnchor="middle"
            >
              SEÇÃO A–A · JUNTO AO PILAR
            </text>
          </>
        ) : (
          <>
            <path
              d={path}
              fill="var(--concrete)"
              stroke="var(--line)"
              strokeWidth="1.5"
            />
            <path d={path} fill={`url(#${uid}concrete)`} />
            {cut && (
              <path
                className="excess-concrete-outline"
                d={removedPath}
                fill="none"
                stroke="var(--line-muted)"
                strokeDasharray="4 4"
                opacity=".7"
              >
                <title>Face original; concreto excedente removido</title>
              </path>
            )}
            <path
              d={`M${X(0)} ${Y(-100)}V${Y(g.height + 80)}`}
              stroke="var(--line-muted)"
              strokeDasharray="5 5"
              opacity=".5"
            />
            {rebar && (
              <>
                <g {...groupProps("N2")} fill="none" strokeWidth="2">
                  {stitchLevels.map((y, i) => {
                    const end = cut
                      ? bottomReach(
                          concrete,
                          y,
                          g.cover + p.rebar.stitchDiameter / 2,
                          g.length,
                        )
                      : g.height === g.tipHeight
                        ? g.length
                        : y <= g.tipHeight
                          ? g.length
                          : (g.length * (g.height - y)) /
                            (g.height - g.tipHeight);
                    return (
                      <path
                        key={i}
                        d={`M${X(-g.columnWidth + g.cover)} ${Y(y)}H${X(Math.max(0, end - g.cover))}`}
                      />
                    );
                  })}
                </g>
                <g {...groupProps("N3")} fill="none" strokeWidth="2">
                  {Array.from({ length: p.rebar.stirrupCount }, (_, i) => {
                    const x =
                      g.cover +
                      ((g.length - 2 * g.cover) * i) /
                        Math.max(1, p.rebar.stirrupCount - 1);
                    const bottom = cut
                      ? bottomOffsetDepth(
                          concrete,
                          x,
                          g.cover + p.rebar.stirrupDiameter / 2,
                        )
                      : g.height -
                        ((g.height - g.tipHeight) * x) / g.length -
                        g.cover;
                    return (
                      <path key={i} d={`M${X(x)} ${Y(g.cover)}V${Y(bottom)}`} />
                    );
                  })}
                </g>
                <g
                  {...groupProps("N1")}
                  fill="none"
                  strokeWidth="4"
                  strokeLinejoin="round"
                >
                  {beam
                    ? beam.top.map((bar, i) => (
                        <path key={i} d={polyline(bar.vertices)} />
                      ))
                    : layout.rows
                        .filter((row) => row.count > 0)
                        .map((row, i) => (
                          <path
                            key={i}
                            d={`M${X(-Math.min(p.design.supportAnchorLength, g.columnWidth - g.cover))} ${Y(row.y)}H${X(g.length - g.cover)}`}
                          />
                        ))}
                </g>
                {shapes.length > 0 && (
                  <g
                    className="steel-detail-families"
                    data-testid="detail-families"
                    fill="none"
                    strokeWidth="3"
                  >
                    {shapes.map((shape, i) =>
                      shape.kind === "path" ? (
                        <path
                          key={i}
                          data-family={shape.bar.family}
                          d={barPathData(shape.path, X, Y, s)}
                        >
                          <title>{shape.bar.description}</title>
                        </path>
                      ) : shape.kind === "line" ? (
                        <path
                          key={i}
                          data-family={shape.bar.family}
                          d={`M${X(shape.a.x)} ${Y(shape.a.y)}L${X(shape.b.x)} ${Y(shape.b.y)}`}
                        >
                          <title>{shape.bar.description}</title>
                        </path>
                      ) : (
                        <circle
                          key={i}
                          data-family={shape.bar.family}
                          cx={X(shape.center.x)}
                          cy={Y(shape.center.y)}
                          r={Math.max(3, (shape.bar.diameter * s) / 2)}
                        >
                          <title>{shape.bar.description}</title>
                        </circle>
                      ),
                    )}
                  </g>
                )}
                {beam && (
                  <path
                    className="steel-positive"
                    data-testid="beam-positive"
                    d={polyline(beam.bottom.vertices)}
                    fill="none"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  >
                    <title>Armadura positiva (armado como viga)</title>
                  </path>
                )}
              </>
            )}
            <rect
              x={X(g.loadOffset - p.design.bearingLength / 2)}
              y={Y(-p.design.bearingHeight)}
              width={p.design.bearingLength * s}
              height={Math.max(3, p.design.bearingHeight * s)}
              fill="var(--line-muted)"
              opacity=".55"
            />
            {forces && (
              <>
                <path
                  d={`M${X(reaction.a)} ${Y(-100)}V${Y(-9)}`}
                  stroke="var(--force)"
                  strokeWidth="2.5"
                  markerEnd={`url(#${uid}arrow)`}
                />
                <text className="force-label" x={X(reaction.a) + 12} y={Y(-85)}>
                  {p.design.forceMode === "design" ? "Vd" : "Vk"} ={" "}
                  {number(p.loads.vertical / 1000, 0)} kN
                </text>
                {p.loads.horizontal !== 0 && (
                  <>
                    <path
                      d={
                        p.loads.horizontal > 0
                          ? `M${X(reaction.a)} ${Y(-15)}h65`
                          : `M${X(reaction.a)} ${Y(-15)}h-65`
                      }
                      stroke="var(--force)"
                      strokeWidth="2"
                      markerEnd={`url(#${uid}arrow)`}
                    />
                    <text
                      className="force-label"
                      x={X(reaction.a) + 12}
                      y={Y(-15) - 12}
                    >
                      {p.design.horizontalMode === "estimated"
                        ? "H adic."
                        : "H total"}{" "}
                      = {number(p.loads.horizontal / 1000, 0)} kN
                    </text>
                  </>
                )}
              </>
            )}
            {dimensions && (
              <>
                <g className="dimension-extension" fill="none">
                  <path
                    d={`M${X(-g.columnWidth)} ${Y(-105)}V${Y(-160)} M${X(0)} ${Y(-105)}V${Y(-160)} M${X(g.length)} ${Y(-5)}V${Y(-160)} M${X(g.length) + 5} ${Y(0)}h95 M${X(g.length) + 5} ${Y(g.tipHeight)}h48 M${X(0) + 5} ${Y(g.height)}H${X(g.length) + 100} M${X(0)} ${Y(g.height) + 5}V${Y(g.height + 55)} M${X(g.loadOffset)} ${Y(g.height) + 5}V${Y(g.height + 55)}`}
                  />
                </g>
                <Dim
                  x1={X(0)}
                  y1={Y(-145)}
                  x2={X(g.length)}
                  y2={Y(-145)}
                  label={cm("length")}
                  onClick={(anchor) => onDimension("length", anchor)}
                  active={focus === "length"}
                />
                <Dim
                  x1={X(0)}
                  y1={Y(g.height + 40)}
                  x2={X(g.loadOffset)}
                  y2={Y(g.height + 40)}
                  label={cm("loadOffset")}
                  onClick={(anchor) => onDimension("loadOffset", anchor)}
                  active={focus === "loadOffset"}
                />
                {reaction.shift !== 0 && (
                  <text
                    className="drawing-caption"
                    x={X(reaction.a)}
                    y={Y(g.height + 75)}
                    textAnchor="middle"
                  >
                    a_calc = {number(reaction.a / 10, 1)} cm
                  </text>
                )}
                <Dim
                  x1={X(g.length) + 38}
                  y1={Y(0)}
                  x2={X(g.length) + 38}
                  y2={Y(g.tipHeight)}
                  label={cm("tipHeight")}
                  onClick={(anchor) => onDimension("tipHeight", anchor)}
                  active={focus === "tipHeight"}
                />
                <Dim
                  x1={X(g.length) + 85}
                  y1={Y(0)}
                  x2={X(g.length) + 85}
                  y2={Y(g.height)}
                  label={cm("height")}
                  onClick={(anchor) => onDimension("height", anchor)}
                  active={focus === "height"}
                />
                <Dim
                  x1={X(-g.columnWidth)}
                  y1={Y(-145)}
                  x2={X(0)}
                  y2={Y(-145)}
                  label={cm("columnWidth")}
                  onClick={(anchor) => onDimension("columnWidth", anchor)}
                  active={focus === "columnWidth"}
                />
              </>
            )}
            <text
              className="drawing-caption"
              x={X(-g.columnWidth / 2)}
              y={Y(g.height + 45)}
              textAnchor="middle"
            >
              PILAR
            </text>
            {rebar && (
              <>
                <path
                  d={`M${X(g.length - g.cover)} ${Y(g.cover)}l32 20h38`}
                  stroke="var(--force)"
                  fill="none"
                />
                <text
                  x={X(g.length - g.cover) + 77}
                  y={Y(g.cover) + 24}
                  className="bar-label"
                >
                  N1
                </text>
              </>
            )}
          </>
        )}
      </g>
      <g className="axis" transform="translate(38 550)">
        <path d="M0 0h30M0 0v-30" fill="none" />
        <text x="34" y="4">
          x
        </text>
        <text x="-3" y="-36">
          z
        </text>
        <circle r="2" />
      </g>
    </svg>
  );
}
