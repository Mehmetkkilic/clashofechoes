import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import "./styles.css";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b18);
scene.fog = new THREE.Fog(0x070b18, 18, 92);

const camera = new THREE.PerspectiveCamera(74, 1, 0.1, 220);
camera.rotation.order = "YXZ";

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

const ui = {
  app: document.querySelector("#app"),
  lockPanel: document.querySelector("#lock-panel"),
  enterArena: document.querySelector("#enter-arena"),
  nickInput: document.querySelector("#nick-input"),
  hpBar: document.querySelector("#hp-bar"),
  hpText: document.querySelector("#hp-text"),
  manaHud: document.querySelector("#mana-hud"),
  manaLabel: document.querySelector("#mana-hud .mana-label"),
  manaBar: document.querySelector("#mana-bar"),
  manaText: document.querySelector("#mana-text"),
  minimap: document.querySelector("#minimap"),
  bossHud: document.querySelector("#boss-hud"),
  bossBar: document.querySelector("#boss-bar"),
  bossHpText: document.querySelector("#boss-hp-text"),
  className: document.querySelector("#class-name"),
  score: document.querySelector("#score"),
  deaths: document.querySelector("#deaths"),
  feed: document.querySelector("#status-feed"),
  vignette: document.querySelector("#hit-vignette"),
  lightingButtons: Array.from(document.querySelectorAll(".lighting-button")),
  lightLevel: document.querySelector("#light-level"),
  lightLevelText: document.querySelector("#light-level-text"),
  mpStatus: document.querySelector("#mp-status"),
  mpRoom: document.querySelector("#mp-room"),
  mpHud: document.querySelector(".multiplayer-hud"),
  scoreboard: document.querySelector("#scoreboard"),
  scoreboardList: document.querySelector("#scoreboard-list"),
  scoreboardLimit: document.querySelector("#scoreboard-limit"),
  matchBanner: document.querySelector("#match-banner"),
  matchBannerTitle: document.querySelector("#match-banner-title"),
  matchBannerDetail: document.querySelector("#match-banner-detail"),
  classButtons: Array.from(document.querySelectorAll(".class-button")),
  abilityCards: Array.from(document.querySelectorAll(".ability")),
  abilityNames: {
    primary: document.querySelector("#primary-name"),
    secondary: document.querySelector("#secondary-name"),
    q: document.querySelector("#q-name"),
    e: document.querySelector("#e-name"),
    r: document.querySelector("#r-name"),
  },
  abilityCooldowns: {
    primary: document.querySelector("#primary-cd"),
    secondary: document.querySelector("#secondary-cd"),
    q: document.querySelector("#q-cd"),
    e: document.querySelector("#e-cd"),
    r: document.querySelector("#r-cd"),
  },
  mobileAbilityButtons: Array.from(
    document.querySelectorAll("#mobile-actions .mobile-btn[data-slot]")
  ).map((root) => ({
    root,
    slot: root.dataset.slot,
    cd: root.querySelector(".mb-cd"),
  })),
  classHud: document.querySelector(".class-hud"),
  classToggle: document.querySelector("#class-toggle"),
  classToggleLabel: document.querySelector("#class-toggle-label"),
  previewCanvas: document.querySelector("#preview-canvas"),
  startCards: Array.from(document.querySelectorAll(".class-card")),
  startHeroName: document.querySelector("#start-hero-name"),
  startHeroInfo: document.querySelector("#start-hero-info"),
  loadingScreen: document.querySelector("#loading-screen"),
  loadingBar: document.querySelector("#loading-bar"),
  loadingPct: document.querySelector("#loading-pct"),
  mainMenu: document.querySelector("#main-menu"),
  leaderboardScreen: document.querySelector("#leaderboard-screen"),
  menuPlay: document.querySelector("#menu-play"),
  menuLeaderboard: document.querySelector("#menu-leaderboard"),
  lbBack: document.querySelector("#lb-back"),
  heroBack: document.querySelector("#hero-back"),
  settingsBtn: document.querySelector("#settings-btn"),
  settingsPanel: document.querySelector("#settings-panel"),
  settingsClose: document.querySelector("#settings-close"),
};

const CLASS_DATA = {
  fighter: {
    name: "Fighter",
    hp: 150,
    speed: 6.2,
    accent: 0xe0a34f,
    primary: "Sword Slash",
    secondary: "Shield",
    q: "Shield Bash",
    e: "Sprint Charge",
    r: "Whirlwind",
  },
  priest: {
    name: "Priest",
    hp: 100,
    speed: 6.5,
    accent: 0xf26f45,
    primary: "Fireball",
    secondary: "Ice Bolt",
    q: "Fire Field",
    e: "Ice Wall",
    r: "Meteor Shower",
  },
  ranger: {
    name: "Ranger",
    hp: 100,
    speed: 7.1,
    accent: 0x5cc9e6,
    primary: "Arrow Shot",
    secondary: "Charged Arrow",
    q: "Dodge Roll",
    e: "Trap",
    r: "Arrow Rain",
  },
  witch: {
    name: "Witch",
    hp: 90,
    speed: 6.7,
    accent: 0x8fdc3c,
    primary: "Sound Wave",
    secondary: "Scream",
    q: "Silence",
    e: "Fear",
    r: "Banshee Scream",
  },
  // PvE enemy — not player-selectable (hero-select cards are static). Only nameplate/scoreboard read this.
  skeleton: {
    name: "Skeleton",
    hp: 90,
    speed: 6.0,
    accent: 0xb8b3a0,
    primary: "Bone Strike",
    secondary: "Bone Strike",
    q: "Bone Strike",
    e: "Bone Strike",
    r: "Bone Strike",
  },
};

const cooldowns = {
  primary: 0,
  secondary: 0,
  q: 0,
  e: 0,
  r: 0,
};

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
  jump: false,
  scoreboard: false,
};

const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.55;
const PLAYER_STEP_HEIGHT = 0.82;
const MATCH_KILL_LIMIT = 20;

const isTouch =
  (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) ||
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;

// Analog movement from the on-screen joystick (x: right, y: down), range [-1, 1].
const touchMove = { active: false, x: 0, y: 0 };

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioState = {
  ctx: null,
  master: null,
  compressor: null,
  ambience: null,
  sampleAmbience: null,
  noiseBuffer: null,
  samples: new Map(),
  sampleLoading: false,
  sampleReady: false,
  sampleFailures: 0,
  unlocked: false,
  unlockMessageShown: false,
};

const AUDIO_SAMPLES = {
  ambience: { src: "/audio/ambience-castle.m4a", gain: 0.11 },
  slash: { src: "/audio/melee-swing.m4a", gain: 0.58 },
  hit: { src: "/audio/sword-hit.m4a", gain: 0.56 },
  bash: { src: "/audio/sword-hit.m4a", gain: 0.72 },
  block: { src: "/audio/sword-hit.m4a", gain: 0.48 },
  fire: { src: "/audio/fireball.m4a", gain: 0.46, maxDuration: 1.7 },
  meteor: { src: "/audio/fireball.m4a", gain: 0.58, maxDuration: 1.9 },
  arrow: { src: "/audio/arrow-whoosh.m4a", gain: 0.52 },
  "charge-arrow": { src: "/audio/magical-whoosh.m4a", gain: 0.44, maxDuration: 0.9 },
  ice: { src: "/audio/magical-whoosh.m4a", gain: 0.38, playbackRate: 1.18, maxDuration: 0.9 },
  witch: { src: "/audio/sonic-disruptor.m4a", gain: 0.42, maxDuration: 1.35 },
  dash: { src: "/audio/magical-whoosh.m4a", gain: 0.44, playbackRate: 0.92, maxDuration: 0.8 },
  trap: { src: "/audio/trap.m4a", gain: 0.5, maxDuration: 1.0 },
  wall: { src: "/audio/magical-whoosh.m4a", gain: 0.42, playbackRate: 0.8, maxDuration: 1.0 },
  zone: { src: "/audio/darkmagic.m4a", gain: 0.28, maxDuration: 1.8 },
  ultimate: { src: "/audio/darkmagic.m4a", gain: 0.42, maxDuration: 2.7 },
};

// ---- Per-class resource economy (PvE only): attacks/abilities cost a resource; kills drop potions.
// Fighter = Stamina, Priest/Witch = Mana, Ranger = Focus. The resource gates spam → challenge.
const POTION_RESTORE = 40;
const POTION_HEAL = 40;
const DEFAULT_RESOURCE_MAX = 100;
const RESOURCES = {
  fighter: { label: "Stamina", color: 0xe0b54f, max: 100, regen: 16, costs: { primary: 14, secondary: 0, q: 22, e: 26, r: 50 } },
  priest: { label: "Mana", color: 0x4a8fff, max: 100, regen: 6, costs: { primary: 16, secondary: 22, q: 26, e: 24, r: 55 } },
  witch: { label: "Mana", color: 0x4a8fff, max: 100, regen: 6, costs: { primary: 16, secondary: 20, q: 26, e: 24, r: 55 } },
  ranger: { label: "Focus", color: 0x5fc46a, max: 100, regen: 9, costs: { primary: 12, secondary: 20, q: 0, e: 18, r: 45 } },
};

function resourceDef(classId = player.classId) {
  return RESOURCES[classId] || null;
}

// True only when the resource economy is active and this cast actually costs something.
function resourceCostFor(slot) {
  if (!RESOURCE_ENABLED) return 0;
  return resourceDef()?.costs?.[slot] ?? 0;
}

// Does this class spend a resource at all (so the bar should show)?
function classUsesResource(classId) {
  return Object.values(RESOURCES[classId]?.costs || {}).some((c) => c > 0);
}

function resourceGradient(color) {
  const c = new THREE.Color(color);
  const light = c.clone().lerp(new THREE.Color(0xffffff), 0.45);
  return `linear-gradient(90deg, #${c.getHexString()}, #${light.getHexString()})`;
}

// Show the resource bar only in PvE for classes that spend one; label/color follow the class.
function updateResourceHud() {
  if (!ui.manaHud) return;
  const def = resourceDef();
  const show = RESOURCE_ENABLED && classUsesResource(player.classId);
  ui.manaHud.classList.toggle("hidden", !show);
  if (show && def) {
    if (ui.manaLabel) ui.manaLabel.textContent = def.label;
    if (ui.manaBar) ui.manaBar.style.background = resourceGradient(def.color);
  }
}

// Check + spend the class resource for a cast; returns false (and warns) if too low.
function spendResource(slot) {
  const cost = resourceCostFor(slot);
  if (cost <= 0) return true;
  if (player.resource < cost) {
    const label = resourceDef()?.label || "Kaynak";
    addFeed(`${label} yetersiz`, label);
    return false;
  }
  player.resource -= cost;
  return true;
}

const player = {
  name: "Player",
  classId: "fighter",
  position: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 18),
  velocity: new THREE.Vector3(),
  hp: CLASS_DATA.fighter.hp,
  maxHp: CLASS_DATA.fighter.hp,
  resource: DEFAULT_RESOURCE_MAX,
  maxResource: DEFAULT_RESOURCE_MAX,
  score: 0,
  deaths: 0,
  shield: false,
  chargingShot: false,
  chargeStartedAt: 0,
  chargeTime: 0,
  chargeRush: 0,
  chargeHits: new Set(),
  deadTimer: 0,
  invulnerable: 0,
};

// Combat modifiers (kept neutral now that per-kill upgrades are gone; still read by hit/move math).
const mods = {
  damageMult: 1,
  lifesteal: 0,
  speedMult: 1,
  cdrBonus: 0,
  maxHpBonus: 0,
};

const enemies = [];
const projectiles = [];
const effects = [];
const timedZones = [];
const blockers = [];
const floatingMessages = [];
const potions = [];
const torches = [];
const remotePlayers = new Map();
const worldColliders = [];
const walkSurfaces = [];

const matchState = {
  limit: MATCH_KILL_LIMIT,
  status: "playing",
  winnerId: null,
  winnerName: "",
  resetAt: 0,
  entries: [],
};

const multiplayer = {
  socket: null,
  id: null,
  room: "public",
  serverUrl: null,
  status: "offline",
  lastSentAt: 0,
  lastMessageAt: 0,
  reconnectTimer: null,
  heartbeatTimer: null,
  reconnectDelay: 1500,
};

const lightingPresets = {
  night: {
    sky: 0x070b18,
    fog: 0x070b18,
    fogNear: 18,
    fogFar: 92,
    hemiSky: 0x2d446d,
    hemiGround: 0x040706,
    hemiIntensity: 0.38,
    keyColor: 0x8fb4ff,
    keyIntensity: 0.64,
    exposure: 1.04,
    torchScale: 1,
    starsOpacity: 0.72,
    moonOpacity: 1,
  },
  day: {
    sky: 0x90aca8,
    fog: 0x90aca8,
    fogNear: 46,
    fogFar: 122,
    hemiSky: 0xd9f2f2,
    hemiGround: 0x3d4d39,
    hemiIntensity: 1.35,
    keyColor: 0xfff0d1,
    keyIntensity: 2.05,
    exposure: 0.98,
    torchScale: 0.22,
    starsOpacity: 0,
    moonOpacity: 0.08,
  },
};

const lightingState = {
  mode: "night",
  level: 0.62,
  hemi: null,
  keyLight: null,
  moonDisc: null,
  stars: null,
  torchPower: 1,
};

let yaw = 0;
let pitch = -0.04;
let lastHitFlash = 0;
let camShake = 0;

function addCameraShake(mag) {
  camShake = Math.min(0.7, Math.max(camShake, mag));
}
let composer = null;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewModel = null;
let previewMixer = null;
let previewActive = true;
let localChar = null;
let weaponGroup;
let weaponState = 0;
let controlsLocked = false;
let matchStarted = false;
let footstepTimer = 0;

// Procedural near-white grain to modulate a material's base color (no asset downloads).
function makeGrainTexture(repeat = 6, contrast = 0.24) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(255 * (1 - contrast + Math.random() * contrast));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Grayscale noise reused as a bump map for surface relief under the torches.
function makeBumpTexture(repeat = 6) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.floor(Math.random() * 165);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

function texturedLambert(color, { repeat = 6, contrast = 0.24, bump = 0.35 } = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    map: makeGrainTexture(repeat, contrast),
    bumpMap: makeBumpTexture(repeat),
    bumpScale: bump,
  });
}

const materials = {
  grass: texturedLambert(0x2f2a23, { repeat: 26, contrast: 0.3, bump: 0.25 }),
  dirt: texturedLambert(0x6f5f46, { repeat: 14, contrast: 0.3, bump: 0.3 }),
  stone: texturedLambert(0x778076, { repeat: 7, contrast: 0.26, bump: 0.45 }),
  darkStone: texturedLambert(0x4a534f, { repeat: 5, contrast: 0.24, bump: 0.45 }),
  wood: texturedLambert(0x76583b, { repeat: 4, contrast: 0.28, bump: 0.4 }),
  enemy: new THREE.MeshLambertMaterial({ color: 0x753f47, flatShading: true }),
  enemyHead: new THREE.MeshLambertMaterial({ color: 0xb8625c, flatShading: true }),
  enemyFrozen: new THREE.MeshLambertMaterial({
    color: 0x95d5ee,
    transparent: true,
    opacity: 0.86,
    flatShading: true,
  }),
  enemySilenced: new THREE.MeshLambertMaterial({ color: 0x706496, flatShading: true }),
  black: new THREE.MeshBasicMaterial({ color: 0x111514 }),
};

// ---- KayKit CC0 character models (rigged + animated). Box meshes are the fallback. ----
const CHARACTER_MODELS = {
  fighter: "/models/kaykit/Knight.glb",
  priest: "/models/kaykit/Mage.glb",
  ranger: "/models/kaykit/Rogue.glb",
  witch: "/models/kaykit/Rogue_Hooded.glb",
  skeleton: "/models/kaykit/Skeleton_Warrior.glb",
};
const ATTACK_CLIP = {
  fighter: "1H_Melee_Attack_Chop",
  priest: "Spellcast_Shoot",
  ranger: "1H_Ranged_Shoot",
  witch: "Spellcast_Shoot",
  skeleton: "1H_Melee_Attack_Chop",
};
const MODEL_TARGET_HEIGHT = 1.85;
const MODEL_FACING_YAW = Math.PI; // tune if characters face the wrong way
const CHARACTER_FOOT_LIFT = 0.05; // small lift onto the floor tiles (origin = feet)
const TPS_DISTANCE = 4.5;
const TPS_FOCUS_Y = 0.4;
const TPS_SHOULDER = 0.7;
// Isometric (ARPG) camera: fixed offset above/behind the player; tune for angle/zoom.
const ISO_OFFSET = new THREE.Vector3(0, 12, 9);
const ISO_FOCUS_Y = 0.6;
// Screen-relative movement axes (camera is fixed looking down -Z): W=up=-Z, D=right=+X.
const SCREEN_FWD = new THREE.Vector3(0, 0, -1);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);
// Cursor aim: raycast the pointer onto the ground plane each frame.
const aimNDC = new THREE.Vector2(0, 0);
const aimRaycaster = new THREE.Raycaster();
const aimGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3(0, 0, -6);
const aimHit = new THREE.Vector3();
const modelCache = new Map();
const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder); // optimized character glbs are meshopt-compressed
loadingManager.onProgress = (_url, loaded, total) => {
  setLoadingProgress(total > 0 ? loaded / total : 0);
};
loadingManager.onLoad = () => revealMainMenu();

// ---- KayKit CC0 dungeon props (visual dressing only; collision unchanged). ----
const DUNGEON_MODELS = {
  torch: "/models/dungeon/torch_lit.gltf.glb",
  barrel: "/models/dungeon/barrel_large.gltf.glb",
  crate: "/models/dungeon/box_large.gltf.glb",
  column: "/models/dungeon/column.gltf.glb",
  banner: "/models/dungeon/banner_red.gltf.glb",
  chest: "/models/dungeon/chest_gold.glb",
  candle: "/models/dungeon/candle_lit.gltf.glb",
  floor: "/models/dungeon/floor_dirt_large.gltf.glb",
  floortile: "/models/dungeon/floor_tile_large.gltf.glb",
  floorwood: "/models/dungeon/floor_wood_large.gltf.glb",
  wall: "/models/dungeon/wall.gltf.glb",
  wall_arched: "/models/dungeon/wall_arched.gltf.glb",
  wall_pillar: "/models/dungeon/wall_pillar.gltf.glb",
  wall_cracked: "/models/dungeon/wall_cracked.gltf.glb",
  gravestone: "/models/halloween/gravestone.gltf",
  grave: "/models/halloween/grave_A.gltf",
  gravemarker: "/models/halloween/gravemarker_A.gltf",
  bone: "/models/halloween/bone_A.gltf",
  ribcage: "/models/halloween/ribcage.gltf",
  coffin: "/models/halloween/coffin.gltf",
  fence: "/models/halloween/fence.gltf",
};
const dungeonCache = new Map();
const arenaProps = [];
let arenaDressed = false;

/*
 * ---- MAP AUTHORING -------------------------------------------------------
 * Add a map to MAPS, then load it with ?map=<id>. Collision is generated
 * automatically from the same data (no hand-written colliders).
 *   ground : { halfX, halfZ, color }   -> dark base + floor tiles + perimeter walls
 *   spawn  : { x, z }                  -> where the player starts/respawns
 *   walls  : [ { x, z, w, d, h } ]     -> extra interior wall colliders
 *   pillars: [ { x, z, r, h } ]        -> KayKit column + circle collider
 *   props  : [ { model, x, z, y?, rot?, solid? } ]  (chest/barrel/crate/candle)
 *   torches: [ { x, z, y? } ]          -> point light + KayKit torch
 * -------------------------------------------------------------------------
 */
const PROP_HEIGHTS = {
  chest: 1.3,
  barrel: 1.6,
  crate: 1.9,
  candle: 0.7,
  gravestone: 1.4,
  grave: 0.6,
  gravemarker: 1.1,
  bone: 0.3,
  ribcage: 0.8,
  coffin: 0.9,
  fence: 1.2,
  banner: 3.2,
};
const MAP_ID = (new URLSearchParams(window.location.search).get("map") || "castle").toLowerCase();
const MODE = (new URLSearchParams(window.location.search).get("mode") || "pve").toLowerCase() === "pvp" ? "pvp" : "pve";
const RESOURCE_ENABLED = MODE === "pve"; // mana/potions are a PvE-only resource loop
let spawnPoint = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 18);

// Emit the 4 wall segments of a room; sides with a door get a centered gap.
function roomWalls(minX, minZ, maxX, maxZ, doors = {}) {
  const dw = 2.6; // door half-width
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const segs = [];
  // north (z=minZ) and south (z=maxZ): run along x
  for (const [z, hasDoor] of [[minZ, doors.n], [maxZ, doors.s]]) {
    if (hasDoor) {
      segs.push({ x1: minX, z1: z, x2: cx - dw, z2: z }, { x1: cx + dw, z1: z, x2: maxX, z2: z });
    } else segs.push({ x1: minX, z1: z, x2: maxX, z2: z });
  }
  // west (x=minX) and east (x=maxX): run along z
  for (const [x, hasDoor] of [[minX, doors.w], [maxX, doors.e]]) {
    if (hasDoor) {
      segs.push({ x1: x, z1: minZ, x2: x, z2: cz - dw }, { x1: x, z1: cz + dw, x2: x, z2: maxZ });
    } else segs.push({ x1: x, z1: minZ, x2: x, z2: maxZ });
  }
  return segs;
}

