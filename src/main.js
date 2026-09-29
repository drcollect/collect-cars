// Collect Cars: a small three.js viewer for the five concept cars.
// The studio mirrors the Blender one they were rendered in: a dark room, a big softbox overhead and
// two long strip lights beside the car, so the paint shows the same clean reflection lines. Each
// body can be configured with its own looks: paint, pattern, finish, light colour and wheel finish.
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

// --- looks -------------------------------------------------------------------------------------------
const LIGHT_COLOURS = {
  White: "#F4F7FF", "Warm White": "#FFE2B8", Amber: "#FFB020", Ice: "#BFE8FF", Red: "#FF2A2A",
  Lime: "#9CFF3A", Cyan: "#22E6FF", Magenta: "#FF2BD6", Violet: "#8A5CFF", Gold: "#FFD34D",
};
// Wheel finishes cover rims, spokes, discs and caps; the tyres stay rubber.
const WHEEL_FINISHES = {
  "Gloss Black": { color: "#0D0E10", metalness: 0.2, roughness: 0.12, clearcoat: 1 },
  "Satin Black": { color: "#141518", metalness: 0.2, roughness: 0.5 },
  Silver: { color: "#C9CED6", metalness: 1, roughness: 0.28 },
  Gunmetal: { color: "#4A4F57", metalness: 1, roughness: 0.32 },
  White: { color: "#EEF0F2", metalness: 0, roughness: 0.3, clearcoat: 0.8 },
  Bronze: { color: "#8C5A2B", metalness: 1, roughness: 0.3 },
  "Anodised Red": { color: "#B3141E", metalness: 1, roughness: 0.22 },
  "Anodised Blue": { color: "#1D4ED8", metalness: 1, roughness: 0.22 },
  "Body Colour": null,                                 // takes the car's own paint
  Chrome: { color: "#F2F3F5", metalness: 1, roughness: 0.04 },
  "Black Chrome": { color: "#2A2C30", metalness: 1, roughness: 0.07 },
  Gold: { color: "#D4A64A", metalness: 1, roughness: 0.14 },
};
const FINISHES = {
  Gloss: { metalness: 0, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 },
  Satin: { metalness: 0, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 },
  Matte: { metalness: 0, roughness: 0.82, clearcoat: 0, clearcoatRoughness: 0.6 },
  Metallic: { metalness: 0.7, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 },
  "Satin Metallic": { metalness: 0.7, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35 },
  Brushed: { metalness: 0.85, roughness: 0.38, clearcoat: 0, clearcoatRoughness: 0.5 },
  "Pearl Gloss": { metalness: 0.15, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, pearl: 0.85 },
  "Pearl Satin": { metalness: 0.15, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, pearl: 0.7 },
  "Chrome Trim": { metalness: 0.1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03,
    trim: { color: "#F2F3F5", metalness: 1, roughness: 0.04 } },
  "Black Chrome Trim": { metalness: 0.1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03,
    trim: { color: "#2A2C30", metalness: 1, roughness: 0.07 } },
  "Gold Chrome Trim": { metalness: 0.1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03,
    trim: { color: "#D4A64A", metalness: 1, roughness: 0.1 } },
};
const PATTERNS = { None: 0, "Twin Stripe": 1, Split: 2, Hex: 3, Topographic: 4, Circuit: 5, Glitch: 6 };

