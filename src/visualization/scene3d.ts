import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SceneModel, Point3 } from "./model3d";
export interface SceneOptions {
  dark: boolean;
  rebar: boolean;
  dimensions: boolean;
  forces: boolean;
  grid: boolean;
  transparent: boolean;
  selectedBar: string;
  lightweight: boolean;
}
const v = (p: Point3) => new THREE.Vector3(...p);
/** The extruded solid has exactly the geometry used by the 2D view and engine. */
export function corbelGeometry(model: SceneModel) {
  const shape = new THREE.Shape();
  shape.moveTo(...model.profile[0]);
  for (const p of model.profile.slice(1)) shape.lineTo(...p);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: model.width,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, model.width / 2, 0);
  geometry.computeBoundingBox();
  return geometry;
}
export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => materials.add(x));
    else if (m) materials.add(m);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
export function createModelGroup(model: SceneModel, options: SceneOptions) {
  const group = new THREE.Group();
  const colors = {
    edge: options.dark ? 0xc9d3df : 0x526075,
    dimension: options.dark ? 0x8ea8cc : 0x6a829e,
    loadV: options.dark ? 0x8ebaff : 0x245fb3,
    loadH: options.dark ? 0xb2cbf2 : 0x436b9b,
  };
  const translucent = options.transparent;
  const concrete = new THREE.MeshLambertMaterial({
    color: options.dark ? 0x566478 : 0xd9dee5,
    transparent: translucent,
    opacity: translucent ? 0.16 : 1,
    depthWrite: !translucent,
    side: THREE.DoubleSide,
  });
  const supportMaterial = new THREE.MeshLambertMaterial({
    color: options.dark ? 0x536073 : 0xc5ccd6,
    transparent: translucent,
    opacity: translucent ? 0.09 : 1,
    depthWrite: !translucent,
    side: THREE.DoubleSide,
  });
  const line = (points: Point3[], color: number, opacity = 1) => {
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    });
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(v)),
      mat,
    );
    group.add(l);
    return l;
  };
  const solid = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 15),
      new THREE.LineBasicMaterial({
        color: colors.edge,
        transparent: true,
        opacity: 0.75,
      }),
    );
    edges.position.copy(mesh.position);
    group.add(edges);
    return { mesh, edges };
  };
  solid(corbelGeometry(model), concrete);
  const support = solid(
    new THREE.BoxGeometry(...model.support.size),
    supportMaterial,
  );
  support.mesh.position.copy(v(model.support.center));
  support.edges.position.copy(support.mesh.position);
  const bearing = new THREE.Mesh(
    new THREE.PlaneGeometry(model.bearing.length, model.bearing.width),
    new THREE.MeshLambertMaterial({
      color: options.dark ? 0x7595c1 : 0x567294,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  bearing.position.copy(v(model.bearing.center));
  bearing.position.z = 0.02;
  group.add(bearing);
  const bearingEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(bearing.geometry),
    new THREE.LineBasicMaterial({ color: colors.edge }),
  );
  bearingEdge.position.copy(bearing.position);
  group.add(bearingEdge);
  if (options.rebar) {
    const palette = {
      N1: options.dark ? 0x78b1ff : 0x246ac2,
      N2: options.dark ? 0x9baac0 : 0x76889f,
      N3: options.dark ? 0xc0cad6 : 0x4b5a70,
      N4: options.dark ? 0xe5b875 : 0x98621c,
      P1: options.dark ? 0x78b1ff : 0x246ac2,
    };
    for (const bar of model.steel) {
      const color = palette[bar.id];
      if (options.lightweight) {
        const l = line(bar.points, color);
        l.userData.barId = bar.id;
        continue;
      }
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 1; i < bar.points.length; i++) {
        const a = v(bar.points[i - 1]),
          b = v(bar.points[i]),
          direction = b.clone().sub(a),
          length = direction.length();
        if (length < 1e-8) continue;
        const shape = new THREE.CylinderGeometry(
          bar.diameter / 2,
          bar.diameter / 2,
          length,
          6,
          1,
          false,
        );
        shape.applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize(),
          ),
        );
        shape.translate(...(a.add(b).multiplyScalar(0.5).toArray() as Point3));
        parts.push(shape);
      }
      if (!parts.length) continue;
      const geometry = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({
          color,
          emissive: bar.id === options.selectedBar ? color : 0,
          emissiveIntensity: bar.id === options.selectedBar ? 0.23 : 0,
        }),
      );
      mesh.userData.barId = bar.id;
      group.add(mesh);
    }
  }
  if (options.dimensions)
    for (const d of model.dimensions) {
      line([d.from, d.to], colors.dimension);
      for (const witness of d.witnesses) line(witness, colors.dimension, 0.45);
      const direction = v(d.to).sub(v(d.from)).normalize();
      let perpendicular = new THREE.Vector3(0, 0, 1);
      if (Math.abs(direction.z) > 0.8)
        perpendicular = new THREE.Vector3(1, 0, 0);
      const tick = direction
        .clone()
        .add(perpendicular)
        .multiplyScalar(model.span * 0.008);
      for (const p of [d.from, d.to])
        line(
          [
            v(p).sub(tick).toArray() as Point3,
            v(p).add(tick).toArray() as Point3,
          ],
          colors.dimension,
        );
    }
  if (options.forces)
    for (const load of model.loads) {
      const dir = v(load.to).sub(v(load.from)),
        length = dir.length();
      if (length > 0)
        group.add(
          new THREE.ArrowHelper(
            dir.normalize(),
            v(load.from),
            length,
            load.id === "vertical" ? colors.loadV : colors.loadH,
            model.span * 0.04,
            model.span * 0.022,
          ),
        );
    }
  if (options.grid) {
    const extent = Math.max(model.span * 2, 1000),
      spacing = Math.max(50, 10 ** Math.floor(Math.log10(model.span / 8)));
    const z = model.support.center[2] - model.support.size[2] / 2;
    const grid = new THREE.GridHelper(
      extent,
      Math.min(80, Math.ceil(extent / spacing)),
      colors.dimension,
      options.dark ? 0x252c35 : 0xe2e6ec,
    );
    grid.rotateX(Math.PI / 2);
    grid.position.z = z - 1;
    group.add(grid);
  }
  return group;
}