const MAPS = {
  // Castle Drakenhall — 13-room floor-plan (3x4 grid + gatehouse), centered doors.
  castle: {
    ground: { halfX: 39, halfZ: 47, color: 0x2a2622 },
    tiles: { floor: "floortile", wall: "wall_arched" }, // polished stone + arched walls
    ceiling: { y: 8 },
    spawn: { x: 0, z: 40 }, // Gatehouse (entrance, south)
    walls: [
      // North row
      ...roomWalls(-37, -45, -13, -27, { e: 1, s: 1 }), // Armory (NW)
      ...roomWalls(-11, -45, 11, -27, { w: 1, e: 1, s: 1 }), // Throne Room (N)
      ...roomWalls(13, -45, 37, -27, { w: 1, s: 1 }), // Treasury (NE)
      // Upper-mid row
      ...roomWalls(-37, -25, -13, -7, { e: 1, n: 1, s: 1 }), // Barracks (W)
      ...roomWalls(-11, -25, 11, -7, { w: 1, e: 1, n: 1, s: 1 }), // Great Hall (center)
      ...roomWalls(13, -25, 37, -7, { w: 1, n: 1, s: 1 }), // Library (E)
      // Lower-mid row
      ...roomWalls(-37, -5, -13, 13, { e: 1, n: 1, s: 1 }), // Kitchen (W)
      ...roomWalls(-11, -5, 11, 13, { w: 1, e: 1, n: 1, s: 1 }), // Chapel (center)
      ...roomWalls(13, -5, 37, 13, { w: 1, n: 1, s: 1 }), // War Room (E)
      // South row
      ...roomWalls(-37, 15, -13, 33, { e: 1, n: 1 }), // Stables (SW)
      ...roomWalls(-11, 15, 11, 33, { w: 1, e: 1, n: 1, s: 1 }), // Courtyard (center)
      ...roomWalls(13, 15, 37, 33, { w: 1, n: 1 }), // Guard Hall (SE)
      // Gatehouse (entrance)
      ...roomWalls(-11, 35, 11, 45, { n: 1 }),
    ],
    pillars: [],
    props: [
      { model: "chest", x: 0, z: -36, rot: 0, solid: true }, // Throne Room
      { model: "chest", x: 25, z: -36, rot: -0.3, solid: true }, // Treasury
      { model: "chest", x: 30, z: -32, rot: 0.4, solid: true },
      { model: "barrel", x: -30, z: -36, solid: true }, // Armory
      { model: "crate", x: -25, z: -32, solid: true },
      { model: "barrel", x: -30, z: -16, solid: true }, // Barracks
      { model: "crate", x: -28, z: 4, solid: true }, // Kitchen
      { model: "barrel", x: -22, z: 8, solid: true },
      { model: "crate", x: -30, z: 24, solid: true }, // Stables
      { model: "candle", x: -4, z: 8 }, // Chapel
      { model: "candle", x: 4, z: 8 },
      { model: "gravestone", x: 0, z: 10, rot: 0 },
      { model: "barrel", x: 28, z: 4, solid: true }, // War Room
      { model: "ribcage", x: 24, z: 24 }, // Guard Hall
      { model: "bone", x: 6, z: 30, rot: 0.6 }, // Courtyard
      { model: "barrel", x: 0, z: 42, solid: true }, // Gatehouse
    ],
    torches: [
      { x: -25, z: -29, y: 4 }, { x: 0, z: -29, y: 4 }, { x: 25, z: -29, y: 4 },
      { x: -25, z: -9, y: 4 }, { x: 0, z: -9, y: 4 }, { x: 25, z: -9, y: 4 },
      { x: -25, z: 11, y: 4 }, { x: 0, z: 11, y: 4 }, { x: 25, z: 11, y: 4 },
      { x: -25, z: 31, y: 4 }, { x: 0, z: 31, y: 4 }, { x: 25, z: 31, y: 4 },
      { x: 0, z: 43, y: 4 },
    ],
  },
  // Medieval Keep — long central Great Hall + throne, gatehouse, side chambers, corner towers.
  medieval: {
    ground: { halfX: 34, halfZ: 44, color: 0x2c2a26 },
    tiles: { floor: "floorwood", wall: "wall_pillar" }, // timber floor + posted walls
    ceiling: { y: 8 },
    spawn: { x: 0, z: 35 }, // Gatehouse (entrance, south)
    walls: [
      ...roomWalls(-10, -24, 10, 28, { n: 1, s: 1, e: 1, w: 1 }), // Great Hall (long center)
      ...roomWalls(-10, -42, 10, -26, { s: 1, w: 1, e: 1 }), // Throne Room (N)
      ...roomWalls(-10, 30, 10, 40, { n: 1 }), // Gatehouse (S, spawn)
      ...roomWalls(-32, -42, -12, -26, { e: 1, s: 1 }), // NW Tower
      ...roomWalls(12, -42, 32, -26, { w: 1, s: 1 }), // NE Tower
      ...roomWalls(-32, -24, -12, -8, { n: 1, s: 1 }), // Armory (W top)
      ...roomWalls(-32, -6, -12, 10, { e: 1, n: 1, s: 1 }), // Barracks (W mid → hall)
      ...roomWalls(-32, 12, -12, 28, { n: 1 }), // Stables (W bot)
      ...roomWalls(12, -24, 32, -8, { n: 1, s: 1 }), // Chapel (E top)
      ...roomWalls(12, -6, 32, 10, { w: 1, n: 1, s: 1 }), // Tavern (E mid → hall)
      ...roomWalls(12, 12, 32, 28, { n: 1 }), // Granary (E bot)
    ],
    pillars: [],
    props: [
      { model: "banner", x: -8, z: -10, rot: Math.PI / 2 }, // Great Hall banners
      { model: "banner", x: 8, z: -10, rot: -Math.PI / 2 },
      { model: "banner", x: -8, z: 14, rot: Math.PI / 2 },
      { model: "banner", x: 8, z: 14, rot: -Math.PI / 2 },
      { model: "chest", x: 0, z: -36, rot: 0, solid: true }, // Throne
      { model: "chest", x: -22, z: -36, rot: 0.3, solid: true }, // NW Tower
      { model: "chest", x: 22, z: -36, rot: -0.3, solid: true }, // NE Tower
      { model: "barrel", x: -26, z: -16, solid: true }, // Armory
      { model: "crate", x: -22, z: -19, solid: true },
      { model: "barrel", x: -26, z: 2, solid: true }, // Barracks
      { model: "crate", x: -26, z: 20, solid: true }, // Stables
      { model: "candle", x: 22, z: -16 }, // Chapel
      { model: "candle", x: 18, z: -12 },
      { model: "barrel", x: 26, z: 2, solid: true }, // Tavern
      { model: "crate", x: 26, z: 5, solid: true },
      { model: "crate", x: 22, z: 20, solid: true }, // Granary
      { model: "barrel", x: 0, z: 37, solid: true }, // Gatehouse
    ],
    torches: [
      { x: -8, z: -22, y: 4 }, { x: 8, z: -22, y: 4 },
      { x: -8, z: 2, y: 4 }, { x: 8, z: 2, y: 4 },
      { x: -8, z: 26, y: 4 }, { x: 8, z: 26, y: 4 },
      { x: 0, z: -40, y: 4 }, { x: -22, z: -40, y: 4 }, { x: 22, z: -40, y: 4 },
      { x: -26, z: -16, y: 4 }, { x: -26, z: 2, y: 4 }, { x: -26, z: 20, y: 4 },
      { x: 26, z: -16, y: 4 }, { x: 26, z: 2, y: 4 }, { x: 26, z: 20, y: 4 },
      { x: 0, z: 38, y: 4 },
    ],
  },
  dungeon: {
    ground: { halfX: 30, halfZ: 40, color: 0x241f19 }, // floor-plan footprint
    tiles: { floor: "floor", wall: "wall_cracked" }, // dirt floor + decayed cracked walls
    ceiling: { y: 8 },
    spawn: { x: -19, z: 0 }, // Guard Room (entrance, west)
    walls: [
      ...roomWalls(-9, -11, 9, 11, { n: 1, s: 1, e: 1, w: 1 }), // Grand Chamber (center)
      ...roomWalls(-9, -38, 9, -13, { s: 1, w: 1, e: 1 }), // Alchemy Shrine (N)
      ...roomWalls(-9, 13, 9, 38, { n: 1 }), // Hall of Traps (S)
      ...roomWalls(11, -11, 28, 11, { w: 1, n: 1, s: 1 }), // Shrine of Dawn (E)
      ...roomWalls(-28, -11, -11, 11, { e: 1, n: 1, s: 1 }), // Guard Room (W)
      ...roomWalls(-28, -38, -11, -13, { s: 1, e: 1 }), // Storage (NW)
      ...roomWalls(11, -38, 28, -13, { s: 1, w: 1 }), // Treasure Vault (NE)
      ...roomWalls(-28, 13, -11, 38, { n: 1 }), // Prison (SW)
      ...roomWalls(11, 13, 28, 38, { n: 1 }), // Boss Lair (SE)
    ],
    pillars: [],
    props: [
      { model: "chest", x: 20, z: -25, rot: 0.3, solid: true }, // Treasure Vault
      { model: "chest", x: 20, z: 24, rot: -0.3, solid: true }, // Boss Lair
      { model: "chest", x: 24, z: 30, rot: 0.5, solid: true },
      { model: "barrel", x: -19, z: 6, solid: true }, // Guard
      { model: "crate", x: -22, z: -25, solid: true }, // Storage
      { model: "barrel", x: -16, z: -31, solid: true },
      { model: "ribcage", x: -20, z: 22 }, // Prison
      { model: "bone", x: -24, z: 30, rot: 0.8 },
      { model: "coffin", x: -16, z: 28, rot: 0.4 },
      { model: "gravestone", x: -4, z: -30, rot: 0.2 }, // Alchemy
      { model: "candle", x: 5, z: -31 },
      { model: "barrel", x: 0, z: 30, solid: true }, // Hall of Traps
      { model: "bone", x: 5, z: 34, rot: 1.0 },
      { model: "gravemarker", x: 22, z: -18, rot: -0.3 },
      { model: "ribcage", x: 22, z: 18 },
    ],
    torches: [
      { x: -7, z: -9, y: 4 }, { x: 7, z: 9, y: 4 },
      { x: -26, z: -9, y: 4 }, { x: -26, z: 9, y: 4 },
      { x: 26, z: -9, y: 4 }, { x: 26, z: 9, y: 4 },
      { x: -7, z: -36, y: 4 }, { x: 7, z: -36, y: 4 },
      { x: -7, z: 36, y: 4 }, { x: 7, z: 36, y: 4 },
      { x: -26, z: -36, y: 4 }, { x: 26, z: -36, y: 4 },
      { x: -26, z: 36, y: 4 }, { x: 26, z: 36, y: 4 },
    ],
  },
};

// Local-enemy AI tuning (offline path). Bounds follow the active map footprint.
const ENEMY_AGGRO_RANGE = 14;
const ENEMY_BOUND_X = (MAPS[MAP_ID]?.ground?.halfX ?? 46) - 1;
const ENEMY_BOUND_Z = (MAPS[MAP_ID]?.ground?.halfZ ?? 46) - 1;

function loadDungeonModels() {
  let remaining = Object.keys(DUNGEON_MODELS).length;
  const done = () => {
    if (--remaining <= 0) onDungeonAssetsReady();
  };
  for (const [key, url] of Object.entries(DUNGEON_MODELS)) {
    gltfLoader.load(
      url,
      (gltf) => {
        dungeonCache.set(key, gltf);
        done();
      },
      undefined,
      (err) => {
        console.warn("Dungeon model failed to load:", key, err);
        done();
      }
    );
  }
}

function placeProp(key, { x, y = 0, z, targetH = null, scale = null, rotY = 0, faceCenter = false, ground = true } = {}) {
  const gltf = dungeonCache.get(key);
  if (!gltf) return null;
  const root = gltf.scene.clone(true);
  let s = scale ?? 1;
  if (targetH) {
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    s = size.y > 0.001 ? targetH / size.y : 1;
  }
  root.scale.setScalar(s);
  root.rotation.y = faceCenter ? Math.atan2(-x, -z) : rotY;
  root.position.set(x, y, z);
  root.updateMatrixWorld(true);
  if (ground) {
    const minY = new THREE.Box3().setFromObject(root).min.y;
    root.position.y += y - minY; // seat the model's base exactly at height y
  }
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  scene.add(root);
  return root;
}

// Pull the first mesh out of a tile model, bake its transform, center X/Z with base at y=0,
// and give it a cheap Lambert material (keeps the embedded texture) for instancing.
function extractBakedTile(key) {
  const gltf = dungeonCache.get(key);
  if (!gltf) return null;
  gltf.scene.updateMatrixWorld(true);
  let mesh = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh && !mesh) mesh = o;
  });
  if (!mesh) return null;
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const material = new THREE.MeshLambertMaterial({
    map: src.map || null,
    color: src.map ? 0xffffff : src.color || 0xffffff,
  });
  return { geometry, material, size };
}

