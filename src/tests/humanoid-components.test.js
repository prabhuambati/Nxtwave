import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createHumanoidComponent, HUMANOID_COMPONENTS } from "../humanoid-components.js";

test("the humanoid component catalog builds bounded disposable geometry", () => {
  assert.deepEqual(HUMANOID_COMPONENTS.map(component => component.id), [
    "horn-crystal",
    "horn-curved",
    "wings",
    "extra-eyes",
    "tail",
    "halo",
    "spikes"
  ]);

  for (const component of HUMANOID_COMPONENTS) {
    const root = createHumanoidComponent(component.id);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(root.children.length > 0, `${component.id} builds visible geometry`);
    assert.ok(size.toArray().every(value => Number.isFinite(value) && value > 0 && value <= 2),
      `${component.id} stays within the normalized humanoid scale`);
    const geometries = new Set();
    const materials = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  assert.throws(() => createHumanoidComponent("unknown"), /Unsupported humanoid component/);
});