// Each body's own looks. Paints are [name, colour] or [name, base, second colour]: the pearl's
// shift colour, or the two-tone's lower colour. mode: 0 one colour, 1 pearl shift, 2 two-tone.
const LOOKS = {
  rally: {
    style: "Solid paints", mode: 0,
    paints: [["Graphite", "#2B2F36"], ["Porcelain", "#E9ECEF"], ["Signal Red", "#D2381C"], ["Cobalt", "#1F4FD1"],
      ["Rally Orange", "#E8671B"], ["Racing Green", "#0F5C3A"], ["Sand", "#C9B48A"], ["Ice Blue", "#A9D8F0"],
      ["Solar Yellow", "#F2C230"], ["Slate", "#56606B"], ["Olive Drab", "#5E6B3A"], ["Brick", "#8E3B2E"],
      ["Arctic White", "#F7F8FA"], ["Jet Black", "#111316"], ["Teal", "#13847E"], ["Lilac", "#B39DDB"]],
    patterns: ["None", "Twin Stripe", "Split", "Hex", "Topographic"],
    finishes: ["Gloss", "Satin", "Matte"],
    lights: ["White", "Warm White", "Amber", "Ice", "Red", "Lime"],
    wheels: ["Gloss Black", "Satin Black", "Silver", "Gunmetal", "White"],
  },
  wedge: {
    style: "Metallic paints", mode: 0,
    paints: [["Gunmetal", "#4A4F57"], ["Liquid Silver", "#B8BEC6"], ["Midnight Blue", "#1A2346"], ["Crimson", "#8E1020"],
      ["Emerald", "#0E6B4F"], ["Bronze", "#8C5A2B"], ["Electric Blue", "#1E5BFF"], ["Copper", "#B06A3B"],
      ["Plum", "#5B2A5E"], ["Blaze", "#D9651E"]],
    patterns: ["None", "Twin Stripe", "Split", "Hex", "Topographic", "Circuit"],
    finishes: ["Metallic", "Satin Metallic", "Brushed"],
    lights: ["White", "Ice", "Cyan", "Amber", "Red", "Lime"],
    wheels: ["Gunmetal", "Silver", "Bronze", "Body Colour", "Satin Black"],
  },
  endurance: {
    style: "Pearl paints that shift colour", mode: 1,
    paints: [["Pearl White", "#F3EFE6", "#D8E6FF"], ["Opal Blue", "#9CC3E6", "#E3D1FF"], ["Rose Pearl", "#E7B8C2", "#FFE7C2"],
      ["Jade Pearl", "#7FBFA6", "#D9F2E6"], ["Moonstone", "#C9CDD6", "#BFD9FF"], ["Tanzanite", "#4B3F9E", "#3FA0C9"],
      ["Amber Pearl", "#D8963A", "#F2D16B"], ["Onyx Pearl", "#22252B", "#5A3F8C"]],
    patterns: ["Twin Stripe", "Split", "Hex", "Topographic", "Circuit", "Glitch"],
    finishes: ["Pearl Gloss", "Pearl Satin"],
    lights: ["White", "Ice", "Cyan", "Magenta", "Violet", "Amber"],
    wheels: ["Bronze", "Body Colour", "Anodised Red", "Anodised Blue", "White", "Gunmetal"],
  },
  hypercar: {
    style: "Two-tone paints with chrome trim", mode: 2, trim: "Carbon_Dark",
    // The two-tones are named colour pairs; these values are the viewer's rendering of those names.
    paints: [["Obsidian / Steel", "#16171B", "#7D8792"], ["Ivory / Carbon", "#EFE8D8", "#1C1D20"],
      ["Scarlet / Carbon", "#C8102E", "#1C1D20"], ["Azure / Graphite", "#2F7DE1", "#2B2F36"],
      ["Ember / Black", "#E2572A", "#0E0F11"], ["Glacier / Gunmetal", "#CFE6F2", "#4A4F57"]],
    patterns: ["Split", "Hex", "Topographic", "Circuit", "Glitch"],
    finishes: ["Chrome Trim", "Black Chrome Trim", "Gold Chrome Trim"],
    lights: ["Cyan", "Magenta", "Violet", "Gold"],
    wheels: ["Chrome", "Black Chrome", "Gold", "Body Colour"],
  },
  streamliner: null,                                    // factory finish
};
const TRAITS = ["paint", "pattern", "finish", "light", "wheels"];
const TABLE = { paint: "paints", pattern: "patterns", finish: "finishes", light: "lights", wheels: "wheels" };

const isPaint = (m) => /Paint|LiquidGraphite/.test(m.name);
const isLight = (m) => m.name.startsWith("Light_White");                  // tail lights stay red
const WHEEL_PART = /_Wheel_[A-Z]+_(Disc|Cap|Rim|Spokes|Hub|Cover|Lip)$/;

