import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createHumanoidComponent, HUMANOID_COMPONENTS } from "./humanoid-components.js";
import { CREATION_VERSION, validateCreationRecipe } from "./humanoid-creation.js";
import { DEFAULT_IMAGE_BADGE_SCALE, MAX_IMAGE_BADGE_SCALE, selectDominantSkinBoneIndex } from "./humanoid-image.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`;
const BRAND_LOGO_URL = `${import.meta.env.BASE_URL}nxtwave-logo.svg`;
const MODEL_DISPLAY_HEIGHT = 3.7;
const BRAND_BADGE_HEIGHT_RATIO = 0.5;
const BRAND_BADGE_FRONT_OFFSET = 0.55;
const REQUIRED_BONES = Object.freeze({
  head: ["Head"],
  torso: ["Torso", "Torso_1"],
  "left shoulder": ["Shoulder.L", "ShoulderL"],
  "left upper arm": ["UpperArm.L", "UpperArmL"],
  "left lower arm": ["LowerArm.L", "LowerArmL"],
  "left hand": ["Palm1.L", "Palm1L"],
  "right shoulder": ["Shoulder.R", "ShoulderR"],
  "right upper arm": ["UpperArm.R", "UpperArmR"],
  "right lower arm": ["LowerArm.R", "LowerArmR"],
  "right hand": ["Palm1.R", "Palm1R"],
  "left upper leg": ["UpperLeg.L", "UpperLegL"],
  "left lower leg": ["LowerLeg.L", "LowerLegL"],
  "left lower leg end": ["LowerLeg.L_end", "LowerLegL_end"],
  "left foot": ["Foot.L", "FootL"],
  "right upper leg": ["UpperLeg.R", "UpperLegR"],
  "right lower leg": ["LowerLeg.R", "LowerLegR"],
  "right lower leg end": ["LowerLeg.R_end", "LowerLegR_end"],
  "right foot": ["Foot.R", "FootR"]
});
const POSE_LABELS = Object.freeze({
  idle: "Idle",
  "t-pose": "T-pose",
  "arms-raised": "Arms Raised",
  "arms-crossed": "Arms Crossed",
  "one-legged-balance": "One-Legged Balance"
});
const MAX_IMAGE_BADGES = 12;

