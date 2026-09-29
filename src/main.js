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
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
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

// --- colourways ----------------------------------------------------------------------------------
// Paint and light colours, including Dropper's brand colours (Sources/Dropper/Palette.swift).
const PAINTS = [
  { name: "Graphite", hex: "#3d4046" },
  { name: "Dropper Indigo", hex: "#8b9cf9" },
  { name: "Dropper Violet", hex: "#7a68e7" },
  { name: "Dropper Coral", hex: "#f2a5a5" },
  { name: "Arctic White", hex: "#e9ecef" },
  { name: "Liquid Silver", hex: "#b8bec7" },
  { name: "Racing Red", hex: "#c4161c" },
  { name: "Burnt Orange", hex: "#d9531e" },
  { name: "Sunburst Yellow", hex: "#f2b705" },
  { name: "British Green", hex: "#184d36" },
  { name: "Petrol Teal", hex: "#0f7c80" },
  { name: "Midnight Blue", hex: "#1d2a5a" },
  { name: "Obsidian", hex: "#131417" },
];
const LIGHTS = [
  { name: "Ice White", hex: "#ddeeff" },
  { name: "Dropper Indigo", hex: "#8b9cf9" },
  { name: "Dropper Violet", hex: "#7a68e7" },
  { name: "Dropper Coral", hex: "#f2a5a5" },
  { name: "Cyan", hex: "#3ee8ff" },
  { name: "Amber", hex: "#ffb13d" },
];
const FINISHES = {
  gloss: { roughness: 0.14, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.03 },
  satin: { roughness: 0.36, metalness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.25 },
  matte: { roughness: 0.66, metalness: 0.15, clearcoat: 0, clearcoatRoughness: 0.6 },
};
const isPaint = (m) => /Paint|LiquidGraphite/.test(m.name);
// Lights glow through their own bloom pass (below), so paint never blooms however bright it is.
// Each light is scaled so its strongest channel is the same, which makes violet or red strips glow
// as much as white ones. (Cycles needed emission strength 25-30; three.js needs far less.)
const GLOW = 3.0;
const isGlow = (m) => Boolean(m.emissive) && m.emissive.getHex() !== 0;
function normalizeGlow(m) {
  const peak = Math.max(m.emissive.r, m.emissive.g, m.emissive.b);
  if (peak > 0.001) m.emissiveIntensity = GLOW / peak;
}
const isLight = (m) => m.name.startsWith("Light_White") || m.name.includes("BrightRing");   // tail lights stay red

// A drop works like a Dropper share link: `<car>-<32 hex>`, 128 bits from the browser's CSPRNG
// (Dropper uses SystemRandomNumberGenerator the same way). The bytes decide the colourway, so a
// drop link shows the same car to everyone who opens it.
function newDrop() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function colorwayFromDrop(drop) {
  const b = drop.match(/../g).map((h) => parseInt(h, 16));
  const base = PAINTS[b[0] % PAINTS.length];
  const hsl = {};
  new THREE.Color(base.hex).getHSL(hsl, THREE.SRGBColorSpace);
  const h = (hsl.h + (b[1] / 255 - 0.5) * 0.04 + 1) % 1;                 // a shade of its own:
  const l = THREE.MathUtils.clamp(hsl.l + (b[2] / 255 - 0.5) * 0.08, 0.04, 0.92);   // no two drops alike
  const paint = `#${new THREE.Color().setHSL(h, hsl.s, l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace)}`;
  const finish = b[3] < 115 ? "gloss" : b[3] < 205 ? "satin" : "matte";
  const light = LIGHTS[b[4] % LIGHTS.length];
  return { paint, paintName: base.name, light: light.hex, lightName: light.name, finish, drop };
}

let colorway = { paint: null, paintName: null, light: null, lightName: null, finish: null, drop: null };

function applyColorway(model) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const f = (m.userData.factory ??= {
        color: m.color.clone(), emissive: m.emissive?.clone(), roughness: m.roughness,
        metalness: m.metalness, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: m.clearcoatRoughness ?? 0,
      });
      if (isPaint(m)) {
        colorway.paint ? m.color.set(colorway.paint) : m.color.copy(f.color);
        const fin = FINISHES[colorway.finish] ?? f;
        m.roughness = fin.roughness;
        m.metalness = fin.metalness;
        if ("clearcoat" in m) {
          m.clearcoat = fin.clearcoat;
          m.clearcoatRoughness = fin.clearcoatRoughness;
        }
      } else if (isLight(m) && f.emissive) {
        colorway.light ? m.emissive.set(colorway.light) : m.emissive.copy(f.emissive);
        normalizeGlow(m);
      }
    }
  });
}

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

const floorExtras = [];                              // soft floor layers: kept out of the glow pass

