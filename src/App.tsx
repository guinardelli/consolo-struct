import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useMemo,
  useState,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { isTauri } from "@tauri-apps/api/core";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileJson,
  FileText,
  FolderOpen,
  Info,
  Layers3,
  ListChecks,
  Moon,
  PanelLeftOpen,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Viewport, { type ViewportHandle } from "./components/Viewport";
import Ribbon, { type Action, type RibbonTab } from "./components/Ribbon";
import { ribbonCommands } from "./components/ribbonCommands";
import StrutLimitControl from "./components/StrutLimitControl";
import MaterialSafetyControl from "./components/MaterialSafetyControl";
import ExcessConcreteControl from "./components/ExcessConcreteControl";
import { pieceVolume } from "./domain/profile";
import BarArrangementControl from "./components/BarArrangementControl";
import { beamArrangementActive } from "./detailing/beam";
import PanelResizer from "./components/PanelResizer";
import Inspector from "./components/Inspector";
import ProjectBrowser from "./components/ProjectBrowser";
import DocumentTabs from "./components/DocumentTabs";
import QuantityEditor from "./components/QuantityEditor";
import MemoryPage from "./components/MemoryPage";
import BrandSignature from "./components/BrandSignature";
import {
  documentReducer,
  initialDocuments,
  type DocumentId,
} from "./domain/documents";
import {
  area,
  decodeProject,
  exampleProject,
  fingerprint,
  geometryErrors,
  newPiece,
  number,
  type GeometryKey,
  type InspectorTab,
  type Piece,
  type Project,
} from "./domain/model";
import {
  calculate,
  ENGINE_VERSION,
  type CalculationResult,
} from "./domain/engine";
import { suggestReinforcement } from "./domain/autodesign";
import CalculationReport, {
  resultLabels,
} from "./components/CalculationReport";
import { nativeOpen, safeName, saveFile } from "./lib/files";
import { toCsv, toDxf, toPdf, toSvg, toCalculationJson } from "./lib/exports";

const ThreeViewport = lazy(() => import("./components/ThreeViewport"));
const Detailing = lazy(() => import("./components/Detailing"));

const storageKey = "consolostruct.project.v1";
function initialProject(): Project {
  try {
    const raw =
      localStorage.getItem(storageKey) ??
      localStorage.getItem("lumeconsolo.project.v1");
    if (raw) return decodeProject(raw);
  } catch {
    /* Unreadable data is preserved in the original key until the first edit. */
  }
  return exampleProject();
}
type Page = "workspace" | "pieces" | "report" | "details" | "empty";
type Modal =
  | "project"
  | "newProject"
  | "piece"
  | "export"
  | "about"
  | "delete"
  | "strutLimit"
  | "materialSafety"
  | "excessConcrete"
  | "barArrangement"
  | null;
type History = { past: Project[]; present: Project; future: Project[] };

