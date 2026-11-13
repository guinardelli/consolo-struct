import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const { shortFixture } = await server.ssrLoadModule("/tests/fixtures.ts");
  const { calculate } = await server.ssrLoadModule("/src/domain/engine.ts");
  const normative = shortFixture();
  normative.name = "Base normativa";
  const literature = structuredClone(normative);
  literature.id = "el-debs-comparison";
  literature.name = "Complementos El Debs";
  literature.loads.horizontal = 30000;
  literature.design.literatureRecommendations = true;
  const displaced = structuredClone(literature);
  displaced.id = "reaction-shift-comparison";
  displaced.name = "Reação 3/4 L — ductilidade";
  displaced.geometry.length = 500;
  displaced.geometry.loadOffset = 365;
  displaced.design.reactionPosition = "threeQuarter";
  const partial = structuredClone(literature);
  partial.id = "partial-contact-required";
  partial.name = "Contato parcial — bloqueado";
  partial.design.reactionPosition = "outerThird";
  const project = {
    format: "lumeconsolo",
    schemaVersion: 5,
    name: "Base Consolo — comparação 0.7",
    client: "Casos de estudo para conferência",
    author: "",
    pieces: [normative, literature, displaced, partial],
  };
  await writeFile(
    "examples/base-consolo.lume.json",
    JSON.stringify(project, null, 2) + "\n",
  );
  const summary = project.pieces.map((p) => {
    const r = calculate(p);
    const v = r.values;
    return {
      name: p.name,
      engine: r.engineVersion,
      policy: r.policy,
      status: r.status,
      a: v.a ?? null,
      H: v.horizontal ?? null,
      As: v.tieRequired ?? null,
      AsElDebs: v.tieElDebs ?? null,
      eContato: v.bearingEccentricity ?? null,
      costura: v.stitchRequired ?? null,
      espacamentoCostura: v.stitchSpacing ?? null,
      reasons: r.reasons,
      pendencias: r.checks.filter((c) => c.status !== "pass").map((c) => c.id),
    };
  });
  await writeFile(
    "examples/base-consolo-resultados.json",
    JSON.stringify(
      {
        notice:
          "Saída derivada do programa; não é validação independente nem um exemplo publicado no livro.",
        units: "mm, N, mm²",
        cases: summary,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(summary);
} finally {
  await server.close();
}
