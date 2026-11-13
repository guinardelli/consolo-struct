import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import {
  Box,
  Check,
  Hand,
  Maximize,
  RotateCcw,
  ScanLine,
  X,
  ZoomIn,
  ZoomOut,
  Info,
} from "lucide-react";
import { type Piece, type GeometryKey, number } from "../domain/model";
import type { ViewportHandle } from "./Viewport";
import { buildSceneModel, type Point3 } from "../visualization/model3d";
import { createModelGroup, disposeGroup } from "../visualization/scene3d";

type Preset = "iso" | "front" | "top" | "side";
interface Engine {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer | SVGRenderer;
  group: THREE.Group | null;
  draw: () => void;
  fit: () => void;
  preset: (p: Preset) => void;
  zoom: (factor: number) => void;
  resize: () => void;
}
type Props = {
  piece: Piece;
  rebar: boolean;
  dimensions: boolean;
  forces: boolean;
  grid: boolean;
  dark: boolean;
  mode: "select" | "pan";
  selectedBar: string;
  focus?: GeometryKey;
  onMode: (m: "select" | "pan") => void;
  onBar: (id: string) => void;
  onDimension: (key: GeometryKey) => void;
  onUpdate: (p: Piece) => void;
  onZoom: (n: number) => void;
  apiRef: Ref<ViewportHandle>;
};
const presets: Record<Preset, Point3> = {
  iso: [1.7, -2.1, 1.5],
  front: [0, -1, 0],
  top: [0, 0, 1],
  side: [1, 0, 0],
};
const names: Record<GeometryKey, string> = {
  width: "Largura b",
  height: "Altura h",
  tipHeight: "Altura na ponta h₂",
  length: "Comprimento L",
  loadOffset: "Posição da carga a",
  columnWidth: "Dimensão do suporte P",
  cover: "Cobrimento c",
};
export default function ThreeViewport(props: Props) {
  const { piece, dimensions, forces, mode, focus, apiRef } = props;
  const model = useMemo(
    () => buildSceneModel(piece),
    [piece.geometry, piece.loads, piece.rebar, piece.design],
  );
  const live = useRef({ props, model });
  live.current = { props, model };
  const root = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null);
  const labels = useRef(new Map<string, HTMLElement>()),
    leaders = useRef<SVGSVGElement>(null),
    axes = useRef<SVGSVGElement>(null);
  const [transparent, setTransparent] = useState(false),
    [rendererKind, setRendererKind] = useState("loading"),
    [failure, setFailure] = useState(""),
    [retry, setRetry] = useState(0),
    [preset, setPreset] = useState<Preset | "free">("iso");
  const [editor, setEditor] = useState<{
      key: GeometryKey;
      left: number;
      top: number;
    } | null>(null),
    [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const transparentRef = useRef(transparent);
  transparentRef.current = transparent;
  useImperativeHandle(
    apiRef,
    () => ({
      fit: () => engine.current?.fit(),
      zoomIn: () => engine.current?.zoom(1.2),
      zoomOut: () => engine.current?.zoom(1 / 1.2),
    }),
    [],
  );
  useEffect(() => {
    if (editor) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editor]);
  useEffect(() => {
    const parent = host.current,
      container = root.current;
    if (!parent || !container) return;
    let renderer: Engine["renderer"];
    let kind = "webgl";
    try {
      const canvas = document.createElement("canvas");
      let context: WebGL2RenderingContext | null = null;
      try {
        context = canvas.getContext("webgl2", {
          antialias: true,
          alpha: false,
          powerPreference: "low-power",
        });
      } catch {
        /* SVG remains interactive on machines without WebGL. */
      }
      if (context) {
        renderer = new THREE.WebGLRenderer({
          canvas,
          context,
          antialias: true,
          alpha: false,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      } else {
        renderer = new SVGRenderer();
        renderer.setQuality("high");
        kind = "svg";
      }
    } catch {
      try {
        renderer = new SVGRenderer();
        kind = "svg";
      } catch {
        setFailure(
          "Não foi possível iniciar a vista 3D. Tente reabrir esta vista.",
        );
        return;
      }
    }
    const element = renderer.domElement;
    element.setAttribute("role", "img");
    element.setAttribute(
      "aria-label",
      `Modelo 3D do consolo ${live.current.props.piece.name}`,
    );
    element.classList.add("three-surface");
    parent.append(element);
    const scene = new THREE.Scene();
    scene.add(
      new THREE.AmbientLight(kind === "svg" ? 0xb0b0b0 : 0xffffff, 0.8),
    );
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(2, 3, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd6e6ff, 0.25);
    fill.position.set(-3, -2, 1);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, element);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.15;
    controls.maxZoom = 8;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.zoomToCursor = true;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    let disposed = false,
      raf = 0,
      width = 1,
      height = 1,
      baseHeight = 1,
      frame = 0;
    const screen = (p: Point3) => {
      const n = new THREE.Vector3(...p).project(camera);
      return {
        x: ((n.x + 1) * width) / 2,
        y: ((1 - n.y) * height) / 2,
        z: n.z,
      };
    };
    const drawNow = () => {
      if (disposed) return;
      raf = 0;
      renderer.render(scene, camera);
      frame++;
      const state = live.current;
      const cameraState = {
        position: camera.position.toArray().map((x) => +x.toFixed(5)),
        target: controls.target.toArray().map((x) => +x.toFixed(5)),
        zoom: +camera.zoom.toFixed(5),
      };
      container.dataset.camera = JSON.stringify(cameraState);
      container.dataset.frame = String(frame);
      container.dataset.renderer = kind;
      const overlays = [
        ...state.model.dimensions.map((d) => ({
          id: d.id,
          anchor: d.anchor,
          visible: state.props.dimensions,
          from: d.from,
          to: d.to,
        })),
        ...state.model.loads.map((l) => ({
          id: l.id,
          anchor: l.anchor,
          visible: state.props.forces,
          from: l.from,
          to: l.to,
        })),
      ];
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      // Project technical labels in screen space; a short leader preserves the measured anchor.
      const ordered = [...overlays].sort(
        (a, b) =>
          Number(b.id === "vertical" || b.id === "horizontal") -
          Number(a.id === "vertical" || a.id === "horizontal"),
      );
      const sizes = new Map(
        ordered.map((a) => {
          const el = labels.current.get(a.id);
          return [
            a.id,
            { w: el?.offsetWidth ?? 80, h: el?.offsetHeight ?? 22 },
          ] as const;
        }),
      );
      for (const annotation of ordered) {
        const el = labels.current.get(annotation.id);
        if (!el) continue;
        const p = screen(annotation.anchor),
          a = screen(annotation.from),
          b = screen(annotation.to),
          size = sizes.get(annotation.id)!;
        const visible =
          annotation.visible &&
          p.z >= -1 &&
          p.z <= 1 &&
          (annotation.id === "vertical" ||
            annotation.id === "horizontal" ||
            Math.hypot(a.x - b.x, a.y - b.y) > 10);
        const leader = leaders.current?.querySelector(
          `[data-leader="${annotation.id}"]`,
        );
        let x = p.x,
          y = p.y;
        if (visible) {
          for (const [dx, dy] of [
            [0, 0],
            [0, -24],
            [0, 24],
            [0, -48],
            [0, 48],
            [-42, 0],
            [42, 0],
            [-42, -24],
            [42, 24],
          ]) {
            const candidate = {
              x: p.x + dx,
              y: p.y + dy,
              w: size.w,
              h: size.h,
            };
            if (
              occupied.every(
                (o) =>
                  Math.abs(candidate.x - o.x) > (candidate.w + o.w) / 2 + 5 ||
                  Math.abs(candidate.y - o.y) > (candidate.h + o.h) / 2 + 4,
              )
            ) {
              x = candidate.x;
              y = candidate.y;
              break;
            }
          }
          occupied.push({ x, y, w: size.w, h: size.h });
        }
        el.style.visibility = visible ? "visible" : "hidden";
        el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        if (leader) {
          leader.setAttribute("x1", String(p.x));
          leader.setAttribute("y1", String(p.y));
          leader.setAttribute("x2", String(x));
          leader.setAttribute("y2", String(y));
          (leader as SVGLineElement).style.visibility =
            visible && Math.hypot(x - p.x, y - p.y) > 5 ? "visible" : "hidden";
        }
      }
      if (axes.current) {
        const matrix = new THREE.Matrix4().extractRotation(
          camera.matrixWorldInverse,
        );
        for (const [i, axis] of [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 1),
        ].entries()) {
          const projected = axis.transformDirection(matrix);
          const x = 42 + projected.x * 26,
            y = 42 - projected.y * 26;
          const line = axes.current.querySelector(`[data-axis-line="${i}"]`);
          const text = axes.current.querySelector(`[data-axis-text="${i}"]`);
          line?.setAttribute("x2", String(x));
          line?.setAttribute("y2", String(y));
          text?.setAttribute("x", String(42 + projected.x * 35));
          text?.setAttribute("y", String(46 - projected.y * 35));
        }
      }
      state.props.onZoom(camera.zoom);
    };
    const draw = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(drawNow);
    };
    const projection = () => {
      const aspect = width / height;
      camera.left = (-baseHeight * aspect) / 2;
      camera.right = (baseHeight * aspect) / 2;
      camera.top = baseHeight / 2;
      camera.bottom = -baseHeight / 2;
      camera.updateProjectionMatrix();
    };
    const fit = () => {
      const m = live.current.model;
      const points: THREE.Vector3[] = [];
      for (const x of [m.bounds.min[0], m.bounds.max[0]])
        for (const y of [m.bounds.min[1], m.bounds.max[1]])
          for (const z of [m.bounds.min[2], m.bounds.max[2]])
            points.push(new THREE.Vector3(x, y, z));
      const center = new THREE.Vector3(...m.bounds.min)
        .add(new THREE.Vector3(...m.bounds.max))
        .multiplyScalar(0.5);
      const direction = camera.position.clone().sub(controls.target);
      if (direction.lengthSq() < 1e-9) direction.set(...presets.iso);
      direction.normalize();
      camera.position.copy(center).addScaledVector(direction, m.span * 4);
      camera.lookAt(center);
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(
          camera.matrixWorld,
          0,
        ),
        up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const xs = points.map((p) => p.clone().sub(center).dot(right)),
        ys = points.map((p) => p.clone().sub(center).dot(up));
      const dx = Math.max(...xs) - Math.min(...xs),
        dy = Math.max(...ys) - Math.min(...ys);
      const unitsPerPixel = Math.max(
        dx / Math.max(150, width - 165),
        dy / Math.max(150, height - 160),
      );
      baseHeight = Math.max(100, unitsPerPixel * height);
      controls.target.copy(center);
      camera.zoom = 1;
      projection();
      controls.update();
      live.current.props.onZoom(1);
      draw();
    };
    const orient = (p: Preset) => {
      const m = live.current.model;
      camera.up.set(0, 0, 1);
      camera.position
        .copy(controls.target)
        .addScaledVector(
          new THREE.Vector3(...presets[p]).normalize(),
          m.span * 4,
        );
      camera.lookAt(controls.target);
      controls.update();
      setPreset(p);
      fit();
    };
    const resize = () => {
      if (disposed) return;
      const r = parent.getBoundingClientRect();
      width = Math.max(1, r.width);
      height = Math.max(1, r.height);
      renderer.setSize(width, height);
      projection();
      draw();
    };
    const zoom = (factor: number) => {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.15, 8);
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    };
    const instance: Engine = {
      scene,
      camera,
      controls,
      renderer,
      group: null,
      draw,
      fit,
      preset: orient,
      zoom,
      resize,
    };
    engine.current = instance;
    controls.addEventListener("change", draw);
    controls.addEventListener("start", () => {
      setPreset("free");
      container.classList.add("three-dragging");
    });
    controls.addEventListener("end", () =>
      container.classList.remove("three-dragging"),
    );
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    const canvasPointerDown = (e: PointerEvent) => {
      container.focus({ preventScroll: true });
      down = { x: e.clientX, y: e.clientY };
    };
    let down: { x: number; y: number } | null = null;
    const canvasPointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
        down = null;
        return;
      }
      down = null;
      const state = live.current;
      if (
        !state.props.rebar ||
        !transparentRef.current ||
        state.props.mode === "pan" ||
        e.button !== 0
      )
        return;
      const rect = element.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.params.Line = { threshold: state.model.span * 0.012 };
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const bars: THREE.Object3D[] = [];
      instance.group?.traverse((o) => {
        if (o.userData.barId) bars.push(o);
      });
      const hit = ray.intersectObjects(bars, false)[0];
      if (hit) state.props.onBar(hit.object.userData.barId);
    };
    element.addEventListener("pointerdown", canvasPointerDown as EventListener);
    element.addEventListener("pointerup", canvasPointerUp as EventListener);
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFailure(
        "A vista 3D foi interrompida pelo dispositivo gráfico. Use Reiniciar 3D para continuar.",
      );
    };
    element.addEventListener("webglcontextlost", contextLost);
    const keydown = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest(
          "input,textarea,select,button,.ribbon,[role=dialog],[contenteditable]",
        )
      )
        return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        container.classList.add("pan-ready");
      }
      if (
        e.key.toLowerCase() === "f" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        fit();
      }
      if (e.key === "Escape") {
        setEditor(null);
        live.current.props.onMode("select");
      }
    };
    const releaseSpace = () => {
      controls.mouseButtons.LEFT =
        live.current.props.mode === "pan"
          ? THREE.MOUSE.PAN
          : THREE.MOUSE.ROTATE;
      container.classList.toggle(
        "pan-ready",
        live.current.props.mode === "pan",
      );
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "Space") releaseSpace();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", releaseSpace);
    setRendererKind(kind);
    setFailure("");
    orient("iso");
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", releaseSpace);
      element.removeEventListener(
        "pointerdown",
        canvasPointerDown as EventListener,
      );
      element.removeEventListener(
        "pointerup",
        canvasPointerUp as EventListener,
      );
      element.removeEventListener("webglcontextlost", contextLost);
      controls.dispose();
      disposeGroup(scene);
      if (renderer instanceof THREE.WebGLRenderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      element.remove();
      engine.current = null;
    };
  }, [retry]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (e.group) {
      e.scene.remove(e.group);
      disposeGroup(e.group);
    }
    e.group = createModelGroup(model, {
      dark: props.dark,
      rebar: props.rebar,
      dimensions: props.dimensions,
      forces: props.forces,
      grid: props.grid,
      transparent,
      selectedBar: props.selectedBar,
      lightweight: e.renderer instanceof SVGRenderer,
    });
    e.scene.add(e.group);
    e.renderer.setClearColor(
      new THREE.Color(props.dark ? 0x000000 : 0xffffff),
      1,
    );
    e.draw();
  }, [
    model,
    props.dark,
    props.rebar,
    props.dimensions,
    props.forces,
    props.grid,
    props.selectedBar,
    transparent,
    retry,
  ]);
  useEffect(() => {
    const e = engine.current;
    if (e)
      e.controls.mouseButtons.LEFT =
        mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }, [mode, retry]);
  const edit = (
    key: GeometryKey,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const parent = root.current!,
      r = parent.getBoundingClientRect(),
      button = event.currentTarget.getBoundingClientRect();
    setDraft(String(piece.geometry[key] / 10).replace(".", ","));
    setError("");
    setEditor({
      key,
      left: Math.max(8, Math.min(button.x - r.x - 80, r.width - 260)),
      top: Math.max(50, Math.min(button.y - r.y + 22, r.height - 120)),
    });
    props.onDimension(key);
  };
  const confirm = () => {
    if (!editor) return false;
    const raw = draft.trim().replace(",", ".");
    const value = Number(raw) * 10;
    if (!raw || !Number.isFinite(value) || value < 5 || value > 6000) {
      setError("Informe de 0,5 a 600 cm, sem separador de milhar.");
      return false;
    }
    props.onUpdate({
      ...piece,
      geometry: { ...piece.geometry, [editor.key]: value },
    });
    setEditor(null);
    root.current?.focus();
    return true;
  };
  const setView = (p: Preset) => engine.current?.preset(p);
  return (
    <div
      ref={root}
      className={`canvas three-viewport ${mode === "pan" ? "pan-ready" : ""}`}
      tabIndex={0}
      role="region"
      aria-label={`Vista 3D do consolo ${piece.name}`}
      data-testid="viewport-3d"
      data-piece-id={piece.id}
      data-width-mm={piece.geometry.width}
      data-length-mm={piece.geometry.length}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
    >
      <div ref={host} className="three-render-host" />
      <div className="canvas-heading">
        <span>{piece.name} / VISTA 3D</span>
        <span>Projeção ortográfica · cm · kN</span>
      </div>
      <div className="three-settings">
        <label>
          <span className="sr-only">Orientação 3D</span>
          <select
            aria-label="Orientação 3D"
            value={preset}
            onChange={(e) => setView(e.target.value as Preset)}
          >
            <option value="free" disabled>
              Vista livre
            </option>
            <option value="iso">Isométrica</option>
            <option value="front">Frontal</option>
            <option value="top">Superior</option>
            <option value="side">Lateral</option>
          </select>
        </label>
        <button
          className={transparent ? "active" : ""}
          aria-label="Concreto translúcido"
          aria-pressed={transparent}
          onClick={() => setTransparent((t) => !t)}
          title="Alternar transparência do concreto para ver as armaduras"
        >
          <ScanLine size={15} />
          <span>Translúcido</span>
        </button>
      </div>
      <svg ref={leaders} className="three-label-leaders" aria-hidden="true">
        {[...model.dimensions, ...model.loads].map((a) => (
          <line key={a.id} data-leader={a.id} />
        ))}
      </svg>
      <div className="three-labels" aria-label="Anotações 3D">
        {dimensions &&
          model.dimensions.map((d) => (
            <button
              key={d.id}
              ref={(el) => {
                if (el) labels.current.set(d.id, el);
                else labels.current.delete(d.id);
              }}
              className={`three-dimension-label ${focus === d.id ? "active" : ""}`}
              aria-label={`Editar cota 3D ${d.id}`}
              title={`Editar ${names[d.id]}`}
              onClick={(e) => edit(d.id, e)}
            >
              {d.label}
            </button>
          ))}
        {forces &&
          model.loads.map((l) => (
            <span
              key={l.id}
              ref={(el) => {
                if (el) labels.current.set(l.id, el);
                else labels.current.delete(l.id);
              }}
              className={`three-force-label three-force-${l.id}`}
            >
              {l.label}
            </span>
          ))}
      </div>
      <div className="view-tools" aria-label="Navegação 3D">
        <button
          aria-label="Orbitar modelo 3D"
          aria-pressed={mode === "select"}
          className={mode === "select" ? "active" : ""}
          onClick={() => props.onMode("select")}
          title="Orbitar · botão esquerdo"
        >
          <RotateCcw size={18} />
        </button>
        <button
          aria-label="Pan no modelo 3D"
          aria-pressed={mode === "pan"}
          className={mode === "pan" ? "active" : ""}
          onClick={() => props.onMode("pan")}
          title="Pan · botão do meio, direito ou Espaço + arrastar"
        >
          <Hand size={18} />
        </button>
        <span />
        <button
          aria-label="Aumentar zoom 3D"
          onClick={() => engine.current?.zoom(1.2)}
        >
          <ZoomIn size={18} />
        </button>
        <button
          aria-label="Diminuir zoom 3D"
          onClick={() => engine.current?.zoom(1 / 1.2)}
        >
          <ZoomOut size={18} />
        </button>
        <button
          aria-label="Ajustar modelo 3D à tela"
          title="Enquadrar · F"
          onClick={() => engine.current?.fit()}
        >
          <Maximize size={18} />
        </button>
        <button aria-label="Vista isométrica 3D" onClick={() => setView("iso")}>
          <Box size={18} />
        </button>
      </div>
      <div className="three-info">
        <span>
          Área de apoio {number(piece.design.bearingLength / 10, 1)} ×{" "}
          {number(piece.design.bearingWidth / 10, 1)} cm
        </span>
        <span title="A profundidade do suporte é ilustrada com a largura b do consolo. N1/N2 são eixos esquemáticos; N3/N4 compartilham a geometria do detalhamento. Ancoragens e interferências exigem conferência.">
          <Info size={12} /> Suporte e armaduras esquemáticos
        </span>
        {forces && (
          <span>
            Cargas de entrada ·{" "}
            {piece.design.forceMode === "design"
              ? "já majoradas"
              : "características"}{" "}
            · setas sem escala
          </span>
        )}
        {rendererKind === "svg" && <span>Modo compatível</span>}
      </div>
      <svg
        ref={axes}
        className="three-axes"
        viewBox="0 0 84 84"
        aria-label="Eixos X comprimento, Y largura, Z altura"
      >
        {["X", "Y", "Z"].map((name, i) => (
          <g key={name}>
            <line data-axis-line={i} x1="42" y1="42" />
            <text data-axis-text={i} textAnchor="middle">
              {name}
            </text>
          </g>
        ))}
        <circle cx="42" cy="42" r="2" />
      </svg>
      <div className="viewport-hint">
        <span>
          Arrastar: orbitar · Meio / direito: pan · Roda: zoom · F: enquadrar
        </span>
      </div>
      {failure && (
        <div className="three-error" role="alert">
          <p>{failure}</p>
          <button className="button" onClick={() => setRetry((n) => n + 1)}>
            Reiniciar 3D
          </button>
        </div>
      )}
      {editor && (
        <form
          className="dimension-editor"
          style={{ left: editor.left, top: editor.top }}
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditor(null);
              root.current?.focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              if (!confirm()) e.stopPropagation();
            }
          }}
          aria-label="Editar cota 3D"
        >
          <label htmlFor="dimension-3d-value">{names[editor.key]}</label>
          <div>
            <input
              ref={input}
              id="dimension-3d-value"
              aria-label="Valor da cota 3D"
              inputMode="decimal"
              value={draft}
              aria-invalid={!!error}
              onChange={(e) => {
                setDraft(e.target.value);
                setError("");
              }}
            />
            <span>cm</span>
            <button type="submit" aria-label="Confirmar cota 3D">
              <Check size={17} />
            </button>
            <button
              type="button"
              aria-label="Cancelar cota 3D"
              onClick={() => {
                setEditor(null);
                root.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </div>
          {error ? (
            <small role="alert">{error}</small>
          ) : (
            <small>Enter confirma · Esc cancela</small>
          )}
        </form>
      )}
    </div>
  );
}
