// Collect Cars: a small three.js viewer for the five concept cars.
// The studio mirrors the Blender one they were rendered in: a dark room, a big softbox overhead and
// two long strip lights beside the car, so the paint shows the same clean reflection lines.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.186.0";

const CARS = [
  { id: "hypercar", name: "Hypercar", size: [4.70, 2.05, 1.26], tris: 196500, mb: [0.33, 3.8],
    tag: "Electric hypercar: a glass canopy that rises out of the hood, glowing wheel rings and a floating rear wing." },
  { id: "wedge", name: "80s Wedge", size: [4.40, 1.93, 1.21], tris: 71240, mb: [0.20, 1.8],
    tag: "Folded-paper wedge with crisp creases, a louvred rear window, pop-up hood panels and a nose light bar." },
  { id: "rally", name: "Rally-Raid", size: [4.60, 2.10, 1.79], tris: 127812, mb: [0.76, 4.5],
    tag: "Desert racer on raised suspension: six light pods, all-terrain tyres, skid plates and a roof scoop." },
  { id: "endurance", name: "Endurance", size: [4.90, 1.97, 1.32], tris: 247752, mb: [0.41, 5.0],
    tag: "24-hour prototype racer: a tall shark fin, bubble canopy, split light blade and deep air channels." },
  { id: "streamliner", name: "Streamliner", size: [5.20, 1.63, 1.29], tris: 389520, mb: [0.35, 9.0],
    tag: "Liquid-metal teardrop with outboard front wheels and one thin light line wrapped all the way round." },
];

const BG = 0x07080a;
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- renderer, scene, camera ------------------------------------------------------------------
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.environment = studioEnvironment();
scene.environmentIntensity = 1.7;                   // satin graphite needs strong studio reflections

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200);
camera.position.set(6.2, 1.9, 8.2);                  // front three-quarter: glTF noses point at +Z

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 2 - 0.05;        // stay above the floor
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.55;
controls.target.set(0, 0.6, 0);

// --- the studio -------------------------------------------------------------------------------
function studioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40),
    new THREE.MeshBasicMaterial({ color: 0x040506, side: THREE.BackSide }));
  room.position.y = 10;
  env.add(room);
  const panel = (w, h, level, position, rotation) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(level), side: THREE.DoubleSide }));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    env.add(mesh);
  };
  panel(4, 9, 8, [0, 7, 0], [Math.PI / 2, 0, 0]);             // softbox, long along the car
  panel(9, 0.8, 5, [-6.5, 1.6, 0], [0, Math.PI / 2, 0]);      // strip lights along the flanks
  panel(9, 0.8, 5, [6.5, 1.6, 0], [0, Math.PI / 2, 0]);
  panel(30, 5, 0.18, [0, 2.5, -19.5], [0, 0, 0]);             // a faint horizon glow front and back
  panel(30, 5, 0.18, [0, 2.5, 19.5], [0, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return texture;
}

function radialTexture(stops) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function floorLayer(size, stops, y, order, blending = THREE.NormalBlending) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: radialTexture(stops), transparent: true, depthWrite: false, blending,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = order;
  scene.add(mesh);
  return mesh;
}

// A dim mirror floor for the glossy showroom reflections, a soft pool of light under the car, the
// car's contact shadow, and a fade into the dark at the edges.
const mirror = new Reflector(new THREE.CircleGeometry(40, 128), {
  clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x34373d,
});
mirror.rotation.x = -Math.PI / 2;
scene.add(mirror);
floorLayer(16, [[0, "rgba(255,255,255,0.045)"], [0.5, "rgba(255,255,255,0.015)"], [1, "rgba(255,255,255,0)"]],
  0.002, 1, THREE.AdditiveBlending);
const contact = floorLayer(1, [[0, "rgba(0,0,0,0.72)"], [0.55, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]], 0.004, 2);
floorLayer(80, [[0, "rgba(7,8,10,0)"], [0.16, "rgba(7,8,10,0)"], [0.42, "rgba(7,8,10,1)"]], 0.006, 3);

const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.35 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.005;
shadowCatcher.receiveShadow = true;
shadowCatcher.renderOrder = 2;
scene.add(shadowCatcher);

