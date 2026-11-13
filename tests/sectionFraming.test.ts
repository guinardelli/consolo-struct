import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Drawing from "../src/components/Drawing";
import {
  exampleProject,
  geometryErrors,
  pieceSchema,
} from "../src/domain/model";

function render(width: number, layers = 1, section = true) {
  const piece = exampleProject().pieces[0];
  piece.geometry.width = width;
  piece.design.tieLayers = layers;
  piece.rebar.tieCount = layers === 1 ? 4 : 7;
  expect(pieceSchema.safeParse(piece).success).toBe(true);
  expect(geometryErrors(piece)).toEqual([]);
  return renderToStaticMarkup(
    createElement(Drawing, {
      piece,
      section,
      rebar: true,
      dimensions: true,
      grid: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      forces: false,
      selectedBar: "",
      onDimension: () => {},
      onBar: () => {},
    }),
  );
}

describe("enquadramento da seção A–A com d’", () => {
  for (const width of [1000, 2000, 6000]) {
    for (const layers of [1, 3]) {
      it(`reserva margem para d’ em b=${width} mm e ${layers} camada(s)`, () => {
        const svg = render(width, layers);
        const dimension = svg.split('class="dimension dimension-derived"')[1];
        const label = dimension.match(/<text x="([^"]+)"/);
        expect(label).not.toBeNull();
        // The right-aligned label needs room to its left, not just an
        // anchor inside the 0..800 drawing viewport.
        expect(Number(label![1])).toBeGreaterThanOrEqual(100);
      });
    }
  }

  it("preserva a escala anterior da seção inicial", () => {
    const svg = render(300);
    const concrete = svg.match(/<rect x="([^"]+)" y="140" width="([^"]+)"/);
    expect(concrete).not.toBeNull();
    const scale = Math.min(480 / (300 + 250), 340 / (400 + 80));
    expect(Number(concrete![1])).toBeCloseTo(400 - (300 * scale) / 2);
    expect(Number(concrete![2])).toBeCloseTo(300 * scale);
  });

  it("não altera a elevação quando somente a largura muda", () => {
    expect(render(1000, 1, false)).toBe(render(300, 1, false));
  });
});