function floorLayer(size, stops, y, order, blending = THREE.NormalBlending) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: radialTexture(stops), transparent: true, depthWrite: false, blending,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = order;
  scene.add(mesh);
  floorExtras.push(mesh);
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
floorExtras.push(shadowCatcher);

const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(2.5, 9, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

// --- post: selective bloom on the lights ----------------------------------------------------------
// Pass 1 renders only the glowing parts (everything else black, still hiding what's behind it) and
// blooms them; pass 2 renders the scene and adds that glow on top.
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.setPixelRatio(renderer.getPixelRatio());
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.12, 0));

const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
const mix = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }",
}), "baseTexture");
mix.needsSwap = true;
composer.addPass(mix);
composer.addPass(new OutputPass());

function renderFrame() {
  const stash = new Map();
  scene.traverse((o) => {
    if (o.isMesh && o !== mirror && !bloomLayer.test(o.layers)) {
      stash.set(o, o.material);
      o.material = black;
    }
  });
  floorExtras.forEach((o) => { o.visible = false; });
  const background = scene.background;
  scene.background = null;
  bloomComposer.render();                            // the mirror reflects the glow too
  scene.background = background;
  floorExtras.forEach((o) => { o.visible = true; });
  for (const [o, m] of stash) o.material = m;
  composer.render();
}

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
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (isGlow(m)) {
            normalizeGlow(m);
            o.layers.enable(BLOOM_LAYER);
          }
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
  applyColorway(model);
  appear = reduceMotion ? 1 : 0;
  frame(model.userData.size);
  syncHash();
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

function syncHash() {
  const id = CARS[currentIndex].id;
  history.replaceState(null, "", colorway.drop ? `#${id}-${colorway.drop}` : `#${id}`);
  const dropped = Boolean(colorway.drop);
  $("drop-line").hidden = !dropped;
  if (dropped) {
    const full = `${id}-${colorway.drop}`;
    $("drop-id").textContent = `${id}-${colorway.drop.slice(0, 6)}…${colorway.drop.slice(-4)}`;
    $("drop-id").title = full;
    $("drop-what").textContent = `${colorway.paintName} · ${colorway.finish} · ${colorway.lightName} lights`;
  }
}

function setColorway(next) {
  colorway = { ...colorway, ...next };
  if (current) applyColorway(current);
  for (const b of $("paint-swatches").querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.name === colorway.paintName));
  }
  for (const b of $("light-swatches").querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.name === colorway.lightName));
  }
  for (const b of $("finish").querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.finish === (colorway.finish ?? "factory")));
  }
  syncHash();
}

function swatch(container, entry, pick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  b.style.setProperty("--c", entry.hex);
  b.dataset.name = entry.name;
  b.title = entry.name;
  b.setAttribute("aria-label", entry.name);
  b.addEventListener("click", pick);
  container.append(b);
}
PAINTS.forEach((p) => swatch($("paint-swatches"), p, () => setColorway({ paint: p.hex, paintName: p.name, drop: null })));
LIGHTS.forEach((l) => swatch($("light-swatches"), l, () => setColorway({ light: l.hex, lightName: l.name, drop: null })));
$("paint-custom").addEventListener("input", (e) => setColorway({ paint: e.target.value, paintName: "Custom", drop: null }));
for (const b of $("finish").querySelectorAll("button")) {
  b.addEventListener("click", () => setColorway({ finish: b.dataset.finish === "factory" ? null : b.dataset.finish, drop: null }));
}
const randomDrop = () => setColorway(colorwayFromDrop(newDrop()));
$("random-drop").addEventListener("click", randomDrop);
$("factory").addEventListener("click", () => setColorway({ paint: null, paintName: null, light: null, lightName: null, finish: null, drop: null }));
$("copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $("copy-link").textContent = "Copied";
  } catch {
    $("copy-link").textContent = "Copy failed";
  }
  setTimeout(() => { $("copy-link").textContent = "Copy link"; }, 1600);
});

function parseHash() {
  const m = /^#([a-z]+)(?:-([0-9a-f]{32}))?$/.exec(location.hash);
  return m ? { index: CARS.findIndex((c) => c.id === m[1]), drop: m[2] ?? null } : { index: -1, drop: null };
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
  else if (e.key === "r" || e.key === "R") randomDrop();
});
controls.addEventListener("start", () => { goal.time = 0; });   // the viewer takes over the camera
addEventListener("hashchange", () => {
  const { index, drop } = parseHash();
  if (drop && drop !== colorway.drop) setColorway(colorwayFromDrop(drop));
  if (index >= 0 && index !== currentIndex) show(index);
});

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloomComposer.setSize(w, h);
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
  renderFrame();
});

const initial = parseHash();
if (initial.drop) setColorway(colorwayFromDrop(initial.drop));
else setColorway({});
show(initial.index >= 0 ? initial.index : 0);

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
      renderFrame();
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