const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(2.5, 9, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

// --- post: bloom on the light bars ---------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.22, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- cars ---------------------------------------------------------------------------------------
const draco = new DRACOLoader().setDecoderPath(`${THREE_CDN}/examples/jsm/libs/draco/gltf/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const cache = new Map();

function loadCar(car) {
  if (!cache.has(car.id)) {
    cache.set(car.id, loader.loadAsync(`models/${car.id}.glb`).then(({ scene: root }) => {
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // The light strips were tuned for Cycles at emission strength 25-30; in three.js a few
        // units is already bright white, and anything more floods the bloom.
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.emissiveIntensity > 4) m.emissiveIntensity = 4;
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const centre = box.getCenter(new THREE.Vector3());
      root.position.set(-centre.x, -box.min.y, -centre.z);   // centred, wheels on the floor
      const group = new THREE.Group();
      group.add(root);
      group.userData.size = box.getSize(new THREE.Vector3());
      return group;
    }));
  }
  return cache.get(car.id);
}

const goal = { target: new THREE.Vector3(0, 0.6, 0), distance: 10, time: 0 };
let current = null;
let currentIndex = 0;
let request = 0;
let appear = 1;

function frame(size) {
  const radius = size.length() / 2;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const fit = radius / Math.sin(Math.min(vfov, hfov) / 2);
  goal.distance = fit * (camera.aspect < 1 ? 1.0 : 0.9);
  goal.target.set(0, size.y * 0.42, 0);
  goal.time = 1.4;
  controls.minDistance = fit * 0.45;
  controls.maxDistance = fit * 2.4;
  contact.scale.set(size.x * 1.35, size.z * 1.18, 1);      // the layer is rotated: its y is the car's z
}

async function show(index) {
  currentIndex = (index + CARS.length) % CARS.length;
  const car = CARS[currentIndex];
  const mine = ++request;
  updateUI(car);
  setLoading(`Loading ${car.name}…`);
  let model;
  try {
    model = await loadCar(car);
  } catch (err) {
    console.error(err);
    setLoading(`Couldn't load ${car.name}.`);
    return;
  }
  if (mine !== request) return;                    // a newer choice arrived meanwhile
  setLoading(null);
  if (current) scene.remove(current);
  current = model;
  scene.add(model);
  appear = reduceMotion ? 1 : 0;
  frame(model.userData.size);
  history.replaceState(null, "", `#${car.id}`);
  CARS.forEach((c) => loadCar(c));                 // warm the cache: switching is then instant
}

// --- UI ---------------------------------------------------------------------------------------------
const switcher = $("switcher");
CARS.forEach((car, i) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.id = car.id;
  button.innerHTML = `<img src="images/${car.id}-thumb.jpg" alt="" loading="lazy">${car.name}`;
  button.addEventListener("click", () => show(i));
  switcher.append(button);
});

function updateUI(car) {
  $("car-name").textContent = car.name;
  $("car-tag").textContent = car.tag;
  const [l, w, h] = car.size;
  $("spec-length").textContent = `${l.toFixed(2)} m`;
  $("spec-width").textContent = `${w.toFixed(2)} m`;
  $("spec-height").textContent = `${h.toFixed(2)} m`;
  $("spec-tris").textContent = car.tris.toLocaleString("en-US");
  const draco = $("dl-draco");
  draco.href = `models/${car.id}.glb`;
  draco.querySelector("span").textContent = `${car.mb[0]} MB`;
  const full = $("dl-full");
  full.href = `models/full/${car.id}.glb`;
  full.querySelector("span").textContent = `${car.mb[1]} MB`;
  for (const b of switcher.children) b.setAttribute("aria-pressed", String(b.dataset.id === car.id));
  document.title = `${car.name} · Collect Cars`;
}

function setLoading(text) {
  const el = $("loading");
  if (text) el.textContent = text;
  el.classList.toggle("hidden", !text);
}

addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (e.key === "ArrowRight") show(currentIndex + 1);
  else if (e.key === "ArrowLeft") show(currentIndex - 1);
  else if (e.key === " ") { controls.autoRotate = !controls.autoRotate; e.preventDefault(); }
});
controls.addEventListener("start", () => { goal.time = 0; });   // the viewer takes over the camera
addEventListener("hashchange", () => {
  const i = CARS.findIndex((c) => `#${c.id}` === location.hash);
  if (i >= 0 && i !== currentIndex) show(i);
});

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const dpr = renderer.getPixelRatio();
  mirror.getRenderTarget().setSize(Math.round(w * dpr), Math.round(h * dpr));
  if (current) frame(current.userData.size);
}
addEventListener("resize", resize);
resize();

// --- loop ---------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (goal.time > 0) {                             // glide to the new car's framing
    goal.time -= dt;
    const k = 1 - Math.exp(-dt * 3.5);
    controls.target.lerp(goal.target, k);
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(offset.length() + (goal.distance - offset.length()) * k);
    camera.position.copy(controls.target).add(offset);
  }
  if (current && appear < 1) {                     // a short settle-in when a car appears
    appear = Math.min(1, appear + dt * 2.5);
    const e = 1 - (1 - appear) ** 3;
    current.scale.setScalar(0.94 + 0.06 * e);
    current.position.y = 0.06 * (1 - e);
  }
  controls.update(dt);
  composer.render(dt);
});

const start = CARS.findIndex((c) => `#${c.id}` === location.hash);
show(start >= 0 ? start : 0);

// ?debug: a hook for checking frames from a script. snap() settles the current car, renders one
// frame and lays it over the canvas as an image, which screenshots capture even in a hidden tab.
if (new URLSearchParams(location.search).has("debug")) {
  window.__viewer = {
    CARS,
    show,
    get loaded() { return Boolean(current) && request > 0; },
    snap(yawDeg = 0) {
      goal.time = 0;
      appear = 1;
      if (current) { current.scale.setScalar(1); current.position.y = 0; }
      controls.target.copy(goal.target);
      const dir = camera.position.clone().sub(controls.target).normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yawDeg));
      camera.position.copy(controls.target).addScaledVector(dir, goal.distance);
      controls.update(0);
      composer.render(0);
      let img = document.getElementById("debug-snap");
      if (!img) {
        img = document.createElement("img");
        img.id = "debug-snap";
        img.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none";
        canvas.after(img);
      }
      img.src = renderer.domElement.toDataURL("image/jpeg", 0.9);
    },
  };
}
