import { NumericField } from "./NumericField";
import StrutLimitControl from "./StrutLimitControl";
import MaterialSafetyControl from "./MaterialSafetyControl";
import { coefficientText } from "../domain/materialSafety";
import { fykOf, steelOptionLabel } from "../domain/steel";
import type { Piece } from "../domain/model";
import type { DesignSettings } from "../domain/design";

export default function DesignPanel({
  piece: p,
  update,
}: {
  piece: Piece;
  update: (p: Piece) => void;
}) {
  const q = p.design;
  const set = <K extends keyof DesignSettings>(
    key: K,
    value: DesignSettings[K],
  ) => update({ ...p, design: { ...q, [key]: value } });
  const select = <K extends keyof DesignSettings>(
    key: K,
    label: string,
    options: [string, string][],
  ) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        value={String(q[key])}
        onChange={(e) => set(key, e.target.value as DesignSettings[K])}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const num = (
    key: keyof DesignSettings,
    label: string,
    unit = "mm",
    factor = 1,
    min = 0,
    max = 10000,
  ) => (
    <NumericField
      label={label}
      value={q[key] as number}
      unit={unit}
      factor={factor}
      min={min}
      max={max}
      onChange={(v) => set(key, v as never)}
    />
  );
  const toggle = (key: keyof DesignSettings, label: string) => (
    <label className="design-toggle">
      <input
        type="checkbox"
        checked={q[key] as boolean}
        onChange={(e) => set(key, e.target.checked as never)}
      />
      {label}
    </label>
  );
  return (
    <div className="design-panel">
      <div className="info-block">
        NBR 6118:2026 + NBR 9062:2017 · ELU normal. Critérios de
        compatibilização e limites aparecem na memória.
      </div>
      <details open>
        <summary>Modelo e ações</summary>
        {select("method", "Modelo resistente", [
          ["auto", "Automático por a/d"],
          ["strut", "Bielas e tirantes"],
          ["friction", "Atrito-cisalhamento"],
        ])}
        {toggle(
          "literatureRecommendations",
          "Aplicar recomendações complementares de El Debs",
        )}
        <small>
          Inclui H ≥ 0,20 V, ponta ≥ h/2, costura de 50% da parcela vertical e
          estribos ≥ 20% do tirante. Em 0,4 ≤ a/d ≤ 1, verifica também o modelo
          simplificado e τ ≤ 0,20 fcd. A memória compara os métodos. Na viga em
          balanço (1 &lt; a/d ≤ 2) vale apenas H ≥ 0,20 V.
        </small>
        {select("forceMode", "Nível das forças informadas", [
          ["characteristic", "Características: aplicar γf × γn"],
          ["design", "De cálculo: já incluem γf e γn"],
        ])}
        <MaterialSafetyControl
          piece={p}
          onChange={(patch) => update({ ...p, design: { ...q, ...patch } })}
        />
        {toggle("permanentPredominant", "Ação permanente predominante")}
        {num("gammaN", "Coeficiente adicional mínimo γn", "", 1, 1.2, 3)}
        {select("loadType", "Introdução da carga", [
          ["direct", "Direta"],
          ["indirect", "Indireta: suspensão integral"],
        ])}
        <StrutLimitControl
          piece={p}
          onChange={(value) => set("strutLimit", value)}
        />
        {select("horizontalMode", "Origem de H", [
          ["estimated", "Apoio + H adicional informado"],
          ["analysis", "Resultante total de análise"],
        ])}
        {q.horizontalMode === "analysis" && (
          <label className="field">
            <span className="field-label">
              Justificativa da força horizontal
            </span>
            <textarea
              maxLength={1000}
              value={q.horizontalJustification}
              onChange={(e) => set("horizontalJustification", e.target.value)}
              placeholder="Modelo e origem de H, inclusive se nulo"
            />
          </label>
        )}
        {toggle("includeSelfWeight", "Acrescentar peso próprio (25 kN/m³)")}
        <small>
          γc = {coefficientText(q.gammaC ?? 1.4)} · γs ={" "}
          {coefficientText(q.gammaS ?? 1.15)}. Combinações excepcionais não são
          modeladas. H de compressão favorável é desconsiderado.
        </small>
      </details>
      <details open>
        <summary>Apoio e interface</summary>
        {select("supportType", "Tipo de apoio", [
          ["elastomer", "Elastômero · H/V = 0,16"],
          ["ptfe", "PTFE · 0,08"],
          ["dry", "Seco · 0,80"],
          ["mortar", "Argamassa · 0,50"],
          ["steel", "Aço / aço · 0,25"],
          ["concreteSteel", "Concreto / aço · 0,40"],
          ["restrained", "Impedido, soldado ou grauteado"],
        ])}
        <small>
          Coeficientes estimados só para ligação que permite movimento
          horizontal. Apoio impedido exige H por análise.
        </small>
        {num(
          "bearingLength",
          "Comprimento do apoio na direção de a",
          "cm",
          10,
          10,
        )}
        {num("bearingWidth", "Largura efetiva de transmissão", "cm", 10, 10)}
        {num(
          "bearingHeight",
          "Altura da linha de H acima do concreto",
          "cm",
          10,
        )}
        {select("reactionPosition", "Posição de cálculo da reação vertical", [
          ["specified", "No centro do apoio informado"],
          ["outerThird", "Deslocar para fora em c_ap/6"],
          ["threeQuarter", "Envelopar com a ≥ 0,75 L (El Debs)"],
        ])}
        <small>
          O centro físico do apoio permanece na cota a. O deslocamento da reação
          soma-se ao efeito de H no contato; fora do núcleo central, o programa
          solicita uma análise de contato parcial.
        </small>
        {select("joint", "Junta junto ao suporte", [
          ["monolithic", "Concretagem monolítica · μ = 1,4"],
          ["rough", "Junta rugosa · μ = 1,0"],
          ["smooth", "Junta lisa · μ = 0,6"],
        ])}
        {q.joint === "rough" &&
          toggle(
            "roughnessConfirmed",
            "Rugosidade 5 mm/30 mm e preparação conferidas",
          )}
      </details>
      <details>
        <summary>Durabilidade e disposição</summary>
        {select("exposure", "Classe de agressividade ambiental", [
          ["I", "I · fraca"],
          ["II", "II · moderada"],
          ["III", "III · forte"],
          ["IV", "IV · muito forte"],
        ])}
        {toggle(
          "qualityCoverReduction",
          "Controle documentado: reduzir cobrimento em 5 mm",
        )}
        {num("aggregate", "Dimensão máxima do agregado", "mm", 1, 4, 50)}
        {num("tieLayers", "Camadas do tirante", "camadas", 1, 1, 4)}
        {num("extraTopCover", "Afastamento adicional do tirante", "mm")}
        <label className="field steel-class-field">
          <span className="field-label">Aço da costura e estribos</span>
          <select
            value={q.fykTransverse}
            onChange={(e) =>
              set("fykTransverse", Number(e.target.value) as 500 | 600)
            }
          >
            {(["CA-50", "CA-60"] as const).map((steel) => (
              <option key={steel} value={fykOf(steel)}>
                {steelOptionLabel(steel)}
              </option>
            ))}
          </select>
        </label>
        <small>
          A resistência de cálculo das armaduras é limitada conforme o modelo;
          fywd ≤ 435 MPa.
        </small>
      </details>
      <details>
        <summary>Ancoragem na frente</summary>
        {select("frontAnchor", "Solução da ancoragem", [
          ["loop", "Alça horizontal"],
          ["welded", "Barra transversal soldada"],
        ])}
        {q.frontAnchor === "loop" ? (
          <>
            {num("loopInternalDiameter", "Diâmetro interno da alça", "mm")}
            <small>
              N1 conta os ramos longitudinais. Cada alça possui dois ramos, na
              mesma camada.
            </small>
          </>
        ) : (
          <>
            {num(
              "weldedBarDiameter",
              "Diâmetro da barra transversal",
              "mm",
              1,
              5,
              25,
            )}
            {num(
              "weldResistancePerBar",
              "Resistência de cálculo da solda / ramo",
              "kN",
              1000,
              0,
              1e7,
            )}
            <label className="field">
              <span className="field-label">
                Especificação e qualificação da solda
              </span>
              <textarea
                value={q.weldSpecification}
                maxLength={1000}
                onChange={(e) => set("weldSpecification", e.target.value)}
              />
            </label>
          </>
        )}
      </details>
      <details>
        <summary>Ancoragem no suporte</summary>
        {select("supportAnchor", "Ancoragem no pilar / suporte", [
          ["straight", "Reta"],
          ["hook", "Com gancho (conferir percurso)"],
        ])}
        {toggle(
          "supportWeldedBar",
          "Barra transversal soldada na ancoragem (NBR 6118 §9.4.2.2)",
        )}
        {toggle(
          "anchorRatioFloor",
          "Limitar a razão As,req/As,ef ao mínimo de 1,0 (conservador)",
        )}
        {select("bond", "Condição de aderência", [
          ["poor", "Má aderência"],
          ["good", "Boa aderência justificada"],
        ])}
        {num(
          "supportAnchorLength",
          "Comprimento disponível da ancoragem",
          "cm",
          10,
        )}
        {q.supportAnchor === "hook" &&
          num(
            "hookNormalCover",
            "Cobrimento normal ao plano do gancho",
            "cm",
            10,
          )}
        {num(
          "anchorConfinementArea",
          "Área efetiva de confinamento da ancoragem",
          "cm²",
          100,
          0,
          100000,
        )}
        {num(
          "supportRebarArea",
          "Área local efetiva na face do suporte",
          "cm²",
          100,
          0,
          100000,
        )}
        <small>
          Informar armaduras existentes e efetivamente ancoradas no suporte. A
          sugestão automática não inventa essas áreas.
        </small>
      </details>
      <details>
        <summary>Armaduras complementares</summary>
        {num(
          "lowerStitchCount",
          "N2b · costura no terço inferior",
          "estribos",
          1,
          0,
          100,
        )}
        {num(
          "splittingCount",
          "N5 · fendilhamento transversal",
          "estribos",
          1,
          0,
          100,
        )}
        {num("splittingDiameter", "N5 · diâmetro", "mm", 1, 5, 25)}
        {num(
          "suspensionCount",
          "N6 · suspensão da carga indireta",
          "estribos",
          1,
          0,
          100,
        )}
        {num("suspensionDiameter", "N6 · diâmetro", "mm", 1, 5, 25)}
        <small>
          Dois ramos efetivos por estribo fechado. N5 e N6 são áreas exclusivas:
          não se contabilizam novamente em N2 ou N3. A representação gráfica
          continua esquemática.
        </small>
      </details>
      <details>
        <summary>Combinações adicionais ({q.combinations.length})</summary>
        <small>
          A combinação Principal usa os campos da aba Ações. Informe outras
          combinações simultâneas V/H; o motor não gera combinações de ações
          automaticamente.
        </small>
        {q.combinations.map((c, i) => {
          const patch = (obj: Partial<typeof c>) =>
            set(
              "combinations",
              q.combinations.map((x, j) => (i === j ? { ...x, ...obj } : x)),
            );
          return (
            <section className="combination-editor" key={i}>
              <label className="field">
                <span className="field-label">Nome da combinação {i + 1}</span>
                <input
                  aria-label={`Nome da combinação ${i + 1}`}
                  value={c.name}
                  maxLength={80}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              <NumericField
                label={`V · ${i + 1}`}
                value={c.vertical}
                factor={1000}
                unit="kN"
                max={1e8}
                onChange={(v) => patch({ vertical: v })}
              />
              <NumericField
                label={`H · ${i + 1}`}
                value={c.horizontal}
                factor={1000}
                unit="kN"
                min={-1e8}
                max={1e8}
                onChange={(v) => patch({ horizontal: v })}
              />
              <NumericField
                label={`γf · ${i + 1}`}
                value={c.gamma}
                unit=""
                min={1}
                max={2}
                step={0.1}
                onChange={(v) => patch({ gamma: v })}
              />
              <button
                className="button"
                onClick={() =>
                  set(
                    "combinations",
                    q.combinations.filter((_, j) => j !== i),
                  )
                }
              >
                Remover combinação {i + 1}
              </button>
            </section>
          );
        })}
        <button
          className="button"
          disabled={q.combinations.length >= 20}
          onClick={() =>
            set("combinations", [
              ...q.combinations,
              {
                name: `Combinação ${q.combinations.length + 1}`,
                vertical: p.loads.vertical,
                horizontal: p.loads.horizontal,
                gamma: p.loads.gamma,
              },
            ])
          }
        >
          Adicionar combinação
        </button>
      </details>
      <details>
        <summary>Domínio e conferência</summary>
        {num(
          "transverseEccentricity",
          "Excentricidade transversal",
          "cm",
          10,
          -6000,
          6000,
        )}
        {num("transverseForce", "Força fora do plano", "kN", 1000, -1e8, 1e8)}
        {toggle("fatigue", "Há fadiga / carregamento cíclico relevante")}
        <small>
          Valores fora do plano ou fadiga interrompem o cálculo simplificado.
          Considere um modelo específico nesses casos.
        </small>
        {toggle(
          "inputsConfirmed",
          "Conferi ações, apoio, materiais e ancoragens desta peça",
        )}
      </details>
    </div>
  );
}
