import { memo, useMemo, useState, useEffect } from "react";
import { FileDown, FileImage, FileText, Table2 } from "lucide-react";
import TechnicalViewport from "./TechnicalViewport";
import { detailRequestKey, type DetailBundle } from "../detailing/job";
import { cachedDetails, requestDetails } from "../detailing/service";
import type { Piece, Project } from "../domain/model";
import { number } from "../domain/model";
import { NumericField } from "./NumericField";
import { beamArrangementActive } from "../detailing/beam";
import {
  drawingDxf,
  drawingPdf,
  drawingSvg,
  steelCsv,
} from "../detailing/exports";
import { safeName, saveFile } from "../lib/files";

function Detailing({
  project,
  piece,
  select,
  update,
  notify,
  dark,
  active,
}: {
  project: Project;
  piece: Piece;
  select: (id: string) => void;
  update: (piece: Piece) => void;
  notify: (message: string) => void;
  dark: boolean;
  active: boolean;
}) {
  const [scope, setScope] = useState<"one" | "all">("one");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(true);
  const key = detailRequestKey(project, piece.id, scope);
  const [prepared, setPrepared] = useState<{
    key: string;
    bundle: DetailBundle;
  } | null>(() => {
    const bundle = cachedDetails(key);
    return bundle ? { key, bundle } : null;
  });
  const [failure, setFailure] = useState("");
  useEffect(() => {
    if (!active) return;
    const cached = cachedDetails(key);
    if (cached) {
      setPrepared((v) => (v?.key === key ? v : { key, bundle: cached }));
      return;
    }
    let disposed = false;
    setFailure("");
    const timer = setTimeout(
      () => {
        void requestDetails(key, project, piece.id, scope)
          .then((bundle) => {
            if (!disposed) setPrepared({ key, bundle });
          })
          .catch((error) => {
            if (!disposed)
              setFailure(
                error instanceof Error
                  ? error.message
                  : "Não foi possível preparar o detalhamento.",
              );
          });
      },
      prepared ? 45 : 0,
    );
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [key, active]);
  const ready = prepared?.key === key;
  const bundle = prepared?.bundle;
  const { details = [], drawings = [], drawing } = bundle ?? {};
  const pieces = scope === "one" ? [piece] : project.pieces;
  const selectedDetail = useMemo(
    () => details.find((d) => d.piece.id === piece.id),
    [details, piece.id],
  );
  const exportDetail = async (kind: "dxf" | "pdf" | "svg" | "csv") => {
    if (document.querySelector('[aria-invalid="true"]')) {
      notify("Corrija o campo inválido antes de gerar os detalhes.");
      return;
    }
    if (!ready || !drawing) return;
    setBusy(true);
    try {
      const base = `${safeName(scope === "one" ? piece.name : project.name)}-detalhes-${scope === "one" ? "peca" : "todos"}`;
      const data =
        kind === "dxf"
          ? drawingDxf(drawing)
          : kind === "svg"
            ? drawingSvg(drawing)
            : kind === "pdf"
              ? await drawingPdf(drawings)
              : steelCsv(details);
      const mime = {
        dxf: "application/dxf",
        pdf: "application/pdf",
        svg: "image/svg+xml",
        csv: "text/csv;charset=utf-8",
      }[kind];
      if (await saveFile(`${base}.${kind}`, data, mime, kind))
        notify(
          `${kind.toUpperCase()} gerado: ${scope === "one" ? piece.name : `${pieces.length} tipos de consolo`}.`,
        );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Não foi possível gerar o arquivo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const patch = (values: Partial<Piece["detailing"]>) =>
    update({ ...piece, detailing: { ...piece.detailing, ...values } });
  return (
    <section className="detailing-page" aria-label="Detalhamento dos consolos">
      <div className="detail-toolbar">
        <label>
          Gerar{" "}
          <select
            aria-label="Escopo dos detalhes"
            value={scope}
            onChange={(e) => setScope(e.target.value as "one" | "all")}
          >
            <option value="one">Somente este consolo</option>
            <option value="all">Todos os consolos</option>
          </select>
        </label>
        <select
          aria-label="Peça do detalhamento"
          value={piece.id}
          onChange={(e) => select(e.target.value)}
        >
          {project.pieces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.quantity} peças
            </option>
          ))}
        </select>
        <span className="detail-toolbar-separator" />
        <button
          onClick={() => void exportDetail("dxf")}
          disabled={busy || !ready}
        >
          <FileDown size={16} /> Detalhes DXF
        </button>
        <button
          onClick={() => void exportDetail("pdf")}
          disabled={busy || !ready}
        >
          <FileText size={16} /> Detalhes PDF
        </button>
        <button
          onClick={() => void exportDetail("svg")}
          disabled={busy || !ready}
        >
          <FileImage size={16} /> Detalhes SVG
        </button>
        <button
          onClick={() => void exportDetail("csv")}
          disabled={busy || !ready}
        >
          <Table2 size={16} /> Quadro CSV
        </button>
        <button
          className="detail-settings-toggle"
          onClick={() => setSettings(!settings)}
          aria-pressed={settings}
        >
          Propriedades do detalhe
        </button>
      </div>
      {failure && (
        <div className="check-error" role="alert">
          {failure}
        </div>
      )}
      {!ready && (
        <div className="detail-loading" role="status">
          {bundle ? "Atualizando detalhes…" : "Preparando detalhes…"}
        </div>
      )}
      <div className="detail-workspace" aria-busy={!ready}>
        {bundle && drawing ? (
          <TechnicalViewport
            width={drawing.width}
            height={drawing.height}
            sections={bundle.sections}
            focusId={piece.id}
            scope={scope}
            dark={dark}
            active={active && ready}
          />
        ) : (
          <div className="detail-viewport" />
        )}
        {settings && (
          <aside
            className="detail-properties"
            aria-label="Propriedades do detalhamento"
          >
            <div className="dock-heading">
              <strong>Detalhamento · {piece.name}</strong>
            </div>
            <div className="detail-properties-body">
              <label className="field">
                <span className="field-label">Revisão</span>
                <input
                  aria-label="Revisão do detalhe"
                  maxLength={20}
                  value={piece.detailing.revision}
                  onChange={(e) => patch({ revision: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Disposição do tirante</span>
                <select
                  aria-label="Disposição do tirante"
                  value={piece.design.tieLayers}
                  onChange={(e) =>
                    update({
                      ...piece,
                      design: {
                        ...piece.design,
                        tieLayers: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value={1}>Simples · 1 camada</option>
                  <option value={2}>Duplo · 2 camadas</option>
                  <option value={3}>3 camadas</option>
                  <option value={4}>4 camadas</option>
                </select>
              </label>
              <NumericField
                label="Ramos resistentes do tirante"
                unit="ramos"
                min={2}
                max={40}
                value={piece.rebar.tieCount}
                onChange={(v) =>
                  update({ ...piece, rebar: { ...piece.rebar, tieCount: v } })
                }
              />
              <p className="detail-tip">
                Uma alça fornece dois ramos. A distribuição em camadas altera a
                altura útil no motor de cálculo. As formas diferentes recebem
                marcas próprias.
              </p>
              <NumericField
                label="Bitola do tirante"
                unit="mm"
                min={6.3}
                max={40}
                step={0.1}
                value={piece.rebar.tieDiameter}
                onChange={(v) =>
                  update({
                    ...piece,
                    rebar: { ...piece.rebar, tieDiameter: v },
                  })
                }
              />
              {beamArrangementActive(piece) && (
                <p className="detail-tip">
                  Armado como viga (Configurações › Detalhamento): tirante e
                  armadura positiva com dobras de 90° nas duas extremidades; as
                  dobras seguem lb,nec e o contorno da peça.
                </p>
              )}
              {piece.design.frontAnchor === "loop" &&
                !beamArrangementActive(piece) && (
                  <NumericField
                    label="D interno da alça principal"
                    unit="cm"
                    factor={10}
                    min={0}
                    max={3000}
                    value={piece.design.loopInternalDiameter}
                    onChange={(v) =>
                      update({
                        ...piece,
                        design: { ...piece.design, loopInternalDiameter: v },
                      })
                    }
                  />
                )}
              {piece.design.tieLayers > 1 &&
                piece.design.frontAnchor === "loop" &&
                !beamArrangementActive(piece) && (
                  <NumericField
                    label="D interno da alça na 2ª camada"
                    unit="cm"
                    factor={10}
                    min={0}
                    max={3000}
                    value={piece.detailing.secondLoopDiameter}
                    onChange={(v) => patch({ secondLoopDiameter: v })}
                  />
                )}
              {piece.design.tieLayers > 1 && (
                <p className="detail-tip">
                  D = 0 usa o diâmetro interno definido no cálculo. Um D próprio
                  permite distinguir a dobra da segunda camada.
                </p>
              )}
              <label className="field">
                <span className="field-label">Ancoragem no suporte</span>
                <select
                  aria-label="Ancoragem do detalhe"
                  value={piece.design.supportAnchor}
                  onChange={(e) =>
                    update({
                      ...piece,
                      design: {
                        ...piece.design,
                        supportAnchor: e.target.value as "straight" | "hook",
                      },
                    })
                  }
                >
                  <option value="straight">Reta</option>
                  <option value="hook">Gancho de 90°</option>
                </select>
              </label>
              <label className="design-toggle">
                <input
                  type="checkbox"
                  checked={piece.design.supportWeldedBar}
                  onChange={(e) =>
                    update({
                      ...piece,
                      design: {
                        ...piece.design,
                        supportWeldedBar: e.target.checked,
                      },
                    })
                  }
                />
                Barra transversal soldada na ancoragem (NBR 6118 §9.4.2.2)
              </label>
              {piece.design.supportAnchor === "straight" ? (
                <NumericField
                  label="Penetração do tirante"
                  unit="cm"
                  factor={10}
                  min={10}
                  value={piece.design.supportAnchorLength}
                  onChange={(v) =>
                    update({
                      ...piece,
                      design: { ...piece.design, supportAnchorLength: v },
                    })
                  }
                />
              ) : (
                <>
                  <NumericField
                    label="Projeção do gancho no suporte"
                    unit="cm"
                    factor={10}
                    value={piece.detailing.supportHookProjection}
                    onChange={(v) => patch({ supportHookProjection: v })}
                  />
                  <NumericField
                    label="Ponta reta do gancho"
                    unit="cm"
                    factor={10}
                    value={piece.detailing.supportHookTail}
                    onChange={(v) => patch({ supportHookTail: v })}
                  />
                </>
              )}
              <NumericField
                label="Penetração da costura"
                unit="cm"
                factor={10}
                min={10}
                value={piece.detailing.stitchEmbedment}
                onChange={(v) => patch({ stitchEmbedment: v })}
              />
              <div className="section-label section-spaced">
                ARMADURAS COMPLEMENTARES
              </div>
              {beamArrangementActive(piece) ? (
                <>
                  <NumericField
                    label="Barras da armadura positiva"
                    unit="barras"
                    min={2}
                    max={20}
                    value={piece.detailing.beamBottomCount}
                    onChange={(v) => patch({ beamBottomCount: v })}
                  />
                  <NumericField
                    label="Bitola da armadura positiva"
                    unit="mm"
                    min={5}
                    max={25}
                    step={0.1}
                    value={piece.detailing.beamBottomDiameter}
                    onChange={(v) => patch({ beamBottomDiameter: v })}
                  />
                  <p className="detail-tip">
                    No modo viga, a positiva é uma família independente (P1),
                    sem contribuição resistente. N4 permanece obrigatória;
                    eventuais interferências aparecem nas pendências.
                  </p>
                </>
              ) : null}
              <p className="detail-tip">
                N4 construtiva obrigatória: {piece.rebar.stirrupBranches} barras
                Ø{number(piece.rebar.constructiveDiameter, 1)} mm. Configure a
                bitola na guia Armaduras; a quantidade vem dos ramos de N3.
              </p>
              <NumericField
                label="Quantidade de pinos"
                unit="barras"
                min={0}
                max={20}
                value={piece.detailing.pins}
                onChange={(v) => patch({ pins: v })}
              />
              {piece.detailing.pins > 0 && (
                <>
                  <NumericField
                    label="Bitola do pino"
                    unit="mm"
                    min={6.3}
                    max={40}
                    step={0.1}
                    value={piece.detailing.pinDiameter}
                    onChange={(v) => patch({ pinDiameter: v })}
                  />
                  <NumericField
                    label="Embutimento do pino"
                    unit="cm"
                    factor={10}
                    value={piece.detailing.pinEmbedment}
                    onChange={(v) => patch({ pinEmbedment: v })}
                  />
                  <NumericField
                    label="Espera do pino"
                    unit="cm"
                    factor={10}
                    value={piece.detailing.pinProjection}
                    onChange={(v) => patch({ pinProjection: v })}
                  />
                  {piece.detailing.pins > 1 && (
                    <NumericField
                      label="Espaçamento entre eixos dos pinos"
                      unit="cm"
                      factor={10}
                      min={0}
                      max={6000}
                      value={piece.detailing.pinSpacing}
                      onChange={(v) => patch({ pinSpacing: v })}
                    />
                  )}
                  <NumericField
                    label="Deslocamento transversal dos pinos"
                    unit="cm"
                    factor={10}
                    min={-3000}
                    max={3000}
                    value={piece.detailing.pinCenterOffset}
                    onChange={(v) => patch({ pinCenterOffset: v })}
                  />
                  <p className="detail-tip">
                    Espaçamento zero distribui os pinos igualmente dentro da
                    largura do apoio. O corte indica as distâncias entre eixos e
                    à face lateral.
                  </p>
                </>
              )}
              <label className="field">
                <span className="field-label">Notas específicas da peça</span>
                <textarea
                  aria-label="Notas do detalhamento"
                  maxLength={2000}
                  value={piece.detailing.notes}
                  rows={3}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              <div className="detail-totals">
                <span>{selectedDetail?.bars.length ?? 0} posições</span>
                <strong>{number(selectedDetail?.mass ?? 0, 2)} kg/pç</strong>
                <span>
                  {piece.quantity} peças:{" "}
                  {number(selectedDetail?.totalMass ?? 0, 2)} kg
                </span>
              </div>
              <p className="detail-tip">
                As posições de fabricação (N1, N2…) são próprias de cada peça.
                Consulte a peça e a posição ao identificar uma barra na obra.
              </p>
              <details className="detail-issues" open>
                <summary>
                  Conferências ({selectedDetail?.issues.length ?? 0})
                </summary>
                {selectedDetail?.issues.map((v) => (
                  <p key={v.code} className={v.severity}>
                    {v.message}
                  </p>
                ))}
              </details>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

export default memo(Detailing);