function tileFloor() {
  const baked = extractBakedTile("floor");
  if (!baked) return;
  const step = baked.size.x || 4;
  const half = 54;
  const cells = [];
  for (let x = -half + step / 2; x < half; x += step) {
    for (let z = -half + step / 2; z < half; z += step) cells.push([x, z]);
  }
  const inst = new THREE.InstancedMesh(baked.geometry, baked.material, cells.length);
  const m = new THREE.Matrix4();
  const topY = 0.05; // sit just above the (now dark) base plane + courtyard
  cells.forEach(([x, z], i) => {
    m.makeTranslation(x, topY - baked.size.y, z);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.receiveShadow = true;
  scene.add(inst);
}

function tileWalls() {
  const baked = extractBakedTile("wall");
  if (!baked) return;
  const w = baked.size.x || 4;
  const h = baked.size.y || 4;
  const half = 50;
  const inner = 47.5;
  const placements = [];
  for (let t = -half; t <= half; t += w) {
    placements.push([t, -inner, 0]);
    placements.push([t, inner, Math.PI]);
    placements.push([-inner, t, Math.PI / 2]);
    placements.push([inner, t, -Math.PI / 2]);
  }
  const rows = 2;
  const inst = new THREE.InstancedMesh(baked.geometry, baked.material, placements.length * rows);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scl = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  let i = 0;
  for (const [x, z, ry] of placements) {
    q.setFromAxisAngle(up, ry);
    for (let r = 0; r < rows; r++) {
      pos.set(x, r * h, z);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i++, m);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
}

function dressArena() {
  if (arenaDressed) return;
  arenaDressed = true;
  tileFloor();
  tileWalls();

  // Torches: swap the procedural flame/glow for a KayKit torch atop the post; keep the light.
  for (const torch of torches) {
    const p = torch.light.position;
    const postHeight = Math.max(1.25, p.y - 0.55);
    const model = placeProp("torch", { x: p.x, y: postHeight - 0.2, z: p.z, targetH: 1.5 });
    if (model) {
      torch.flame.visible = false;
      torch.glow.visible = false;
    }
  }

  // Barrels / crates replace the procedural props at the same spots (colliders unchanged).
  for (const prop of arenaProps) {
    const key = prop.index % 2 ? "crate" : "barrel";
    const model = placeProp(key, {
      x: prop.x,
      z: prop.z,
      targetH: prop.index % 2 ? 1.9 : 1.6,
      rotY: prop.index * 0.72,
    });
    if (model) prop.mesh.visible = false;
  }

  // Decorative columns at the four corner towers and gate sides.
  for (const [x, z] of [[-45, -45], [45, -45], [-45, 45], [45, 45]]) {
    placeProp("column", { x, z, targetH: 9 });
  }
  placeProp("column", { x: -8, z: 47, targetH: 7 });
  placeProp("column", { x: 8, z: 47, targetH: 7 });

  // Banners on the inner wall faces, facing the arena center.
  for (const [x, z] of [[-22, -47.5], [22, -47.5], [-47.5, -22], [47.5, 22]]) {
    placeProp("banner", { x, y: 6.4, z, targetH: 4.4, faceCenter: true, ground: false });
  }

  // Gold chests as loot accents (one central, two on side platforms at height 7).
  placeProp("chest", { x: 5, z: 6, targetH: 1.3, rotY: 0.6 });
  placeProp("chest", { x: -36, y: 7, z: 2, targetH: 1.3, rotY: -0.5 });
  placeProp("chest", { x: 36, y: 7, z: -2, targetH: 1.3, rotY: 0.5 });
  addBoxCollider(5, 6, 1.4, 1.4, 0, 1.3);
  addBoxCollider(-36, 2, 1.4, 1.4, 7, 8.3);
  addBoxCollider(36, -2, 1.4, 1.4, 7, 8.3);

  // A couple of candles on ruin blocks.
  placeProp("candle", { x: -14, y: 7.8, z: -12, targetH: 0.7 });
  placeProp("candle", { x: 13, y: 7.2, z: 10, targetH: 0.7 });

  scatterPlagueProps([
    ["gravestone", -11, -9, 0.3], ["grave", -14, -9, 0.1], ["gravestone", 12, 10, -0.4],
    ["gravemarker", 10, -12, 0.6], ["ribcage", -9, 13, 0.2], ["bone", 8, 14, 1.1],
    ["coffin", -16, 11, 0.8], ["bone", 15, -7, 0.4], ["gravestone", -17, 4, 0.2],
    ["gravemarker", 16, 2, -0.3], ["ribcage", 6, -15, 0.5],
  ]);
}

// Place a list of [model, x, z, rotY] decorative props (graveyard / plague clutter).
function scatterPlagueProps(list) {
  for (const [model, x, z, rot] of list) {
    placeProp(model, { x, z, rotY: rot ?? 0, targetH: PROP_HEIGHTS[model] ?? 1 });
  }
}

function onDungeonAssetsReady() {
  if (!MAPS[MAP_ID]) dressArena();
  else buildMapDressing(MAPS[MAP_ID]);
}

function tileFloorArea(halfX, halfZ, topY = 0.05, faceDown = false, floorKey = "floor") {
  const baked = extractBakedTile(floorKey) || extractBakedTile("floor");
  if (!baked) return;
  const step = baked.size.x || 4;
  const cells = [];
  for (let x = -halfX + step / 2; x < halfX; x += step) {
    for (let z = -halfZ + step / 2; z < halfZ; z += step) cells.push([x, z]);
  }
  const inst = new THREE.InstancedMesh(baked.geometry, baked.material, cells.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  if (faceDown) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); // ceiling: flip to face down
  cells.forEach(([x, z], i) => {
    p.set(x, faceDown ? topY : topY - baked.size.y, z);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.receiveShadow = true;
  scene.add(inst);
}

function tileWallsRect(minX, maxX, minZ, maxZ, rows = 2, wallKey = "wall") {
  const baked = extractBakedTile(wallKey) || extractBakedTile("wall");
  if (!baked) return;
  const w = baked.size.x || 4;
  const h = baked.size.y || 4;
  const placements = [];
  for (let x = minX; x <= maxX; x += w) {
    placements.push([x, minZ, 0]);
    placements.push([x, maxZ, Math.PI]);
  }
  for (let z = minZ; z <= maxZ; z += w) {
    placements.push([minX, z, Math.PI / 2]);
    placements.push([maxX, z, -Math.PI / 2]);
  }
  const inst = new THREE.InstancedMesh(baked.geometry, baked.material, placements.length * rows);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scl = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  let i = 0;
  for (const [x, z, ry] of placements) {
    q.setFromAxisAngle(up, ry);
    for (let r = 0; r < rows; r++) {
      pos.set(x, r * h, z);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i++, m);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
}

// Build a map's gameplay collision + spawn + lights from its data (visuals come later).
function buildMapCollision(def) {
  const g = def.ground;
  spawnPoint = new THREE.Vector3(def.spawn?.x ?? 0, PLAYER_EYE_HEIGHT, def.spawn?.z ?? 0);
  player.position.copy(spawnPoint);

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(g.halfX * 2 + 8, g.halfZ * 2 + 8),
    new THREE.MeshLambertMaterial({ color: g.color ?? 0x241f19 })
  );
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  scene.add(base);
  addWalkRect(0, 0, (g.halfX + 6) * 2, (g.halfZ + 6) * 2, 0);

  const th = 1.5;
  const wallH = 8;
  addBoxCollider(0, -g.halfZ, g.halfX * 2, th, 0, wallH);
  addBoxCollider(0, g.halfZ, g.halfX * 2, th, 0, wallH);
  addBoxCollider(-g.halfX, 0, th, g.halfZ * 2, 0, wallH);
  addBoxCollider(g.halfX, 0, th, g.halfZ * 2, 0, wallH);

  for (const w of def.walls || []) addWallSegmentCollider(w);
  for (const p of def.pillars || []) addCircleCollider(p.x, p.z, p.r ?? 1.2, 0, p.h ?? 8);
  for (const pr of def.props || []) {
    if (pr.solid) addBoxCollider(pr.x, pr.z, 1.4, 1.4, 0, 1.4);
  }
  for (const t of def.torches || []) createTorch(t.x, t.y ?? 4, t.z);
}

// Axis-aligned wall segment {x1,z1,x2,z2,h?} -> box collider matching the tiled visual.
function addWallSegmentCollider(w) {
  const horizontal = Math.abs(w.x2 - w.x1) >= Math.abs(w.z2 - w.z1);
  const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
  const th = 1.2;
  addBoxCollider(
    (w.x1 + w.x2) / 2,
    (w.z1 + w.z2) / 2,
    horizontal ? len : th,
    horizontal ? th : len,
    0,
    w.h ?? 8
  );
}

// Tile KayKit wall pieces along a segment (visual; matches addWallSegmentCollider).
function tileWallSegment(w, rows = 2, wallKey = "wall") {
  const baked = extractBakedTile(wallKey) || extractBakedTile("wall");
  if (!baked) return;
  const tw = baked.size.x || 4;
  const th = baked.size.y || 4;
  const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
  const n = Math.max(1, Math.round(len / tw));
  const horizontal = Math.abs(w.x2 - w.x1) >= Math.abs(w.z2 - w.z1);
  const ry = horizontal ? 0 : Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = w.x1 + (w.x2 - w.x1) * t;
    const z = w.z1 + (w.z2 - w.z1) * t;
    for (let r = 0; r < rows; r++) {
      const mesh = new THREE.Mesh(baked.geometry, baked.material);
      mesh.position.set(x, r * th, z);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

// Apply a map's KayKit visuals once the dungeon models are loaded.
function buildMapDressing(def) {
  if (arenaDressed) return;
  arenaDressed = true;
  const g = def.ground;
  const floorKey = def.tiles?.floor ?? "floor";
  const wallKey = def.tiles?.wall ?? "wall";
  tileFloorArea(g.halfX, g.halfZ, 0.05, false, floorKey);
  // Isometric: single-row (~4u) walls so they don't dwarf the character / occlude the view.
  tileWallsRect(-g.halfX, g.halfX, -g.halfZ, g.halfZ, 1, wallKey);
  // Isometric view looks down into the rooms, so no closed ceiling.
  for (const w of def.walls || []) tileWallSegment(w, 1, wallKey); // interior room walls
  for (const p of def.pillars || []) placeProp("column", { x: p.x, z: p.z, targetH: p.h ?? 8 });
  for (const pr of def.props || []) {
    placeProp(pr.model, {
      x: pr.x,
      z: pr.z,
      y: pr.y ?? 0,
      rotY: pr.rot ?? 0,
      targetH: PROP_HEIGHTS[pr.model] ?? 1.3,
    });
  }
  for (const torch of torches) {
    const p = torch.light.position;
    const model = placeProp("torch", { x: p.x, y: Math.max(1.25, p.y - 0.55) - 0.2, z: p.z, targetH: 1.5 });
    if (model) {
      torch.flame.visible = false;
      torch.glow.visible = false;
    }
  }
}

function loadCharacterModels() {
  for (const [key, url] of Object.entries(CHARACTER_MODELS)) {
    gltfLoader.load(
      url,
      (gltf) => {
        modelCache.set(key, gltf);
        if (previewActive && key === player.classId && !previewModel) setPreviewClass(key);
      },
      undefined,
      (err) => console.warn("Character model failed to load:", key, err)
    );
  }
}

function makeCharInstance(key) {
  const gltf = modelCache.get(key);
  if (!gltf) return null;
  const root = cloneSkeleton(gltf.scene);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0.001 ? MODEL_TARGET_HEIGHT / size.y : 1;
  root.scale.setScalar(scale);
  // KayKit's armature root sits at the feet, so trust the origin. Box3.setFromObject is
  // unreliable for skinned meshes (bind-pose bounds), which caused the sinking.
  root.position.y = CHARACTER_FOOT_LIFT;
  root.rotation.y = MODEL_FACING_YAW;
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations || [];
  const action = (name) => {
    const clip = clips.find((c) => c.name === name);
    return clip ? mixer.clipAction(clip) : null;
  };
  const actions = {
    idle: action("Idle"),
    run: action("Running_A") || action("Walking_A"),
    attack: action(ATTACK_CLIP[key]) || action("1H_Melee_Attack_Chop") || action("Unarmed_Melee_Attack_Punch_A"),
  };
  const char = {
    root,
    mixer,
    actions,
    footOffset: root.position.y,
    currentLoco: null,
    attacking: false,
    attackTimer: 0,
  };
  if (actions.idle) {
    actions.idle.play();
    char.currentLoco = actions.idle;
  }
  return char;
}

function setCharLoco(char, moving) {
  if (!char || char.attacking) return;
  const next = moving && char.actions.run ? char.actions.run : char.actions.idle;
  if (!next || char.currentLoco === next) return;
  next.reset().fadeIn(0.18).play();
  if (char.currentLoco) char.currentLoco.fadeOut(0.18);
  char.currentLoco = next;
}

function triggerCharAttack(char) {
  if (!char || !char.actions.attack) return;
  const a = char.actions.attack;
  a.reset();
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = false;
  a.fadeIn(0.04).play();
  if (char.currentLoco) char.currentLoco.fadeOut(0.04);
  char.attacking = true;
  char.attackTimer = a.getClip().duration;
}

function updateChar(char, dt, moving) {
  if (!char) return;
  if (char.attacking) {
    char.attackTimer -= dt;
    if (char.attackTimer <= 0) {
      char.attacking = false;
      char.currentLoco = null;
      setCharLoco(char, moving);
    }
  } else {
    setCharLoco(char, moving);
  }
  char.mixer.update(dt);
}

init();

function init() {
  const customMap = !!MAPS[MAP_ID];
  const objEl = document.getElementById("objective-text");
  if (objEl) objEl.textContent = MODE === "pvp" ? "Eliminate Heroes" : "Defeat the Swarm";
  setupWorld();
  if (!customMap) setupLights();
  setupPostProcessing();
  loadCharacterModels();
  loadLightingPrefs();
  applyLightingSettings();
  if (customMap) buildMapCollision(MAPS[MAP_ID]);
  else setupArena();
  loadDungeonModels();
  setupPlayerWeapon();
  if (MODE === "pve") spawnEnemies(); // local skeleton enemies only in PvE
  bindEvents();
  setupMobileControls();
  setupCharacterPreview();
  setupMenus();
  setupPlayerName();
  exposeDebugState();
  initMultiplayer();
  selectClass("fighter");
  addFeed("Demo loaded", "Enter Arena");
  resize();
  requestAnimationFrame(tick);
}

function exposeDebugState() {
  window.__clashDemo = {
    getState() {
      return {
        classId: player.classId,
        hp: Math.ceil(player.hp),
        maxHp: player.maxHp,
        score: player.score,
        deaths: player.deaths,
        controlsLocked,
        audioUnlocked: audioState.unlocked,
        audioState: audioState.ctx?.state ?? "unavailable",
        audioSamples: audioState.samples.size,
        lightingMode: lightingState.mode,
        lightLevel: lightingState.level,
        multiplayerStatus: multiplayer.status,
        multiplayerId: multiplayer.id,
        multiplayerPeers: remotePlayers.size,
        enemies: enemies.length,
        aliveEnemies: enemies.filter((enemy) => enemy.alive).length,
      };
    },
    sampleCanvas() {
      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(4 * 25);
      let index = 0;
      for (const yRatio of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        for (const xRatio of [0.2, 0.35, 0.5, 0.65, 0.8]) {
          const x = Math.min(width - 1, Math.max(0, Math.floor(width * xRatio)));
          const y = Math.min(height - 1, Math.max(0, Math.floor(height * yRatio)));
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels.subarray(index * 4, index * 4 + 4));
          index += 1;
        }
      }
      const samples = Array.from(pixels);
      const colors = [];
      for (let i = 0; i < samples.length; i += 4) {
        colors.push(`${samples[i]},${samples[i + 1]},${samples[i + 2]}`);
      }
      const uniqueSampleColors = new Set(colors).size;
      const litSamples = colors.filter((color) => color.split(",").reduce((sum, value) => sum + Number(value), 0) > 45).length;
      return {
        width,
        height,
        uniqueSampleColors,
        litSamples,
        nonBlank: uniqueSampleColors > 3 && litSamples > 10,
      };
    },
    captureCanvas() {
      return renderer.domElement.toDataURL("image/jpeg", 0.86);
    },
  };
}

function unlockAudio() {
  if (!AudioContextClass) return;

  if (!audioState.ctx) {
    audioState.ctx = new AudioContextClass();
    audioState.compressor = audioState.ctx.createDynamicsCompressor();
    audioState.compressor.threshold.value = -18;
    audioState.compressor.knee.value = 18;
    audioState.compressor.ratio.value = 5;
    audioState.compressor.attack.value = 0.003;
    audioState.compressor.release.value = 0.18;

    audioState.master = audioState.ctx.createGain();
    audioState.master.gain.value = 0.42;
    audioState.master.connect(audioState.compressor);
    audioState.compressor.connect(audioState.ctx.destination);
  }

  if (audioState.ctx.state === "suspended") {
    audioState.ctx.resume().then(finishAudioUnlock).catch(() => {
      audioState.unlocked = false;
    });
  } else {
    finishAudioUnlock();
  }
}

function finishAudioUnlock() {
  audioState.unlocked = audioState.ctx.state === "running";
  if (audioState.unlocked) {
    startAmbience();
    loadAudioSamples();
    if (!audioState.unlockMessageShown) {
      audioState.unlockMessageShown = true;
      playSound("ready");
      addFeed("Sound enabled", "Audio");
    }
  }
}

function setupPlayerName() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("nick") || params.get("name") || localStorage.getItem("clash-player-name");
  player.name = sanitizePlayerName(requested || `Player ${Math.floor(100 + Math.random() * 900)}`);
  ui.nickInput.value = player.name;
}

function commitPlayerName() {
  player.name = sanitizePlayerName(ui.nickInput.value || player.name);
  ui.nickInput.value = player.name;
  localStorage.setItem("clash-player-name", player.name);
  sendMultiplayerState(true);
}

function sanitizePlayerName(value) {
  const clean = String(value || "")
    .replace(/[^\w .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  return clean || "Player";
}

function startAmbience() {
  const ctx = audioState.ctx;
  if (!ctx || audioState.ambience) return;

  const gain = ctx.createGain();
  const low = ctx.createOscillator();
  const high = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();

  low.type = "sine";
  high.type = "triangle";
  low.frequency.value = 58;
  high.frequency.value = 116;
  filter.type = "lowpass";
  filter.frequency.value = 420;
  gain.gain.value = 0.018;

  low.connect(filter);
  high.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.master);
  low.start();
  high.start();

  audioState.ambience = { gain, low, high, filter };
}

async function loadAudioSamples() {
  if (!audioState.ctx || audioState.sampleLoading || audioState.sampleReady) return;
  audioState.sampleLoading = true;

  const decodedBySource = new Map();
  const entries = Object.entries(AUDIO_SAMPLES);

  await Promise.all(
    entries.map(async ([name, settings]) => {
      try {
        if (!decodedBySource.has(settings.src)) {
          decodedBySource.set(
            settings.src,
            fetch(settings.src)
              .then((response) => {
                if (!response.ok) throw new Error(`Audio load failed: ${settings.src}`);
                return response.arrayBuffer();
              })
              .then((data) => audioState.ctx.decodeAudioData(data))
          );
        }

        audioState.samples.set(name, await decodedBySource.get(settings.src));
      } catch {
        audioState.sampleFailures += 1;
      }
    })
  );

  audioState.sampleReady = audioState.samples.size > 0;
  audioState.sampleLoading = false;
  startSampleAmbience();
}

function startSampleAmbience() {
  if (!canPlayAudio() || audioState.sampleAmbience) return;
  const buffer = audioState.samples.get("ambience");
  if (!buffer) return;

  const source = audioState.ctx.createBufferSource();
  const gain = audioState.ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = AUDIO_SAMPLES.ambience.gain;
  source.connect(gain);
  gain.connect(audioState.master);
  source.start();
  audioState.sampleAmbience = { source, gain };
}

function canPlayAudio() {
  return audioState.unlocked && audioState.ctx?.state === "running" && audioState.master;
}

function playSound(name, intensity = 1) {
  if (!canPlayAudio()) return;
  if (playSample(name, intensity)) return;

  switch (name) {
    case "ready":
      tone(392, 0.08, { volume: 0.12, type: "triangle" });
      tone(588, 0.14, { delay: 0.07, volume: 0.1, type: "triangle" });
      break;
    case "class":
      tone(280, 0.08, { volume: 0.08, type: "sine" });
      tone(420, 0.12, { delay: 0.04, volume: 0.07, type: "sine" });
      break;
    case "step":
      noise(0.055, { volume: 0.035, filter: 170, type: "lowpass" });
      tone(72, 0.045, { volume: 0.025, type: "sine", endFrequency: 58 });
      break;
    case "slash":
      noise(0.12, { volume: 0.12, filter: 1900, type: "bandpass" });
      tone(180, 0.09, { volume: 0.08, type: "sawtooth", endFrequency: 82 });
      break;
    case "shield-up":
      tone(130, 0.12, { volume: 0.11, type: "square", endFrequency: 88 });
      noise(0.08, { volume: 0.05, filter: 520, type: "lowpass" });
      break;
    case "shield-down":
      tone(92, 0.08, { volume: 0.07, type: "triangle", endFrequency: 70 });
      break;
    case "fire":
      tone(98, 0.16, { volume: 0.12, type: "sawtooth", endFrequency: 62 });
      noise(0.18, { volume: 0.12, filter: 920, type: "lowpass" });
      break;
    case "ice":
      tone(740, 0.18, { volume: 0.08, type: "triangle", endFrequency: 1180 });
      noise(0.12, { volume: 0.05, filter: 2600, type: "highpass" });
      break;
    case "arrow":
      noise(0.11, { volume: 0.09, filter: 2400, type: "bandpass" });
      tone(640, 0.08, { volume: 0.045, type: "triangle", endFrequency: 330 });
      break;
    case "charge-arrow":
      tone(240, 0.18, { volume: 0.09, type: "triangle", endFrequency: 680 });
      noise(0.09, { delay: 0.07, volume: 0.08, filter: 2800, type: "bandpass" });
      break;
    case "witch":
      tone(150, 0.22, { volume: 0.11, type: "sawtooth", endFrequency: 76 });
      tone(301, 0.2, { volume: 0.045, type: "sine", endFrequency: 190 });
      break;
    case "bash":
      tone(74, 0.14, { volume: 0.16, type: "square", endFrequency: 45 });
      noise(0.12, { volume: 0.13, filter: 260, type: "lowpass" });
      break;
    case "dash":
      noise(0.22, { volume: 0.1, filter: 980, type: "bandpass" });
      tone(120, 0.16, { volume: 0.09, type: "sawtooth", endFrequency: 210 });
      break;
    case "trap":
      tone(220, 0.08, { volume: 0.08, type: "square" });
      tone(165, 0.1, { delay: 0.07, volume: 0.06, type: "square" });
      break;
    case "wall":
      tone(460, 0.22, { volume: 0.09, type: "triangle", endFrequency: 230 });
      noise(0.18, { volume: 0.08, filter: 1500, type: "bandpass" });
      break;
    case "zone":
      tone(190, 0.24, { volume: 0.09, type: "sawtooth", endFrequency: 95 });
      noise(0.2, { volume: 0.07, filter: 520, type: "lowpass" });
      break;
    case "ultimate":
      tone(72, 0.42, { volume: 0.18, type: "sawtooth", endFrequency: 144 });
      tone(216, 0.34, { volume: 0.08, type: "triangle", endFrequency: 432 });
      noise(0.35, { volume: 0.15, filter: 720, type: "bandpass" });
      break;
    case "meteor":
      tone(96, 0.28, { volume: 0.11, type: "sawtooth", endFrequency: 44 });
      noise(0.3, { volume: 0.13, filter: 700, type: "lowpass" });
      break;
    case "hit":
      tone(220, 0.07, { volume: 0.09 * intensity, type: "square", endFrequency: 140 });
      noise(0.06, { volume: 0.08 * intensity, filter: 1000, type: "bandpass" });
      break;
    case "kill":
      tone(280, 0.08, { volume: 0.12, type: "triangle" });
      tone(420, 0.09, { delay: 0.07, volume: 0.11, type: "triangle" });
      tone(700, 0.16, { delay: 0.15, volume: 0.09, type: "triangle" });
      break;
    case "hurt":
      tone(92, 0.16, { volume: 0.14, type: "sawtooth", endFrequency: 48 });
      noise(0.12, { volume: 0.12, filter: 360, type: "lowpass" });
      break;
    case "block":
      tone(170, 0.09, { volume: 0.12, type: "square", endFrequency: 120 });
      noise(0.08, { volume: 0.1, filter: 1400, type: "bandpass" });
      break;
    case "death":
      tone(164, 0.18, { volume: 0.12, type: "sawtooth", endFrequency: 82 });
      tone(82, 0.3, { delay: 0.12, volume: 0.12, type: "triangle", endFrequency: 41 });
      break;
    default:
      break;
  }
}

function playSample(name, intensity = 1) {
  const settings = AUDIO_SAMPLES[name];
  const buffer = audioState.samples.get(name);
  if (!settings || !buffer) return false;

  const source = audioState.ctx.createBufferSource();
  const gain = audioState.ctx.createGain();
  const start = audioState.ctx.currentTime;
  const jitter = 1 + (Math.random() - 0.5) * 0.05;

  source.buffer = buffer;
  source.playbackRate.value = (settings.playbackRate ?? 1) * jitter;
  gain.gain.value = (settings.gain ?? 0.4) * intensity;
  source.connect(gain);
  gain.connect(audioState.master);
  source.start(start);

  if (settings.maxDuration && settings.maxDuration < buffer.duration) {
    source.stop(start + settings.maxDuration);
  }

  return true;
}

function tone(frequency, duration, options = {}) {
  const ctx = audioState.ctx;
  if (!ctx) return;

  const delay = options.delay ?? 0;
  const attack = options.attack ?? 0.008;
  const release = options.release ?? 0.08;
  const start = ctx.currentTime + delay;
  const end = start + duration;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume ?? 0.08), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release);

  oscillator.connect(gain);
  gain.connect(audioState.master);
  oscillator.start(start);
  oscillator.stop(end + release + 0.04);
}

function noise(duration, options = {}) {
  const ctx = audioState.ctx;
  if (!ctx) return;

  if (!audioState.noiseBuffer) {
    const sampleCount = ctx.sampleRate;
    audioState.noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = audioState.noiseBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  const delay = options.delay ?? 0;
  const attack = options.attack ?? 0.004;
  const release = options.release ?? 0.07;
  const start = ctx.currentTime + delay;
  const end = start + duration;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = audioState.noiseBuffer;
  source.loop = true;
  filter.type = options.type ?? "bandpass";
  filter.frequency.setValueAtTime(options.filter ?? 1000, start);
  filter.Q.value = options.q ?? 0.8;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume ?? 0.07), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.master);
  source.start(start);
  source.stop(end + release + 0.04);
}

function initMultiplayer() {
  const params = new URLSearchParams(window.location.search);
  const explicitServer = params.get("server");
  const baseRoom = params.get("room") || "public";
  // Group players by map (bot bounds) and mode (PvE skeletons vs PvP heroes) into separate rooms.
  let room = MAP_ID === "castle" ? baseRoom : `${baseRoom}:${MAP_ID}`;
  if (MODE === "pvp") room += ":pvp";
  multiplayer.room = room;
  multiplayer.serverUrl = resolveMultiplayerServerUrl(explicitServer);

  if (!multiplayer.serverUrl) {
    setMultiplayerStatus("offline", "MP needs server", "add ?server=wss://...");
    return;
  }

  connectMultiplayer();
}

function resolveMultiplayerServerUrl(explicitServer) {
  if (explicitServer) return normalizeWebSocketUrl(explicitServer);

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (import.meta.env.DEV && isLocalHost) {
    return "ws://127.0.0.1:8787";
  }

  if (!window.location.host) return null;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function normalizeWebSocketUrl(value) {
  const raw = value.trim();
  if (!raw) return null;

  let normalized = raw;
  if (/^https?:\/\//i.test(raw)) {
    normalized = raw.replace(/^http/i, "ws");
  } else if (!/^[a-z]+:\/\//i.test(raw)) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    normalized = `${protocol}://${raw}`;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function connectMultiplayer() {
  if (!multiplayer.serverUrl) return;
  clearTimeout(multiplayer.reconnectTimer);
  setMultiplayerStatus("connecting", "MP Connecting", multiplayer.room);

  let url;
  try {
    url = new URL(multiplayer.serverUrl);
  } catch {
    setMultiplayerStatus("offline", "MP Offline", "invalid server");
    return;
  }

  url.searchParams.set("room", multiplayer.room);
  const socket = new WebSocket(url);
  multiplayer.socket = socket;
  multiplayer.lastMessageAt = Date.now();

  socket.addEventListener("open", () => {
    setMultiplayerStatus("connecting", "MP Joining", multiplayer.room);
    startMultiplayerHeartbeat(socket);
    sendMultiplayerState(true);
  });

  socket.addEventListener("message", (event) => {
    multiplayer.lastMessageAt = Date.now();
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "welcome") {
      multiplayer.id = message.id;
      multiplayer.room = message.room || multiplayer.room;
      multiplayer.reconnectDelay = 1500;
      setMultiplayerStatus("online", "MP Online", `room ${multiplayer.room}`);
      if (message.scoreboard) applyScoreboard(message.scoreboard);
      for (const peer of message.peers || []) {
        updateRemotePlayer(peer.id, peer.state);
      }
      sendMultiplayerState(true);
    }

    if (message.type === "peer-state") {
      updateRemotePlayer(message.id, message.state);
    }

    if (message.type === "peer-attack") {
      animateRemoteAttack(message.id, message.attack);
    }

    if (message.type === "damage") {
      applyPeerDamage(message.attackerId, message.hit);
    }

    if (message.type === "peer-death") {
      handlePeerDeath(message.id, message.death);
    }

    if (message.type === "scoreboard") {
      applyScoreboard(message);
    }

    if (message.type === "match-over") {
      matchState.status = "ended";
      matchState.winnerId = message.winnerId || null;
      matchState.winnerName = message.winnerName || "";
      matchState.resetAt = Number(message.resetAt) || 0;
      showMatchBanner(message.winnerName || "Winner", `First to ${message.limit || matchState.limit}. Restarting soon.`);
    }

    if (message.type === "match-reset") {
      handleMatchReset();
    }

    if (message.type === "pong") {
      return;
    }

    if (message.type === "peer-left") {
      removeRemotePlayer(message.id);
    }
  });

  socket.addEventListener("close", () => {
    if (multiplayer.socket !== socket) return;
    stopMultiplayerHeartbeat();
    multiplayer.socket = null;
    multiplayer.id = null;
    clearRemotePlayers();
    setMultiplayerStatus("offline", "MP Offline", "retrying");
    scheduleMultiplayerReconnect();
  });

  socket.addEventListener("error", () => {
    if (multiplayer.socket !== socket) return;
    setMultiplayerStatus("offline", "MP Offline", "server not found");
    socket.close();
  });
}

function startMultiplayerHeartbeat(socket) {
  stopMultiplayerHeartbeat();
  multiplayer.heartbeatTimer = setInterval(() => {
    if (multiplayer.socket !== socket) {
      stopMultiplayerHeartbeat();
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    if (now - multiplayer.lastMessageAt > 25000) {
      socket.close();
      return;
    }

    socket.send(JSON.stringify({ type: "ping", t: now }));
  }, 8000);
}

function stopMultiplayerHeartbeat() {
  if (!multiplayer.heartbeatTimer) return;
  clearInterval(multiplayer.heartbeatTimer);
  multiplayer.heartbeatTimer = null;
}

function scheduleMultiplayerReconnect() {
  clearTimeout(multiplayer.reconnectTimer);
  const delay = multiplayer.reconnectDelay;
  multiplayer.reconnectDelay = Math.min(9000, Math.round(multiplayer.reconnectDelay * 1.45));
  multiplayer.reconnectTimer = setTimeout(connectMultiplayer, delay);
}

function setMultiplayerStatus(status, label, detail) {
  multiplayer.status = status;
  ui.mpStatus.textContent = label;
  ui.mpRoom.textContent = detail;
  ui.mpHud.classList.toggle("online", status === "online");
  ui.mpHud.classList.toggle("connecting", status === "connecting");
  syncEnemyVisibility();
}

function sendMultiplayerState(force = false) {
  if (!multiplayer.socket || multiplayer.socket.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (!force && now - multiplayer.lastSentAt < 50) return;
  multiplayer.lastSentAt = now;

  multiplayer.socket.send(
    JSON.stringify({
      type: "state",
      state: {
        name: player.name,
        classId: player.classId,
        hp: player.hp,
        maxHp: player.maxHp,
        score: player.score,
        deaths: player.deaths,
        shield: player.shield,
        chargingShot: player.chargingShot,
        dead: player.deadTimer > 0,
        ready: matchStarted,
        yaw,
        position: {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
        },
      },
    })
  );
}

function sendMultiplayerMessage(message) {
  if (!multiplayer.socket || multiplayer.socket.readyState !== WebSocket.OPEN) return false;
  multiplayer.socket.send(JSON.stringify(message));
  return true;
}

function sendMultiplayerAttack(slot, label, color, options = {}) {
  const direction = options.direction ?? getCameraForward();
  const target = options.target ?? null;
  sendMultiplayerMessage({
    type: "attack",
    attack: {
      classId: player.classId,
      slot,
      label,
      color,
      yaw,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
      target: target
        ? {
            x: target.x,
            y: target.y,
            z: target.z,
          }
        : null,
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z,
      },
    },
  });
}

function sendMultiplayerHit(remote, amount, label, color, extra = {}) {
  return sendMultiplayerMessage({
    type: "hit",
    targetId: remote.id,
    amount,
    label,
    color,
    knock: extra.knock ?? 0,
  });
}

function sendMultiplayerDeath(killerId, label) {
  sendMultiplayerMessage({
    type: "death",
    death: {
      killerId,
      label,
    },
  });
}

function animateRemoteAttack(id, attack = {}) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  remote.attackPulse = 1;
  if (remote.char) triggerCharAttack(remote.char);
  spawnRemoteAttackEffect(remote, attack);
  playSound(soundForAttack(attack.label));
}

function spawnRemoteAttackEffect(remote, attack) {
  const color = attack.color ?? classColor(remote.classId);
  const label = attack.label || "Attack";
  const origin = attack.position
    ? new THREE.Vector3(attack.position.x, attack.position.y, attack.position.z)
    : remote.group.position.clone().add(new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 0));
  const target = getAttackTarget(attack);
  const direction = getAttackDirection(attack);

  if (label.includes("Slash")) {
    makeDirectionalCone(remote.group.position, remote.group.rotation.y, 3.2, color, 0.28);
    return;
  }

  if (label.includes("Shield Bash")) {
    makeDirectionalCone(remote.group.position, remote.group.rotation.y, 4.0, color, 0.34);
    return;
  }

  if (label.includes("Scream")) {
    makeDirectionalCone(remote.group.position, remote.group.rotation.y, label.includes("Banshee") ? 15 : 8.5, color, 0.65);
    return;
  }

  if (label.includes("Sprint Charge") || label.includes("Roll")) {
    makeGroundRing(remote.group.position, label.includes("Sprint") ? 2.8 : 2.1, color, 0.42);
    return;
  }

  if (label.includes("Whirlwind") || label.includes("Fear")) {
    makeGroundRing(remote.group.position, label.includes("Whirlwind") ? 6.3 : 7.4, color, 0.55);
    return;
  }

  if (label.includes("Fire Field")) {
    makeRemoteZone(target || projectAttackTarget(origin, direction, 18), 4.3, color, 4.2);
    return;
  }

  if (label.includes("Ice Wall")) {
    makeRemoteWall(target || projectAttackTarget(origin, direction, 9), direction, color, 5.8);
    return;
  }

  if (label.includes("Meteor Shower")) {
    const center = target || projectAttackTarget(origin, direction, 18);
    makeRemoteZone(center, 7.5, color, 1.2);
    for (let i = 0; i < 9; i++) {
      setTimeout(() => spawnRemoteMeteor(center.clone().add(randomFlatOffset(11)), color), i * 170);
    }
    return;
  }

  if (label.includes("Trap")) {
    makeRemoteZone(target || projectAttackTarget(origin, direction, 6), 2.2, color, 5.0);
    return;
  }

  if (label.includes("Arrow Rain")) {
    const center = target || projectAttackTarget(origin, direction, 17);
    makeRemoteZone(center, 7.2, color, 1.0);
    for (let i = 0; i < 14; i++) {
      setTimeout(() => spawnRemoteFallingArrow(center.clone().add(randomFlatOffset(12)), color), i * 80);
    }
    return;
  }

  if (label.includes("Silence")) {
    makeRemoteZone(target || projectAttackTarget(origin, direction, 13), 4.6, color, 3.5);
    return;
  }

  if (isProjectileAttack(label)) {
    spawnRemoteProjectile(attack, origin, color, label);
    return;
  }

  makeGroundRing(remote.group.position, 2.4, color, 0.28);
}

function isProjectileAttack(label) {
  return (
    label === "Arrow" ||
    label.includes("Charged Arrow") ||
    label.includes("Fireball") ||
    label.includes("Ice Bolt") ||
    label.includes("Sound Wave")
  );
}

function spawnRemoteProjectile(attack, origin, color, label) {
  const config = remoteProjectileConfig(label);
  const direction = getAttackDirection(attack);
  const start = origin.clone().add(direction.clone().multiplyScalar(1.1));
  start.y -= 0.12;

  const mesh = createProjectileMesh(config.shape, color, config.radius);
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  scene.add(mesh);

  effects.push({
    mesh,
    life: config.life,
    maxLife: config.life,
    update(effect, progress, dt) {
      effect.mesh.position.addScaledVector(direction, config.speed * dt);
      if (config.spin) effect.mesh.rotation[config.spin.axis] += config.spin.speed * dt;
      setObjectOpacity(effect.mesh, Math.max(0, 0.94 * (1 - progress)));
    },
  });
}

function remoteProjectileConfig(label) {
  if (label.includes("Charged Arrow")) {
    return { shape: "arrow", radius: 0.48, speed: 58, life: 1.55 };
  }
  if (label.includes("Arrow")) {
    return { shape: "arrow", radius: 0.36, speed: 44, life: 1.6 };
  }
  if (label.includes("Ice")) {
    return { shape: "ice", radius: 0.42, speed: 34, life: 1.7 };
  }
  if (label.includes("Wave")) {
    return { shape: "wave", radius: 0.76, speed: 30, life: 1.35, spin: { axis: "z", speed: 12 } };
  }
  return { shape: "sphere", radius: 0.55, speed: 24, life: 2.0 };
}

function getAttackDirection(attack) {
  const raw = attack.direction;
  if (raw) {
    const direction = new THREE.Vector3(raw.x, raw.y, raw.z);
    if (direction.lengthSq() > 0.01) return direction.normalize();
  }

  return new THREE.Vector3(0, 0, -1).applyAxisAngle(upAxis, attack.yaw ?? 0).normalize();
}

function getAttackTarget(attack) {
  if (!attack.target) return null;
  return new THREE.Vector3(attack.target.x, attack.target.y, attack.target.z);
}

function projectAttackTarget(origin, direction, distance) {
  const flat = direction.clone();
  flat.y = 0;
  if (flat.lengthSq() <= 0.01) flat.set(0, 0, -1).applyAxisAngle(upAxis, yaw);
  return new THREE.Vector3(origin.x, 0, origin.z).add(flat.normalize().multiplyScalar(distance));
}

function soundForAttack(label = "") {
  if (label.includes("Arrow")) return "arrow";
  if (label.includes("Fire") || label.includes("Meteor")) return "fire";
  if (label.includes("Ice")) return "ice";
  if (label.includes("Slash")) return "slash";
  if (label.includes("Bash")) return "bash";
  if (label.includes("Charge") || label.includes("Roll")) return "dash";
  if (label.includes("Trap")) return "trap";
  if (label.includes("Wall")) return "wall";
  if (label.includes("Whirlwind") || label.includes("Rain") || label.includes("Banshee")) return "ultimate";
  if (label.includes("Silence") || label.includes("Fear") || label.includes("Scream") || label.includes("Wave")) return "witch";
  return "zone";
}

function applyPeerDamage(attackerId, hit = {}) {
  if (!attackerId || player.deadTimer > 0 || player.invulnerable > 0) return;

  const attacker = remotePlayers.get(attackerId);
  let finalDamage = clamp(Number(hit.amount) || 0, 0, 200);
  if (finalDamage <= 0) return;

  if (player.shield && attacker && isSourceInFront(attacker)) {
    finalDamage *= 0.25;
    playSound("block");
    addFeed("Shield absorbed player hit", "Block");
  } else {
    playSound("hurt");
  }

  player.hp = Math.max(0, player.hp - finalDamage);
  player.invulnerable = 0.18;
  ui.vignette.classList.add("active");
  lastHitFlash = 0.14;
  addCameraShake(0.3);

  if (attacker) {
    const impact = player.position.clone().add(new THREE.Vector3(0, -0.45, 0));
    spawnHitBurst(impact, hit.color ?? classColor(attacker.classId));
    const knockDir = player.position.clone().sub(attacker.group.position);
    knockDir.y = 0;
    if ((hit.knock ?? 0) > 0 && knockDir.lengthSq() > 0.01) {
      movePlayerByVector(knockDir.normalize().multiplyScalar(Math.min(1.6, hit.knock * 0.06)));
    }
  }

  addFeed(`${hit.label || "Hit"} dealt ${Math.round(finalDamage)}`, "Damage");

  if (player.hp <= 0) {
    player.deaths += 1;
    player.deadTimer = 2;
    player.hp = 0;
    player.shield = false;
    player.chargingShot = false;
    player.chargeRush = 0;
    playSound("death");
    addFeed("Respawning", "Defeated");
    sendMultiplayerDeath(attackerId, hit.label || "Defeated");
  }

  sendMultiplayerState(true);
}

function handlePeerDeath(victimId, death = {}) {
  if (!victimId) return;
  const victim = remotePlayers.get(victimId);
  const victimLabel = victim?.isBot ? victim.state?.name || "Bot" : "Player";

  if (death.killerId === multiplayer.id) {
    playSound("kill");
    addFeed(`${victimLabel} down`, death.label || "Elimination");
    // PvE: killing a skeleton (server bot) drops a potion the killer can grab.
    if (RESOURCE_ENABLED && victim?.isBot && victim.group) spawnPotion(victim.group.position);
    return;
  }

  if (victim) {
    addFeed(`${victimLabel} down`, death.label || "Elimination");
  }
}

function applyScoreboard(message = {}) {
  matchState.limit = Number(message.limit) || MATCH_KILL_LIMIT;
  matchState.status = message.status || "playing";
  matchState.winnerId = message.winnerId || null;
  matchState.winnerName = message.winnerName || "";
  matchState.resetAt = Number(message.resetAt) || 0;
  matchState.entries = Array.isArray(message.entries) ? message.entries : [];

  const mine = matchState.entries.find((entry) => entry.id === multiplayer.id);
  if (mine) {
    player.score = Number(mine.score) || 0;
    player.deaths = Number(mine.deaths) || 0;
  }

  if (matchState.status === "playing") {
    ui.matchBanner.classList.add("hidden");
  }

  updateScoreboardHud();
}

function updateScoreboardHud() {
  if (!ui.scoreboardList) return;
  ui.scoreboard.classList.toggle("hidden", !input.scoreboard);
  ui.scoreboardLimit.textContent = `${matchState.limit} kills`;

  const entries = [...matchState.entries].sort((a, b) => {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (Number(a.deaths) || 0) - (Number(b.deaths) || 0);
  });

  ui.scoreboardList.replaceChildren(
    ...entries.map((entry, index) => {
      const row = document.createElement("div");
      row.className = "scoreboard-row";
      row.classList.toggle("local", entry.id === multiplayer.id);
      const status = entry.dead ? "Down" : entry.ready === false ? "Lobby" : "Alive";
      row.innerHTML = `
        <div class="scoreboard-name">
          <strong>${escapeHtml(entry.name || (entry.bot ? "Bot" : `Player ${index + 1}`))}</strong>
          <span>${escapeHtml(CLASS_DATA[entry.classId]?.name || "Fighter")}${entry.bot ? " Bot" : ""}</span>
        </div>
        <div class="scoreboard-stat"><strong>${Number(entry.score) || 0}</strong><span>K</span></div>
        <div class="scoreboard-stat"><strong>${Number(entry.deaths) || 0}</strong><span>D</span></div>
        <div class="scoreboard-status">${status}</div>
      `;
      return row;
    })
  );
}

function showMatchBanner(title, detail) {
  ui.matchBannerTitle.textContent = title;
  ui.matchBannerDetail.textContent = detail;
  ui.matchBanner.classList.remove("hidden");
}

function handleMatchReset() {
  matchState.status = "playing";
  matchState.winnerId = null;
  matchState.winnerName = "";
  matchState.resetAt = 0;
  player.score = 0;
  player.deaths = 0;
  resetMods();
  respawnPlayer();
  showMatchBanner("New Round", `First to ${matchState.limit} kills`);
  setTimeout(() => {
    if (matchState.status === "playing") ui.matchBanner.classList.add("hidden");
  }, 1800);
}

function classBaseHp() {
  return CLASS_DATA[player.classId]?.hp ?? 100;
}

function healPlayer(value) {
  if (value <= 0 || player.deadTimer > 0) return;
  player.hp = Math.min(player.maxHp, player.hp + value);
}

function resetMods() {
  mods.damageMult = 1;
  mods.lifesteal = 0;
  mods.speedMult = 1;
  mods.cdrBonus = 0;
  mods.maxHpBonus = 0;
  player.maxHp = classBaseHp();
  player.hp = Math.min(player.hp, player.maxHp);
  player.resource = player.maxResource;
}

function clearRemotePlayers() {
  for (const id of remotePlayers.keys()) {
    removeRemotePlayer(id);
  }
}

function setupWorld() {
  const hemi = new THREE.HemisphereLight(0x2d446d, 0x040706, 0.38);
  lightingState.hemi = hemi;
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.64);
  lightingState.keyLight = moon;
  moon.position.set(-32, 48, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -70;
  moon.shadow.camera.right = 70;
  moon.shadow.camera.top = 70;
  moon.shadow.camera.bottom = -70;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 130;
  scene.add(moon);

  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 24),
    new THREE.MeshBasicMaterial({
      color: 0xd8e2ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
  );
  moonDisc.position.set(-36, 54, -62);
  lightingState.moonDisc = moonDisc;
  scene.add(moonDisc);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 140; i++) {
    starPositions.push((Math.random() - 0.5) * 150, 28 + Math.random() * 46, -80 + Math.random() * 135);
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xcdd7ff,
      size: 0.42,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  lightingState.stars = stars;
  scene.add(stars);
}

function setupLights() {
  const torchPositions = [
    [-31, 3.8, -31],
    [31, 3.8, -31],
    [-31, 3.8, 31],
    [31, 3.8, 31],
    [-12, 3.1, -16],
    [15, 3.1, 13],
    [-23, 3.1, 10],
    [24, 3.1, -12],
    [-8, 3.0, 9],
    [8, 3.0, 9],
    [-5, 2.7, 12],
    [5, 2.7, 12],
    [0, 2.8, -2],
    [-7, 3.0, -5],
    [7, 3.0, -5],
    [0, 4.4, 25],
    [-34, 4.4, 2],
    [34, 4.4, 2],
    [-30, 3.2, 39],
  ];

  torchPositions.forEach(([x, y, z]) => createTorch(x, y, z));
}

function createTorch(x, y, z) {
  const flame = new THREE.PointLight(0xff8f46, 5.6, 27, 1.65);
  flame.position.set(x, y, z);
  flame.castShadow = false;
  scene.add(flame);

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.86, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8f46 })
  );
  mesh.position.copy(flame.position);
  scene.add(mesh);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff8f46,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    })
  );
  glow.position.copy(flame.position);
  scene.add(glow);

  const postHeight = Math.max(1.25, y - 0.55);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, postHeight, 6), materials.wood);
  post.position.set(x, postHeight / 2, z);
  post.castShadow = true;
  scene.add(post);

  torches.push({
    light: flame,
    flame: mesh,
    glow,
    baseIntensity: flame.intensity,
    phase: Math.random() * Math.PI * 2,
  });
}