export default function App() {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialProject(),
    future: [],
  }));
  const project = history.present;
  const [selected, setSelected] = useState(() => project.pieces[0].id);
  const p = project.pieces.find((p) => p.id === selected) ?? project.pieces[0];
  const [documents, dispatchDocument] = useReducer(
    documentReducer,
    initialDocuments,
  );
  const lastView = useRef<"elevation" | "section" | "three">("elevation");
  const openDocument = useCallback((id: DocumentId) => {
    if (id === "elevation" || id === "section" || id === "three")
      lastView.current = id;
    dispatchDocument({ type: "open", id });
  }, []);
  const closeDocument = useCallback(
    (id: DocumentId) => dispatchDocument({ type: "close", id }),
    [],
  );
  const page: Page =
    documents.active === null
      ? "empty"
      : ["elevation", "section", "three"].includes(documents.active)
        ? "workspace"
        : (documents.active as Page);
  const view =
    page === "workspace"
      ? (documents.active as "elevation" | "section" | "three")
      : lastView.current;
  const setPage = useCallback(
    (next: Exclude<Page, "empty">) =>
      openDocument(next === "workspace" ? lastView.current : next),
    [openDocument],
  );
  const [tab, setTab] = useState<InspectorTab>("geometry");
  const [modal, setModal] = useState<Modal>(null);
  const [theme, setTheme] = useState(() => {
    try {
      return (localStorage.getItem("consolostruct.theme") ??
        localStorage.getItem("lumeconsolo.theme")) === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  const [sidebar, setSidebar] = useState(() => window.innerWidth >= 900),
    [grid, setGrid] = useState(false),
    [dims, setDims] = useState(true),
    [steel, setSteel] = useState(true);
  const [ribbon, setRibbon] = useState<RibbonTab>("Início");
  const [properties, setProperties] = useState(() => window.innerWidth >= 700),
    [forces, setForces] = useState(true);
  const [mode, setMode] = useState<"select" | "pan">("select");
  const [browserWidth, setBrowserWidth] = useState(210),
    [propertyWidth, setPropertyWidth] = useState(278);
  const viewport = useRef<ViewportHandle>(null);
  const [zoom, setZoom] = useState(1),
    [focus, setFocus] = useState<GeometryKey>(),
    [bar, setBar] = useState("N1");
  const [expanded, setExpanded] = useState(false),
    [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [toast, setToast] = useState(""),
    [saving, setSaving] = useState(false),
    [storageError, setStorageError] = useState(false),
    [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    client: "",
    author: "",
    description: "",
    quantity: 1,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const modalReturnFocus = useRef<HTMLElement | null>(null);
  const hasEdited = useRef(false);
  const errors = useMemo(() => geometryErrors(p), [p]);
  const result = results[p.id];
  const currentFingerprint = useMemo(() => fingerprint(p), [p]);
  const stale = !!result && result.fingerprint !== currentFingerprint;
  useEffect(() => {
    const active = documents.active;
    if (active === "elevation" || active === "section" || active === "three")
      lastView.current = active;
  }, [documents.active]);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("consolostruct.theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (!hasEdited.current) return;
    const flush = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(project));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    };
    const timer = setTimeout(flush, 250);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [project]);
  const commit = useCallback(
    (next: Project | ((previous: Project) => Project)) => {
      hasEdited.current = true;
      setHistory((h) => {
        const value = typeof next === "function" ? next(h.present) : next;
        if (
          value === h.present ||
          (value.name === h.present.name &&
            value.client === h.present.client &&
            value.author === h.present.author &&
            value.pieces.length === h.present.pieces.length &&
            value.pieces.every((p, i) => p === h.present.pieces[i]))
        )
          return h;
        return {
          past: [...h.past, h.present].slice(-60),
          present: value,
          future: [],
        };
      });
    },
    [],
  );
  const undo = useCallback(() => {
    hasEdited.current = true;
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  }, []);
  const redo = useCallback(() => {
    hasEdited.current = true;
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  }, []);
  const updatePiece = useCallback(
    (next: Piece) =>
      commit((pr) => {
        const old = pr.pieces.find((item) => item.id === next.id);
        if (
          !old ||
          old === next ||
          JSON.stringify(old) === JSON.stringify(next)
        )
          return pr;
        return {
          ...pr,
          pieces: pr.pieces.map((item) => (item.id === next.id ? next : item)),
        };
      }),
    [commit],
  );
  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
        return;
      commit((pr) => {
        const old = pr.pieces.find((p) => p.id === id);
        if (!old || old.quantity === quantity) return pr;
        return {
          ...pr,
          pieces: pr.pieces.map((p) => (p.id === id ? { ...p, quantity } : p)),
        };
      });
    },
    [commit],
  );
  const selectPiece = useCallback((id: string) => {
    setSelected(id);
    setFocus(undefined);
  }, []);
  const browserView = useCallback(
    (id: DocumentId, pieceId?: string) => {
      if (pieceId) selectPiece(pieceId);
      openDocument(id);
    },
    [openDocument, selectPiece],
  );
  const closeBrowser = useCallback(() => setSidebar(false), []);
  const closeProperties = useCallback(() => setProperties(false), []);
  const saveProject = useCallback(async () => {
    try {
      if (
        await saveFile(
          `${safeName(project.name)}.consolo.json`,
          JSON.stringify(project, null, 2),
          "application/json",
          "json",
        )
      )
        notify(
          "Projeto exportado. O arquivo pode ser reaberto no ConsoloStruct.",
        );
    } catch {
      notify("Não foi possível salvar o arquivo. Tente outra pasta.");
    }
  }, [project, notify]);
  const saveRef = useRef(saveProject);
  saveRef.current = saveProject;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const editable =
        e.target instanceof HTMLElement &&
        !!e.target.closest("input,textarea,[contenteditable]");
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        setTimeout(() => void saveRef.current(), 0);
      } else if (!editable && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  const load = (raw: string) => {
    try {
      const next = decodeProject(raw);
      commit(next);
      setSelected(next.pieces[0].id);
      setResults({});
      setPage("workspace");
      notify("Projeto aberto. Você pode desfazer esta troca.");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Não foi possível abrir este projeto.",
      );
    }
  };
  const open = async () => {
    if (isTauri()) {
      try {
        const raw = await nativeOpen();
        if (raw !== null) load(raw);
      } catch {
        notify("Não foi possível ler o arquivo selecionado.");
      }
    } else inputRef.current?.click();
  };
  const add = (duplicate = false) => {
    if (project.pieces.length >= 200) {
      notify("Limite de 200 peças por projeto.");
      return;
    }
    let n = 1;
    while (
      project.pieces.some((x) => x.name === `C${String(n).padStart(2, "0")}`)
    )
      n++;
    const fresh = newPiece(n);
    const next = duplicate
      ? {
          ...structuredClone(p),
          id: fresh.id,
          name: fresh.name,
          description: (p.description + " · cópia").slice(0, 160),
        }
      : fresh;
    commit({ ...project, pieces: [...project.pieces, next] });
    setSelected(next.id);
    setPage("workspace");
    setTab("geometry");
    notify(duplicate ? "Peça duplicada." : "Nova peça adicionada.");
  };
  const showForm = (kind: "project" | "piece") => {
    setForm({
      name: kind === "project" ? project.name : p.name,
      client: project.client,
      author: project.author,
      description: p.description,
      quantity: p.quantity,
    });
    setModal(kind);
  };
  const invalidDraft = () => {
    if (!document.querySelector('[aria-invalid="true"]')) return false;
    setResults((r) => {
      const next = { ...r };
      delete next[p.id];
      return next;
    });
    notify(
      "Há um campo com valor inválido. Corrija-o antes de calcular ou exportar.",
    );
    return true;
  };
  const runCalculation = () => {
    if (invalidDraft()) return;
    const next = calculate(p);
    setResults((r) => ({ ...r, [p.id]: next }));
    setExpanded(true);
    notify(resultLabels[next.status]);
  };
  const runDesign = () => {
    if (invalidDraft()) return;
    const proposal = suggestReinforcement(p);
    if (proposal.changed) updatePiece(proposal.piece);
    setResults((r) => ({ ...r, [p.id]: proposal.result }));
    setExpanded(true);
    notify(proposal.message);
  };
  async function exportData(
    kind: "json" | "svg" | "dxf" | "pdf" | "csv" | "calc",
  ) {
    if (["svg", "dxf"].includes(kind) && errors.length) {
      notify(
        "Corrija as inconsistências geométricas antes de exportar esta peça.",
      );
      return;
    }
    if (invalidDraft()) return;
    setSaving(true);
    try {
      let done = false;
      const filename = `${safeName(p.name)}-consolostruct`;
      if (kind === "json") {
        done = await saveFile(
          `${safeName(project.name)}.consolo.json`,
          JSON.stringify(project, null, 2),
          "application/json",
          "json",
        );
      }
      if (kind === "calc")
        done = await saveFile(
          `${filename}.calc.json`,
          toCalculationJson(project, p),
          "application/json",
          "json",
        );
      if (kind === "svg")
        done = await saveFile(
          `${filename}.svg`,
          toSvg(p),
          "image/svg+xml",
          "svg",
        );
      if (kind === "dxf")
        done = await saveFile(
          `${filename}.dxf`,
          toDxf(p),
          "application/dxf",
          "dxf",
        );
      if (kind === "csv")
        done = await saveFile(
          `${safeName(project.name)}-quantidades.csv`,
          toCsv(project),
          "text/csv;charset=utf-8",
          "csv",
        );
      if (kind === "pdf")
        done = await saveFile(
          `${filename}.pdf`,
          await toPdf(project, p),
          "application/pdf",
          "pdf",
        );
      if (done) {
        setModal(null);
        notify(`Arquivo ${kind.toUpperCase()} exportado.`);
      }
    } catch {
      notify(
        "Falha na exportação. Confira a pasta de destino e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }
  const dimension = useCallback((key: GeometryKey) => {
    setFocus(key);
    setTab("geometry");
  }, []);
  const chooseBar = useCallback((id: string) => {
    setBar(id);
    setTab("rebar");
  }, []);
  const total = project.pieces.reduce((sum, p) => sum + p.quantity, 0);
  const action = (a: Action) => {
    if (["geometry", "loads", "materials", "rebar", "design"].includes(a)) {
      setTab(a as InspectorTab);
      setProperties(true);
      setPage("workspace");
      return;
    }
    if (["pdf", "dxf", "svg", "csv"].includes(a)) {
      void exportData(a as "pdf" | "dxf" | "svg" | "csv");
      return;
    }
    switch (a) {
      case "strutLimit":
        setModal("strutLimit");
        break;
      case "barArrangement":
        setModal("barArrangement");
        break;
      case "materialSafety":
        setModal("materialSafety");
        break;
      case "excessConcrete":
        setModal("excessConcrete");
        break;
      case "new": {
        setForm({
          name: "",
          client: "",
          author: project.author,
          description: "",
          quantity: 1,
        });
        setModal("newProject");
        break;
      }
      case "open":
        void open();
        break;
      case "save":
        void saveProject();
        break;
      case "project":
        showForm("project");
        break;
      case "add":
        add();
        break;
      case "duplicate":
        add(true);
        break;
      case "rename":
        showForm("piece");
        break;
      case "delete":
        setModal("delete");
        break;
      case "select":
      case "pan":
        setMode(a);
        setPage("workspace");
        break;
      case "elevation":
      case "section":
      case "three":
        openDocument(a);
        break;
      case "fit":
        setPage("workspace");
        viewport.current?.fit();
        break;
      case "zoomIn":
        setPage("workspace");
        viewport.current?.zoomIn();
        break;
      case "zoomOut":
        setPage("workspace");
        viewport.current?.zoomOut();
        break;
      case "calculate":
        setPage("workspace");
        runCalculation();
        break;
      case "autodesign":
        setPage("workspace");
        runDesign();
        break;
      case "export":
        setModal("export");
        break;
      case "dimensions":
        setDims(!dims);
        break;
      case "steel":
        setSteel(!steel);
        break;
      case "forces":
        setForces(!forces);
        break;
      case "grid":
        setGrid(!grid);
        break;
      case "browser":
        setSidebar(!sidebar);
        break;
      case "properties":
        setProperties(!properties);
        break;
      case "checks":
        setPage("workspace");
        setExpanded(!expanded);
        break;
      case "theme":
        setTheme(theme === "light" ? "dark" : "light");
        break;
      case "pieces":
      case "report":
      case "details":
        setPage(a);
        break;
    }
  };
  return (
    <div className="app-shell">
      <input
        type="file"
        accept=".json"
        ref={inputRef}
        className="sr-only"
        aria-label="Abrir arquivo de projeto"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 2_000_000)
              notify("O projeto excede o limite de 2 MB.");
            else load(await f.text());
          }
          e.target.value = "";
        }}
      />
      <header className="titlebar">
        <div className="quick-access">
          <img
            src="/brand/consolostruct-128.png"
            width="23"
            height="23"
            alt=""
          />
          <strong>ConsoloStruct</strong>
          <span className="separator" />
          <button
            className="icon-button"
            title="Abrir projeto"
            aria-label="Abrir projeto"
            onClick={() => void open()}
          >
            <FolderOpen size={16} />
          </button>
          <button
            className="icon-button"
            title={`${ribbonCommands.save.tip} · Ctrl+S`}
            aria-label={ribbonCommands.save.label}
            onClick={() => void saveProject()}
          >
            <Save size={16} />
          </button>
          <button
            className="icon-button"
            title="Desfazer · Ctrl+Z"
            aria-label="Desfazer"
            disabled={!history.past.length}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            title="Refazer · Ctrl+Shift+Z"
            aria-label="Refazer"
            disabled={!history.future.length}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <button
          className="document-title"
          onClick={() => showForm("project")}
          title="Editar dados do projeto"
        >
          {project.name}
          <span> — Projeto local</span>
        </button>
        <div className="titlebar-right">
          <span className={`autosave ${storageError ? "error" : ""}`}>
            {storageError ? "Exporte para salvar" : "Rascunho automático"}
          </span>
          <button
            className="icon-button"
            aria-label="Alternar tema"
            aria-pressed={theme === "dark"}
            title={theme === "light" ? "Usar tema escuro" : "Usar tema claro"}
            onClick={() => action("theme")}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            className="icon-button"
            aria-label="Ajuda e atalhos"
            title="Ajuda e atalhos"
            onClick={() => setModal("about")}
          >
            <CircleHelp size={17} />
          </button>
        </div>
      </header>
      <Ribbon
        tab={ribbon}
        setTab={setRibbon}
        onAction={action}
        dark={theme === "dark"}
        canDelete={project.pieces.length > 1}
        active={{
          select: mode === "select",
          pan: mode === "pan",
          elevation: page === "workspace" && view === "elevation",
          section: page === "workspace" && view === "section",
          three: page === "workspace" && view === "three",
          dimensions: dims,
          steel,
          forces,
          grid,
          browser: sidebar,
          properties,
          checks: expanded,
          barArrangement: beamArrangementActive(p),
        }}
      />
      <div className="desktop-body">
        {sidebar && (
          <>
            <ProjectBrowser
              project={project}
              selected={p.id}
              active={documents.active}
              width={browserWidth}
              onSelect={selectPiece}
              onView={browserView}
              onQuantity={updateQuantity}
              onAdd={() => add()}
              onProject={() => showForm("project")}
              onClose={closeBrowser}
            />
            <PanelResizer
              label="Largura do navegador"
              value={browserWidth}
              min={160}
              max={320}
              onChange={setBrowserWidth}
            />
          </>
        )}
        <main className="document-workspace">
          <nav className="document-tabs" aria-label="Vistas e documentos">
            {!sidebar && (
              <button
                title="Mostrar navegador do projeto"
                aria-label="Mostrar navegador do projeto"
                onClick={() => setSidebar(true)}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <DocumentTabs
              state={documents}
              pieceName={p.name}
              open={openDocument}
              close={closeDocument}
            />
            {!properties && (
              <button
                title="Mostrar propriedades"
                aria-label="Mostrar propriedades"
                onClick={() => setProperties(true)}
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
          </nav>
          {page === "workspace" ? (
            <div className="drawing-workspace">
              <div className="view-caption">
                <h1>
                  {p.name} · {p.description}
                </h1>
                <span>Representação esquemática</span>
              </div>
              {view === "three" ? (
                <Suspense
                  fallback={
                    <div className="canvas three-loading" role="status">
                      Preparando vista 3D…
                    </div>
                  }
                >
                  <ThreeViewport
                    key={p.id}
                    apiRef={viewport}
                    piece={p}
                    rebar={steel}
                    dimensions={dims}
                    grid={grid}
                    forces={forces}
                    dark={theme === "dark"}
                    focus={focus}
                    selectedBar={bar}
                    mode={mode}
                    onMode={setMode}
                    onDimension={dimension}
                    onBar={chooseBar}
                    onUpdate={updatePiece}
                    onZoom={setZoom}
                  />
                </Suspense>
              ) : (
                <Viewport
                  key={`${p.id}:${view}`}
                  apiRef={viewport}
                  piece={p}
                  section={view === "section"}
                  rebar={steel}
                  dimensions={dims}
                  grid={grid}
                  forces={forces}
                  focus={focus}
                  selectedBar={bar}
                  mode={mode}
                  onMode={setMode}
                  onDimension={dimension}
                  onBar={chooseBar}
                  onUpdate={updatePiece}
                  onZoom={setZoom}
                />
              )}
              <div className="drawing-legend">
                {[
                  { id: "N1", label: "Tirante" },
                  { id: "N2", label: "Costura" },
                  { id: "N3", label: "Estribos" },
                  { id: "N4", label: "Construtiva" },
                ].map((b) => (
                  <button
                    key={b.id}
                    className={bar === b.id ? "selected" : ""}
                    onClick={() => {
                      chooseBar(b.id);
                      setProperties(true);
                    }}
                  >
                    <span className={`legend-line ${b.id}`} />
                    {b.id} <small>{b.label}</small>
                  </button>
                ))}
                <span className="geometry-summary">
                  Vol. {number(pieceVolume(p), 3)} m³ <span>·</span> Aₛ,N1{" "}
                  {number(area(p.rebar.tieCount, p.rebar.tieDiameter) / 100, 2)}{" "}
                  cm²
                </span>
              </div>
              <div
                className={`checks-panel ${expanded || errors.length ? "expanded" : ""}`}
              >
                <button
                  className="checks-heading"
                  aria-expanded={expanded || errors.length > 0}
                  onClick={() => setExpanded(!expanded)}
                >
                  <ListChecks size={17} />
                  <strong>Verificações</strong>
                  <span className="pill">
                    {errors.length
                      ? `${errors.length} pendência(s) geométrica(s)`
                      : result
                        ? stale
                          ? "Cálculo desatualizado"
                          : resultLabels[result.status]
                        : "Aguardando cálculo"}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {(expanded || errors.length > 0) && (
                  <div className="checks-body">
                    {errors.map((e) => (
                      <div className="check-error" key={e}>
                        <ShieldAlert size={16} />
                        {e}
                      </div>
                    ))}
                    <CalculationReport result={result} stale={stale} compact />
                  </div>
                )}
              </div>
            </div>
          ) : page === "details" || page === "report" ? null : page ===
            "pieces" ? (
            <section className="full-page">
              <div className="project-summary">
                <div>
                  <span>TIPOS DE CONSOLO</span>
                  <strong>
                    {project.pieces.length.toString().padStart(2, "0")}
                  </strong>
                </div>
                <div>
                  <span>PEÇAS NO PROJETO</span>
                  <strong>{total.toString().padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>VOLUME GEOMÉTRICO TOTAL</span>
                  <strong>
                    {number(
                      project.pieces.reduce(
                        (s, p) => s + pieceVolume(p) * p.quantity,
                        0,
                      ),
                      3,
                    )}{" "}
                    <small>m³</small>
                  </strong>
                </div>
                <div>
                  <span>DIMENSIONAMENTO</span>
                  <strong className="text-small">Não executado</strong>
                </div>
              </div>
              <div className="table-header">
                <h2>
                  Lista de peças <span>{project.pieces.length}</span>
                </h2>
                <input
                  aria-label="Buscar peças"
                  placeholder="Buscar identificação ou descrição…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Peça</th>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                      <th>b × h × L (cm)</th>
                      <th>V (kN)</th>
                      <th>Armadura N1</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {project.pieces
                      .filter((p) =>
                        (p.name + " " + p.description)
                          .toLocaleLowerCase()
                          .includes(search.toLocaleLowerCase()),
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                          </td>
                          <td>{item.description}</td>
                          <td>
                            <QuantityEditor
                              name={item.name}
                              value={item.quantity}
                              onChange={(n) => updateQuantity(item.id, n)}
                            />
                          </td>
                          <td>
                            {item.geometry.width / 10} ×{" "}
                            {item.geometry.height / 10} ×{" "}
                            {item.geometry.length / 10}
                          </td>
                          <td>{number(item.loads.vertical / 1000, 0)}</td>
                          <td>
                            {item.rebar.tieCount} Ø{" "}
                            {number(item.rebar.tieDiameter, 1)}
                          </td>
                          <td>
                            <span className="pill">Rascunho</span>
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Editar ${item.name}`}
                              onClick={() => {
                                setSelected(item.id);
                                setPage("workspace");
                              }}
                            >
                              <ArrowUpRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="table-note">
                <Info size={15} /> A área de aço e o volume são propriedades
                geométricas. Não representam uma verificação estrutural.
              </p>
            </section>
          ) : (
            <div className="empty-workspace">
              <BrandSignature />
              <p>Nenhuma vista aberta.</p>
              <button
                className="button"
                onClick={() => openDocument("elevation")}
              >
                Abrir elevação
              </button>
              <button className="button" onClick={() => action("new")}>
                Novo projeto
              </button>
            </div>
          )}
          {documents.tabs.includes("details") &&
            documents.visited.includes("details") && (
              <div className="retained-document" hidden={page !== "details"}>
                <Suspense
                  fallback={
                    <div className="info-block">Carregando detalhamento…</div>
                  }
                >
                  <Detailing
                    project={project}
                    piece={p}
                    select={setSelected}
                    update={updatePiece}
                    notify={notify}
                    dark={theme === "dark"}
                    active={page === "details"}
                  />
                </Suspense>
              </div>
            )}
          {documents.tabs.includes("report") &&
            documents.visited.includes("report") && (
              <div className="retained-document" hidden={page !== "report"}>
                <MemoryPage
                  project={project}
                  piece={p}
                  result={result}
                  stale={stale}
                  saving={saving}
                  select={setSelected}
                  calculate={runCalculation}
                  exportPdf={() => void exportData("pdf")}
                />
              </div>
            )}
        </main>
        {properties && page !== "details" && page !== "empty" && (
          <>
            <PanelResizer
              label="Largura das propriedades"
              value={propertyWidth}
              min={240}
              max={380}
              reverse
              onChange={setPropertyWidth}
            />
            <div className="property-dock" style={{ width: propertyWidth }}>
              <Inspector
                piece={p}
                tab={tab}
                setTab={setTab}
                update={updatePiece}
                onFocus={setFocus}
                selectedBar={bar}
                setBar={setBar}
                onClose={closeProperties}
              />
            </div>
          </>
        )}
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {isTauri() ? "Desktop" : "Prévia local"}
          <span className="status-divider">|</span>
          {storageError
            ? "Exporte o projeto para salvar"
            : "Rascunho salvo neste dispositivo"}
        </span>
        <span className="status-prototype">
          Motor ELU {ENGINE_VERSION} · hipóteses e limites na memória
        </span>
        <span className="status-view">
          {page === "workspace" ? `${Math.round(zoom * 100)}%` : "Documento"}
          <span className="status-divider">|</span>cm · kN · MPa
        </span>
      </footer>
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setModal(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content
            className={`modal-content ${modal === "export" ? "export-modal" : ""}`}
            onOpenAutoFocus={() => {
              modalReturnFocus.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = modalReturnFocus.current;
              if (target?.isConnected && !target.matches(":disabled"))
                target.focus();
              else
                document
                  .querySelector<HTMLElement>(
                    '.ribbon-tabs [aria-selected="true"]',
                  )
                  ?.focus();
            }}
          >
            <Dialog.Title>
              {modal === "strutLimit"
                ? "Limite da biela da peça selecionada"
                : modal === "materialSafety"
                  ? "Coeficientes dos materiais da peça selecionada"
                  : modal === "excessConcrete"
                    ? "Concreto excedente da peça selecionada"
                    : modal === "barArrangement"
                      ? "Detalhamento das armaduras da peça selecionada"
                      : modal === "project" || modal === "newProject"
                        ? "Dados do projeto"
                        : modal === "piece"
                          ? "Identificação da peça"
                          : modal === "export"
                            ? "Exportar projeto"
                            : modal === "delete"
                              ? "Excluir este consolo?"
                              : "Conheça o ConsoloStruct"}
            </Dialog.Title>
            <Dialog.Description>
              {modal === "strutLimit" ||
              modal === "materialSafety" ||
              modal === "excessConcrete" ||
              modal === "barArrangement"
                ? `Peça ${p.name} · ${p.description}. As alterações entram em Desfazer/Refazer. Use Salvar projeto para guardar os valores no arquivo.`
                : modal === "export"
                  ? "PDF e CSV recalculam os dados atuais. DXF e SVG são geométricos."
                  : modal === "about"
                    ? "Editor paramétrico 2D/3D · versão 0.7.1 · detalhamento e quadro de aço."
                    : modal === "delete"
                      ? `${p.name} será removido. Você poderá desfazer esta ação.`
                      : "Estas informações ficam salvas no arquivo do projeto."}
            </Dialog.Description>
            <Dialog.Close
              className="modal-close icon-button"
              aria-label="Fechar janela"
              disabled={saving}
            >
              <X size={20} />
            </Dialog.Close>
            {(modal === "project" ||
              modal === "newProject" ||
              modal === "piece") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.name.trim()) return;
                  if (modal === "newProject") {
                    const fresh = newPiece(1);
                    commit({
                      format: "lumeconsolo",
                      schemaVersion: 5,
                      name: form.name.trim(),
                      client: form.client.trim(),
                      author: form.author.trim(),
                      pieces: [fresh],
                    });
                    setSelected(fresh.id);
                    setResults({});
                    lastView.current = "elevation";
                    dispatchDocument({ type: "reset" });
                    setTab("geometry");
                    notify("Projeto criado com os dados informados.");
                  } else if (modal === "project")
                    commit({
                      ...project,
                      name: form.name.trim(),
                      client: form.client,
                      author: form.author,
                    });
                  else
                    updatePiece({
                      ...p,
                      name: form.name.trim(),
                      description: form.description,
                      quantity: form.quantity,
                    });
                  setModal(null);
                }}
              >
                <label className="field">
                  <span className="field-label">
                    {modal === "project" || modal === "newProject"
                      ? "Nome do projeto"
                      : "Identificação"}
                  </span>
                  <input
                    required
                    maxLength={
                      modal === "project" || modal === "newProject" ? 120 : 80
                    }
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                {modal === "project" || modal === "newProject" ? (
                  <>
                    <label className="field">
                      <span className="field-label">Cliente</span>
                      <input
                        maxLength={120}
                        value={form.client}
                        onChange={(e) =>
                          setForm({ ...form, client: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Autor / responsável</span>
                      <input
                        maxLength={120}
                        value={form.author}
                        onChange={(e) =>
                          setForm({ ...form, author: e.target.value })
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span className="field-label">Descrição</span>
                      <input
                        maxLength={160}
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">
                        Quantidade de peças iguais
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        required
                        value={form.quantity}
                        onChange={(e) =>
                          setForm({ ...form, quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                  </>
                )}
                <div className="modal-actions">
                  {modal === "piece" && (
                    <button
                      type="button"
                      className="button danger-text"
                      disabled={project.pieces.length === 1}
                      onClick={() => setModal("delete")}
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  )}
                  <Dialog.Close className="button" type="button">
                    Cancelar
                  </Dialog.Close>
                  <button className="button primary" type="submit">
                    {modal === "newProject"
                      ? "Criar projeto"
                      : "Salvar alterações"}
                  </button>
                </div>
              </form>
            )}
            {modal === "delete" && (
              <div className="modal-actions">
                <Dialog.Close className="button">Cancelar</Dialog.Close>
                <button
                  className="button danger"
                  onClick={() => {
                    const remaining = project.pieces.filter(
                      (x) => x.id !== p.id,
                    );
                    if (!remaining.length) return;
                    commit({ ...project, pieces: remaining });
                    setSelected(remaining[0].id);
                    setModal(null);
                    notify("Peça removida. Use Desfazer para restaurar.");
                  }}
                >
                  Excluir peça
                </button>
              </div>
            )}
            {modal === "strutLimit" && (
              <>
                <StrutLimitControl
                  piece={p}
                  onChange={(value) =>
                    updatePiece({
                      ...p,
                      design: { ...p.design, strutLimit: value },
                    })
                  }
                />
                <p>
                  Alterar o critério torna resultados anteriores desatualizados.
                  Use Calcular para conferir a nova revisão.
                </p>
                <div className="modal-actions">
                  <Dialog.Close className="button">Concluir</Dialog.Close>
                </div>
              </>
            )}
            {modal === "materialSafety" && (
              <>
                <MaterialSafetyControl
                  piece={p}
                  onChange={(patch) =>
                    updatePiece({ ...p, design: { ...p.design, ...patch } })
                  }
                />
                <p>
                  Os valores afetam somente a peça selecionada. Use Calcular
                  para conferir a nova revisão após editar.
                </p>
                <div className="modal-actions">
                  <Dialog.Close className="button">Concluir</Dialog.Close>
                </div>
              </>
            )}
            {modal === "excessConcrete" && (
              <>
                <ExcessConcreteControl
                  piece={p}
                  onChange={(value) =>
                    updatePiece({
                      ...p,
                      design: { ...p.design, excessConcrete: value },
                    })
                  }
                />
                <p>
                  A geometria é atualizada em todas as vistas. Use Calcular para
                  conferir a nova revisão.
                </p>
                <div className="modal-actions">
                  <Dialog.Close className="button">Concluir</Dialog.Close>
                </div>
              </>
            )}
            {modal === "barArrangement" && (
              <>
                <BarArrangementControl
                  piece={p}
                  onChange={(patch) =>
                    updatePiece({
                      ...p,
                      detailing: { ...p.detailing, ...patch },
                    })
                  }
                />
                <p>
                  O modo afeta somente o detalhamento da peça selecionada: os
                  desenhos, o modelo 3D e o quadro de aço. O resultado do
                  cálculo continua válido.
                </p>
                <div className="modal-actions">
                  <Dialog.Close className="button">Concluir</Dialog.Close>
                </div>
              </>
            )}
            {modal === "export" && (
              <>
                <div className="export-grid">
                  {(
                    [
                      {
                        id: "json",
                        name: "Projeto editável",
                        ext: ".consolo.json",
                        desc: "Projeto reabrível com todas as peças e parâmetros",
                        icon: FileJson,
                      },
                      {
                        id: "calc",
                        name: "Cálculo auditável",
                        ext: ".calc.json",
                        desc: "Entradas e resultados; não reabre como projeto",
                        icon: FileJson,
                      },
                      {
                        id: "pdf",
                        name: "Memória de cálculo",
                        ext: ".pdf",
                        desc: "Equações, verificações e combinações",
                        icon: FileText,
                      },
                      {
                        id: "svg",
                        name: "Geometria vetorial",
                        ext: ".svg",
                        desc: "Contorno do consolo e pilar em milímetros",
                        icon: Ruler,
                      },
                      {
                        id: "dxf",
                        name: "Geometria para CAD",
                        ext: ".dxf",
                        desc: "Contornos 1:1 em milímetros",
                        icon: Layers3,
                      },
                      {
                        id: "csv",
                        name: "Lista de quantidades",
                        ext: ".csv",
                        desc: "Quantidades do projeto; não é quadro de corte",
                        icon: ClipboardList,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      className="export-option"
                      disabled={
                        saving ||
                        (["svg", "dxf"].includes(item.id) && errors.length > 0)
                      }
                      onClick={() => void exportData(item.id)}
                    >
                      <item.icon size={23} />
                      <strong>{item.name}</strong>
                      <small>{item.desc}</small>
                      <span>
                        {item.ext}
                        <ArrowDownToLine size={14} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="info-block">
                  As opções de geometria acima exportam apenas o contorno. Para
                  vistas, formas das barras, comprimentos de corte e quadro de
                  aço, abra o Detalhamento.
                </div>
                <button
                  className="button"
                  onClick={() => {
                    setPage("details");
                    setModal(null);
                  }}
                >
                  Abrir detalhamento e quadro de aço
                </button>
                {saving && <p aria-live="polite">Preparando arquivo…</p>}
              </>
            )}
            {modal === "about" && (
              <>
                <div className="about-logo">
                  <img
                    src="/brand/consolostruct-128.png"
                    width="54"
                    height="54"
                    alt=""
                  />
                  <div>
                    <strong>ConsoloStruct</strong>
                    <span>por OPENSTRUCT · Engenharia aberta.</span>
                  </div>
                </div>
                <div className="info-block">
                  Motor ELU local para consolos curtos e muito curtos. Critérios
                  rastreáveis das NBR 6118:2026 e 9062:2017, com modelos de
                  Araújo e El Debs.
                </div>
                <ul className="about-list">
                  <li>
                    <Check size={16} /> Geometria paramétrica 2D/3D e edição de
                    armaduras
                  </li>
                  <li>
                    <Check size={16} /> Arquivos locais, histórico e exportações
                  </li>
                  <li>
                    <Info size={16} /> Verificações reais, hipóteses e limites
                    explícitos
                  </li>
                </ul>
                <div className="shortcut-row">
                  <span>Salvar arquivo</span>
                  <kbd>Ctrl S</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Desfazer / refazer</span>
                  <kbd>Ctrl Z / Ctrl Shift Z</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Confirmar campo</span>
                  <kbd>Enter</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Mover a vista (pan)</span>
                  <kbd>Botão do meio / Espaço + arrastar</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Zoom / enquadrar</span>
                  <kbd>Roda do mouse / F</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Editar dimensão</span>
                  <kbd>Clique na cota</kbd>
                </div>
                <p className="about-stack">
                  Tauri 2 · React · TypeScript · SVG
                  <br />
                  Código aberto sob licença MIT · v0.7.1
                </p>
                <button
                  className="button"
                  onClick={() => {
                    commit(exampleProject());
                    setResults({});
                    setModal(null);
                    notify(
                      "Exemplo restaurado. Você pode desfazer esta troca.",
                    );
                  }}
                >
                  <RotateCcw size={16} /> Restaurar projeto de exemplo
                </button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{toast}</span>
          <button aria-label="Dispensar mensagem" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