export async function mountRobotScene(container, onLoaded, onError) {
  let renderer;
  let pmrem;
  let environment;
  let observer;
  let frameId = 0;
  let disposed = false;
  let dragging = false;
  let pointerMoved = false;
  let previousPointerX = 0;
  let previousPointerY = 0;
  let rotationX = 0;
  let rotationY = 0;
  let modelRoot;
  let loadedModel;
  let poseBones = new Map();
  let bindTransforms = new Map();
  let bindWorldPositions = new Map();
  let bindWorldQuaternions = new Map();
  let lastFrameTime = 0;
  let selectedComponent = null;
  let currentPose = "idle";
  let nativeDragComponentId = null;
  let previewObject = null;
  let imagePlacementPreview = null;
  let imagePlacement = null;
  let permanentBrandBadge = null;
  let dropHandled = false;
  let modelMeshes = [];
  let modelBones = [];
  let modelAnchors = new Map();
  let componentInstances = [];
  let imageBadges = [];
  let nextComponentInstanceId = 1;
  let nextImageBadgeId = 1;
  let fusionEffects = [];
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const dropPoint = new THREE.Vector3();
  const dropNormal = new THREE.Vector3(0, 0, 1);
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.022, 8, 32),
    new THREE.MeshBasicMaterial({ color: "#23a787", transparent: true, opacity: 0.9, depthTest: false })
  );
  marker.visible = false;
  marker.renderOrder = 20;

  const scene = new THREE.Scene();
  scene.add(marker);
  scene.background = new THREE.Color("#f7fbfa");
  scene.fog = new THREE.Fog("#f7fbfa", 12, 24);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 2.2, 8);

  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.HemisphereLight("#f4fffe", "#b7c9c4", 1.15));

  const keyLight = new THREE.DirectionalLight("#fff5e8", 2.4);
  keyLight.position.set(-4.5, 6, 5.5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight("#9cece1", 1.2);
  fillLight.position.set(5, 1, 4);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight("#4caaa9", 18, 18, 2);
  rimLight.position.set(-2.6, 3.5, -3.2);
  scene.add(rimLight);

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute("role", "application");
    renderer.domElement.setAttribute("aria-label", "NxtWave bot 3D viewport. Select or drag an accessory onto the character; drag to rotate.");
    renderer.domElement.setAttribute("tabindex", "0");
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
    renderer.domElement.addEventListener("keydown", handleKeyDown);

    pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = environment.texture;
  } catch (error) {
    dispose();
    throw error;
  }

  const resize = () => {
    if (disposed || !renderer) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 440 ? 9.2 : 8;
    camera.fov = width < 440 ? 39 : 35;
    camera.updateProjectionMatrix();
    render();
  };
  observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  frameId = requestAnimationFrame(animate);

  try {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    if (disposed) {
      disposeModel(gltf.scene);
      return { dispose };
    }

    loadedModel = gltf.scene;
    modelRoot = loadedModel;
    const bounds = new THREE.Box3().setFromObject(modelRoot);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (size.y <= 0 || !Number.isFinite(size.y)) {
      throw new Error("The humanoid model has invalid dimensions.");
    }

    modelRoot.scale.setScalar(MODEL_DISPLAY_HEIGHT / size.y);
    modelRoot.position.set(-center.x * modelRoot.scale.x, -bounds.min.y * modelRoot.scale.y, -center.z * modelRoot.scale.z);
    group.add(modelRoot);
    camera.lookAt(0, 1.72, 0);

    const bones = new Map();
    const skinnedBones = new Map();
    const sceneNodes = new Map();
    const skinnedMeshNames = [];
    modelRoot.traverse(object => {
      if (object.name && !sceneNodes.has(object.name)) sceneNodes.set(object.name, object);
      if (object.isBone && !bones.has(object.name)) bones.set(object.name, object);
      if (object.isSkinnedMesh) {
        skinnedMeshNames.push(object.name || "(unnamed skinned mesh)");
        for (const bone of object.skeleton.bones) {
          bones.set(bone.name, bone);
          skinnedBones.set(bone.name, bone);
        }
      }
    });
    modelRoot.updateMatrixWorld(true);
    const boneNames = [...bones.keys()];
    const resolvedBones = Object.fromEntries(Object.entries(REQUIRED_BONES).map(([role, candidates]) => {
      const exactBone = candidates.map(candidate => bones.get(candidate)).find(Boolean);
      const normalizedBone = boneNames.find(name => candidates.some(candidate =>
        normalizeBoneName(candidate) === normalizeBoneName(name)
      ));
      const exactNode = candidates.map(candidate => sceneNodes.get(candidate)).find(Boolean);
      const normalizedNode = [...sceneNodes.entries()].find(([name]) => candidates.some(candidate =>
        normalizeBoneName(candidate) === normalizeBoneName(name)
      ))?.[1];
      return [role, exactBone ?? (normalizedBone ? bones.get(normalizedBone) : null) ?? exactNode ?? normalizedNode ?? null];
    }));
    poseBones = new Map(Object.entries(resolvedBones).filter(([, bone]) => bone));
    modelAnchors = new Map([
      ["head", poseBones.get("head")],
      ["torso", poseBones.get("torso")],
      ["hips", bones.get("Hips")]
    ]);
    if ([...modelAnchors.values()].some(anchor => !anchor?.isBone)) {
      throw new Error("The humanoid model is missing a head, torso, or hips attachment anchor.");
    }
    modelMeshes = [];
    modelRoot.traverse(object => {
      if (object.isMesh) modelMeshes.push(object);
    });
    modelBones = [...bones.values()];
    const brandTexture = await new THREE.TextureLoader().loadAsync(BRAND_LOGO_URL);
    brandTexture.colorSpace = THREE.SRGBColorSpace;
    brandTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    permanentBrandBadge = createPermanentBrandBadge(brandTexture);
    bindTransforms = new Map([...bones.values()].map(bone => [bone, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone()
    }]));
    bindWorldPositions = new Map([...new Set(poseBones.values())].map(node =>
      [node, node.getWorldPosition(new THREE.Vector3())]
    ));
    bindWorldQuaternions = new Map([...bones.values()].map(bone =>
      [bone, bone.getWorldQuaternion(new THREE.Quaternion())]
    ));
    // Static pose presets own the rig. GLTF animation clips are not started automatically.
    const report = {
      source: MODEL_URL,
      scene: gltf.scene.name || "(unnamed scene)",
      meshCount: countObjects(modelRoot, object => object.isMesh),
      skinnedMeshNames,
      meshSurfaceData: modelMeshes.map(mesh => ({
        name: mesh.name || "(unnamed mesh)",
        type: mesh.isSkinnedMesh ? "skinned" : "rigid",
        parentBone: nearestParentBone(mesh)?.name ?? null,
        uv: Boolean(mesh.geometry.getAttribute("uv")),
        skinIndices: Boolean(mesh.geometry.getAttribute("skinIndex")),
        skinWeights: Boolean(mesh.geometry.getAttribute("skinWeight"))
      })),
      brandBadge: {
        parentBone: permanentBrandBadge.parent?.name ?? null,
        localPosition: permanentBrandBadge.position.toArray(),
        localScale: permanentBrandBadge.scale.toArray(),
        logoTextureLoaded: Boolean(permanentBrandBadge.children[2]?.material?.map?.image)
      },
      boneCount: boneNames.length,
      skinnedBoneCount: skinnedBones.size,
      requiredBones: Object.entries(resolvedBones).map(([role, bone]) => ({
        role,
        name: bone?.name ?? null,
        isBone: Boolean(bone?.isBone)
      })),
      attachmentAnchors: [...modelAnchors.entries()].map(([role, bone]) => ({
        role,
        name: bone.name,
        isBone: bone.isBone
      })),
      boneHierarchy: Object.entries(resolvedBones).flatMap(([role, bone]) => {
        if (!bone) return [];
        const ancestors = [];
        let parent = bone.parent;
        while (parent) {
          if (parent.isBone) ancestors.push(parent.name);
          parent = parent.parent;
        }
        return [{ role, chain: [...ancestors.reverse(), bone.name].join(" → ") }];
      }),
      bones: boneNames,
      animations: gltf.animations.map(clip => ({
        name: clip.name || "(unnamed animation)",
        durationSeconds: Number(clip.duration.toFixed(2)),
        tracks: clip.tracks.length
      }))
    };

    setPose("idle");
    render();
    onLoaded(report);
    renderer.domElement.addEventListener("dragover", handleDragOver);
    renderer.domElement.addEventListener("dragleave", handleDragLeave);
    renderer.domElement.addEventListener("drop", handleDrop);
    renderer.domElement.addEventListener("dragenter", handleDragEnter);
    return {
      dispose,
      setPose,
      setSelectedComponent,
      beginComponentDrag,
      endComponentDrag,
      removeComponent,
      undoLastComponent,
      resetComponents,
      beginImagePlacement,
      beginImageReposition,
      updateImagePlacementAt,
      completeImagePlacementAt,
      cancelImagePlacement,
      setImageBadgeScale,
      setImageBadgeRotation,
      selectImageBadge,
      exportThumbnail,
      getImageBadges: () => imageBadges.map(({ imageId, anchorName, scale, rotation = 0 }) => ({ imageId, anchor: anchorName, scale, rotation: THREE.MathUtils.radToDeg(rotation) })),
      removeImageBadge,
      resetImageBadges,
      restoreCreation,
      getComponents: () => componentInstances.map(instance => ({
        instanceId: instance.instanceId,
        id: instance.id,
        anchor: instance.anchorName,
        fusing: fusionEffects.includes(instance)
      })),
      getCreation: () => ({
        version: CREATION_VERSION,
        pose: currentPose,
        components: componentInstances.map(instance => ({
          id: instance.id,
          anchor: instance.anchorName,
          offset: instance.localOffset.toArray(),
          rotation: instance.localOrientation.toArray()
        }))
      })
    };
  } catch (error) {
    dispose();
    onError(error);
    throw error;
  }

  function countObjects(root, predicate) {
    let count = 0;
    root.traverse(object => {
      if (predicate(object)) count += 1;
    });
    return count;
  }

  function createPermanentBrandBadge(texture) {
    const torsoBone = modelAnchors.get("torso");
    if (!torsoBone) {
      texture.dispose();
      throw new Error("The humanoid model has no chest surface for the permanent NxtWave badge.");
    }

    modelRoot.updateMatrixWorld(true);
    const chestNormal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    const chestCenter = group.localToWorld(new THREE.Vector3(
      0,
      MODEL_DISPLAY_HEIGHT * BRAND_BADGE_HEIGHT_RATIO,
      BRAND_BADGE_FRONT_OFFSET
    ));

    const worldOrientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      chestNormal
    );
    const boneWorldOrientation = torsoBone.getWorldQuaternion(new THREE.Quaternion());
    const localOrientation = boneWorldOrientation.invert().multiply(worldOrientation);
    const localPosition = torsoBone.worldToLocal(chestCenter.clone());
    const width = 0.48;
    const height = width * (61 / 105);
    const badge = new THREE.Group();
    badge.name = "PermanentNxtWaveBrandBadge";

    const border = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.05, height + 0.05, 0.018),
      new THREE.MeshStandardMaterial({ color: "#006ec6", roughness: 0.42, metalness: 0.04 })
    );
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.034, height + 0.034, 0.019),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.62, metalness: 0 })
    );
    backing.position.z = 0.006;
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    logo.position.z = 0.017;
    badge.add(border, backing, logo);

    const worldScale = torsoBone.getWorldScale(new THREE.Vector3());
    const inheritedScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
    if (!Number.isFinite(inheritedScale) || inheritedScale <= 0) {
      removeAndDispose(badge);
      throw new Error("The humanoid torso has an invalid scale for the permanent NxtWave badge.");
    }
    badge.scale.setScalar(1 / inheritedScale);
    torsoBone.add(badge);
    badge.position.copy(localPosition);
    badge.quaternion.copy(localOrientation);
    return badge;
  }

  function normalizeBoneName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
  }

  function animate(time) {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    if (document.hidden || time - lastFrameTime < 28) return;
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 0;
    lastFrameTime = time;
    updateFusions(time);
    render();
  }

  function render() {
    if (!disposed && renderer) renderer.render(scene, camera);
  }

  function setPose(poseName) {
    if (!POSE_LABELS[poseName]) throw new RangeError(`Unknown humanoid pose: ${poseName}.`);
    if (!modelRoot) throw new Error("The humanoid model has not finished loading.");
    for (const [bone, transform] of bindTransforms) {
      bone.position.copy(transform.position);
      bone.quaternion.copy(transform.quaternion);
      bone.scale.copy(transform.scale);
    }

    if (poseName === "idle") {
      // bindTransforms was restored above, producing a stable static Idle pose.
    } else {
      applyCustomPose(poseName);
    }

    modelRoot.updateMatrixWorld(true);
    currentPose = poseName;
    render();
    return POSE_LABELS[poseName];
  }

  function restoreCreation(value) {
    const recipe = validateCreationRecipe(value);
    resetComponents();
    resetImageBadges();
    setSelectedComponent(null);
    setPose(recipe.pose);

    for (const component of recipe.components) {
      const bone = modelAnchors.get(component.anchor);
      if (!bone) throw new Error(`The humanoid model has no ${component.anchor} attachment anchor.`);
      const instance = {
        instanceId: nextComponentInstanceId++,
        id: component.id,
        object: createHumanoidComponent(component.id),
        bone,
        localOffset: new THREE.Vector3(...component.offset),
        localOrientation: new THREE.Quaternion(...component.rotation),
        effect: null,
        anchorName: component.anchor
      };
      const transform = getAttachmentTransform(instance);
      instance.object.position.copy(transform.position);
      instance.object.quaternion.copy(transform.orientation);
      group.add(instance.object);
      componentInstances.push(instance);
    }

    render();
    return componentInstances.map(instance => ({
      instanceId: instance.instanceId,
      id: instance.id,
      anchor: instance.anchorName,
      fusing: false
    }));
  }

  function setSelectedComponent(id) {
    if (id !== null && !HUMANOID_COMPONENTS.some(component => component.id === id)) {
      throw new RangeError(`Unsupported humanoid component: ${id}.`);
    }
    selectedComponent = id;
    if (id) showComponentPreview(id);
    else hideComponentPreview();
    return id;
  }

  function beginComponentDrag(id) {
    if (!HUMANOID_COMPONENTS.some(component => component.id === id)) {
      throw new RangeError(`Unsupported humanoid component: ${id}.`);
    }
    nativeDragComponentId = id;
    selectedComponent = null;
    dropHandled = false;
    showComponentPreview(id);
  }

  function endComponentDrag() {
    nativeDragComponentId = null;
    hideComponentPreview();
    marker.visible = false;
    render();
  }

  function showComponentPreview(id) {
    hideComponentPreview();
    previewObject = createHumanoidComponent(id);
    previewObject.name = `Preview_${id}`;
    previewObject.scale.setScalar(0.64);
    previewObject.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.transparent = true;
        material.opacity = 0.48;
        material.depthWrite = false;
      }
    });
    previewObject.visible = false;
    scene.add(previewObject);
  }

  function hideComponentPreview() {
    if (!previewObject) return;
    removeAndDispose(previewObject);
    previewObject = null;
  }

  function setDropMarker(clientX, clientY) {
    if (!renderer || !modelRoot || modelMeshes.length === 0) return null;
    modelRoot.updateMatrixWorld(true);
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
      marker.visible = false;
      if (previewObject) previewObject.visible = false;
      if (imagePlacementPreview) imagePlacementPreview.visible = false;
      render();
      return null;
    }
    pointerNdc.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(modelMeshes, false)[0];
    if (!hit) {
      marker.visible = false;
      if (previewObject) previewObject.visible = false;
      if (imagePlacementPreview) imagePlacementPreview.visible = false;
      render();
      return null;
    }
    dropPoint.copy(hit.point);
    dropNormal.copy(hit.face?.normal ?? new THREE.Vector3(0, 0, 1))
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
      .normalize();
    marker.position.copy(dropPoint).addScaledVector(dropNormal, 0.035);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dropNormal);
    marker.visible = true;
    if (previewObject) {
      previewObject.position.copy(dropPoint).addScaledVector(dropNormal, 0.08);
      previewObject.quaternion.copy(marker.quaternion);
      previewObject.visible = true;
    }
    const bone = imagePlacement ? resolveSurfaceBone(hit) : null;
    if (imagePlacementPreview) {
      imagePlacementPreview.position.copy(dropPoint).addScaledVector(dropNormal, 0.012);
      imagePlacementPreview.quaternion.copy(marker.quaternion);
      imagePlacementPreview.visible = true;
    }
    render();
    return { point: dropPoint.clone(), normal: dropNormal.clone(), hit, bone };
  }

  function nearestParentBone(object) {
    let node = object;
    while (node && !node.isBone) node = node.parent;
    return node?.isBone ? node : null;
  }

  function resolveSurfaceBone(hit) {
    const object = hit.object;
    if (object.isSkinnedMesh && hit.face && hit.barycoord) {
      const joints = object.geometry.getAttribute("skinIndex");
      const weights = object.geometry.getAttribute("skinWeight");
      if (joints && weights) {
        const faceVertices = [hit.face.a, hit.face.b, hit.face.c];
        const barycentric = [hit.barycoord.x, hit.barycoord.y, hit.barycoord.z];
        const vertices = faceVertices.map((vertexIndex, index) => ({
          indices: [joints.getX(vertexIndex), joints.getY(vertexIndex), joints.getZ(vertexIndex), joints.getW(vertexIndex)],
          weights: [weights.getX(vertexIndex), weights.getY(vertexIndex), weights.getZ(vertexIndex), weights.getW(vertexIndex)],
          barycentric: barycentric[index]
        }));
        const boneIndex = selectDominantSkinBoneIndex(vertices, object.skeleton.bones.length);
        if (boneIndex !== null) return object.skeleton.bones[boneIndex];
      }
    }
    const parentBone = nearestParentBone(object);
    if (parentBone) return parentBone;
    return modelBones.reduce((nearest, bone) => {
      const distance = bone.getWorldPosition(new THREE.Vector3()).distanceToSquared(hit.point);
      return distance < nearest.distance ? { bone, distance } : nearest;
    }, { bone: null, distance: Infinity }).bone;
  }

  function addComponentAt(id, clientX, clientY) {
    if (!HUMANOID_COMPONENTS.some(component => component.id === id)) {
      throw new RangeError(`Unsupported humanoid component: ${id}.`);
    }
    const location = setDropMarker(clientX, clientY);
    if (!location) return null;
    const descriptor = HUMANOID_COMPONENTS.find(component => component.id === id);
    let anchorName = descriptor.anchor;
    if (anchorName === "spine") {
      anchorName = [...modelAnchors.entries()].reduce((nearest, [name, candidate]) => {
        const distance = candidate.getWorldPosition(new THREE.Vector3()).distanceToSquared(location.point);
        return distance < nearest.distance ? { name, distance } : nearest;
      }, { name: "torso", distance: Infinity }).name;
    }
    const bone = modelAnchors.get(anchorName);
    if (!bone) throw new Error(`The humanoid model has no ${anchorName} attachment anchor.`);
    bone.updateWorldMatrix(true, false);
    const anchorWorldPosition = bone.getWorldPosition(new THREE.Vector3());
    const anchorWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
    modelRoot.updateMatrixWorld(true);
    const backNormal = new THREE.Vector3(0, 0, -1).transformDirection(modelRoot.matrixWorld);
    const upNormal = new THREE.Vector3(0, 1, 0).transformDirection(modelRoot.matrixWorld);
    let componentNormal = location.normal.clone();
    let targetWorldPosition = location.point.clone().addScaledVector(componentNormal, 0.18);
    if (id === "wings") {
      componentNormal = backNormal;
      targetWorldPosition = anchorWorldPosition.clone().addScaledVector(backNormal, 0.48);
    } else if (id === "tail") {
      componentNormal = backNormal;
      targetWorldPosition = anchorWorldPosition.clone().addScaledVector(backNormal, 0.28);
    } else if (id === "halo") {
      componentNormal = upNormal;
      targetWorldPosition = location.point.clone().addScaledVector(upNormal, 0.4);
    }
    const sameAnchor = componentInstances.filter(instance => instance.id === id && instance.bone === bone).length;
    if (sameAnchor) {
      const tangent = new THREE.Vector3(0, 1, 0).cross(componentNormal);
      if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
      tangent.normalize();
      targetWorldPosition.addScaledVector(tangent, ((sameAnchor % 3) - 1) * 0.12);
      targetWorldPosition.y += Math.floor(sameAnchor / 3) * 0.11;
    }
    const localOffset = targetWorldPosition.clone()
      .sub(anchorWorldPosition)
      .applyQuaternion(anchorWorldQuaternion.clone().invert());
    const worldOrientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      componentNormal
    );
    const localOrientation = anchorWorldQuaternion.clone().invert().multiply(worldOrientation);
    const groupWorldQuaternion = group.getWorldQuaternion(new THREE.Quaternion());
    const localGroupOrientation = groupWorldQuaternion.clone().invert().multiply(worldOrientation);
    const object = createHumanoidComponent(id);
    const startWorldPosition = targetWorldPosition.clone().addScaledVector(componentNormal, 0.42);
    object.position.copy(group.worldToLocal(startWorldPosition));
    object.quaternion.copy(localGroupOrientation);
    object.scale.setScalar(0.015);
    group.add(object);

    const instance = {
      instanceId: nextComponentInstanceId++,
      id,
      object,
      bone,
      localOffset,
      localOrientation,
      start: object.position.clone(),
      startOrientation: object.quaternion.clone(),
      startTime: performance.now(),
      duration: reducedMotion.matches ? 1 : 650,
      effect: null,
      anchorName
    };
    instance.effect = makeFusionEffect(object.position);
    componentInstances.push(instance);
    fusionEffects.push(instance);
    marker.visible = false;
    hideComponentPreview();
    selectedComponent = null;
    nativeDragComponentId = null;
    dropHandled = true;
    render();
    return { id, anchor: anchorName, count: componentInstances.length };
  }

  function getAttachmentTransform(instance) {
    instance.bone.updateWorldMatrix(true, false);
    const bonePosition = instance.bone.getWorldPosition(new THREE.Vector3());
    const boneOrientation = instance.bone.getWorldQuaternion(new THREE.Quaternion());
    const worldPosition = bonePosition.add(
      instance.localOffset.clone().applyQuaternion(boneOrientation)
    );
    const worldOrientation = boneOrientation.multiply(instance.localOrientation);
    const groupOrientation = group.getWorldQuaternion(new THREE.Quaternion());
    return {
      position: group.worldToLocal(worldPosition),
      orientation: groupOrientation.invert().multiply(worldOrientation)
    };
  }

  function makeFusionEffect(position) {
    const vertices = [];
    let seed = 41;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let index = 0; index < 18; index += 1) {
      vertices.push((random() - 0.5) * 0.5, (random() - 0.5) * 0.5, (random() - 0.5) * 0.5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({
      color: "#b2ffe8",
      size: 0.045,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(geometry, material);
    particles.position.copy(position);
    group.add(particles);
    const light = new THREE.PointLight("#56e2bd", 1.2, 1.2);
    light.position.copy(position);
    group.add(light);
    return { particles, light, geometry, material };
  }

  function updateFusions(time) {
    for (const instance of componentInstances) {
      const target = getAttachmentTransform(instance);
      if (fusionEffects.includes(instance)) {
        const progress = THREE.MathUtils.clamp((time - instance.startTime) / instance.duration, 0, 1);
        const eased = 1 - (1 - progress) ** 3;
        instance.object.position.lerpVectors(instance.start, target.position, eased);
        instance.object.quaternion.slerpQuaternions(instance.startOrientation, target.orientation, eased);
        const scale = progress < 0.68
          ? THREE.MathUtils.lerp(0.015, 0.16, progress / 0.68)
          : THREE.MathUtils.lerp(0.16, 1, (progress - 0.68) / 0.32);
        instance.object.scale.setScalar(scale);
        instance.effect.particles.position.copy(instance.object.position);
        instance.effect.light.position.copy(instance.object.position);
        instance.effect.particles.scale.setScalar(0.25 + progress * 1.3);
        instance.effect.material.opacity = 0.95 * (1 - progress);
        instance.effect.light.intensity = 1.2 * (1 - progress);
        if (progress >= 1) {
          removeFusionEffect(instance);
          renderer?.domElement.dispatchEvent(new CustomEvent("componentfused", {
            detail: { instanceId: instance.instanceId, id: instance.id, anchor: instance.anchorName }
          }));
        }
      } else {
        instance.object.position.copy(target.position);
        instance.object.quaternion.copy(target.orientation);
      }
    }
  }

  function createImageSurface(sourceCanvas, opacity = 1) {
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = sourceCanvas.width;
    imageCanvas.height = sourceCanvas.height;
    const context = imageCanvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare the image badge.");
    context.drawImage(sourceCanvas, 0, 0);
    const texture = new THREE.CanvasTexture(imageCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const imageAspect = imageCanvas.width / imageCanvas.height;
    const maxDimension = 0.34;
    const width = imageAspect >= 1 ? maxDimension : maxDimension * imageAspect;
    const height = width / imageAspect;
    const badge = new THREE.Group();
    const image = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
        depthTest: opacity >= 1,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    image.position.z = 0.003;
    if (opacity < 1) image.renderOrder = 21;
    badge.add(image);
    return { object: badge, sourceCanvas: imageCanvas };
  }

  function beginImagePlacement(sourceCanvas, existingBadge = null) {
    if (imageBadges.length >= MAX_IMAGE_BADGES && !existingBadge) {
      throw new RangeError(`A creation can have at most ${MAX_IMAGE_BADGES} local image badges.`);
    }
    if (!sourceCanvas || sourceCanvas.tagName !== "CANVAS" || !sourceCanvas.width || !sourceCanvas.height) {
      throw new TypeError("A decoded local image is required to add an image badge.");
    }
    cancelImagePlacement();
    selectedComponent = null;
    hideComponentPreview();
    imagePlacement = { sourceCanvas, existingBadge };
    const preview = createImageSurface(sourceCanvas, 0.55);
    imagePlacementPreview = preview.object;
    imagePlacementPreview.name = "ImagePlacementPreview";
    imagePlacementPreview.scale.setScalar(existingBadge?.scale ?? DEFAULT_IMAGE_BADGE_SCALE);
    imagePlacementPreview.visible = false;
    scene.add(imagePlacementPreview);
    return true;
  }

  function beginImageReposition(imageId) {
    const badge = imageBadges.find(instance => instance.imageId === imageId);
    if (!badge) return false;
    beginImagePlacement(badge.sourceCanvas, badge);
    return true;
  }

  function updateImagePlacementAt(clientX, clientY) {
    if (!imagePlacement) return null;
    const location = setDropMarker(clientX, clientY);
    if (!location) return null;
    if (!location.bone) {
      imagePlacementPreview.visible = false;
      render();
      return null;
    }
    return { anchor: location.bone.name, point: location.point, normal: location.normal };
  }

  function completeImagePlacementAt(clientX, clientY) {
    if (!imagePlacement) return null;
    const location = setDropMarker(clientX, clientY);
    if (!location?.bone) return null;
    const repositioned = Boolean(imagePlacement.existingBadge);
    const imageId = imagePlacement.existingBadge?.imageId ?? nextImageBadgeId++;
    let instance = imagePlacement.existingBadge;
    if (!instance) {
      const surface = createImageSurface(imagePlacement.sourceCanvas);
      instance = {
        imageId,
        object: surface.object,
        sourceCanvas: surface.sourceCanvas,
        scale: DEFAULT_IMAGE_BADGE_SCALE,
        rotation: 0
      };
      imageBadges.push(instance);
    }
    location.bone.updateWorldMatrix(true, false);
    const worldPosition = location.point.clone().addScaledVector(location.normal, 0.012);
    const localPosition = location.bone.worldToLocal(worldPosition);
    const boneWorldOrientation = location.bone.getWorldQuaternion(new THREE.Quaternion());
    const worldOrientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      location.normal
    );
    const localOrientation = boneWorldOrientation.invert().multiply(worldOrientation);
    location.bone.add(instance.object);
    instance.object.position.copy(localPosition);
    instance.object.quaternion.copy(localOrientation);
    instance.object.rotateZ(instance.rotation ?? 0);
    instance.object.scale.setScalar(getImageLocalScale(location.bone, instance.scale));
    instance.bone = location.bone;
    instance.anchorName = location.bone.name;
    cancelImagePlacement();
    render();
    return { imageId, anchor: instance.anchorName, scale: instance.scale, repositioned };
  }

  function cancelImagePlacement() {
    if (imagePlacementPreview) removeAndDispose(imagePlacementPreview);
    imagePlacementPreview = null;
    imagePlacement = null;
    marker.visible = false;
    render();
  }

  function setImageBadgeScale(imageId, scale) {
    const badge = imageBadges.find(instance => instance.imageId === imageId);
    if (!badge) return false;
    if (!Number.isFinite(scale) || scale < 0.5 || scale > MAX_IMAGE_BADGE_SCALE) {
      throw new RangeError("Image badge size must be between 0.5× and 3×.");
    }
    badge.scale = scale;
    badge.object.scale.setScalar(getImageLocalScale(badge.bone, scale));
    render();
    return true;
  }

  function getImageLocalScale(bone, desiredWorldScale) {
    const worldScale = bone.getWorldScale(new THREE.Vector3());
    const inheritedScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
    if (!Number.isFinite(inheritedScale) || inheritedScale <= 0) {
      throw new Error(`The ${bone.name} attachment has an invalid world scale.`);
    }
    return desiredWorldScale / inheritedScale;
  }

  function setImageBadgeRotation(imageId, rotationDegrees) {
    const badge = imageBadges.find(instance => instance.imageId === imageId);
    if (!badge) return false;
    if (!Number.isFinite(rotationDegrees) || rotationDegrees < -180 || rotationDegrees > 180) {
      throw new RangeError("Image badge rotation must be between -180° and 180°.");
    }
    badge.rotation = THREE.MathUtils.degToRad(rotationDegrees);
    if (badge.bone) {
      const worldPosition = badge.object.getWorldPosition(new THREE.Vector3());
      const worldNormal = badge.object.localToWorld(new THREE.Vector3(0, 0, 1)).sub(worldPosition).normalize();
      const boneWorldOrientation = badge.bone.getWorldQuaternion(new THREE.Quaternion());
      const worldOrientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
      badge.object.quaternion.copy(boneWorldOrientation.invert().multiply(worldOrientation));
      badge.object.rotateZ(badge.rotation);
    }
    render();
    return true;
  }

  function selectImageBadge(imageId) {
    for (const badge of imageBadges) {
      badge.object.children.forEach(child => {
        if (child.name?.startsWith("ImageResizeHandle-")) child.visible = badge.imageId === imageId;
      });
    }
    render();
    return true;
  }

  function removeImageBadge(imageId) {
    const index = imageBadges.findIndex(instance => instance.imageId === imageId);
    if (index < 0) return false;
    const [badge] = imageBadges.splice(index, 1);
    if (imagePlacement?.existingBadge === badge) cancelImagePlacement();
    removeAndDispose(badge.object);
    render();
    return true;
  }

  async function exportThumbnail(maxSize = 512) {
    if (!renderer) throw new Error("The 3D renderer is not ready.");
    render();
    const source = renderer.domElement;
    const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The thumbnail canvas is unavailable.");
    context.drawImage(source, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The creation thumbnail could not be generated.")), "image/jpeg", 0.82);
    });
  }

  function resetImageBadges() {
    cancelImagePlacement();
    for (const badge of imageBadges) removeAndDispose(badge.object);
    imageBadges = [];
    render();
  }

  function removeFusionEffect(instance) {
    const index = fusionEffects.indexOf(instance);
    if (index >= 0) fusionEffects.splice(index, 1);
    if (!instance.effect) return;
    instance.effect.particles.parent?.remove(instance.effect.particles);
    instance.effect.light.parent?.remove(instance.effect.light);
    instance.effect.geometry.dispose();
    instance.effect.material.dispose();
    instance.effect = null;
  }

  function removeAndDispose(object) {
    object.parent?.remove(object);
    const geometries = new Set();
    const materials = new Set();
    object.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      if (Array.isArray(child.material)) child.material.forEach(material => materials.add(material));
      else if (child.material) materials.add(child.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    });
  }

  function undoLastComponent() {
    const instance = componentInstances.pop();
    if (!instance) return false;
    removeFusionEffect(instance);
    removeAndDispose(instance.object);
    render();
    return true;
  }

  function removeComponent(instanceId) {
    const index = componentInstances.findIndex(instance => instance.instanceId === instanceId);
    if (index < 0) return false;
    const [instance] = componentInstances.splice(index, 1);
    removeFusionEffect(instance);
    removeAndDispose(instance.object);
    render();
    return true;
  }

  function resetComponents() {
    for (const instance of componentInstances) {
      removeFusionEffect(instance);
      removeAndDispose(instance.object);
    }
    componentInstances = [];
    resetImageBadges();
    render();
  }

  function applyCustomPose(poseName) {
    const sideOf = side => {
      const shoulder = poseBones.get(`${side} shoulder`);
      const torso = poseBones.get("torso");
      if (!shoulder || !torso) throw new Error("The humanoid rig is missing shoulder or torso bones.");
      return Math.sign(
        bindWorldPositions.get(shoulder).x - bindWorldPositions.get(torso).x
      ) || (side === "left" ? 1 : -1);
    };
    const pointAlong = (side, x, y, z) => new THREE.Vector3(sideOf(side) * x, y, z).normalize();
    const alignSegment = (role, endRole, targetDirection) => {
      const bone = poseBones.get(role);
      const endBone = poseBones.get(endRole);
      if (!bone || !endBone) throw new Error(`The humanoid rig is missing the ${role} segment.`);
      const start = bindWorldPositions.get(bone);
      const end = bindWorldPositions.get(endBone);
      const sourceDirection = end.clone().sub(start).normalize();
      const worldDelta = new THREE.Quaternion().setFromUnitVectors(
        sourceDirection,
        targetDirection.clone().normalize()
      );
      const desiredWorld = worldDelta.multiply(bindWorldQuaternions.get(bone));
      const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(parentWorld.invert().multiply(desiredWorld));
      modelRoot.updateMatrixWorld(true);
    };
    const applyArmDirection = (side, direction) => {
      alignSegment(`${side} upper arm`, `${side} lower arm`, direction);
      alignSegment(`${side} lower arm`, `${side} hand`, direction);
    };

    if (poseName === "t-pose") {
      for (const side of ["left", "right"]) {
        applyArmDirection(side, pointAlong(side, 1, 0, 0));
      }
      return;
    }

    if (poseName === "arms-raised") {
      for (const side of ["left", "right"]) {
        applyArmDirection(side, pointAlong(side, 0.48, 0.88, 0));
      }
      return;
    }

    if (poseName === "arms-crossed") {
      for (const side of ["left", "right"]) {
        const inward = sideOf(side) > 0 ? -1 : 1;
        const leftSide = side === "left";
        alignSegment(`${side} upper arm`, `${side} lower arm`, new THREE.Vector3(
          inward * (leftSide ? 0.42 : 0.35),
          leftSide ? -0.8 : -0.65,
          leftSide ? 0.38 : 0.68
        ));
        alignSegment(`${side} lower arm`, `${side} hand`, new THREE.Vector3(
          inward * 0.88,
          leftSide ? 0.25 : -0.35,
          leftSide ? 0.42 : 0.25
        ));
      }
      return;
    }

    const raisedSide = "left";
    const groundedSide = "right";
    applyArmDirection(raisedSide, pointAlong(raisedSide, 1, 0, 0));
    applyArmDirection(groundedSide, pointAlong(groundedSide, 1, 0, 0));
    const raisedLegSide = sideOf(raisedSide);
    alignSegment(`${raisedSide} upper leg`, `${raisedSide} lower leg`, new THREE.Vector3(raisedLegSide * 0.42, 0.25, 0.87));
    alignSegment(`${raisedSide} lower leg`, `${raisedSide} lower leg end`, new THREE.Vector3(raisedLegSide * 0.1, -0.78, -0.62));
    moveFootToEnd(raisedSide);
    alignSegment(`${groundedSide} upper leg`, `${groundedSide} lower leg`, new THREE.Vector3(0, -1, 0));
    alignSegment(`${groundedSide} lower leg`, `${groundedSide} lower leg end`, new THREE.Vector3(0, -1, 0));
  }

  function moveFootToEnd(side) {
    const foot = poseBones.get(`${side} foot`);
    const shinEnd = poseBones.get(`${side} lower leg end`);
    if (!foot || !shinEnd) throw new Error(`The humanoid rig is missing the ${side} foot joint.`);
    const anklePosition = shinEnd.getWorldPosition(new THREE.Vector3());
    foot.parent.worldToLocal(anklePosition);
    foot.position.copy(anklePosition);
    modelRoot.updateMatrixWorld(true);
  }

  function handlePointerDown(event) {
    if (nativeDragComponentId || imagePlacement) return;
    dragging = true;
    pointerMoved = false;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (nativeDragComponentId || imagePlacement) return;
    if (!dragging) {
      if (selectedComponent) setDropMarker(event.clientX, event.clientY);
      return;
    }
    const deltaX = event.clientX - previousPointerX;
    const deltaY = event.clientY - previousPointerY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) pointerMoved = true;
    rotationY += deltaX * 0.006;
    rotationX = THREE.MathUtils.clamp(rotationX + deltaY * 0.004, -0.4, 0.4);
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    group.rotation.set(rotationX, rotationY, 0);
    render();
  }

  function handlePointerUp(event) {
    if (nativeDragComponentId || imagePlacement) return;
    dragging = false;
    if (selectedComponent && !pointerMoved) {
      const result = addComponentAt(selectedComponent, event.clientX, event.clientY);
      renderer?.domElement.dispatchEvent(new CustomEvent("componentplaced", { detail: result }));
    }
    if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerCancel(event) {
    if (nativeDragComponentId || imagePlacement) return;
    dragging = false;
    pointerMoved = false;
    if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event) {
    if ((event.key === "Enter" || event.key === " ") && selectedComponent) {
      event.preventDefault();
      const bounds = renderer.domElement.getBoundingClientRect();
      const result = addComponentAt(
        selectedComponent,
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
      );
      renderer.domElement.dispatchEvent(new CustomEvent("componentplaced", { detail: result }));
      return;
    }
    const step = 0.12;
    if (event.key === "ArrowLeft") rotationY -= step;
    else if (event.key === "ArrowRight") rotationY += step;
    else if (event.key === "ArrowUp") rotationX = THREE.MathUtils.clamp(rotationX - step, -0.4, 0.4);
    else if (event.key === "ArrowDown") rotationX = THREE.MathUtils.clamp(rotationX + step, -0.4, 0.4);
    else return;
    event.preventDefault();
    group.rotation.set(rotationX, rotationY, 0);
    render();
  }

  function handleDragEnter(event) {
    if (!nativeDragComponentId) return;
    event.preventDefault();
  }

  function handleDragOver(event) {
    if (!nativeDragComponentId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    setDropMarker(event.clientX, event.clientY);
  }

  function handleDragLeave(event) {
    if (!nativeDragComponentId) return;
    if (!renderer?.domElement.contains(event.relatedTarget)) {
      marker.visible = false;
      if (previewObject) previewObject.visible = false;
      render();
    }
  }

  function handleDrop(event) {
    if (!nativeDragComponentId || dropHandled) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer?.getData("text/plain") || nativeDragComponentId;
    if (!HUMANOID_COMPONENTS.some(component => component.id === id)) {
      dropHandled = true;
      endComponentDrag();
      renderer?.domElement.dispatchEvent(new CustomEvent("componentplaced", { detail: null }));
      return;
    }
    const result = addComponentAt(id, event.clientX, event.clientY);
    dropHandled = true;
    if (!result) endComponentDrag();
    renderer?.domElement.dispatchEvent(new CustomEvent("componentplaced", { detail: result }));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    resetImageBadges();
    cancelAnimationFrame(frameId);
    observer?.disconnect();
    if (renderer) {
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("keydown", handleKeyDown);
      renderer.domElement.removeEventListener("dragenter", handleDragEnter);
      renderer.domElement.removeEventListener("dragover", handleDragOver);
      renderer.domElement.removeEventListener("dragleave", handleDragLeave);
      renderer.domElement.removeEventListener("drop", handleDrop);
    }
    for (const instance of componentInstances) {
      removeFusionEffect(instance);
      removeAndDispose(instance.object);
    }
    componentInstances = [];
    if (permanentBrandBadge) {
      removeAndDispose(permanentBrandBadge);
      permanentBrandBadge = null;
    }
    marker.geometry.dispose();
    marker.material.dispose();
    scene.remove(marker);
    hideComponentPreview();
    if (loadedModel) disposeModel(loadedModel);
    environment?.dispose();
    pmrem?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
  }
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {
    for (const value of Object.values(material)) {
      if (value?.isTexture) value.dispose();
    }
    material.dispose();
  });
}