function setLightingMode(mode) {
  if (!lightingPresets[mode]) return;
  lightingState.mode = mode;
  lightingState.level = mode === "day" ? 1 : 0.62;
  ui.lightLevel.value = String(Math.round(lightingState.level * 100));
  applyLightingSettings();
  saveLightingPrefs();
}

function setLightingLevel(level) {
  lightingState.level = clamp(level, 0.35, 1.2);
  applyLightingSettings();
  saveLightingPrefs();
}

function saveLightingPrefs() {
  try {
    localStorage.setItem("vc-light", JSON.stringify({ mode: lightingState.mode, level: lightingState.level }));
  } catch (err) {
    /* ignore storage errors */
  }
}

function loadLightingPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("vc-light") || "null");
    if (!saved) return;
    if (lightingPresets[saved.mode]) lightingState.mode = saved.mode;
    if (typeof saved.level === "number") lightingState.level = clamp(saved.level, 0.35, 1.2);
    if (ui.lightLevel) ui.lightLevel.value = String(Math.round(lightingState.level * 100));
  } catch (err) {
    /* ignore storage errors */
  }
}

function applyLightingSettings() {
  const preset = lightingPresets[lightingState.mode];
  const level = lightingState.level;
  const intensityScale = 0.52 + level * 0.78;
  const exposureScale = 0.78 + level * 0.36;
  const colorScale = clamp(0.46 + level * 0.56, 0.55, 1.12);
  const sky = new THREE.Color(preset.sky).multiplyScalar(colorScale);
  const fog = new THREE.Color(preset.fog).multiplyScalar(colorScale);

  scene.background.copy(sky);
  scene.fog.color.copy(fog);
  scene.fog.near = Math.max(8, preset.fogNear * (0.9 + level * 0.08));
  scene.fog.far = Math.max(scene.fog.near + 16, preset.fogFar * (0.78 + level * 0.28));
  renderer.toneMappingExposure = preset.exposure * exposureScale;

  if (lightingState.hemi) {
    lightingState.hemi.color.setHex(preset.hemiSky);
    lightingState.hemi.groundColor.setHex(preset.hemiGround);
    lightingState.hemi.intensity = preset.hemiIntensity * intensityScale;
  }

  if (lightingState.keyLight) {
    lightingState.keyLight.color.setHex(preset.keyColor);
    lightingState.keyLight.intensity = preset.keyIntensity * intensityScale;
  }

  if (lightingState.stars) {
    lightingState.stars.material.opacity = preset.starsOpacity * clamp(1.2 - level * 0.32, 0.35, 1.1);
  }

  if (lightingState.moonDisc) {
    lightingState.moonDisc.material.opacity = preset.moonOpacity * clamp(1.12 - level * 0.22, 0.35, 1);
  }

  lightingState.torchPower = preset.torchScale * (0.58 + level * 0.8);

  ui.lightLevelText.textContent = `${Math.round(level * 100)}%`;
  ui.lightingButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lightMode === lightingState.mode);
  });
}

function setupArena() {
  addWalkRect(0, 0, 108, 108, 0);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(108, 108, 12, 12), materials.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const courtyard = new THREE.Mesh(new THREE.CircleGeometry(21, 9), materials.dirt);
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.position.y = 0.025;
  courtyard.receiveShadow = true;
  scene.add(courtyard);

  addWall(0, -51, 104, 7, 8);
  addWall(0, 51, 104, 7, 8);
  addWall(-51, 0, 7, 104, 8);
  addWall(51, 0, 7, 104, 8);

  addGate(0, 51.2);
  addTowers();
  addBattlements();
  addRuins();
  addArcherPlatforms();
  addTunnel();
  addProps();
}

function addWall(x, z, w, d, h) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.stone);
  wall.position.set(x, h / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  addBoxCollider(x, z, w, d, 0, h);
}

function addGate(x, z) {
  const left = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 6), materials.darkStone);
  const right = left.clone();
  left.position.set(x - 15, 4, z);
  right.position.set(x + 15, 4, z);
  scene.add(left, right);
  addBoxCollider(x - 15, z, 14, 6, 0, 8);
  addBoxCollider(x + 15, z, 14, 6, 0, 8);

  const arch = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 6.2), materials.darkStone);
  arch.position.set(x, 10, z);
  arch.castShadow = true;
  arch.receiveShadow = true;
  scene.add(arch);
}

function addTowers() {
  const spots = [
    [-45, -45],
    [45, -45],
    [-45, 45],
    [45, 45],
  ];

  spots.forEach(([x, z]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.4, 16, 8), materials.darkStone);
    tower.position.set(x, 8, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    addCircleCollider(x, z, 7.2, 0, 16);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 1.2, 8), materials.stone);
    top.position.set(x, 16.7, z);
    top.castShadow = true;
    scene.add(top);
  });
}