// Lights glow through their own bloom pass (below), so paint never blooms however bright it is.
// Each light is scaled so its strongest channel is the same, which makes violet or red strips glow
// as much as white ones. (Cycles needed emission strength 25-30; three.js needs far less.)
const GLOW = 3.0;
const isGlow = (m) => Boolean(m.emissive) && m.emissive.getHex() !== 0;
function normalizeGlow(m) {
  const peak = Math.max(m.emissive.r, m.emissive.g, m.emissive.b);
  if (peak > 0.001) m.emissiveIntensity = GLOW / peak;
}

const BG = 0x07080a;
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- renderer, scene, camera ------------------------------------------------------------------
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Neutral (Khronos PBR Neutral) keeps paint true to its colour; AgX washed saturated paints to pastel.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.3;
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

const carInverse = new THREE.Matrix4();              // world → the shown car's own space, for the paint

function renderFrame() {
  if (current) carInverse.copy(current.matrixWorld).invert();
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

// --- the paint shader: paint type, two-tone split, pearl shift and patterns ---------------------------
// Patterns are drawn procedurally in the car's own space (metres, nose towards +Z), so they need no UVs.
const PAINT_VERTEX_HEAD = /* glsl */`
uniform mat4 uCarInverse;
varying vec3 vCarPos;
varying vec3 vCarNormal;`;
const PAINT_VERTEX_BODY = /* glsl */`
vCarPos = (uCarInverse * modelMatrix * vec4(transformed, 1.0)).xyz;
vCarNormal = normalize(mat3(uCarInverse) * mat3(modelMatrix) * objectNormal);`;
const PAINT_FRAGMENT_HEAD = /* glsl */`
uniform vec3 uBoxMin; uniform vec3 uBoxMax;
uniform vec3 uPaintA; uniform vec3 uPaintB; uniform vec3 uAccent; uniform vec3 uAccentB;
uniform float uMode; uniform float uPattern; uniform float uPearl; uniform float uSplitY;
varying vec3 vCarPos;
varying vec3 vCarNormal;

float ccHash(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
float ccHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float ccHash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ccNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ccHash3(i), ccHash3(i + vec3(1, 0, 0)), f.x), mix(ccHash3(i + vec3(0, 1, 0)), ccHash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ccHash3(i + vec3(0, 0, 1)), ccHash3(i + vec3(1, 0, 1)), f.x), mix(ccHash3(i + vec3(0, 1, 1)), ccHash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float ccBand(float d, float halfWidth) {
  float fw = fwidth(d);
  return 1.0 - smoothstep(halfWidth - fw, halfWidth + fw, abs(d));
}
float ccHex(vec2 uv) {                                  // honeycomb lines
  vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h; vec2 b = mod(uv - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  float edge = 0.5 - max(dot(q, vec2(0.5, 0.8660254)), q.x);
  float fw = (fwidth(uv.x) + fwidth(uv.y)) * 0.75;
  return 1.0 - smoothstep(0.03, 0.03 + fw, edge);
}
float ccCircuit(vec2 q) {                               // traces with node dots
  vec2 g = q / 0.09; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float fw = (fwidth(g.x) + fwidth(g.y)) * 0.6;
  float line = 0.0;
  if (ccHash2(id) > 0.45) line = max(line, 1.0 - smoothstep(0.07 - fw, 0.07 + fw, abs(f.y)));
  if (ccHash2(id + 17.3) > 0.62) line = max(line, 1.0 - smoothstep(0.07 - fw, 0.07 + fw, abs(f.x)));
  if (ccHash2(id + 41.7) > 0.72) line = max(line, 1.0 - smoothstep(0.17 - fw, 0.17 + fw, length(f)));
  return line;
}
float ccGlitch(vec3 w) {                                // offset horizontal slices
  float band = floor(w.y / 0.035);
  if (ccHash(band + 3.1) < 0.6) return 0.0;
  float z0 = (ccHash(band + 7.7) - 0.5) * 4.2;
  float len = 0.2 + 1.3 * ccHash(band + 11.3);
  float fw = fwidth(w.z);
  return smoothstep(z0 - fw, z0 + fw, w.z) * (1.0 - smoothstep(z0 + len - fw, z0 + len + fw, w.z));
}
float ccPattern(vec3 p, vec3 w, vec3 n) {               // p: 0..1 across the car's box; w: metres
  if (uPattern < 0.5) return 0.0;
  if (uPattern < 1.5) return ccBand(abs(w.x) - 0.1, 0.06) * smoothstep(0.3, 0.4, p.y);      // twin stripe
  if (uPattern < 2.5) {                                                                        // split
    float e = p.y + 0.75 * p.z - 0.62;
    float fw = fwidth(e);
    return 1.0 - smoothstep(-fw, fw, e);
  }
  vec2 q = abs(n.x) > abs(n.y) ? w.zy : w.zx;           // on the flank or on the top
  if (uPattern < 3.5) return ccHex(q / 0.12) * smoothstep(0.3, 0.85, abs(n.x));              // hex
  if (uPattern < 4.5) {                                                                        // topographic
    float t = (0.65 * ccNoise(w * 0.8) + 0.35 * ccNoise(w * 1.9 + 7.0)) * 9.0;
    float d = abs(fract(t + 0.5) - 0.5);
    float fw = fwidth(t);
    return 1.0 - smoothstep(0.6 * fw, 1.6 * fw, d);
  }
  if (uPattern < 5.5) return ccCircuit(q);                                                    // circuit
  return ccGlitch(w);                                                                          // glitch
}`;
const PAINT_FRAGMENT_COLOUR = /* glsl */`
vec3 carP = (vCarPos - uBoxMin) / max(uBoxMax - uBoxMin, vec3(1e-4));
vec3 paint = uPaintA;
vec3 accent = uAccent;
if (uMode > 1.5) {                                      // two-tone: lower colour below the split,
  float fy = fwidth(carP.y);                            // and patterns tinted to the tone beneath them
  float upper = smoothstep(uSplitY - fy, uSplitY + fy, carP.y);
  paint = mix(uPaintB, uPaintA, upper);
  accent = mix(uAccentB, uAccent, upper);
}
diffuseColor.rgb = mix(paint, accent, ccPattern(carP, vCarPos, normalize(vCarNormal)));`;
const PAINT_FRAGMENT_PEARL = /* glsl */`
if (uMode > 0.5 && uMode < 1.5) {                       // pearl: shifts towards its second colour at grazing angles
  float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPaintB, pow(1.0 - facing, 3.0) * uPearl);
}`;

function paintShader(material, size) {
  const uniforms = {
    uCarInverse: { value: carInverse },
    uBoxMin: { value: new THREE.Vector3(-size.x / 2, 0, -size.z / 2) },
    uBoxMax: { value: new THREE.Vector3(size.x / 2, size.y, size.z / 2) },
    uPaintA: { value: material.color.clone() },
    uPaintB: { value: material.color.clone() },
    uAccent: { value: new THREE.Color() },
    uAccentB: { value: new THREE.Color() },
    uMode: { value: 0 }, uPattern: { value: 0 }, uPearl: { value: 0 }, uSplitY: { value: 0.47 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${PAINT_VERTEX_HEAD}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${PAINT_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PAINT_FRAGMENT_HEAD}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${PAINT_FRAGMENT_COLOUR}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${PAINT_FRAGMENT_PEARL}`);
  };
  material.customProgramCacheKey = () => "collect-paint";
  return uniforms;
}

function remember(m) {                                   // a material's factory look, to go back to
  m.userData.factory = {
    color: m.color.clone(), metalness: m.metalness, roughness: m.roughness,
    clearcoat: m.clearcoat ?? 0, clearcoatRoughness: m.clearcoatRoughness ?? 0,
    emissive: m.emissive?.clone(),
  };
  return m;
}

function setSurface(m, s) {
  if (s.color !== undefined) m.color.set(s.color);
  m.metalness = s.metalness;
  m.roughness = s.roughness;
  if ("clearcoat" in m) {
    m.clearcoat = s.clearcoat ?? 0;
    m.clearcoatRoughness = s.clearcoatRoughness ?? 0.1;
  }
}

function contrast(color) {                               // pattern colour: the paint, lighter or darker
  const hsl = {};
  color.getHSL(hsl, THREE.SRGBColorSpace);
  const l = hsl.l > 0.5 ? hsl.l - 0.3 : Math.min(hsl.l + 0.32, 0.92);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.85, l, THREE.SRGBColorSpace);
}

// look: indices into the body's tables, or null for the factory finish.
function applyLook(model, id, look) {
  const d = model.userData;
  const table = LOOKS[id];
  if (!d.paint) return;
  const u = d.paint.uniforms;
  if (!look || !table) {
    const f = d.paint.material.userData.factory;
    u.uMode.value = 0; u.uPattern.value = 0; u.uPearl.value = 0;
    u.uPaintA.value.copy(f.color); u.uPaintB.value.copy(f.color);
    setSurface(d.paint.material, f);
    d.lights.forEach((m) => { m.emissive.copy(m.userData.factory.emissive); normalizeGlow(m); });
    [...d.wheels, ...d.trim].forEach((m) => setSurface(m, m.userData.factory));
    return;
  }
  const [, hexA, hexB] = table.paints[look.paint];
  const colourA = new THREE.Color(hexA);
  const finish = FINISHES[table.finishes[look.finish]];
  u.uMode.value = table.mode;
  u.uPaintA.value.copy(colourA);
  u.uPaintB.value.set(hexB ?? hexA);
  u.uAccent.value.copy(contrast(colourA));
  u.uAccentB.value.copy(contrast(u.uPaintB.value));
  u.uPattern.value = PATTERNS[table.patterns[look.pattern]];
  u.uPearl.value = finish.pearl ?? 0;
  setSurface(d.paint.material, finish);
  const light = new THREE.Color(LIGHT_COLOURS[table.lights[look.light]]);
  d.lights.forEach((m) => { m.emissive.copy(light); normalizeGlow(m); });
  const wheel = WHEEL_FINISHES[table.wheels[look.wheels]] ?? { ...finish, color: colourA };
  d.wheels.forEach((m) => setSurface(m, wheel));
  d.trim.forEach((m) => setSurface(m, finish.trim ?? m.userData.factory));
}

// --- cars ---------------------------------------------------------------------------------------
const draco = new DRACOLoader().setDecoderPath(`${THREE_CDN}/examples/jsm/libs/draco/gltf/`);
const loader = new GLTFLoader().setDRACOLoader(draco);
const cache = new Map();

function loadCar(car) {
  if (!cache.has(car.id)) {
    cache.set(car.id, loader.loadAsync(`models/${car.id}.glb`).then(({ scene: root }) => {
      const wheelCopies = new Map();                   // wheel parts get their own material copies,
      const paints = new Set(), lights = new Set(), trim = new Set();   // so a wheel finish doesn't repaint trim
      const table = LOOKS[car.id];
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (WHEEL_PART.test(o.name)) {
          if (!wheelCopies.has(o.material)) wheelCopies.set(o.material, remember(o.material.clone()));
          o.material = wheelCopies.get(o.material);
        }
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (isGlow(m)) {
            normalizeGlow(m);
            o.layers.enable(BLOOM_LAYER);
          }
          if (isPaint(m)) paints.add(m);
          if (isLight(m)) lights.add(m);
          if (table?.trim && m.name === table.trim && !WHEEL_PART.test(o.name)) trim.add(m);
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const centre = box.getCenter(new THREE.Vector3());
      root.position.set(-centre.x, -box.min.y, -centre.z);   // centred, wheels on the floor
      const group = new THREE.Group();
      group.add(root);
      const size = box.getSize(new THREE.Vector3());
      group.userData.size = size;
      const paint = [...paints][0];
      group.userData.paint = paint && table ? { material: remember(paint), uniforms: paintShader(paint, size) } : null;
      group.userData.lights = [...lights].map(remember);
      group.userData.wheels = [...wheelCopies.values()];
      group.userData.trim = [...trim].map(remember);
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
const looks = new Map();                                 // car id → its look (null: factory finish)

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
  syncLook();                                      // the controls show the look before the model arrives
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
  applyLook(model, car.id, looks.get(car.id) ?? null);
  appear = reduceMotion ? 1 : 0;
  frame(model.userData.size);
  syncLook();
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
  $("dims").textContent = `${l.toFixed(2)} × ${w.toFixed(2)} × ${h.toFixed(2)} m · ${car.tris.toLocaleString("en-US")} triangles`;
  const draco = $("dl-draco");
  draco.href = `models/${car.id}.glb`;
  draco.querySelector("span").textContent = `${car.mb[0]} MB`;
  const full = $("dl-full");
  full.href = `models/full/${car.id}.glb`;
  full.querySelector("span").textContent = `${car.mb[1]} MB`;
  for (const b of switcher.children) b.setAttribute("aria-pressed", String(b.dataset.id === car.id));
  document.title = `${car.name} · Collect Cars`;
  buildControls(car.id);
}

function swatchBackground(trait, entry) {
  if (trait === "paint") {
    const [, a, b] = entry;
    if (!b) return a;
    return LOOKS[CARS[currentIndex].id].mode === 2 ? `linear-gradient(180deg, ${a} 50%, ${b} 50%)`
      : `linear-gradient(135deg, ${a} 35%, ${b})`;
  }
  if (trait === "light") return LIGHT_COLOURS[entry];
  const w = WHEEL_FINISHES[entry];
  if (!w) return "conic-gradient(#8d939c, #e9ebee, #8d939c)";                   // body colour
  return `radial-gradient(circle at 35% 30%, #ffffff66, transparent 45%), ${w.color}`;
}

function buildControls(id) {
  const table = LOOKS[id];
  $("look-style").textContent = table ? table.style : "Factory finish";
  $("look-controls").hidden = !table;
  if (!table) {
    for (const trait of TRAITS) $(`opt-${trait}`).replaceChildren();
    return;
  }
  for (const trait of TRAITS) {
    const box = $(`opt-${trait}`);
    box.replaceChildren();
    table[TABLE[trait]].forEach((entry, i) => {
      const name = Array.isArray(entry) ? entry[0] : entry;
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.index = String(i);
      b.title = name;
      b.setAttribute("aria-label", `${trait}: ${name}`);
      if (trait === "pattern" || trait === "finish") {
        b.className = "chip";
        b.textContent = name;
      } else {
        b.className = trait === "light" ? "swatch glow" : "swatch";
        b.style.setProperty("--c", swatchBackground(trait, entry));
      }
      b.addEventListener("click", () => {
        const base = looks.get(id) ?? { paint: 0, pattern: 0, finish: 0, light: 0, wheels: 0 };
        setLook(id, { ...base, [trait]: i });
      });
      box.append(b);
    });
  }
}

function setLook(id, look) {
  looks.set(id, look);
  if (current && CARS[currentIndex].id === id) applyLook(current, id, look);
  syncLook();
}

const cardEl = document.querySelector(".card");
function updateCardFade() {
  cardEl.classList.toggle("more", cardEl.scrollTop + cardEl.clientHeight < cardEl.scrollHeight - 4);
}
cardEl.addEventListener("scroll", updateCardFade, { passive: true });
addEventListener("resize", updateCardFade);

function syncLook() {
  queueMicrotask(updateCardFade);
  const id = CARS[currentIndex].id;
  const table = LOOKS[id];
  const look = looks.get(id) ?? null;
  history.replaceState(null, "", look ? `#${id}/${TRAITS.map((t) => look[t]).join(".")}` : `#${id}`);
  $("look-line").hidden = !look;
  if (!table) return;
  for (const trait of TRAITS) {
    for (const b of $(`opt-${trait}`).children) {
      b.setAttribute("aria-pressed", String(Boolean(look) && Number(b.dataset.index) === look[trait]));
    }
  }
  if (look) {
    const name = (trait) => { const e = table[TABLE[trait]][look[trait]]; return Array.isArray(e) ? e[0] : e; };
    $("look-what").textContent =
      `${name("paint")} · ${name("pattern")} · ${name("finish")} · ${name("light")} lights · ${name("wheels")} wheels`;
  }
}

// A random look: 32 random bytes, then one SHA-256 draw per trait, h = SHA-256(bytes || trait), taking
// the first 8 bytes of h (big-endian) modulo the number of options.
async function randomLook(id) {
  const table = LOOKS[id];
  if (!table) return;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const look = {};
  for (const trait of TRAITS) {
    const tag = new TextEncoder().encode(trait);
    const message = new Uint8Array(bytes.length + tag.length);
    message.set(bytes);
    message.set(tag, bytes.length);
    const h = new DataView(await crypto.subtle.digest("SHA-256", message));
    look[trait] = Number(h.getBigUint64(0) % BigInt(table[TABLE[trait]].length));
  }
  setLook(id, look);
}

$("random-look").addEventListener("click", () => randomLook(CARS[currentIndex].id));
$("configure-toggle").addEventListener("click", () => {  // phones: the rows fold away to keep the car in view
  const open = cardEl.classList.toggle("open");
  $("configure-toggle").setAttribute("aria-expanded", String(open));
  $("configure-toggle").textContent = open ? "Done" : "Configure";
  updateCardFade();
});
$("factory").addEventListener("click", () => {
  const id = CARS[currentIndex].id;
  looks.delete(id);
  if (current) applyLook(current, id, null);
  syncLook();
});
$("copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $("copy-link").textContent = "Copied";
  } catch {
    $("copy-link").textContent = "Copy failed";
  }
  setTimeout(() => { $("copy-link").textContent = "Copy link"; }, 1600);
});

// Links: #hypercar for the factory finish, #hypercar/2.0.1.3.0 for a look (paint.pattern.finish.light.wheels).
function parseHash() {
  const m = /^#([a-z]+)(?:\/(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+))?$/.exec(location.hash);
  if (!m) return { index: -1, look: null };
  const index = CARS.findIndex((c) => c.id === m[1]);
  const table = LOOKS[m[1]];
  if (!m[2] || !table) return { index, look: null };
  const look = Object.fromEntries(TRAITS.map((t, i) => [t, Number(m[i + 2])]));
  const valid = TRAITS.every((t) => look[t] < table[TABLE[t]].length);
  return { index, look: valid ? look : null };
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
  else if (e.key === "r" || e.key === "R") randomLook(CARS[currentIndex].id);
});
controls.addEventListener("start", () => { goal.time = 0; });   // the viewer takes over the camera
addEventListener("hashchange", () => {              // a link shows exactly its look: #car alone is factory
  const { index, look } = parseHash();
  if (index < 0) return;
  const id = CARS[index].id;
  if (look) looks.set(id, look);
  else looks.delete(id);
  if (index !== currentIndex) show(index);
  else {
    if (current) applyLook(current, id, look);
    syncLook();
  }
});

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;                            // a hidden tab can report 0×0: keep the last size
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
if (initial.index >= 0 && initial.look) looks.set(CARS[initial.index].id, initial.look);
show(initial.index >= 0 ? initial.index : 0);

// ?debug: a hook for checking frames from a script. snap() settles the current car, renders one
// frame and lays it over the canvas as an image, which screenshots capture even in a hidden tab.
if (new URLSearchParams(location.search).has("debug")) {
  if (new URLSearchParams(location.search).has("open")) $("configure-toggle").click();
  window.__viewer = {
    CARS,
    show,
    randomLook: () => randomLook(CARS[currentIndex].id),
    setLook: (look) => setLook(CARS[currentIndex].id, look),
    get loaded() { return Boolean(current) && request > 0; },
    get current() { return current; },
    renderer,
    THREE,
    camera,
    controls,
    goal,
    snap(yawDeg = 0) {
      goal.time = 0;
      appear = 1;
      if (current) { current.scale.setScalar(1); current.position.y = 0; current.updateMatrixWorld(); }
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
