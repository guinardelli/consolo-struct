import type { CalculationResult } from "../../src/domain/engine";

/** Historical snapshots predate the N4 convention. Reverse only the documented
 * public text changes; no numbers, check states or calculation values are removed. */
export function legacyN4Labels(result: CalculationResult): CalculationResult {
  return JSON.parse(
    JSON.stringify(result, (key, value) => {
      if (key === "assumptions")
        return value.map((s: string) =>
          s.startsWith("N1 conta ramos longitudinais;")
            ? "N1 é número de ramos longitudinais. N2/N3/N4/N5 são estribos fechados com dois ramos efetivos e ancorados; áreas informadas de suporte/confinamento são efetivas, não áreas brutas arbitrárias."
            : s,
        );
      if (typeof value !== "string" || key !== "detail") return value;
      if (
        value.includes(
          "N3: 2 ramos efetivos por posição (estribo externo), distribuídos",
        )
      )
        return value.replace(
          /N3: 2.*$/,
          "N3 conta estribos fechados, com dois ramos, distribuídos ao longo do comprimento L do consolo. A parcela do concreto é desconsiderada nesta faixa de a/d.",
        );
      if (value.includes("N3: 2 ramos efetivos por posição (estribo externo)."))
        return value.replace(
          /N3: 2.*$/,
          "N3 conta estribos fechados, com dois ramos. Complemento de El Debs p.129(e) quando ativado; N5 de suspensão permanece independente, sem dupla contagem.",
        );
      return value
        .replace("N5 é armadura exclusiva", "N4 é armadura exclusiva")
        .replace("a armadura N5 transversal", "a armadura N4 transversal");
    }),
  );
}