function addBattlements() {
  for (let i = -45; i <= 45; i += 10) {
    addBlock(i, -51, 4.6, 2.6, 2.2, 9.2, materials.darkStone);
    addBlock(i, 51, 4.6, 2.6, 2.2, 9.2, materials.darkStone);
    addBlock(-51, i, 2.6, 4.6, 2.2, 9.2, materials.darkStone);
    addBlock(51, i, 2.6, 4.6, 2.2, 9.2, materials.darkStone);
  }
}

function addRuins() {
  const ruinSpecs = [
    [-14, -12, 2.2, 2.2, 7.8],
    [-9, -16, 2.2, 2.2, 5.4],
    [13, 10, 2.4, 2.4, 7.2],
    [18, 14, 2.4, 2.4, 4.7],
    [-18, 16, 10, 2.2, 3.8],
    [18, -17, 2.2, 10, 3.8],
  ];

  ruinSpecs.forEach(([x, z, w, d, h]) => addBlock(x, z, w, d, h, h / 2, materials.stone));

  addStonehenge(0, 0, 5.5, 8);
}

// Ring of standing stones with lintels at the arena center (open, walkable interior).
function addStonehenge(cx, cz, radius, count) {
  const upW = 1.7;
  const upH = 5;
  const upD = 1.1;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const z = cz + Math.sin(a) * radius;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(upW, upH, upD), materials.stone);
    stone.position.set(x, upH / 2, z);
    stone.rotation.y = -a;
    stone.castShadow = true;
    stone.receiveShadow = true;
    scene.add(stone);
    addCircleCollider(x, z, 1.0, 0, upH);

    const a2 = ((i + 1) / count) * Math.PI * 2;
    const mid = (a + a2) / 2;
    const chord = 2 * radius * Math.sin(Math.PI / count);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(chord + 0.4, 0.8, upD * 1.05), materials.darkStone);
    lintel.position.set(cx + Math.cos(mid) * radius, upH + 0.4, cz + Math.sin(mid) * radius);
    lintel.rotation.y = -mid + Math.PI / 2;
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    scene.add(lintel);
  }
}

function addArcherPlatforms() {
  const platformMat = materials.wood;
  [
    [-36, 0, 11, 22],
    [36, 0, 11, 22],
    [0, -36, 24, 11],
  ].forEach(([x, z, w, d]) => {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), platformMat);
    platform.position.set(x, 6.4, z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);
    addWalkRect(x, z, w, d, 7);

    addRamp(x, z + d / 2 + 5, w * 0.75, 10, platformMat, z > 0 ? -1 : 1);
  });
}

function addRamp(x, z, w, d, material, direction) {
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), material);
  ramp.position.set(x, 3.25, z);
  ramp.rotation.x = direction * 0.48;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  scene.add(ramp);
  addRampSurface(x, z, w, d, 0, 7, direction);
}

function addTunnel() {
  const trench = new THREE.Mesh(new THREE.BoxGeometry(13, 1, 24), materials.dirt);
  trench.position.set(-30, 0.05, 29);
  trench.receiveShadow = true;
  scene.add(trench);

  const arch = new THREE.Mesh(new THREE.BoxGeometry(15, 5, 4), materials.darkStone);
  arch.position.set(-30, 2.7, 41);
  arch.castShadow = true;
  scene.add(arch);

  const hole = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.2, 1), materials.black);
  hole.position.set(-30, 2.1, 43.3);
  scene.add(hole);
}

function addProps() {
  const barrelGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8);
  const crateGeo = new THREE.BoxGeometry(1.9, 1.9, 1.9);
  const spots = [
    [-23, -7],
    [-25, -3],
    [27, 8],
    [30, 11],
    [6, -28],
    [10, -31],
    [-33, 23],
  ];

  spots.forEach(([x, z], index) => {
    const mesh = new THREE.Mesh(index % 2 ? crateGeo : barrelGeo, materials.wood);
    mesh.position.set(x, index % 2 ? 0.95 : 0.8, z);
    mesh.rotation.y = index * 0.72;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    arenaProps.push({ mesh, x, z, index });
    addBoxCollider(x, z, index % 2 ? 1.9 : 1.8, index % 2 ? 1.9 : 1.8, 0, index % 2 ? 1.9 : 1.6);
  });
}

function addBlock(x, z, w, d, h, y, material) {
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  block.position.set(x, y, z);
  block.rotation.y = (Math.sin(x * 12.989 + z * 78.233) * 0.2) % 0.2;
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
  if (y - h / 2 <= 0.2) addBoxCollider(x, z, w, d, 0, h);
  return block;
}

function addBoxCollider(x, z, w, d, minY, maxY) {
  worldColliders.push({
    type: "box",
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    minY,
    maxY,
  });
}

function addCircleCollider(x, z, radius, minY, maxY) {
  worldColliders.push({
    type: "circle",
    x,
    z,
    radius,
    minY,
    maxY,
  });
}

function addWalkRect(x, z, w, d, height) {
  walkSurfaces.push({
    type: "rect",
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    height,
  });
}

function addRampSurface(x, z, w, d, lowHeight, highHeight, direction) {
  walkSurfaces.push({
    type: "ramp",
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    lowHeight,
    highHeight,
    highAtMinZ: direction >= 0,
  });
}

function setupPlayerWeapon() {
  weaponGroup = new THREE.Group();
  camera.add(weaponGroup);
  scene.add(camera);
  rebuildWeapon();
  weaponGroup.visible = false; // third-person: the character model is shown instead
}

function rebuildWeapon() {
  if (!weaponGroup) return;
  weaponGroup.clear();

  const data = CLASS_DATA[player.classId];
  const handMat = new THREE.MeshLambertMaterial({ color: 0x3b2d27, flatShading: true });
  const accentMat = new THREE.MeshLambertMaterial({
    color: data.accent,
    emissive: data.accent,
    emissiveIntensity: 0.9,
    flatShading: true,
  });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0xc9c6ba, flatShading: true });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6f4a30, flatShading: true });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.8), handMat);
  hand.position.set(0.38, -0.34, -0.7);
  hand.rotation.set(0.2, -0.2, 0);
  weaponGroup.add(hand);

  if (player.classId === "fighter") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 1.45), metalMat);
    blade.position.set(0.48, -0.24, -1.32);
    blade.rotation.set(-0.28, -0.08, 0.08);
    weaponGroup.add(blade);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.12), accentMat);
    shield.position.set(-0.44, -0.26, -0.82);
    shield.rotation.set(0.12, 0.34, -0.05);
    weaponGroup.add(shield);
  } else if (player.classId === "ranger") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.025, 6, 16, Math.PI * 1.3), woodMat);
    bow.position.set(0.45, -0.22, -1.02);
    bow.rotation.set(0.2, -0.3, 1.05);
    weaponGroup.add(bow);

    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 6), metalMat);
    arrow.position.set(0.16, -0.26, -1.0);
    arrow.rotation.x = Math.PI / 2;
    weaponGroup.add(arrow);
  } else if (player.classId === "priest") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.55, 6), woodMat);
    staff.position.set(0.48, -0.26, -1.03);
    staff.rotation.set(0.6, -0.2, 0.06);
    weaponGroup.add(staff);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), accentMat);
    crystal.position.set(0.24, -0.07, -1.64);
    weaponGroup.add(crystal);
  } else {
    const focus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), accentMat);
    focus.position.set(0.4, -0.24, -1.08);
    weaponGroup.add(focus);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.018, 8, 18),
      new THREE.MeshBasicMaterial({ color: data.accent })
    );
    ring.position.copy(focus.position);
    ring.rotation.set(0.6, 0.2, 0.1);
    weaponGroup.add(ring);
  }
}

function spawnEnemies() {
  const spots = [
    [-18, -18],
    [0, -27],
    [21, -18],
    [27, 4],
    [14, 24],
    [-12, 27],
    [-28, 8],
    [-25, -12],
    [35, -29],
    [-38, 32],
  ];

  spots.forEach((spot, index) => {
    const enemy = createEnemy(index, spot[0], spot[1]);
    enemies.push(enemy);
    scene.add(enemy.group);
  });
}

function createEnemy(index, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 1.45, 6), materials.enemy);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 0), materials.enemyHead);
  head.position.y = 2.05;
  head.castShadow = true;
  group.add(head);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.78, 0.13), materials.darkStone);
  blade.position.set(0.74, 1.25, -0.08);
  blade.rotation.z = -0.45;
  blade.castShadow = true;
  group.add(blade);

  const barGroup = new THREE.Group();
  barGroup.position.y = 2.75;
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x1b1e1f, transparent: true, opacity: 0.8 })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xe05245 })
  );
  fill.position.z = 0.01;
  barGroup.add(back, fill);
  group.add(barGroup);

  const char = makeCharInstance("skeleton");
  if (char) {
    group.add(char.root);
    body.visible = false;
    head.visible = false;
    blade.visible = false;
  }

  return {
    id: index,
    group,
    body,
    head,
    char,
    healthFill: fill,
    hp: 110,
    maxHp: 110,
    alive: true,
    radius: 0.78,
    speed: 2.1 + Math.random() * 0.45,
    attackCd: 0.5 + Math.random() * 0.8,
    respawn: 0,
    frozen: 0,
    silenced: 0,
    fear: 0,
    burn: 0,
    knock: new THREE.Vector3(),
    wander: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
    nextWander: 1.5 + Math.random() * 2,
    spawn: new THREE.Vector3(x, 0, z),
  };
}

function createRemotePlayer(id, state) {
  const group = new THREE.Group();
  const color = classColor(state.classId);
  const bodyMat = new THREE.MeshLambertMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.28,
    flatShading: true,
  });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd6d0be, flatShading: true });
  const trimMat = new THREE.MeshBasicMaterial({ color });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.34, 6), bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), headMat);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);

  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.025, 6, 18), trimMat);
  marker.position.y = 0.08;
  marker.rotation.x = Math.PI / 2;
  group.add(marker);

  const weapon = createRemoteWeapon(state.classId, color);
  group.add(weapon);

  const barGroup = new THREE.Group();
  barGroup.position.y = 2.48;
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x101415, transparent: true, opacity: 0.82 })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x6bd391 })
  );
  fill.position.z = 0.01;
  barGroup.add(back, fill);
  group.add(barGroup);

  const nameSprite = createNameSprite(displayRemoteName(state, id), state.bot);
  group.add(nameSprite);

  scene.add(group);

  const char = makeCharInstance(state.classId);
  if (char) {
    group.add(char.root);
    body.visible = false;
    head.visible = false;
    weapon.visible = false;
  }

  if (state.boss) {
    group.scale.setScalar(state.scale || 2.2); // bigger, menacing
    fill.material.color.set(0xe0594a); // red boss health bar
  }

  return {
    id,
    group,
    body,
    head,
    weapon,
    char,
    nameSprite,
    isBot: Boolean(state.bot),
    isBoss: Boolean(state.boss),
    displayName: displayRemoteName(state, id),
    classId: state.classId,
    healthFill: fill,
    target: new THREE.Vector3(),
    state,
    attackPulse: 0,
  };
}

function updateRemotePlayer(id, state) {
  if (!id || !state) return;
  let remote = remotePlayers.get(id);
  if (!remote) {
    remote = createRemotePlayer(id, state);
    remotePlayers.set(id, remote);
    addFeed(state.bot ? `${state.name || "Bot"} joined` : "Player joined", "Multiplayer");
  }

  remote.state = state;
  remote.isBot = Boolean(state.bot);
  remote.isBoss = Boolean(state.boss);
  const nextName = displayRemoteName(state, id);
  if (remote.displayName !== nextName) {
    updateNameSprite(remote, nextName);
  }
  remote.target.set(state.position.x, state.position.y - PLAYER_EYE_HEIGHT, state.position.z);
  if (remote.classId !== state.classId) {
    remote.group.remove(remote.weapon);
    remote.weapon = createRemoteWeapon(state.classId, classColor(state.classId));
    remote.group.add(remote.weapon);
    remote.classId = state.classId;
    if (remote.char) {
      remote.group.remove(remote.char.root);
      remote.char = makeCharInstance(state.classId);
      if (remote.char) remote.group.add(remote.char.root);
    }
  }

  // Upgrade a fallback box to a model once it finishes loading.
  if (!remote.char && modelCache.has(remote.classId)) {
    remote.char = makeCharInstance(remote.classId);
    if (remote.char) {
      remote.group.add(remote.char.root);
      remote.body.visible = false;
      remote.head.visible = false;
    }
  }

  remote.body.material.color.setHex(classColor(state.classId));
  remote.body.material.emissive.setHex(classColor(state.classId));
  remote.group.rotation.y = state.yaw ?? 0;
  remote.group.visible = !state.dead && (state.hp ?? 0) > 0;
  remote.weapon.visible = remote.group.visible && !remote.char;
  remote.weapon.position.z = state.shield ? -0.18 : 0;
  remote.weapon.rotation.x = state.chargingShot ? -0.35 : 0;
  const hpScale = clamp((state.hp ?? 0) / Math.max(1, state.maxHp ?? 1), 0, 1);
  remote.healthFill.scale.x = hpScale;
  remote.healthFill.position.x = -0.55 * (1 - hpScale);
}

function updateRemotePlayers(dt) {
  for (const remote of remotePlayers.values()) {
    remote.group.position.lerp(remote.target, 0.22);
    if (remote.char) {
      const moving = remote.group.position.distanceToSquared(remote.target) > 0.02;
      updateChar(remote.char, dt, moving);
    } else if (remote.attackPulse > 0) {
      remote.attackPulse = Math.max(0, remote.attackPulse - dt * 4.8);
      const swing = Math.sin(remote.attackPulse * Math.PI);
      remote.weapon.rotation.z = -swing * 0.68;
      remote.weapon.position.x = swing * 0.12;
    } else {
      remote.weapon.rotation.z *= Math.pow(0.02, dt);
      remote.weapon.position.x *= Math.pow(0.02, dt);
    }
    if (remote.hitPunch > 0) {
      remote.hitPunch = Math.max(0, remote.hitPunch - dt);
      const base = remote.isBoss ? remote.state?.scale || 2.2 : 1;
      remote.group.scale.setScalar(base * (1 + 0.2 * (remote.hitPunch / 0.12)));
    }
    remote.healthFill.parent.quaternion.copy(camera.quaternion);
    remote.nameSprite.quaternion.copy(camera.quaternion);
  }
}

function createRemoteWeapon(classId, color) {
  const weapon = new THREE.Group();
  weapon.position.set(0.58, 1.16, -0.06);

  const handMat = new THREE.MeshLambertMaterial({ color: 0xc6bda9, flatShading: true });
  const accentMat = new THREE.MeshBasicMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x252b2a, flatShading: true });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), handMat);
  hand.castShadow = true;
  weapon.add(hand);

  if (classId === "fighter") {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), darkMat);
    sword.position.set(0.12, 0.34, 0);
    sword.rotation.z = -0.2;
    sword.castShadow = true;
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.12), accentMat);
    shield.position.set(-0.3, 0.2, 0.08);
    shield.castShadow = true;
    weapon.add(sword, shield);
  } else if (classId === "ranger") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 6, 18, Math.PI), accentMat);
    bow.rotation.z = Math.PI / 2;
    bow.position.set(0.08, 0.22, 0);
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), darkMat);
    arrow.position.set(0.14, 0.18, -0.06);
    weapon.add(bow, arrow);
  } else if (classId === "priest") {
    const staff = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), darkMat);
    staff.position.set(0.12, 0.34, 0);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), accentMat);
    crystal.position.set(0.12, 0.86, 0);
    weapon.add(staff, crystal);
  } else {
    const focus = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 18), accentMat);
    focus.position.set(0.14, 0.28, 0);
    focus.rotation.x = Math.PI / 2;
    const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), accentMat);
    shard.position.set(0.14, 0.28, 0);
    weapon.add(focus, shard);
  }

  return weapon;
}

function displayRemoteName(state, id) {
  if (state?.name) return state.name;
  if (state?.bot) return "Bot";
  return `Player ${String(id).slice(0, 4)}`;
}

function createNameSprite(name, isBot = false) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeNameTexture(name, isBot),
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.position.y = 2.92;
  sprite.scale.set(2.4, 0.62, 1);
  return sprite;
}

function updateNameSprite(remote, name) {
  remote.displayName = name;
  const oldMap = remote.nameSprite.material.map;
  remote.nameSprite.material.map = makeNameTexture(name, remote.isBot);
  remote.nameSprite.material.needsUpdate = true;
  oldMap?.dispose?.();
}

function makeNameTexture(name, isBot = false) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext("2d");
  context.clearRect(0, 0, 256, 64);
  context.fillStyle = isBot ? "rgba(31, 36, 34, 0.72)" : "rgba(12, 16, 16, 0.78)";
  roundRect(context, 16, 12, 224, 40, 8);
  context.fill();
  context.strokeStyle = isBot ? "rgba(107, 211, 145, 0.46)" : "rgba(225, 181, 96, 0.55)";
  context.stroke();
  context.font = "800 22px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#eef2f0";
  context.fillText(String(name).slice(0, 18), 128, 33, 198);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function setObjectOpacity(object, opacity) {
  object.traverse((child) => {
    if (!child.material || typeof child.material.opacity !== "number") return;
    child.material.transparent = true;
    child.material.opacity = opacity;
  });
}

function removeRemotePlayer(id) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  scene.remove(remote.group);
  remote.nameSprite?.material?.map?.dispose?.();
  remote.nameSprite?.material?.dispose?.();
  remotePlayers.delete(id);
  addFeed("Player left", "Multiplayer");
}

function classColor(classId) {
  return CLASS_DATA[classId]?.accent ?? 0xd6d0be;
}

function bindEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("pointerdown", unlockAudio, { capture: true });

  canvas.addEventListener("click", () => {
    unlockAudio();
    if (isTouch) {
      if (!controlsLocked) startMobileArena();
    } else {
      requestArenaPointerLock();
    }
  });

  ui.enterArena.addEventListener("click", () => {
    unlockAudio();
    commitPlayerName();
    if (isTouch) startMobileArena();
    else requestArenaPointerLock();
  });

  ui.nickInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.code === "Enter") {
      event.preventDefault();
      ui.enterArena.click();
    }
  });

  ui.lightingButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightingMode(button.dataset.lightMode);
    });
  });

  ui.lightLevel.addEventListener("input", (event) => {
    setLightingLevel(Number(event.target.value) / 100);
  });

  // Isometric: no pointer lock. Track the cursor in NDC for ground-aim raycasting.
  document.addEventListener("mousemove", (event) => {
    aimNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
    aimNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("mousedown", (event) => {
    if (!controlsLocked || settingsOpen) return;
    if (event.target && event.target.closest && event.target.closest(".hud, .menu-screen, .lock-panel, button"))
      return; // let UI clicks through
    unlockAudio();
    if (event.button === 0) usePrimary();
    if (event.button === 2) useSecondaryDown();
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 2) useSecondaryUp();
  });

  window.addEventListener("keydown", (event) => {
    unlockAudio();
    if (event.code === "Tab") {
      event.preventDefault();
      input.scoreboard = true;
      updateScoreboardHud();
      return;
    }

    if (document.activeElement === ui.nickInput) return;

    if (event.code === "Escape") {
      // Desktop: pointer lock makes the gear unclickable, so Escape toggles settings.
      if (settingsOpen) closeSettings();
      else if (controlsLocked) openSettings();
      return;
    }

    switch (event.code) {
      case "KeyW":
        input.forward = true;
        break;
      case "KeyS":
        input.back = true;
        break;
      case "KeyA":
        input.left = true;
        break;
      case "KeyD":
        input.right = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        input.sprint = true;
        break;
      case "Space":
        input.jump = true;
        break;
      case "Digit1":
        selectClass("fighter");
        break;
      case "Digit2":
        selectClass("priest");
        break;
      case "Digit3":
        selectClass("ranger");
        break;
      case "Digit4":
        selectClass("witch");
        break;
      case "KeyQ":
        useAbility("q");
        break;
      case "KeyE":
        useAbility("e");
        break;
      case "KeyR":
        useAbility("r");
        break;
      default:
        break;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Tab") {
      event.preventDefault();
      input.scoreboard = false;
      updateScoreboardHud();
      return;
    }

    switch (event.code) {
      case "KeyW":
        input.forward = false;
        break;
      case "KeyS":
        input.back = false;
        break;
      case "KeyA":
        input.left = false;
        break;
      case "KeyD":
        input.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        input.sprint = false;
        break;
      case "Space":
        input.jump = false;
        break;
      default:
        break;
    }
  });

  ui.classButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectClass(button.dataset.class);
      canvas.focus();
    });
  });
}

// Isometric has no pointer lock — entering the arena just resumes input + starts the match.
function requestArenaPointerLock() {
  startMobileArena();
}

function startMobileArena() {
  controlsLocked = true;
  ui.lockPanel.classList.add("hidden");
  document.body.classList.add("playing");
  stopPreview();
  if (!matchStarted) {
    matchStarted = true;
    commitPlayerName();
    addFeed("Match started", "Arena");
    sendMultiplayerState(true);
  }
}

