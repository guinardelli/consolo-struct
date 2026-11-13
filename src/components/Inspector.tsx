import DesignPanel from "./DesignPanel";
import { ribbonCommands } from "./ribbonCommands";
import { coefficientText } from "../domain/materialSafety";
import {
  fykOf,
  steelBondDescription,
  steelClasses,
  steelClassOf,
  steelLabel,
  steelOptionLabel,
} from "../domain/steel";
import { memo, useId } from "react";
import {
  ChevronDown,
  SlidersHorizontal,
  Ruler,
  ArrowDownToLine,
  Layers3,
  Workflow,
  Info,
  X,
} from "lucide-react";
import { NumericField } from "./NumericField";
import {
  area,
  number,
  type Piece,
  type InspectorTab,
  type GeometryKey,
} from "../domain/model";
function Inspector({
  piece: p,
  tab,
  setTab,
  update,
  onFocus,
  selectedBar,
  setBar,
  onClose,
}: {
  piece: Piece;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  update: (p: Piece) => void;
  onFocus: (k: GeometryKey) => void;
  selectedBar: string;
  setBar: (b: string) => void;
  onClose: () => void;
}) {
  const steelId = useId();
  const steel = steelClassOf(p.materials.fyk);
  const tabs = [
    { id: "geometry", label: "Geometria", icon: Ruler },
    { id: "loads", label: "Ações", icon: ArrowDownToLine },
    { id: "materials", label: "Materiais", icon: Layers3 },
    { id: "rebar", label: "Armaduras", icon: Workflow },
    { id: "design", label: "Cálculo", icon: SlidersHorizontal },
  ] as const;
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>
          <SlidersHorizontal size={16} /> Propriedades
        </span>
        <button
          className="icon-button"
          aria-label="Fechar propriedades"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="property-selection">
        <Layers3 size={24} />
        <div>
          <strong>{p.name} · Consolo simples</strong>
          <span>{p.description}</span>
        </div>
      </div>
      <div
        className="inspector-tabs"
        role="group"
        aria-label="Propriedades da peça"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-label={ribbonCommands[t.id].label}
            title={ribbonCommands[t.id].tip}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "active" : ""}
          >
            <t.icon size={17} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="inspector-content">
        {tab === "design" && <DesignPanel piece={p} update={update} />}
        {tab === "geometry" && (
          <>
            <div className="section-label">
              FORMA DO CONSOLO <ChevronDown size={14} />
            </div>
            <div className="shape-card">
              <svg viewBox="0 0 80 64" width="62">
                <path
                  d="M12 8h20v16h30v14L32 55H12Z"
                  fill="var(--accent-soft)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
              </svg>
              <div>
                <strong>Consolo simples</strong>
                <span>Seção retangular · face inclinada</span>
              </div>
              <span className="selected-dot" />
            </div>
            <div className="fields-grid">
              {(
                [
                  { key: "width", label: "Largura", symbol: "b" },
                  { key: "height", label: "Altura no pilar", symbol: "h" },
                  { key: "tipHeight", label: "Altura na ponta", symbol: "h₂" },
                  { key: "length", label: "Comprimento", symbol: "L" },
                  { key: "loadOffset", label: "Posição da carga", symbol: "a" },
                  {
                    key: "columnWidth",
                    label: "Dimensão do pilar",
                    symbol: "P",
                  },
                ] as const
              ).map((f) => (
                <NumericField
                  key={f.key}
                  label={f.label}
                  symbol={f.symbol}
                  unit="cm"
                  value={p.geometry[f.key]}
                  factor={10}
                  min={5}
                  max={6000}
                  onFocus={() => onFocus(f.key)}
                  onChange={(v) =>
                    update({ ...p, geometry: { ...p.geometry, [f.key]: v } })
                  }
                />
              ))}
            </div>
            <div className="section-label section-spaced">COBRIMENTO</div>
            <NumericField
              label="Cobrimento nominal informado"
              symbol="c"
              unit="cm"
              value={p.geometry.cover}
              factor={10}
              min={10}
              max={100}
              onChange={(v) =>
                update({ ...p, geometry: { ...p.geometry, cover: v } })
              }
            />
            <div className="inspector-tip">
              <Info size={15} />
              <p>
                Clique em uma cota para editar diretamente no desenho. Enter
                confirma; Esc cancela. Dimensões em centímetros.
              </p>
            </div>
          </>
        )}
        {tab === "loads" && (
          <>
            <div className="section-label">AÇÕES INFORMADAS</div>
            <div className="info-block">
              Combinação Principal. Na aba Cálculo, defina se as forças são
              características ou de cálculo e se H é adicional à estimativa do
              apoio ou a resultante total de análise.
            </div>
            <NumericField
              label="Força vertical"
              symbol="V"
              unit="kN"
              value={p.loads.vertical}
              factor={1000}
              max={1e8}
              onChange={(v) =>
                update({ ...p, loads: { ...p.loads, vertical: v } })
              }
            />
            <NumericField
              label={
                p.design.horizontalMode === "estimated"
                  ? "Força horizontal adicional"
                  : "Força horizontal total"
              }
              symbol="H"
              unit="kN"
              value={p.loads.horizontal}
              factor={1000}
              min={-1e8}
              max={1e8}
              onChange={(v) =>
                update({ ...p, loads: { ...p.loads, horizontal: v } })
              }
            />
            <NumericField
              label="Coeficiente das ações características"
              symbol="γf"
              unit=""
              value={p.loads.gamma}
              min={1}
              max={2}
              step={0.1}
              onChange={(v) =>
                update({ ...p, loads: { ...p.loads, gamma: v } })
              }
            />
            <div className="inspector-tip">
              <Info size={15} />
              <p>
                Em ações características, aplica-se γf × γn. Valores já
                majorados não recebem nova majoração. As combinações adicionais
                são inseridas na aba Cálculo.
              </p>
            </div>
          </>
        )}
        {tab === "materials" && (
          <>
            <div className="section-label">CONCRETO</div>
            <div className="material-swatch">
              <Layers3 size={25} />
              <div>
                <strong>Concreto armado</strong>
                <span>Parâmetros do modelo</span>
              </div>
            </div>
            <NumericField
              label="Resistência característica"
              symbol="fck"
              unit="MPa"
              value={p.materials.fck}
              min={20}
              max={90}
              onChange={(v) =>
                update({ ...p, materials: { ...p.materials, fck: v } })
              }
            />
            <div className="section-label section-spaced">
              AÇO DAS ARMADURAS
            </div>
            <label className="field steel-class-field" htmlFor={steelId}>
              <span className="field-label">Classe de aço do tirante</span>
              <select
                id={steelId}
                value={p.materials.fyk}
                aria-describedby={`${steelId}-bond`}
                onChange={(event) => {
                  const selected = steelClassOf(Number(event.target.value));
                  if (selected)
                    update({
                      ...p,
                      materials: { ...p.materials, fyk: fykOf(selected) },
                    });
                }}
              >
                {!steel && (
                  <option value={p.materials.fyk} disabled>
                    {steelLabel(p.materials.fyk)}
                  </option>
                )}
                {steelClasses.map((value) => (
                  <option key={value} value={fykOf(value)}>
                    {steelOptionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <p className="table-note steel-bond-note" id={`${steelId}-bond`}>
              {steelBondDescription(p.materials.fyk)}
            </p>
            <div className="inspector-tip">
              <Info size={15} />
              <p>
                Adotados: γc = {coefficientText(p.design.gammaC ?? 1.4)} e γs ={" "}
                {coefficientText(p.design.gammaS ?? 1.15)}. Aço transversal e
                exposição na aba Cálculo.
              </p>
            </div>
          </>
        )}
        {tab === "rebar" && (
          <>
            <div className="section-label">ARMADURA ADOTADA</div>
            <div className="info-block">
              Use Calcular para verificar o arranjo ou Sugerir armaduras. N1
              conta ramos longitudinais; N2 mantém dois ramos. N3 tem 2 ou 4
              ramos efetivos por posição. N4 é construtiva, obrigatória e sem
              contribuição resistente. O desenho é esquemático.
            </div>
            {(
              [
                {
                  id: "N1",
                  name: "Tirante principal",
                  count: "tieCount",
                  diameter: "tieDiameter",
                },
                {
                  id: "N2",
                  name: "Costura horizontal",
                  count: "stitchCount",
                  diameter: "stitchDiameter",
                },
                {
                  id: "N3",
                  name: "Estribos verticais",
                  count: "stirrupCount",
                  diameter: "stirrupDiameter",
                },
              ] as const
            ).map((b) => (
              <section
                className={`rebar-editor ${selectedBar === b.id ? "selected" : ""}`}
                key={b.id}
                onClick={() => setBar(b.id)}
              >
                <h4>
                  <span className={`bar-tag ${b.id}`}>{b.id}</span>
                  {b.name}
                </h4>
                <div className="fields-grid">
                  <NumericField
                    label="Quantidade"
                    value={p.rebar[b.count]}
                    unit={
                      b.id === "N1"
                        ? "ramos"
                        : b.id === "N3"
                          ? "posições"
                          : "estribos"
                    }
                    min={b.id === "N1" ? 2 : 1}
                    max={b.id === "N1" ? 40 : 100}
                    onChange={(v) =>
                      update({ ...p, rebar: { ...p.rebar, [b.count]: v } })
                    }
                  />
                  <label className="field">
                    <span className="field-label">
                      Diâmetro <i>ϕ</i>
                    </span>
                    <select
                      aria-label={`Diâmetro ${b.id}`}
                      value={p.rebar[b.diameter]}
                      onChange={(e) =>
                        update({
                          ...p,
                          rebar: {
                            ...p.rebar,
                            [b.diameter]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[5, 6.3, 8, 10, 12.5, 16, 20, 25, 32, 40]
                        .filter((d) => (b.id === "N1" ? d >= 6.3 : d <= 25))
                        .map((d) => (
                          <option key={d} value={d}>
                            {number(d, 1)} mm
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {b.id === "N3" && (
                  <label className="field">
                    <span className="field-label">
                      Ramos efetivos por posição
                    </span>
                    <select
                      aria-label="Ramos efetivos de N3"
                      value={p.rebar.stirrupBranches}
                      onChange={(e) =>
                        update({
                          ...p,
                          rebar: {
                            ...p.rebar,
                            stirrupBranches: Number(e.target.value) as 2 | 4,
                          },
                        })
                      }
                    >
                      <option value={2}>2 · estribo externo</option>
                      <option value={4}>
                        4 · estribo externo + grampo interno
                      </option>
                    </select>
                  </label>
                )}
                <div className="provided-area">
                  <span>Área geométrica das barras</span>
                  <strong>
                    {number(
                      area(
                        p.rebar[b.count] *
                          (b.id === "N1"
                            ? 1
                            : b.id === "N3"
                              ? p.rebar.stirrupBranches
                              : 2),
                        p.rebar[b.diameter],
                      ) / 100,
                      2,
                    )}{" "}
                    cm²
                  </strong>
                </div>
              </section>
            ))}
            <section
              className={`rebar-editor ${selectedBar === "N4" ? "selected" : ""}`}
              onClick={() => setBar("N4")}
            >
              <h4>
                <span className="bar-tag N4">N4</span>Armadura construtiva
              </h4>
              <label className="field">
                <span className="field-label">
                  Diâmetro <i>ϕ</i>
                </span>
                <select
                  aria-label="Diâmetro N4"
                  value={p.rebar.constructiveDiameter}
                  onChange={(e) =>
                    update({
                      ...p,
                      rebar: {
                        ...p.rebar,
                        constructiveDiameter: Number(e.target.value),
                      },
                    })
                  }
                >
                  {Array.from(
                    new Set([
                      5,
                      6.3,
                      8,
                      10,
                      12.5,
                      16,
                      20,
                      25,
                      p.rebar.constructiveDiameter,
                    ]),
                  )
                    .sort((a, b) => a - b)
                    .map((d) => (
                      <option key={d} value={d}>
                        {number(d, 1)} mm
                      </option>
                    ))}
                </select>
              </label>
              <div className="provided-area">
                <span>Quantidade derivada de N3</span>
                <strong>{p.rebar.stirrupBranches} barras</strong>
              </div>
              <p className="field-help">
                Uma barra por vértice inferior interno de N3. Acompanha a face
                inferior, prolonga-se no suporte e dobra na ponta. Não entra no
                cálculo resistente nem na sugestão.
              </p>
            </section>
          </>
        )}
      </div>
      <div className="inspector-bottom">
        <span className="status-dot" /> Edição local · sem conexão necessária
      </div>
    </aside>
  );
}

export default memo(Inspector);
