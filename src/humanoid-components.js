import * as THREE from "three";

const MATERIAL_OPTIONS = Object.freeze({
  main: { color: "#35aaa1", metalness: 0.46, roughness: 0.24, clearcoat: 0.8 },
  light: { color: "#d9f3ea", metalness: 0.24, roughness: 0.22, clearcoat: 1 },
  gold: { color: "#d9a83c", metalness: 0.72, roughness: 0.2, clearcoat: 0.8 },
  eye: { color: "#53d5d0", metalness: 0.24, roughness: 0.16, emissive: "#138b85", emissiveIntensity: 0.42 }
});

export const HUMANOID_COMPONENTS = Object.freeze([
  Object.freeze({ id: "horn-crystal", label: "Crystal Horns", anchor: "head" }),
  Object.freeze({ id: "horn-curved", label: "Curved Horns", anchor: "head" }),
  Object.freeze({ id: "wings", label: "Wings", anchor: "torso" }),
  Object.freeze({ id: "extra-eyes", label: "Extra Eyes", anchor: "head" }),
  Object.freeze({ id: "tail", label: "Tail", anchor: "hips" }),
  Object.freeze({ id: "halo", label: "Halo", anchor: "head" }),
  Object.freeze({ id: "spikes", label: "Spikes", anchor: "spine" })
]);

function mesh(geometry, material) {
  return new THREE.Mesh(geometry, material);
}

function makeMaterial(name) {
  return new THREE.MeshPhysicalMaterial({
    ...MATERIAL_OPTIONS[name],
    side: THREE.DoubleSide
  });
}

function addCone(group, color, position, scale, rotation = [0, 0, 0]) {
  const object = mesh(new THREE.ConeGeometry(0.5, 1, 8), color);
  object.position.set(...position);
  object.scale.set(...scale);
  object.rotation.set(...rotation);
  group.add(object);
  return object;
}

function addTube(group, points, radius, material, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const object = mesh(new THREE.TubeGeometry(curve, segments, radius, 10, false), material);
  group.add(object);
  return object;
}

function addWing(group, side, material) {
  const sign = side;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(sign * 0.36, 0.16, sign * 0.56, 0.54, sign * 0.95, 0.68);
  shape.bezierCurveTo(sign * 0.86, 0.24, sign * 0.72, -0.17, sign * 0.14, -0.22);
  shape.quadraticCurveTo(sign * 0.06, -0.08, 0, 0);
  const wing = mesh(new THREE.ShapeGeometry(shape, 18), material);
  wing.position.z = -0.02;
  group.add(wing);
  addTube(group, [[0, 0, 0.015], [sign * 0.36, 0.22, 0.025], [sign * 0.78, 0.43, 0.015]], 0.025, material, 16);
}

function addEye(group, x, eyeMaterial, darkMaterial, whiteMaterial) {
  const socket = mesh(new THREE.SphereGeometry(0.19, 20, 16), makeMaterial("light"));
  socket.position.set(x, 0, 0);
  socket.scale.set(1, 1.08, 0.52);
  group.add(socket);
  const iris = mesh(new THREE.SphereGeometry(0.14, 20, 16), eyeMaterial);
  iris.position.set(x, 0, 0.075);
  iris.scale.z = 0.55;
  group.add(iris);
  const pupil = mesh(new THREE.SphereGeometry(0.07, 16, 12), darkMaterial);
  pupil.position.set(x, -0.01, 0.14);
  group.add(pupil);
  const glint = mesh(new THREE.SphereGeometry(0.028, 10, 8), whiteMaterial);
  glint.position.set(x - 0.035, 0.04, 0.18);
  group.add(glint);
}

export function createHumanoidComponent(id) {
  if (!HUMANOID_COMPONENTS.some(component => component.id === id)) {
    throw new RangeError(`Unsupported humanoid component: ${id}.`);
  }
  const group = new THREE.Group();
  group.name = `Fusion_${id}`;
  const main = ["horn-crystal", "wings", "tail"].includes(id) ? makeMaterial("main") : null;
  const light = ["horn-crystal", "wings"].includes(id) ? makeMaterial("light") : null;
  const gold = ["horn-curved", "tail", "halo", "spikes"].includes(id) ? makeMaterial("gold") : null;

  if (id === "horn-crystal") {
    addCone(group, light, [-0.25, 0.18, 0], [0.2, 0.72, 0.2], [0, 0, -0.28]);
    addCone(group, main, [0.25, 0.18, 0], [0.2, 0.72, 0.2], [0, 0, 0.28]);
  } else if (id === "horn-curved") {
    addTube(group, [[-0.25, -0.12, 0], [-0.37, 0.08, 0], [-0.42, 0.34, 0], [-0.25, 0.48, 0]], 0.075, gold, 20);
    addTube(group, [[0.25, -0.12, 0], [0.37, 0.08, 0], [0.42, 0.34, 0], [0.25, 0.48, 0]], 0.075, gold, 20);
  } else if (id === "wings") {
    addWing(group, -1, light);
    addWing(group, 1, main);
  } else if (id === "extra-eyes") {
    const eye = makeMaterial("eye");
    const dark = new THREE.MeshPhysicalMaterial({ color: "#233b4a", roughness: 0.16 });
    const white = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    addEye(group, -0.2, eye, dark, white);
    addEye(group, 0.2, eye, dark, white);
  } else if (id === "tail") {
    addTube(group, [[0, 0, 0], [0, -0.18, -0.26], [0.12, -0.42, -0.44], [0.3, -0.56, -0.58]], 0.09, main, 32);
    const tip = mesh(new THREE.SphereGeometry(0.13, 16, 12), gold);
    tip.position.set(0.3, -0.56, -0.58);
    group.add(tip);
  } else if (id === "halo") {
    const ring = mesh(new THREE.TorusGeometry(0.43, 0.045, 10, 48), gold);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const glow = new THREE.PointLight("#f4ca64", 0.7, 1.4);
    glow.position.set(0, 0, 0);
    group.add(glow);
  } else if (id === "spikes") {
    for (const [x, y, z, tilt] of [
      [-0.3, 0.14, 0, -0.5],
      [0, 0.24, 0, 0],
      [0.3, 0.14, 0, 0.5]
    ]) {
      addCone(group, gold, [x, y, z], [0.12, 0.34, 0.12], [0, 0, tilt]);
    }
  }

  return group;
}