function setupMobileControls() {
  if (!isTouch) return;
  document.body.classList.add("touch");

  const lookZone = document.querySelector("#mobile-look .look-zone");
  const joyZone = document.querySelector("#mobile-look .joystick-zone");
  const joyBase = document.querySelector("#mobile-look .joystick-base");
  const joyKnob = document.querySelector("#mobile-look .joystick-knob");
  if (!lookZone || !joyZone) return;

  let lookId = null;
  let lookX = 0;
  let lookY = 0;
  lookZone.addEventListener(
    "touchstart",
    (event) => {
      if (lookId !== null) return;
      const t = event.changedTouches[0];
      lookId = t.identifier;
      lookX = t.clientX;
      lookY = t.clientY;
      event.preventDefault();
    },
    { passive: false }
  );
  lookZone.addEventListener(
    "touchmove",
    (event) => {
      // Isometric: camera is fixed; aim follows movement direction (handled in updateAim).
      for (const t of event.changedTouches) {
        if (t.identifier !== lookId) continue;
      }
      event.preventDefault();
    },
    { passive: false }
  );
  const endLook = (event) => {
    for (const t of event.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookZone.addEventListener("touchend", endLook);
  lookZone.addEventListener("touchcancel", endLook);

  const radius = 56;
  let joyId = null;
  let joyOx = 0;
  let joyOy = 0;
  joyZone.addEventListener(
    "touchstart",
    (event) => {
      if (joyId !== null) return;
      const t = event.changedTouches[0];
      joyId = t.identifier;
      joyOx = t.clientX;
      joyOy = t.clientY;
      joyBase.style.left = `${joyOx}px`;
      joyBase.style.top = `${joyOy}px`;
      joyBase.classList.add("visible");
      joyKnob.style.transform = "translate(-50%, -50%)";
      touchMove.active = true;
      touchMove.x = 0;
      touchMove.y = 0;
      event.preventDefault();
    },
    { passive: false }
  );
  joyZone.addEventListener(
    "touchmove",
    (event) => {
      for (const t of event.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - joyOx;
        let dy = t.clientY - joyOy;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) {
          dx = (dx / dist) * radius;
          dy = (dy / dist) * radius;
        }
        touchMove.x = dx / radius;
        touchMove.y = dy / radius;
        input.sprint = Math.hypot(touchMove.x, touchMove.y) > 0.82;
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      event.preventDefault();
    },
    { passive: false }
  );
  const endJoy = (event) => {
    for (const t of event.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      touchMove.active = false;
      touchMove.x = 0;
      touchMove.y = 0;
      input.sprint = false;
      joyBase.classList.remove("visible");
    }
  };
  joyZone.addEventListener("touchend", endJoy);
  joyZone.addEventListener("touchcancel", endJoy);

  document.querySelectorAll("#mobile-actions .mobile-btn").forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener(
      "touchstart",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        unlockAudio();
        handleMobileAction(action, true, btn);
      },
      { passive: false }
    );
    btn.addEventListener(
      "touchend",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleMobileAction(action, false, btn);
      },
      { passive: false }
    );
  });

  if (ui.classToggle && ui.classHud) {
    ui.classToggle.addEventListener("click", () => {
      ui.classHud.classList.toggle("open");
    });
  }
}

function handleMobileAction(action, pressed, btn) {
  switch (action) {
    case "primary":
      if (pressed) usePrimary();
      break;
    case "secondary":
      if (pressed) useSecondaryDown();
      else useSecondaryUp();
      break;
    case "q":
    case "e":
    case "r":
      if (pressed) useAbility(action);
      break;
    case "jump":
      if (pressed) input.jump = true;
      break;
    case "sprint":
      if (pressed) {
        input.sprint = !input.sprint;
        btn?.classList.toggle("active", input.sprint);
      }
      break;
    default:
      break;
  }
}

function selectClass(classId) {
  if (!CLASS_DATA[classId]) return;
  player.classId = classId;
  const data = CLASS_DATA[classId];
  player.maxHp = data.hp + mods.maxHpBonus;
  player.hp = player.maxHp;
  player.maxResource = resourceDef(classId)?.max ?? DEFAULT_RESOURCE_MAX;
  player.resource = player.maxResource;
  updateResourceHud();
  player.shield = false;
  player.chargingShot = false;
  player.chargeRush = 0;
  player.chargeHits.clear();
  Object.keys(cooldowns).forEach((slot) => {
    cooldowns[slot] = 0;
  });

  ui.classButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.class === classId);
  });

  ui.className.textContent = data.name;
  ui.abilityNames.primary.textContent = data.primary;
  ui.abilityNames.secondary.textContent = data.secondary;
  ui.abilityNames.q.textContent = data.q;
  ui.abilityNames.e.textContent = data.e;
  ui.abilityNames.r.textContent = data.r;

  rebuildWeapon();
  rebuildLocalPlayerModel();
  updateHud();
  sendMultiplayerState(true);
  playSound("class");
  addFeed(`${data.name} selected`, "Loadout");

  if (isTouch) {
    if (ui.classToggleLabel) ui.classToggleLabel.textContent = data.name;
    if (ui.classHud) ui.classHud.classList.remove("open");
  }

  if (ui.startHeroName) ui.startHeroName.textContent = data.name;
  if (ui.startHeroInfo) ui.startHeroInfo.textContent = `${data.hp} HP · ${data.primary}`;
  ui.startCards.forEach((card) => card.classList.toggle("active", card.dataset.class === classId));
  if (previewActive) setPreviewClass(classId);
}

function setupPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34, // strength — subtle glow, not blown out
    0.5, // radius
    0.82 // threshold — only torches / emissive surfaces bloom
  );
  composer.addPass(bloom);
}

function setupCharacterPreview() {
  if (!ui.previewCanvas) return;
  previewRenderer = new THREE.WebGLRenderer({ canvas: ui.previewCanvas, alpha: true, antialias: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  previewCamera.position.set(0, 1.0, 3.1);
  previewCamera.lookAt(0, 0.95, 0);

  previewScene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1d1d22, 1.15));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.7);
  key.position.set(2.5, 4, 3);
  previewScene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.85);
  rim.position.set(-3, 2.2, -2.5);
  previewScene.add(rim);

  resizePreview();

  ui.startCards.forEach((card) => {
    card.addEventListener("click", () => selectClass(card.dataset.class));
  });
}

function resizePreview() {
  if (!previewRenderer || !ui.previewCanvas) return;
  const w = ui.previewCanvas.clientWidth || 320;
  const h = ui.previewCanvas.clientHeight || 190;
  previewRenderer.setSize(w, h, false);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}

function setPreviewClass(classId) {
  if (!previewScene) return;
  if (previewModel) {
    previewScene.remove(previewModel);
    previewModel = null;
    previewMixer = null;
  }
  const gltf = modelCache.get(classId);
  if (!gltf) return; // retried once models finish loading
  const root = cloneSkeleton(gltf.scene);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0.001 ? 1.9 / size.y : 1;
  root.scale.setScalar(scale);
  root.position.y = 0; // KayKit origin is at the feet
  root.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });
  previewScene.add(root);
  previewModel = root;
  previewMixer = new THREE.AnimationMixer(root);
  const idle = (gltf.animations || []).find((c) => c.name === "Idle");
  if (idle) previewMixer.clipAction(idle).play();
}

function updatePreview(dt) {
  if (!previewActive || !previewRenderer) return;
  if (!ui.lockPanel || ui.lockPanel.classList.contains("hidden")) return; // only on hero-select
  if (previewModel) previewModel.rotation.y += dt * 0.6;
  if (previewMixer) previewMixer.update(dt);
  previewRenderer.render(previewScene, previewCamera);
}

function stopPreview() {
  previewActive = false;
}

let mainMenuShown = false;

function setLoadingProgress(frac) {
  const pct = Math.round(clamp(frac, 0, 1) * 100);
  if (ui.loadingBar) ui.loadingBar.style.width = `${pct}%`;
  if (ui.loadingPct) ui.loadingPct.textContent = `Loading… ${pct}%`;
}

function revealMainMenu() {
  if (mainMenuShown) return;
  mainMenuShown = true;
  setLoadingProgress(1);
  ui.loadingScreen?.classList.add("hidden");
  ui.mainMenu?.classList.remove("hidden");
}

function showHeroSelect() {
  ui.mainMenu?.classList.add("hidden");
  ui.leaderboardScreen?.classList.add("hidden");
  ui.lockPanel?.classList.remove("hidden");
}

function showMainMenu() {
  ui.lockPanel?.classList.add("hidden");
  ui.leaderboardScreen?.classList.add("hidden");
  ui.mainMenu?.classList.remove("hidden");
}

function showLeaderboard() {
  ui.mainMenu?.classList.add("hidden");
  ui.leaderboardScreen?.classList.remove("hidden");
}

function setupMenus() {
  document.querySelectorAll(".map-button[data-map]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.map === MAP_ID);
    btn.addEventListener("click", () => {
      if (btn.dataset.map === MAP_ID) return;
      const params = new URLSearchParams(window.location.search);
      if (btn.dataset.map === "castle") params.delete("map");
      else params.set("map", btn.dataset.map);
      window.location.search = params.toString(); // reload into the chosen map
    });
  });

  document.querySelectorAll(".mode-button[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === MODE);
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === MODE) return;
      const params = new URLSearchParams(window.location.search);
      if (btn.dataset.mode === "pve") params.delete("mode");
      else params.set("mode", btn.dataset.mode);
      window.location.search = params.toString(); // reload into the chosen mode
    });
  });

  ui.menuPlay?.addEventListener("click", showHeroSelect);
  ui.menuLeaderboard?.addEventListener("click", showLeaderboard);
  ui.lbBack?.addEventListener("click", showMainMenu);
  ui.heroBack?.addEventListener("click", showMainMenu);

  ui.settingsBtn?.addEventListener("click", openSettings);
  ui.settingsClose?.addEventListener("click", closeSettings);

  // Safety: if asset loading stalls, reveal the menu anyway.
  setTimeout(revealMainMenu, 12000);
}

let settingsOpen = false;

let resumeAfterSettings = false;

function openSettings() {
  if (!ui.settingsPanel) return;
  settingsOpen = true;
  ui.settingsPanel.classList.remove("hidden");
  resumeAfterSettings = controlsLocked;
  controlsLocked = false; // pause input while the panel is open
}

function closeSettings() {
  settingsOpen = false;
  ui.settingsPanel?.classList.add("hidden");
  if (resumeAfterSettings) controlsLocked = true; // resume if we were playing
  resumeAfterSettings = false;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  if (composer) composer.render();
  else renderer.render(scene, camera);
  updatePreview(dt);
  requestAnimationFrame(tick);
}

function update(dt) {
  const cdRate = 1 + mods.cdrBonus;
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, cooldowns[key] - dt * cdRate);
  }

  if (RESOURCE_ENABLED && player.resource < player.maxResource) {
    const regen = resourceDef()?.regen ?? 6;
    player.resource = Math.min(player.maxResource, player.resource + regen * dt);
  }
  updatePotions(dt);

  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (camShake > 0) camShake = Math.max(0, camShake - dt * 2.6);
  if (lastHitFlash > 0) {
    lastHitFlash -= dt;
    if (lastHitFlash <= 0) ui.vignette.classList.remove("active");
  }

  updatePlayer(dt);
  updateCamera();
  if (controlsLocked) updateAim();
  updateLocalPlayerModel(dt);
  updateWeapon(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateZones(dt);
  updateEffects(dt);
  updateTorchLights();
  updateRemotePlayers(dt);
  sendMultiplayerState();
  updateFloatingMessages(dt);
  updateMinimap(dt);
  updateHud();
}

function updateTorchLights() {
  const time = performance.now() * 0.001;
  for (const torch of torches) {
    const flicker = 0.88 + Math.sin(time * 7.4 + torch.phase) * 0.09 + Math.sin(time * 16.2 + torch.phase * 1.7) * 0.05;
    const clamped = clamp(flicker, 0.72, 1.08);
    const power = lightingState.torchPower ?? 1;
    torch.light.intensity = torch.baseIntensity * power * clamped;
    torch.flame.scale.setScalar(0.82 + clamped * 0.16);
    torch.glow.scale.setScalar(0.86 + clamped * 0.3);
    torch.glow.material.opacity = clamp((0.05 + clamped * 0.05) * power, 0.02, 0.13);
  }
}

function updatePlayer(dt) {
  if (player.deadTimer > 0) {
    player.deadTimer -= dt;
    if (player.deadTimer <= 0) respawnPlayer();
    return;
  }

  if (!controlsLocked) return;

  const classData = CLASS_DATA[player.classId];
  // Isometric: movement is screen-relative (camera-fixed), independent of facing/aim.
  const forward = SCREEN_FWD;
  const right = SCREEN_RIGHT;
  const wish = new THREE.Vector3();
  if (input.forward) wish.add(forward);
  if (input.back) wish.sub(forward);
  if (input.right) wish.add(right);
  if (input.left) wish.sub(right);
  if (touchMove.active) {
    wish.add(forward.clone().multiplyScalar(-touchMove.y));
    wish.add(right.clone().multiplyScalar(touchMove.x));
  }
  if (wish.lengthSq() > 1) wish.normalize();

  let speed = (classData.speed + (input.sprint ? 1.2 : 0)) * mods.speedMult;
  if (player.shield) speed *= 0.54;
  if (player.chargingShot) speed *= 0.72;
  if (player.chargeRush > 0) {
    speed = 18.8;
    wish.copy(getFlatForward()); // charge toward the aim/facing direction
    player.chargeRush -= dt;
    checkChargeHits();
  }

  player.velocity.x = wish.x * speed;
  player.velocity.z = wish.z * speed;
  updateFootsteps(dt, wish.lengthSq() > 0.01, input.sprint || player.chargeRush > 0);

  const currentFootY = player.position.y - PLAYER_EYE_HEIGHT;
  const currentGroundY = getWalkHeight(player.position.x, player.position.z, currentFootY, PLAYER_STEP_HEIGHT);
  const grounded = currentFootY <= currentGroundY + 0.08 && player.velocity.y <= 0.2;

  if (input.jump && grounded) {
    player.velocity.y = 6.2;
  }
  input.jump = false;

  player.velocity.y -= 18 * dt;
  movePlayerWithCollision(dt, currentFootY, grounded);
}

function movePlayerWithCollision(dt, startFootY, grounded) {
  const dx = player.velocity.x * dt;
  const dz = player.velocity.z * dt;

  if (dx !== 0) {
    const previousX = player.position.x;
    player.position.x = clamp(player.position.x + dx, -47, 47);
    if (collidesWithWorld(player.position)) {
      player.position.x = previousX;
      player.velocity.x = 0;
    }
  }

  if (dz !== 0) {
    const previousZ = player.position.z;
    player.position.z = clamp(player.position.z + dz, -47, 47);
    if (collidesWithWorld(player.position)) {
      player.position.z = previousZ;
      player.velocity.z = 0;
    }
  }

  let footY = startFootY + player.velocity.y * dt;
  const step = grounded ? PLAYER_STEP_HEIGHT : Math.max(PLAYER_STEP_HEIGHT, Math.abs(player.velocity.y * dt) + 0.1);
  const groundY = getWalkHeight(player.position.x, player.position.z, startFootY, step);
  const canSnapUp = grounded && groundY <= startFootY + PLAYER_STEP_HEIGHT;
  const fallingOntoSurface = player.velocity.y <= 0 && startFootY >= groundY - 0.05;

  if ((canSnapUp && player.velocity.y <= 0) || (fallingOntoSurface && footY <= groundY)) {
    footY = groundY;
    player.velocity.y = 0;
  }

  if (footY < 0) {
    footY = 0;
    player.velocity.y = 0;
  }

  player.position.y = footY + PLAYER_EYE_HEIGHT;
}

function movePlayerByVector(vector) {
  const steps = Math.max(1, Math.ceil(vector.length() / 0.35));
  const step = vector.clone().multiplyScalar(1 / steps);
  for (let i = 0; i < steps; i++) {
    const previousX = player.position.x;
    player.position.x = clamp(player.position.x + step.x, -47, 47);
    if (collidesWithWorld(player.position)) player.position.x = previousX;

    const previousZ = player.position.z;
    player.position.z = clamp(player.position.z + step.z, -47, 47);
    if (collidesWithWorld(player.position)) player.position.z = previousZ;
  }
}

function collidesWithWorld(position) {
  const footY = position.y - PLAYER_EYE_HEIGHT;
  const headY = position.y;
  for (const collider of worldColliders) {
    if (headY < collider.minY || footY > collider.maxY) continue;
    if (collider.type === "box") {
      if (
        position.x > collider.minX - PLAYER_RADIUS &&
        position.x < collider.maxX + PLAYER_RADIUS &&
        position.z > collider.minZ - PLAYER_RADIUS &&
        position.z < collider.maxZ + PLAYER_RADIUS
      ) {
        return true;
      }
    } else if (collider.type === "circle") {
      const distance = horizontalDistance(position, collider);
      if (distance < collider.radius + PLAYER_RADIUS) return true;
    }
  }

  return false;
}

function getWalkHeight(x, z, referenceFootY = 0, stepHeight = PLAYER_STEP_HEIGHT) {
  let best = 0;
  for (const surface of walkSurfaces) {
    if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) continue;
    const height = surface.type === "ramp" ? rampHeightAt(surface, z) : surface.height;
    if (height <= referenceFootY + stepHeight && height > best) best = height;
  }
  return best;
}

function rampHeightAt(surface, z) {
  const t = clamp((z - surface.minZ) / Math.max(0.001, surface.maxZ - surface.minZ), 0, 1);
  const highT = surface.highAtMinZ ? 1 - t : t;
  return surface.lowHeight + (surface.highHeight - surface.lowHeight) * highT;
}

function updateFootsteps(dt, moving, fast) {
  const footY = player.position.y - PLAYER_EYE_HEIGHT;
  const groundY = getWalkHeight(player.position.x, player.position.z, footY, PLAYER_STEP_HEIGHT);
  if (!moving || footY > groundY + 0.08) {
    footstepTimer = Math.min(footstepTimer, 0.08);
    return;
  }

  footstepTimer -= dt;
  if (footstepTimer <= 0) {
    playSound("step");
    footstepTimer = fast ? 0.24 : 0.34;
  }
}

function updateCamera() {
  // Fixed isometric (ARPG) camera: hover above/behind the player, look down at them.
  const focus = player.position.clone();
  focus.y += ISO_FOCUS_Y;
  camera.position.copy(focus).add(ISO_OFFSET);
  if (camShake > 0.0005) {
    camera.position.x += (Math.random() - 0.5) * camShake;
    camera.position.y += (Math.random() - 0.5) * camShake;
    camera.position.z += (Math.random() - 0.5) * camShake;
  }
  camera.lookAt(focus);
  camera.updateMatrixWorld();
}

// True if a wall/pillar collider occupies this point (camera-sized margin).
function cameraPointBlocked(p) {
  const margin = 0.3;
  for (const c of worldColliders) {
    if (p.y < c.minY || p.y > c.maxY) continue;
    if (c.type === "box") {
      if (p.x > c.minX - margin && p.x < c.maxX + margin && p.z > c.minZ - margin && p.z < c.maxZ + margin) {
        return true;
      }
    } else if (c.type === "circle") {
      if (horizontalDistance(p, c) < c.radius + margin) return true;
    }
  }
  return false;
}

// Pull the camera in toward the focus if a wall sits between them, so it never clips behind geometry.
function resolveCameraCollision(focus, desired) {
  const toCam = desired.clone().sub(focus);
  const maxDist = toCam.length();
  if (maxDist < 0.001) return desired;
  toCam.multiplyScalar(1 / maxDist);
  const steps = 16;
  const buffer = 0.35;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * maxDist;
    if (cameraPointBlocked(focus.clone().addScaledVector(toCam, t))) {
      const safe = Math.max(0.6, t - buffer);
      return focus.clone().addScaledVector(toCam, safe);
    }
  }
  return desired;
}

function updateLocalPlayerModel(dt) {
  if (!localChar && modelCache.has(player.classId)) {
    localChar = makeCharInstance(player.classId);
    if (localChar) scene.add(localChar.root);
  }
  if (!localChar) return;
  const visible = controlsLocked && player.deadTimer <= 0;
  localChar.root.visible = visible;
  if (!visible) return;
  localChar.root.position.set(
    player.position.x,
    player.position.y - PLAYER_EYE_HEIGHT + localChar.footOffset,
    player.position.z
  );
  localChar.root.rotation.y = yaw + MODEL_FACING_YAW;
  const moving =
    input.forward || input.back || input.left || input.right || touchMove.active;
  updateChar(localChar, dt, moving);
}

function rebuildLocalPlayerModel() {
  if (localChar) {
    scene.remove(localChar.root);
    localChar = null;
  }
  const next = makeCharInstance(player.classId);
  if (next) {
    scene.add(next.root);
    localChar = next;
  }
}

