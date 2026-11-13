import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { shortFixture } = await server.ssrLoadModule("/tests/fixtures.ts");
  const { buildDetail } = await server.ssrLoadModule("/src/detailing/model.ts");
  const { pieceDrawing, combineDrawings, steelSummaryDrawing } =
    await server.ssrLoadModule("/src/detailing/drawing.ts");
  const { drawingSvg, drawingDxf, drawingPdf, steelCsv } =
    await server.ssrLoadModule("/src/detailing/exports.ts");
  const first = shortFixture();
  first.name = "C01";
  first.quantity = 8;
  first.description = "Consolo com tirante simples em alças";
  const second = shortFixture();
  second.id = "double-tie";
  second.name = "C02";
  second.quantity = 4;
  second.description = "Tirante duplo, com duas camadas e dobras distintas";
  second.design.tieLayers = 2;
  second.detailing.secondLoopDiameter = 120;
  second.geometry.length = 470;
  second.geometry.width = 300;
  second.design.bearingWidth = 250;
  second.materials.fck = 35;
  second.detailing.pins = 2;
  second.detailing.notes =
    "Pinos da ligação: conferir esforço, embutimento, furação e montagem antes de emitir para execução.";
  const project = {
    format: "lumeconsolo",
    schemaVersion: 5,
    name: "Consolos - exemplo de detalhamento",
    client: "Exemplo técnico para conferência",
    author: "",
    pieces: [first, second],
  };
  const details = project.pieces.map(buildDetail),
    drawings = details.map((d) => pieceDrawing(project, d));
  const allDrawings = [...drawings, steelSummaryDrawing(project, details)];
  const combined = combineDrawings(allDrawings);
  await mkdir("examples/detalhamento", { recursive: true });
  await writeFile(
    "examples/detalhamento/consolos-detalhados.lume.json",
    JSON.stringify(project, null, 2),
  );
  await writeFile(
    "examples/detalhamento/todos-consolos.svg",
    drawingSvg(combined),
  );
  await writeFile(
    "examples/detalhamento/todos-consolos.dxf",
    drawingDxf(combined),
  );
  await writeFile(
    "examples/detalhamento/todos-consolos.pdf",
    await drawingPdf(allDrawings),
  );
  await writeFile("examples/detalhamento/quadro-aco.csv", steelCsv(details));
  for (let i = 0; i < details.length; i++) {
    await writeFile(
      `examples/detalhamento/${details[i].piece.name}.svg`,
      drawingSvg(drawings[i]),
    );
    console.log(
      details[i].piece.name,
      details[i].bars.length,
      "posições",
      details[i].mass.toFixed(3),
      "kg/pç",
      "dimensões",
      drawings[i].width.toFixed(1),
      drawings[i].height.toFixed(1),
      "pendências",
      details[i].issues,
    );
  }
} finally {
  await server.close();
}
