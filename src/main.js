import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  upgradeModal: document.querySelector("#upgrade-modal"),
  upgradeCards: Array.from(document.querySelectorAll(".upgrade-card")).map((root) => ({
    root,
    name: root.querySelector(".upgrade-name"),
    desc: root.querySelector(".upgrade-desc"),
  })),
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

const player = {
  name: "Player",
  classId: "fighter",
  position: new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 18),
  velocity: new THREE.Vector3(),
  hp: CLASS_DATA.fighter.hp,
  maxHp: CLASS_DATA.fighter.hp,
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

// Roguelite upgrade modifiers. Stack during a match, reset on new round.
const mods = {
  damageMult: 1,
  lifesteal: 0,
  speedMult: 1,
  cdrBonus: 0,
  maxHpBonus: 0,
};

const upgradeState = {
  open: false,
  queued: 0,
  options: [],
  autoPickAt: 0,
};

let lastScore = 0;

const UPGRADE_POOL = [
  {
    id: "lifesteal",
    name: "Vampirizm",
    desc: "Verdiğin hasarın %15'i kadar can çal",
    apply() {
      mods.lifesteal += 0.15;
    },
  },
  {
    id: "damage",
    name: "Keskinlik",
    desc: "Hasar +%20",
    apply() {
      mods.damageMult += 0.2;
    },
  },
  {
    id: "speed",
    name: "Çeviklik",
    desc: "Hareket hızı +%12",
    apply() {
      mods.speedMult += 0.12;
    },
  },
  {
    id: "cdr",
    name: "Soğukkanlılık",
    desc: "Yetenek bekleme süreleri %18 daha hızlı",
    apply() {
      mods.cdrBonus += 0.18;
    },
  },
  {
    id: "maxhp",
    name: "Dayanıklılık",
    desc: "Maksimum can +25 (ve hemen iyileş)",
    apply() {
      mods.maxHpBonus += 25;
      player.maxHp = classBaseHp() + mods.maxHpBonus;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
];

const enemies = [];
const projectiles = [];
const effects = [];
const timedZones = [];
const blockers = [];
const floatingMessages = [];
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
let composer = null;
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
  grass: texturedLambert(0x53785b, { repeat: 26, contrast: 0.34, bump: 0.25 }),
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
const modelCache = new Map();
const gltfLoader = new GLTFLoader();

function loadCharacterModels() {
  for (const [key, url] of Object.entries(CHARACTER_MODELS)) {
    gltfLoader.load(
      url,
      (gltf) => modelCache.set(key, gltf),
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
  root.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.y = -grounded.min.y;
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
  const char = { root, mixer, actions, currentLoco: null, attacking: false, attackTimer: 0 };
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
  setupWorld();
  setupLights();
  setupPostProcessing();
  loadCharacterModels();
  applyLightingSettings();
  setupArena();
  setupPlayerWeapon();
  spawnEnemies();
  bindEvents();
  setupMobileControls();
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
  multiplayer.room = params.get("room") || "public";
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
  lastScore = 0;
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
  upgradeState.queued = 0;
  closeUpgradeModal();
}

function updateUpgrades() {
  const delta = player.score - lastScore;
  if (delta > 0) {
    // A small jump is a fresh kill; a large jump is a join/score resync.
    if (delta <= 2) upgradeState.queued += delta;
    lastScore = player.score;
  } else if (delta < 0) {
    lastScore = player.score;
  }

  if (!upgradeState.open && upgradeState.queued > 0 && controlsLocked) {
    upgradeState.queued -= 1;
    offerUpgrades();
  }

  if (upgradeState.open && performance.now() >= upgradeState.autoPickAt) {
    selectUpgrade(0);
  }
}

function offerUpgrades() {
  if (upgradeState.open || !ui.upgradeModal) return;
  const pool = UPGRADE_POOL.slice();
  const options = [];
  while (options.length < 3 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    options.push(pool.splice(idx, 1)[0]);
  }
  upgradeState.options = options;
  upgradeState.open = true;
  upgradeState.autoPickAt = performance.now() + 6000;
  renderUpgradeModal();
  ui.upgradeModal.classList.remove("hidden");
  playSound("class");
}

function renderUpgradeModal() {
  ui.upgradeCards.forEach((card, i) => {
    const opt = upgradeState.options[i];
    card.root.style.display = opt ? "" : "none";
    if (opt) {
      card.name.textContent = opt.name;
      card.desc.textContent = opt.desc;
    }
  });
}

function selectUpgrade(index) {
  if (!upgradeState.open) return;
  const choice = upgradeState.options[index];
  if (!choice) return;
  choice.apply();
  addFeed(`Yükseltme: ${choice.name}`, "Roguelite");
  playSound("class");
  closeUpgradeModal();
}

function closeUpgradeModal() {
  upgradeState.open = false;
  upgradeState.options = [];
  if (ui.upgradeModal) ui.upgradeModal.classList.add("hidden");
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

  torchPositions.forEach(([x, y, z]) => {
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
  });
}

function setLightingMode(mode) {
  if (!lightingPresets[mode]) return;
  lightingState.mode = mode;
  lightingState.level = mode === "day" ? 1 : 0.62;
  ui.lightLevel.value = String(Math.round(lightingState.level * 100));
  applyLightingSettings();
}

function setLightingLevel(level) {
  lightingState.level = clamp(level, 0.35, 1.2);
  applyLightingSettings();
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

  const centerObelisk = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8.5, 5), materials.darkStone);
  centerObelisk.position.set(0, 4.25, 0);
  centerObelisk.castShadow = true;
  centerObelisk.receiveShadow = true;
  scene.add(centerObelisk);
  addCircleCollider(0, 0, 2.8, 0, 8.5);
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

  return {
    id,
    group,
    body,
    head,
    weapon,
    char,
    nameSprite,
    isBot: Boolean(state.bot),
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

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    controlsLocked = locked;
    ui.lockPanel.classList.toggle("hidden", locked);
    if (locked && !matchStarted) {
      matchStarted = true;
      commitPlayerName();
      addFeed("Match started", "Arena");
      sendMultiplayerState(true);
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) return;
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.002;
    pitch = clamp(pitch, -1.32, 1.18);
  });

  window.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("mousedown", (event) => {
    if (document.pointerLockElement !== canvas) return;
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

    if (upgradeState.open) {
      if (event.code === "Digit1") {
        event.preventDefault();
        selectUpgrade(0);
        return;
      }
      if (event.code === "Digit2") {
        event.preventDefault();
        selectUpgrade(1);
        return;
      }
      if (event.code === "Digit3") {
        event.preventDefault();
        selectUpgrade(2);
        return;
      }
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

  ui.upgradeCards.forEach((card) => {
    card.root.addEventListener("click", () => {
      selectUpgrade(Number(card.root.dataset.index));
    });
  });
}

function requestArenaPointerLock() {
  if (document.pointerLockElement === canvas) return;
  const request = canvas.requestPointerLock?.();
  if (request?.catch) request.catch(() => {});
}

// Touch devices cannot use pointer lock, so enter the arena directly.
function startMobileArena() {
  controlsLocked = true;
  ui.lockPanel.classList.add("hidden");
  document.body.classList.add("playing");
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
      for (const t of event.changedTouches) {
        if (t.identifier !== lookId) continue;
        yaw -= (t.clientX - lookX) * 0.004;
        pitch -= (t.clientY - lookY) * 0.004;
        pitch = clamp(pitch, -1.32, 1.18);
        lookX = t.clientX;
        lookY = t.clientY;
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
  if (upgradeState.open && pressed) {
    // Let upgrade taps fall through to the modal cards instead.
    return;
  }
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
  updateHud();
  sendMultiplayerState(true);
  playSound("class");
  addFeed(`${data.name} selected`, "Loadout");

  if (isTouch) {
    if (ui.classToggleLabel) ui.classToggleLabel.textContent = data.name;
    if (ui.classHud) ui.classHud.classList.remove("open");
  }
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

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function update(dt) {
  const cdRate = 1 + mods.cdrBonus;
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, cooldowns[key] - dt * cdRate);
  }

  updateUpgrades();

  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (lastHitFlash > 0) {
    lastHitFlash -= dt;
    if (lastHitFlash <= 0) ui.vignette.classList.remove("active");
  }

  updatePlayer(dt);
  updateCamera();
  updateWeapon(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateZones(dt);
  updateEffects(dt);
  updateTorchLights();
  updateRemotePlayers(dt);
  sendMultiplayerState();
  updateFloatingMessages(dt);
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
  const forward = getFlatForward();
  const right = getFlatRight();
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
    wish.copy(forward);
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
  camera.position.copy(player.position);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
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

    if (enemy.frozen <= 0) {
      let move = tmpVec2.set(0, 0, 0);
      if (enemy.fear > 0 && distance > 0.01) {
        move.copy(toPlayer).normalize().multiplyScalar(-1);
      } else if (distance < 38 && distance > 2.2) {
        move.copy(toPlayer).normalize();
      } else if (distance >= 38) {
        enemy.nextWander -= dt;
        if (enemy.nextWander <= 0) {
          enemy.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          enemy.nextWander = 1.2 + Math.random() * 2.5;
        }
        move.copy(enemy.wander);
      }

      enemy.group.position.addScaledVector(move, enemy.speed * dt);
      enemy.group.position.addScaledVector(enemy.knock, dt);
      enemy.knock.multiplyScalar(Math.pow(0.05, dt));
      enemy.group.position.x = clamp(enemy.group.position.x, -46, 46);
      enemy.group.position.z = clamp(enemy.group.position.z, -46, 46);

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
    player.chargingShot = true;
    player.chargeStartedAt = performance.now();
    playSound("charge-arrow");
    sendMultiplayerState(true);
    return;
  }

  if (cooldowns.secondary > 0) return;

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
  if (!extra.quiet) {
    playSound("hit", clamp(amount / 60, 0.45, 1.25));
  }
  if (!extra.quiet) {
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
  if (!extra.quiet) {
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
  player.position.set(0, PLAYER_EYE_HEIGHT, 18);
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
  const direction = getCameraForward();
  const start = camera.position.clone().add(direction.clone().multiplyScalar(1.1));
  start.y -= 0.12;

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

function createProjectileMesh(shape, color, radius) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94 });
  if (shape === "arrow") {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6), material);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), material);
    shaft.position.y = -0.16;
    head.position.y = -0.88;
    shaft.rotation.x = Math.PI / 2;
    head.rotation.x = Math.PI;
    group.add(shaft, head);
    return group;
  }

  if (shape === "wave") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 6, 18), material);
    ring.scale.z = 0.22;
    return ring;
  }

  if (shape === "ice") {
    return new THREE.Mesh(new THREE.OctahedronGeometry(radius), material);
  }

  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), material);
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

function getFlatForward() {
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(upAxis, yaw).normalize();
}

function getFlatRight() {
  return new THREE.Vector3(1, 0, 0).applyAxisAngle(upAxis, yaw).normalize();
}

function getAimGroundPoint(maxDistance) {
  const direction = getCameraForward();
  const origin = camera.position.clone();
  if (Math.abs(direction.y) > 0.01) {
    const t = -origin.y / direction.y;
    if (t > 0 && t < maxDistance) {
      return origin.add(direction.multiplyScalar(t));
    }
  }

  const flat = getFlatForward();
  return player.position.clone().add(flat.multiplyScalar(maxDistance));
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

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  if (composer) composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