function updateWeapon(dt) {
  if (!weaponGroup) return;
  weaponState += dt;
  const walkBob = input.forward || input.back || input.left || input.right ? Math.sin(weaponState * 11) * 0.025 : 0;
  weaponGroup.position.set(0, walkBob, 0);
  weaponGroup.rotation.z = Math.sin(weaponState * 4.5) * 0.012;

  if (player.shield) {
    weaponGroup.position.x = -0.08;
    weaponGroup.position.z = -0.13;
  }

  if (player.chargingShot) {
    player.chargeTime = Math.min(1.25, (performance.now() - player.chargeStartedAt) / 1000);
    weaponGroup.position.z = 0.08 - player.chargeTime * 0.08;
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    if (p.spin) p.mesh.rotation[p.spin.axis] += p.spin.speed * dt;

    const groundHit = p.mesh.position.y <= 0.25 && p.velocity.y < 0;
    let hit = false;

    if (p.hitEnemies) {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const distance = horizontalDistance(p.mesh.position, enemy.group.position);
        const vertical = Math.abs(p.mesh.position.y - 1.2);
        if (distance < enemy.radius + p.radius && vertical < 1.8) {
          hitEnemy(enemy, p.damage, p.label, p.color, p.extra);
          hit = true;
          if (p.aoe > 0) damageArea(p.mesh.position, p.aoe, p.splashDamage ?? p.damage, p.label, p.color, p.extra);
          break;
        }
      }

      if (!hit) {
        for (const remote of remotePlayers.values()) {
          if (!isRemoteAlive(remote)) continue;
          const distance = horizontalDistance(p.mesh.position, remote.group.position);
          const vertical = Math.abs(p.mesh.position.y - (remote.group.position.y + 1.2));
          if (distance < 0.74 + p.radius && vertical < 1.8) {
            hitRemotePlayer(remote, p.damage, p.label, p.color, p.extra);
            hit = true;
            if (p.aoe > 0) damageArea(p.mesh.position, p.aoe, p.splashDamage ?? p.damage, p.label, p.color, p.extra);
            break;
          }
        }
      }
    }

    if (groundHit && p.aoe > 0) {
      damageArea(p.mesh.position, p.aoe, p.splashDamage ?? p.damage, p.label, p.color, p.extra);
      makeGroundRing(p.mesh.position, p.aoe, p.color, 0.55);
      hit = true;
    }

    if (p.life <= 0 || hit || isOutsideArena(p.mesh.position)) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  if (isMultiplayerActive()) {
    syncEnemyVisibility();
    return;
  }

  for (const enemy of enemies) {
    if (!enemy.alive) {
      if (controlsLocked) {
        enemy.respawn -= dt;
        if (enemy.respawn <= 0) respawnEnemy(enemy);
      }
      continue;
    }

    if (!controlsLocked) {
      enemy.healthFill.parent.quaternion.copy(camera.quaternion);
      continue;
    }

    if (enemy.hitPunch > 0) {
      enemy.hitPunch = Math.max(0, enemy.hitPunch - dt);
      enemy.group.scale.setScalar(1 + 0.2 * (enemy.hitPunch / 0.12));
    }
    enemy.frozen = Math.max(0, enemy.frozen - dt);
    enemy.silenced = Math.max(0, enemy.silenced - dt);
    enemy.fear = Math.max(0, enemy.fear - dt);
    enemy.attackCd = Math.max(0, enemy.attackCd - dt);

    if (!enemy.char && modelCache.has("skeleton")) {
      enemy.char = makeCharInstance("skeleton");
      if (enemy.char) {
        enemy.group.add(enemy.char.root);
        enemy.body.visible = false;
        enemy.head.visible = false;
      }
    }
    let enemyMoving = false;

    if (enemy.burn > 0) {
      enemy.burn -= dt;
      hitEnemy(enemy, 5 * dt, "Burn", 0xf26f45, { quiet: true });
    }

    const toPlayer = tmpVec.copy(player.position).sub(enemy.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    // Patrol until the player comes within range, then chase (with brief memory).
    if (distance <= ENEMY_AGGRO_RANGE) enemy.aggroUntil = performance.now() + 3000;
    const engaged = performance.now() < (enemy.aggroUntil || 0);

    if (enemy.frozen <= 0) {
      let move = tmpVec2.set(0, 0, 0);
      if (enemy.fear > 0 && distance > 0.01) {
        move.copy(toPlayer).normalize().multiplyScalar(-1);
      } else if (engaged && distance > 2.2) {
        move.copy(toPlayer).normalize();
      } else {
        enemy.nextWander -= dt;
        if (enemy.nextWander <= 0) {
          enemy.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          enemy.nextWander = 1.2 + Math.random() * 2.5;
        }
        // Patrol near spawn: steer back if it drifted too far.
        const home = enemy.spawn;
        if (home && enemy.group.position.distanceTo(home) > 10) {
          move.copy(home).sub(enemy.group.position).setY(0).normalize();
        } else {
          move.copy(enemy.wander);
        }
      }

      enemy.group.position.addScaledVector(move, enemy.speed * dt);
      enemy.group.position.addScaledVector(enemy.knock, dt);
      enemy.knock.multiplyScalar(Math.pow(0.05, dt));
      enemy.group.position.x = clamp(enemy.group.position.x, -ENEMY_BOUND_X, ENEMY_BOUND_X);
      enemy.group.position.z = clamp(enemy.group.position.z, -ENEMY_BOUND_Z, ENEMY_BOUND_Z);

      if (move.lengthSq() > 0.01) {
        enemy.group.rotation.y = Math.atan2(move.x, move.z);
        enemyMoving = true;
      }
    }

    if (distance < 2.25 && enemy.attackCd <= 0 && player.deadTimer <= 0) {
      enemy.attackCd = 1.05 + Math.random() * 0.25;
      damagePlayer(9, enemy);
      if (enemy.char) triggerCharAttack(enemy.char);
    }

    if (enemy.char) updateChar(enemy.char, dt, enemyMoving);

    enemy.healthFill.scale.x = clamp(enemy.hp / enemy.maxHp, 0, 1);
    enemy.healthFill.position.x = -0.625 * (1 - enemy.healthFill.scale.x);
    enemy.healthFill.parent.quaternion.copy(camera.quaternion);

    if (enemy.frozen > 0) {
      enemy.body.material = materials.enemyFrozen;
      enemy.head.material = materials.enemyFrozen;
    } else if (enemy.silenced > 0) {
      enemy.body.material = materials.enemySilenced;
      enemy.head.material = materials.enemyHead;
    } else {
      enemy.body.material = materials.enemy;
      enemy.head.material = materials.enemyHead;
    }
  }
}

function updateZones(dt) {
  for (let i = timedZones.length - 1; i >= 0; i--) {
    const zone = timedZones[i];
    zone.life -= dt;
    zone.tick -= dt;

    if (zone.tick <= 0) {
      zone.tick = zone.rate;
      zone.onTick(zone);
    }

    if (zone.mesh) {
      const t = 1 - zone.life / zone.maxLife;
      zone.mesh.material.opacity = Math.max(0, zone.opacity * (1 - t * 0.7));
      zone.mesh.rotation.z += dt * zone.spin;
    }

    if (zone.life <= 0) {
      if (zone.mesh) scene.remove(zone.mesh);
      timedZones.splice(i, 1);
    }
  }

  for (let i = blockers.length - 1; i >= 0; i--) {
    const blocker = blockers[i];
    blocker.life -= dt;
    blocker.mesh.material.opacity = Math.max(0, blocker.life / blocker.maxLife * 0.64);
    if (blocker.life <= 0) {
      scene.remove(blocker.mesh);
      blockers.splice(i, 1);
    }
  }
}

function isMultiplayerActive() {
  return multiplayer.status === "online" || multiplayer.status === "connecting";
}

function syncEnemyVisibility() {
  const enabled = !isMultiplayerActive();
  for (const enemy of enemies) {
    enemy.group.visible = enabled && enemy.alive;
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.life -= dt;
    const progress = 1 - effect.life / effect.maxLife;
    if (effect.update) effect.update(effect, progress, dt);
    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      effects.splice(i, 1);
    }
  }
}

function updateFloatingMessages(dt) {
  for (let i = floatingMessages.length - 1; i >= 0; i--) {
    const msg = floatingMessages[i];
    msg.life -= dt;
    msg.mesh.position.y += dt * 1.2;
    msg.mesh.material.opacity = Math.max(0, msg.life / msg.maxLife);
    msg.mesh.quaternion.copy(camera.quaternion);
    if (msg.life <= 0) {
      scene.remove(msg.mesh);
      floatingMessages.splice(i, 1);
    }
  }
}

function usePrimary() {
  if (player.deadTimer > 0 || cooldowns.primary > 0 || matchState.status === "ended") return;
  if (!spendResource("primary")) return;
  const classId = player.classId;

  if (classId === "fighter") {
    cooldowns.primary = 0.46;
    playSound("slash");
    sendMultiplayerAttack("primary", "Slash", 0xe0a34f);
    swingWeapon(0.38);
    meleeCone({
      range: 3.2,
      angle: 0.68,
      damage: 34,
      label: "Slash",
      color: 0xe0a34f,
    });
  } else if (classId === "priest") {
    cooldowns.primary = 0.72;
    playSound("fire");
    sendMultiplayerAttack("primary", "Fireball", 0xf26f45);
    spawnProjectile({
      label: "Fireball",
      color: 0xf26f45,
      speed: 24,
      damage: 36,
      radius: 0.55,
      aoe: 2.4,
      splashDamage: 18,
      gravity: 0,
      shape: "sphere",
      extra: { burn: 1.4 },
    });
  } else if (classId === "ranger") {
    cooldowns.primary = 0.55;
    playSound("arrow");
    sendMultiplayerAttack("primary", "Arrow", 0x7fcf79);
    spawnProjectile({
      label: "Arrow",
      color: 0x7fcf79,
      speed: 42,
      damage: 42,
      radius: 0.34,
      gravity: 0,
      shape: "arrow",
    });
  } else {
    cooldowns.primary = 0.62;
    playSound("witch");
    sendMultiplayerAttack("primary", "Sound Wave", 0xb77ce8);
    spawnProjectile({
      label: "Sound Wave",
      color: 0xb77ce8,
      speed: 30,
      damage: 28,
      radius: 0.76,
      gravity: 0,
      shape: "wave",
      extra: { knock: 5 },
    });
  }
}

function useSecondaryDown() {
  if (player.deadTimer > 0 || matchState.status === "ended") return;
  if (player.classId === "fighter") {
    player.shield = true;
    playSound("shield-up");
    sendMultiplayerState(true);
    return;
  }

  if (player.classId === "ranger") {
    if (cooldowns.secondary > 0 || player.chargingShot) return;
    if (!spendResource("secondary")) return;
    player.chargingShot = true;
    player.chargeStartedAt = performance.now();
    playSound("charge-arrow");
    sendMultiplayerState(true);
    return;
  }

  if (cooldowns.secondary > 0) return;
  if (!spendResource("secondary")) return;

  if (player.classId === "priest") {
    cooldowns.secondary = 1.0;
    playSound("ice");
    sendMultiplayerAttack("secondary", "Ice Bolt", 0x95d5ee);
    spawnProjectile({
      label: "Ice Bolt",
      color: 0x95d5ee,
      speed: 34,
      damage: 26,
      radius: 0.42,
      gravity: 0,
      shape: "ice",
      extra: { freeze: 1.2 },
    });
  } else if (player.classId === "witch") {
    cooldowns.secondary = 1.2;
    playSound("witch");
    sendMultiplayerAttack("secondary", "Scream", 0xb77ce8);
    meleeCone({
      range: 8.5,
      angle: 0.82,
      damage: 32,
      label: "Scream",
      color: 0xb77ce8,
      extra: { knock: 8, silence: 1.0 },
    });
    makeForwardCone(8.5, 0xb77ce8, 0.45);
  }
}

function useSecondaryUp() {
  if (player.classId === "fighter") {
    player.shield = false;
    playSound("shield-down");
    sendMultiplayerState(true);
  }

  if (player.classId === "ranger" && player.chargingShot) {
    player.chargingShot = false;
    cooldowns.secondary = 1.15;
    playSound("arrow");
    sendMultiplayerState(true);
    const charge = clamp((performance.now() - player.chargeStartedAt) / 1150, 0.25, 1);
    sendMultiplayerAttack("secondary", "Charged Arrow", 0xd7f6a2);
    spawnProjectile({
      label: "Charged Arrow",
      color: 0xd7f6a2,
      speed: 48 + charge * 12,
      damage: 44 + charge * 48,
      radius: 0.42 + charge * 0.18,
      gravity: 0,
      shape: "arrow",
      extra: { pierce: charge > 0.82 },
    });
  }
}

function useAbility(slot) {
  if (player.deadTimer > 0 || cooldowns[slot] > 0 || matchState.status === "ended") return;
  if (!spendResource(slot)) return;
  const classId = player.classId;

  if (classId === "fighter") useFighterAbility(slot);
  if (classId === "priest") usePriestAbility(slot);
  if (classId === "ranger") useRangerAbility(slot);
  if (classId === "witch") useWitchAbility(slot);
}

function useFighterAbility(slot) {
  if (slot === "q") {
    cooldowns.q = 4.8;
    playSound("bash");
    sendMultiplayerAttack("q", "Shield Bash", 0xe0a34f);
    meleeCone({
      range: 4.0,
      angle: 0.88,
      damage: 22,
      label: "Shield Bash",
      color: 0xe0a34f,
      extra: { knock: 12 },
    });
    makeForwardCone(4, 0xe0a34f, 0.35);
  }

  if (slot === "e") {
    cooldowns.e = 7.0;
    playSound("dash");
    sendMultiplayerAttack("e", "Sprint Charge", 0xe0a34f);
    player.chargeRush = 0.72;
    player.chargeHits.clear();
    makeGroundRing(player.position, 2.8, 0xe0a34f, 0.5);
  }

  if (slot === "r") {
    cooldowns.r = 22;
    playSound("ultimate");
    sendMultiplayerAttack("r", "Whirlwind", 0xe0a34f);
    damageArea(player.position, 6.3, 76, "Whirlwind", 0xe0a34f, { knock: 10 });
    makeGroundRing(player.position, 6.3, 0xe0a34f, 0.7);
    addFeed("Whirlwind released", "Ultimate");
  }
}

function usePriestAbility(slot) {
  if (slot === "q") {
    cooldowns.q = 6.5;
    playSound("zone");
    const point = getAimGroundPoint(18);
    sendMultiplayerAttack("q", "Fire Field", 0xf26f45, { target: point });
    const mesh = makeGroundRing(point, 4.3, 0xf26f45, 4.2, true);
    timedZones.push({
      mesh,
      life: 4.2,
      maxLife: 4.2,
      rate: 0.45,
      tick: 0,
      opacity: 0.42,
      spin: 0.28,
      onTick(zone) {
        damageArea(zone.mesh.position, 4.3, 11, "Fire Field", 0xf26f45, { burn: 0.8, quiet: true });
      },
    });
  }

  if (slot === "e") {
    cooldowns.e = 8.0;
    playSound("wall");
    const point = getAimGroundPoint(9);
    const forward = getFlatForward();
    sendMultiplayerAttack("e", "Ice Wall", 0x95d5ee, { target: point, direction: forward });
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 3.2, 0.5),
      new THREE.MeshLambertMaterial({
        color: 0x95d5ee,
        transparent: true,
        opacity: 0.64,
        flatShading: true,
      })
    );
    wall.position.copy(point);
    wall.position.y = 1.6;
    wall.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI / 2;
    wall.castShadow = true;
    scene.add(wall);
    blockers.push({ mesh: wall, life: 5.8, maxLife: 5.8 });
    makeGroundRing(point, 4.4, 0x95d5ee, 0.5);
  }

  if (slot === "r") {
    cooldowns.r = 24;
    playSound("ultimate");
    const center = getAimGroundPoint(18);
    sendMultiplayerAttack("r", "Meteor Shower", 0xf26f45, { target: center });
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3((Math.random() - 0.5) * 11, 0, (Math.random() - 0.5) * 11);
        playSound("meteor");
        spawnMeteor(center.clone().add(offset));
      }, i * 170);
    }
    makeGroundRing(center, 7.5, 0xf26f45, 1.1);
    addFeed("Meteor Shower called", "Ultimate");
  }
}

function useRangerAbility(slot) {
  if (slot === "q") {
    cooldowns.q = 4.2;
    playSound("dash");
    sendMultiplayerAttack("q", "Roll", 0x7fcf79);
    const right = getFlatRight();
    const forward = getFlatForward();
    const direction = input.left ? right.multiplyScalar(-1) : input.right ? right : forward.multiplyScalar(-1);
    movePlayerByVector(direction.multiplyScalar(5.2));
    makeGroundRing(player.position, 2.1, 0x7fcf79, 0.35);
  }

  if (slot === "e") {
    cooldowns.e = 6.6;
    playSound("trap");
    const point = getAimGroundPoint(6);
    sendMultiplayerAttack("e", "Trap", 0x7fcf79, { target: point });
    const trap = makeGroundRing(point, 2.2, 0x7fcf79, 8, true);
    timedZones.push({
      mesh: trap,
      life: 8,
      maxLife: 8,
      rate: 0.2,
      tick: 0,
      opacity: 0.34,
      spin: 0.1,
      onTick(zone) {
        let triggered = false;
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (horizontalDistance(zone.mesh.position, enemy.group.position) < 2.2) {
            hitEnemy(enemy, 34, "Trap", 0x7fcf79, { freeze: 1.0, knock: 3 });
            triggered = true;
            break;
          }
        }
        if (!triggered) {
          for (const remote of remotePlayers.values()) {
            if (!isRemoteAlive(remote)) continue;
            if (horizontalDistance(zone.mesh.position, remote.group.position) < 2.2) {
              hitRemotePlayer(remote, 34, "Trap", 0x7fcf79, { freeze: 1.0, knock: 3 });
              triggered = true;
              break;
            }
          }
        }
        if (triggered) zone.life = 0;
      },
    });
  }

  if (slot === "r") {
    cooldowns.r = 21;
    playSound("ultimate");
    const center = getAimGroundPoint(17);
    sendMultiplayerAttack("r", "Arrow Rain", 0x7fcf79, { target: center });
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12);
        playSound("arrow");
        spawnFallingArrow(center.clone().add(offset));
      }, i * 80);
    }
    makeGroundRing(center, 7.2, 0x7fcf79, 1.0);
    addFeed("Arrow Rain released", "Ultimate");
  }
}

function useWitchAbility(slot) {
  if (slot === "q") {
    cooldowns.q = 6.4;
    playSound("zone");
    const point = getAimGroundPoint(13);
    sendMultiplayerAttack("q", "Silence", 0xb77ce8, { target: point });
    const mesh = makeGroundRing(point, 4.6, 0xb77ce8, 3.5, true);
    timedZones.push({
      mesh,
      life: 3.5,
      maxLife: 3.5,
      rate: 0.35,
      tick: 0,
      opacity: 0.36,
      spin: -0.36,
      onTick(zone) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (horizontalDistance(zone.mesh.position, enemy.group.position) < 4.6) {
            enemy.silenced = Math.max(enemy.silenced, 1.2);
            enemy.attackCd = Math.max(enemy.attackCd, 0.8);
          }
        }
      },
    });
  }

  if (slot === "e") {
    cooldowns.e = 7.2;
    playSound("witch");
    sendMultiplayerAttack("e", "Fear", 0xb77ce8);
    damageArea(player.position, 7.4, 18, "Fear", 0xb77ce8, { fear: 2.2, knock: 7 });
    makeGroundRing(player.position, 7.4, 0xb77ce8, 0.7);
  }

  if (slot === "r") {
    cooldowns.r = 24;
    playSound("ultimate");
    sendMultiplayerAttack("r", "Banshee Scream", 0xb77ce8);
    meleeCone({
      range: 15,
      angle: 1.22,
      damage: 86,
      label: "Banshee Scream",
      color: 0xb77ce8,
      extra: { knock: 16, silence: 2.3, fear: 2.0 },
    });
    makeForwardCone(15, 0xb77ce8, 0.9);
    addFeed("Banshee Scream released", "Ultimate");
  }
}

function swingWeapon(duration) {
  if (localChar) triggerCharAttack(localChar);
  const start = weaponGroup.rotation.z;
  const effect = {
    mesh: new THREE.Group(),
    life: duration,
    maxLife: duration,
    update(_, progress) {
      weaponGroup.rotation.z = start - Math.sin(progress * Math.PI) * 0.38;
      weaponGroup.position.x = Math.sin(progress * Math.PI) * 0.08;
    },
  };
  scene.add(effect.mesh);
  effects.push(effect);
}

function checkChargeHits() {
  for (const enemy of enemies) {
    if (!enemy.alive || player.chargeHits.has(enemy.id)) continue;
    if (horizontalDistance(player.position, enemy.group.position) < 2.4) {
      player.chargeHits.add(enemy.id);
      hitEnemy(enemy, 48, "Sprint Charge", 0xe0a34f, { knock: 14 });
    }
  }

  for (const remote of remotePlayers.values()) {
    const hitId = `remote:${remote.id}`;
    if (!isRemoteAlive(remote) || player.chargeHits.has(hitId)) continue;
    if (horizontalDistance(player.position, remote.group.position) < 2.4) {
      player.chargeHits.add(hitId);
      hitRemotePlayer(remote, 48, "Sprint Charge", 0xe0a34f, { knock: 14 });
    }
  }
}

function meleeCone({ range, angle, damage, label, color, extra = {} }) {
  const forward = getFlatForward();
  let any = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const toEnemy = tmpVec.copy(enemy.group.position).sub(player.position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    if (distance > range) continue;
    const dot = toEnemy.normalize().dot(forward);
    if (dot > Math.cos(angle)) {
      hitEnemy(enemy, damage, label, color, extra);
      any = true;
    }
  }

  for (const remote of remotePlayers.values()) {
    if (!isRemoteAlive(remote)) continue;
    const toRemote = tmpVec.copy(remote.group.position).sub(player.position);
    toRemote.y = 0;
    const distance = toRemote.length();
    if (distance > range) continue;
    const dot = toRemote.normalize().dot(forward);
    if (dot > Math.cos(angle)) {
      hitRemotePlayer(remote, damage, label, color, extra);
      any = true;
    }
  }

  if (!any) addFeed(`${label} missed`, "Combat");
}

function damageArea(center, radius, damage, label, color, extra = {}) {
  let hits = 0;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const distance = horizontalDistance(center, enemy.group.position);
    if (distance <= radius) {
      const falloff = clamp(1 - distance / radius, 0.35, 1);
      hitEnemy(enemy, damage * falloff, label, color, extra);
      hits += 1;
    }
  }

  for (const remote of remotePlayers.values()) {
    if (!isRemoteAlive(remote)) continue;
    const distance = horizontalDistance(center, remote.group.position);
    if (distance <= radius) {
      const falloff = clamp(1 - distance / radius, 0.35, 1);
      hitRemotePlayer(remote, damage * falloff, label, color, extra);
      hits += 1;
    }
  }

  if (hits === 0 && !extra.quiet) addFeed(`${label} found no target`, "Combat");
}

function hitEnemy(enemy, amount, label, color, extra = {}) {
  if (!enemy.alive) return;
  amount *= mods.damageMult;
  enemy.hp -= amount;
  if (mods.lifesteal > 0) healPlayer(amount * mods.lifesteal);

  if (extra.freeze) enemy.frozen = Math.max(enemy.frozen, extra.freeze);
  if (extra.silence) enemy.silenced = Math.max(enemy.silenced, extra.silence);
  if (extra.fear) enemy.fear = Math.max(enemy.fear, extra.fear);
  if (extra.burn) enemy.burn = Math.max(enemy.burn, extra.burn);
  if (extra.knock) {
    const knockDir = enemy.group.position.clone().sub(player.position);
    knockDir.y = 0;
    if (knockDir.lengthSq() > 0.01) enemy.knock.add(knockDir.normalize().multiplyScalar(extra.knock));
  }

  spawnHitBurst(enemy.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), color);
  enemy.hitPunch = 0.12;
  if (!extra.quiet) {
    addCameraShake(0.1);
    playSound("hit", clamp(amount / 60, 0.45, 1.25));
    spawnFloatingText(enemy.group.position.clone().add(new THREE.Vector3(0, 2.8, 0)), Math.round(amount), color);
  }

  if (enemy.hp <= 0) {
    killEnemy(enemy, label);
  } else if (!extra.quiet && Math.random() > 0.48) {
    addFeed(`${label} hit Echo ${enemy.id + 1}`, "Hit");
  }
}

function hitRemotePlayer(remote, amount, label, color, extra = {}) {
  if (!isRemoteAlive(remote)) return;

  amount *= mods.damageMult;
  const sent = sendMultiplayerHit(remote, amount, label, color, extra);
  if (!sent) return;

  if (mods.lifesteal > 0) healPlayer(amount * mods.lifesteal);
  spawnHitBurst(remote.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), color);
  remote.hitPunch = 0.12;
  if (!extra.quiet) {
    addCameraShake(0.1);
    playSound("hit", clamp(amount / 60, 0.45, 1.25));
    spawnFloatingText(remote.group.position.clone().add(new THREE.Vector3(0, 2.8, 0)), Math.round(amount), color);
    if (Math.random() > 0.48) addFeed(`${label} hit player`, "Hit");
  }
}

function isRemoteAlive(remote) {
  return remote?.group?.visible !== false && !remote.state?.dead && (remote.state?.hp ?? 0) > 0;
}

function killEnemy(enemy, label) {
  enemy.alive = false;
  enemy.group.visible = false;
  enemy.respawn = 2.4 + Math.random() * 1.2;
  player.score += 1;
  playSound("kill");
  addFeed(`Echo ${enemy.id + 1} down`, label);
  if (RESOURCE_ENABLED) spawnPotion(enemy.group.position);
}

function respawnEnemy(enemy) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 20 + Math.random() * 22;
  enemy.group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  enemy.hp = enemy.maxHp;
  enemy.alive = true;
  enemy.group.visible = true;
  enemy.frozen = 0;
  enemy.silenced = 0;
  enemy.fear = 0;
  enemy.burn = 0;
  enemy.knock.set(0, 0, 0);
}

function damagePlayer(amount, enemy) {
  if (!controlsLocked || player.invulnerable > 0 || player.deadTimer > 0) return;
  let finalDamage = amount;

  if (player.shield && isEnemyInFront(enemy)) {
    finalDamage *= 0.25;
    playSound("block");
    addFeed("Shield absorbed damage", "Block");
  } else {
    playSound("hurt");
  }

  player.hp -= finalDamage;
  player.invulnerable = 0.25;
  ui.vignette.classList.add("active");
  lastHitFlash = 0.14;
  addCameraShake(0.3);

  if (player.hp <= 0) {
    player.deaths += 1;
    player.deadTimer = 2;
    player.hp = 0;
    playSound("death");
    addFeed("Respawning", "Defeated");
    sendMultiplayerState(true);
  }
}

function respawnPlayer() {
  player.position.copy(spawnPoint);
  player.velocity.set(0, 0, 0);
  player.maxHp = classBaseHp() + mods.maxHpBonus;
  player.hp = player.maxHp;
  player.invulnerable = 1.2;
  player.shield = false;
  player.chargingShot = false;
  player.chargeRush = 0;
  addFeed("Back in the arena", "Spawn");
  sendMultiplayerState(true);
}

function spawnProjectile({
  label,
  color,
  speed,
  damage,
  radius,
  aoe = 0,
  splashDamage = damage,
  gravity = 0,
  shape = "sphere",
  extra = {},
}) {
  const direction = getAimDirection();
  // Fire from the character's chest toward the cursor's ground point (horizontal).
  const start = player.position.clone();
  start.y -= 0.25;
  start.add(direction.clone().multiplyScalar(1.0));
  if (localChar) triggerCharAttack(localChar);

  const mesh = createProjectileMesh(shape, color, radius);
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: direction.multiplyScalar(speed).add(new THREE.Vector3(0, -gravity, 0)),
    life: 3.2,
    radius,
    damage,
    aoe,
    splashDamage,
    label,
    color,
    hitEnemies: true,
    spin: shape === "wave" ? { axis: "z", speed: 12 } : null,
    extra,
  });
}

function makeGlowSphere(color, r) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 10),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
}

function createProjectileMesh(shape, color, radius) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94 });
  if (shape === "arrow") {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), material);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), material);
    head.position.y = 0.62; // tip leads the flight direction (+Y maps to velocity)
    group.add(shaft, head, makeGlowSphere(color, 0.16));
    return group;
  }

  if (shape === "wave") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 6, 18), material);
    ring.scale.z = 0.22;
    return ring;
  }

  if (shape === "ice") {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(radius), material));
    group.add(makeGlowSphere(color, radius * 1.7));
    return group;
  }

  // default: round glowing orb (fireball / magic) instead of a faceted triangle
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color })));
  group.add(makeGlowSphere(color, radius * 2.0));
  return group;
}

function spawnMeteor(point) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.65, 0),
    new THREE.MeshBasicMaterial({ color: 0xf26f45 })
  );
  mesh.position.copy(point);
  mesh.position.y = 18 + Math.random() * 8;
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: new THREE.Vector3((Math.random() - 0.5) * 2, -20, (Math.random() - 0.5) * 2),
    life: 1.5,
    radius: 0.8,
    damage: 34,
    aoe: 3.4,
    splashDamage: 48,
    label: "Meteor",
    color: 0xf26f45,
    hitEnemies: true,
    spin: { axis: "x", speed: 6 },
    extra: { burn: 1.2 },
  });
}

function spawnFallingArrow(point) {
  const mesh = createProjectileMesh("arrow", 0x7fcf79, 0.35);
  mesh.position.copy(point);
  mesh.position.y = 16 + Math.random() * 6;
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.9, -26, (Math.random() - 0.5) * 0.9),
    life: 1.2,
    radius: 0.5,
    damage: 38,
    aoe: 1.4,
    splashDamage: 22,
    label: "Arrow Rain",
    color: 0x7fcf79,
    hitEnemies: true,
    extra: { freeze: 0.25 },
  });
}

function makeGroundRing(position, radius, color, life, persistent = false) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.76, radius, 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: persistent ? 0.38 : 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.position.set(position.x, 0.065, position.z);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  if (!persistent) {
    effects.push({
      mesh: ring,
      life,
      maxLife: life,
      update(effect, progress) {
        effect.mesh.scale.setScalar(1 + progress * 0.34);
        effect.mesh.material.opacity = Math.max(0, 0.58 * (1 - progress));
      },
    });
  }

  return ring;
}

function makeForwardCone(range, color, life) {
  makeDirectionalCone(player.position, yaw, range, color, life);
}

function makeDirectionalCone(origin, yawValue, range, color, life) {
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(upAxis, yawValue).normalize();
  const position = origin.clone().add(forward.multiplyScalar(range * 0.48));
  position.y = 0.08;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(range * 0.45, range, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  cone.position.copy(position);
  cone.rotation.x = Math.PI / 2;
  cone.rotation.z = -yawValue;
  scene.add(cone);
  effects.push({
    mesh: cone,
    life,
    maxLife: life,
    update(effect, progress) {
      effect.mesh.material.opacity = Math.max(0, 0.24 * (1 - progress));
      effect.mesh.scale.setScalar(1 + progress * 0.18);
    },
  });
}

function makeRemoteZone(position, radius, color, life) {
  const zone = makeGroundRing(position, radius, color, life, true);
  zone.material.opacity = 0.36;
  effects.push({
    mesh: zone,
    life,
    maxLife: life,
    update(effect, progress, dt) {
      effect.mesh.rotation.z += dt * 0.2;
      effect.mesh.material.opacity = Math.max(0, 0.36 * (1 - progress * 0.72));
    },
  });
}

function makeRemoteWall(position, direction, color, life) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 3.2, 0.5),
    new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.58,
      flatShading: true,
    })
  );
  const flat = direction.clone();
  flat.y = 0;
  if (flat.lengthSq() <= 0.01) flat.set(0, 0, -1);
  wall.position.set(position.x, 1.6, position.z);
  wall.rotation.y = Math.atan2(flat.x, flat.z) + Math.PI / 2;
  wall.castShadow = true;
  scene.add(wall);
  effects.push({
    mesh: wall,
    life,
    maxLife: life,
    update(effect, progress) {
      effect.mesh.material.opacity = Math.max(0, 0.58 * (1 - progress * 0.85));
    },
  });
}

function spawnRemoteMeteor(point, color) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.65, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  mesh.position.copy(point);
  mesh.position.y = 18 + Math.random() * 8;
  scene.add(mesh);
  effects.push({
    mesh,
    life: 1.5,
    maxLife: 1.5,
    update(effect, progress, dt) {
      effect.mesh.position.y -= 20 * dt;
      effect.mesh.rotation.x += 6 * dt;
      effect.mesh.material.opacity = Math.max(0, 0.95 * (1 - Math.max(0, progress - 0.65) / 0.35));
    },
  });
}

function spawnRemoteFallingArrow(point, color) {
  const mesh = createProjectileMesh("arrow", color, 0.35);
  mesh.position.copy(point);
  mesh.position.y = 16 + Math.random() * 6;
  scene.add(mesh);
  effects.push({
    mesh,
    life: 1.2,
    maxLife: 1.2,
    update(effect, progress, dt) {
      effect.mesh.position.y -= 26 * dt;
      setObjectOpacity(effect.mesh, Math.max(0, 0.94 * (1 - Math.max(0, progress - 0.7) / 0.3)));
    },
  });
}

function randomFlatOffset(size) {
  return new THREE.Vector3((Math.random() - 0.5) * size, 0, (Math.random() - 0.5) * size);
}

function spawnHitBurst(position, color) {
  const burst = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  burst.position.copy(position);
  scene.add(burst);
  effects.push({
    mesh: burst,
    life: 0.32,
    maxLife: 0.32,
    update(effect, progress) {
      effect.mesh.scale.setScalar(1 + progress * 2.6);
      effect.mesh.material.opacity = Math.max(0, 0.9 * (1 - progress));
    },
  });

  // White impact flash core.
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
  );
  flash.position.copy(position);
  scene.add(flash);
  effects.push({
    mesh: flash,
    life: 0.14,
    maxLife: 0.14,
    update(effect, progress) {
      effect.mesh.scale.setScalar(1 + progress * 1.8);
      effect.mesh.material.opacity = Math.max(0, 0.85 * (1 - progress));
    },
  });

  // A few spark shards flying outward.
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    shard.position.copy(position);
    const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.7, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(5 + Math.random() * 3);
    shard.lookAt(position.clone().add(vel));
    scene.add(shard);
    effects.push({
      mesh: shard,
      life: 0.26,
      maxLife: 0.26,
      vel,
      update(effect, progress, dt) {
        effect.mesh.position.addScaledVector(effect.vel, dt);
        effect.vel.multiplyScalar(0.9);
        effect.mesh.material.opacity = Math.max(0, 0.95 * (1 - progress));
      },
    });
  }
}

// PvE loot: a killed skeleton drops a glowing orb — the class resource, or sometimes health.
function spawnPotion(position) {
  const usesResource = classUsesResource(player.classId);
  const isHeal = !usesResource || Math.random() < 0.3;
  const color = isHeal ? 0x6bd391 : resourceDef()?.color ?? 0x5aa0ff;
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  orb.position.set(position.x, 0.7, position.z);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })
  );
  orb.add(glow);
  scene.add(orb);
  potions.push({ mesh: orb, kind: isHeal ? "heal" : "resource", life: 12, baseY: 0.7 });
}

function updatePotions(dt) {
  for (let i = potions.length - 1; i >= 0; i--) {
    const p = potions[i];
    p.life -= dt;
    p.mesh.rotation.y += dt * 2.2;
    p.mesh.position.y = p.baseY + Math.sin(performance.now() * 0.004 + i) * 0.12;
    if (p.life < 2) p.mesh.material.opacity = Math.max(0.1, 0.95 * (p.life / 2)); // fade out

    const dx = p.mesh.position.x - player.position.x;
    const dz = p.mesh.position.z - player.position.z;
    const picked = dx * dx + dz * dz < 1.8 * 1.8 && player.deadTimer <= 0;
    if (picked) {
      if (p.kind === "heal") {
        healPlayer(POTION_HEAL);
        addFeed(`+${POTION_HEAL} Can`, "İksir");
      } else {
        player.resource = Math.min(player.maxResource, player.resource + POTION_RESTORE);
        addFeed(`+${POTION_RESTORE} ${resourceDef()?.label || "Kaynak"}`, "İksir");
      }
      playSound("class");
    }
    if (picked || p.life <= 0) {
      scene.remove(p.mesh);
      potions.splice(i, 1);
    }
  }
}

function spawnFloatingText(position, text, color) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeTextTexture(String(text), color),
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.position.copy(position);
  sprite.scale.set(1.8, 0.72, 1);
  scene.add(sprite);
  floatingMessages.push({ mesh: sprite, life: 0.8, maxLife: 0.8 });
}

function makeTextTexture(text, color) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext("2d");
  context.clearRect(0, 0, 128, 64);
  context.fillStyle = "rgba(0,0,0,0.38)";
  context.fillRect(28, 14, 72, 38);
  context.font = "800 28px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fillText(text, 64, 34);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function getCameraForward() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  return direction.normalize();
}

// Horizontal aim direction (player -> cursor ground point). Used for projectiles/abilities.
function getAimDirection() {
  const dir = new THREE.Vector3(aimPoint.x - player.position.x, 0, aimPoint.z - player.position.z);
  if (dir.lengthSq() < 0.0001) return getFlatForward();
  return dir.normalize();
}

// Per-frame: resolve the cursor (or movement on touch) into an aim point + facing yaw.
function updateAim() {
  if (isTouch) {
    if (touchMove.active && (touchMove.x || touchMove.y)) {
      const wx = SCREEN_RIGHT.x * touchMove.x + SCREEN_FWD.x * -touchMove.y;
      const wz = SCREEN_RIGHT.z * touchMove.x + SCREEN_FWD.z * -touchMove.y;
      if (wx || wz) yaw = Math.atan2(-wx, -wz);
    }
    aimPoint.copy(player.position).addScaledVector(getFlatForward(), 6);
    return;
  }
  aimRaycaster.setFromCamera(aimNDC, camera);
  if (aimRaycaster.ray.intersectPlane(aimGroundPlane, aimHit)) {
    aimPoint.copy(aimHit);
    const dx = aimPoint.x - player.position.x;
    const dz = aimPoint.z - player.position.z;
    if (dx * dx + dz * dz > 0.05) yaw = Math.atan2(-dx, -dz);
  }
}

function getFlatForward() {
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(upAxis, yaw).normalize();
}

function getFlatRight() {
  return new THREE.Vector3(1, 0, 0).applyAxisAngle(upAxis, yaw).normalize();
}

// Show a raid-style boss bar when a living boss is near the player.
function updateBossHud() {
  let boss = null;
  for (const remote of remotePlayers.values()) {
    if (remote.isBoss && !remote.state?.dead) {
      boss = remote;
      break;
    }
  }
  let near = false;
  if (boss) {
    const bp = boss.group.position;
    near = Math.hypot(bp.x - player.position.x, bp.z - player.position.z) < 32;
  }
  ui.bossHud.classList.toggle("hidden", !near);
  if (near) {
    const frac = clamp((boss.state.hp ?? 0) / Math.max(1, boss.state.maxHp ?? 1), 0, 1);
    ui.bossBar.style.transform = `scaleX(${frac})`;
    ui.bossHpText.textContent = `${Math.ceil(boss.state.hp)} / ${boss.state.maxHp}`;
  }
}

let minimapAccum = 0;
const minimapCtx = ui.minimap ? ui.minimap.getContext("2d") : null;

// Top-down mini-map: walls + player (facing) + enemy/player blips. Visual only.
function updateMinimap(dt) {
  if (!minimapCtx) return;
  const def = MAPS[MAP_ID];
  if (!def) return;
  minimapAccum += dt;
  if (minimapAccum < 0.066) return; // ~15 fps
  minimapAccum = 0;

  const ctx = minimapCtx;
  const size = ui.minimap.width;
  const pad = 10;
  const span = size - pad * 2;
  const halfX = def.ground.halfX;
  const halfZ = def.ground.halfZ;
  const toX = (x) => pad + ((x + halfX) / (halfX * 2)) * span;
  const toY = (z) => pad + ((z + halfZ) / (halfZ * 2)) * span;
  const blip = (x, z, r) => {
    ctx.beginPath();
    ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(214,204,176,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const w of def.walls || []) {
    ctx.moveTo(toX(w.x1), toY(w.z1));
    ctx.lineTo(toX(w.x2), toY(w.z2));
  }
  ctx.stroke();

  ctx.fillStyle = "#e0594a"; // enemies
  for (const remote of remotePlayers.values()) {
    if (remote.isBot && !remote.state?.dead) blip(remote.group.position.x, remote.group.position.z, remote.state?.boss ? 6 : 3.5);
  }
  for (const e of enemies) {
    if (e.alive) blip(e.group.position.x, e.group.position.z, 3.5);
  }

  ctx.fillStyle = "#5cc9e6"; // other players
  for (const remote of remotePlayers.values()) {
    if (!remote.isBot && !remote.state?.dead) blip(remote.group.position.x, remote.group.position.z, 3.5);
  }

  // local player — arrow pointing along facing
  const fwd = getFlatForward();
  ctx.save();
  ctx.translate(toX(player.position.x), toY(player.position.z));
  ctx.rotate(Math.atan2(fwd.z, fwd.x));
  ctx.fillStyle = "#e1b560";
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4, 4.5);
  ctx.lineTo(-4, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getAimGroundPoint(maxDistance) {
  // Cursor ground point (updated each frame), clamped to the ability's max range.
  const to = new THREE.Vector3(aimPoint.x - player.position.x, 0, aimPoint.z - player.position.z);
  const dist = to.length();
  if (dist > maxDistance) to.multiplyScalar(maxDistance / dist);
  return player.position.clone().add(to);
}

function isEnemyInFront(enemy) {
  return isSourceInFront(enemy);
}

function isSourceInFront(source) {
  const forward = getFlatForward();
  const sourcePosition = source?.group?.position ?? source?.position;
  if (!sourcePosition) return false;
  const toSource = sourcePosition.clone().sub(player.position);
  toSource.y = 0;
  if (toSource.lengthSq() <= 0.01) return false;
  return toSource.normalize().dot(forward) > 0.2;
}

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function isOutsideArena(position) {
  return Math.abs(position.x) > 58 || Math.abs(position.z) > 58 || position.y > 80 || position.y < -4;
}

function addFeed(message, type) {
  const item = document.createElement("div");
  item.className = "feed-item";
  item.innerHTML = `<strong>${type}</strong> ${message}`;
  ui.feed.prepend(item);
  while (ui.feed.children.length > 4) ui.feed.lastElementChild.remove();
  setTimeout(() => item.remove(), 4200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateHud() {
  ui.app.dataset.audio = audioState.ctx?.state ?? "unavailable";
  ui.app.dataset.audioUnlocked = String(audioState.unlocked);
  ui.app.dataset.audioSamples = String(audioState.samples.size);
  ui.app.dataset.lightMode = lightingState.mode;
  ui.app.dataset.lightLevel = String(Math.round(lightingState.level * 100));
  ui.app.dataset.multiplayerStatus = multiplayer.status;
  ui.app.dataset.multiplayerPeers = String(remotePlayers.size);

  const hpPercent = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  ui.hpBar.style.transform = `scaleX(${clamp(hpPercent, 0, 1)})`;
  ui.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  if (ui.manaBar) {
    const resPercent = player.maxResource > 0 ? player.resource / player.maxResource : 0;
    ui.manaBar.style.transform = `scaleX(${clamp(resPercent, 0, 1)})`;
    ui.manaText.textContent = `${Math.ceil(player.resource)} / ${player.maxResource}`;
  }
  if (ui.bossHud) updateBossHud();
  ui.score.textContent = String(player.score);
  ui.deaths.textContent = String(player.deaths);

  for (const card of ui.abilityCards) {
    const slot = card.dataset.slot;
    const cd = cooldowns[slot] ?? 0;
    card.classList.toggle("ready", cd <= 0.01);
    card.classList.toggle("cooling", cd > 0.01);
    ui.abilityCooldowns[slot].textContent = cd > 0.01 ? cd.toFixed(cd > 9.9 ? 0 : 1) : "";
  }

  if (player.shield) {
    ui.abilityCooldowns.secondary.textContent = "Block";
  }
  if (player.chargingShot) {
    ui.abilityCooldowns.secondary.textContent = `${Math.round(clamp(player.chargeTime / 1.25, 0, 1) * 100)}%`;
  }

  for (const b of ui.mobileAbilityButtons) {
    const cd = cooldowns[b.slot] ?? 0;
    b.root.classList.toggle("cooling", cd > 0.01);
    if (b.cd) b.cd.textContent = cd > 0.01 ? cd.toFixed(cd > 9.9 ? 0 : 1) : "";
  }
}

// Target a constant HORIZONTAL field of view so the character reads the same size in
// portrait and landscape (otherwise a fixed vertical FOV zooms in on tall screens).
const BASE_HFOV = 78;

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  if (composer) composer.setSize(width, height);
  camera.aspect = width / height;
  const hfov = THREE.MathUtils.degToRad(BASE_HFOV);
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 50, 100);
  camera.updateProjectionMatrix();
  resizePreview();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
