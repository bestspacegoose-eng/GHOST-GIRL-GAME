const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const subhint = document.getElementById("subhint");
const dayLabel = document.getElementById("dayLabel");
const timeLabel = document.getElementById("timeLabel");
const dialLabel = document.getElementById("dialLabel");
const earningsLabel = document.getElementById("earningsLabel");
const titleCard = document.getElementById("titleCard");
const titleCardText = document.getElementById("titleCardText");
const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBody = document.getElementById("dialogBody");
const dialogButton = document.getElementById("dialogButton");
const minigameOverlay = document.getElementById("minigameOverlay");
const paintCanvas = document.getElementById("paintCanvas");
const paintCtx = paintCanvas.getContext("2d");
const paintPrompt = document.getElementById("paintPrompt");
const mixPrompt = document.getElementById("mixPrompt");
const paintStats = document.getElementById("paintStats");
const brushButton = document.getElementById("brushButton");
const correctButton = document.getElementById("correctButton");
const lickButton = document.getElementById("lickButton");
const submitButton = document.getElementById("submitButton");
const mixResetButton = document.getElementById("mixResetButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const HALF_HEIGHT = HEIGHT / 2;
const FOV = Math.PI / 3;
const MAX_DEPTH = 22;
const MOVE_SPEED = 2.3;
const STRAFE_SPEED = 2.1;
const TURN_SPEED = 0.0027;
const LOOK_SPEED = 0.18;
const PLAYER_RADIUS = 0.2;
const MAX_PITCH = HALF_HEIGHT * 0.72;

const SHIFT_HOURS = 7;
const SECONDS_PER_HOUR = 20;
const SHIFT_DURATION_SECONDS = SHIFT_HOURS * SECONDS_PER_HOUR;
const PAY_PER_DIAL_CENTS = 8;
const IGNORE_CORRECTION_FINE_CENTS = 10;
const DAY_NAMES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DEFAULT_BRUSH_SIZE = 4;
const WATCH_CENTER_X = 390;
const WATCH_CENTER_Y = 270;
const NUMERAL_RADIUS = 168;
const WATCH_DRAW_WIDTH = 536;
const WATCH_DRAW_HEIGHT = 396;
const ASSET_PATHS = {
  backgroundRoom: "./assets/background-radium-girls.jpg",
  roomClock: "./assets/room-clock.png",
  cursorMix: "./assets/cursor-mix.png",
  cursorBrush: "./assets/cursor-brush.png",
  cursorNail: "./assets/cursor-nail.png",
  watchFace: "./assets/watch-face.png",
  yellowPowder: "./assets/yellow-powder.png",
  gumArabic: "./assets/gum-arabic.png",
  waterPlate: "./assets/water-plate.png",
};

const keys = new Set();
let lastTime = performance.now();
let activeMessageTimer = 0;
let titleFadeTimer = 0;

const player = {
  x: 7.5,
  y: 8.45,
  angle: -Math.PI / 2,
  pitch: 0,
};

const gameState = {
  currentDay: 0,
  shiftActive: false,
  shiftEnded: false,
  dayTransition: true,
  shiftElapsed: 0,
  dialsPaintedToday: 0,
  watchesSubmittedToday: 0,
  dayEarningsCents: 0,
  totalEarningsCents: 0,
  totalDialsPainted: 0,
  dialogMode: "",
  lastShiftProgress: 0,
  lowPayDaysInRow: 0,
  warnedLowHealth: false,
  fracturePending: false,
  fractureResolved: false,
  hiddenStats: {
    health: 100,
    brushLicks: 0,
    fingernailUses: 0,
  },
};

const paintState = {
  active: false,
  cursorX: paintCanvas.width / 2,
  cursorY: paintCanvas.height / 2,
  isPainting: false,
  correcting: false,
  tool: "brush",
  tableLabel: "central",
  watchIndex: 0,
  brushSize: DEFAULT_BRUSH_SIZE,
  mix: [0, 0, 0],
  mixQuality: 0,
  dials: [],
  readyToSubmit: false,
  mode: "watch",
  fracturePieces: [],
  draggedPieceIndex: -1,
  dragOffsetX: 0,
  dragOffsetY: 0,
};

const roomState = {
  cursorX: WIDTH / 2,
  cursorY: HEIGHT / 2,
};

const assetImages = Object.fromEntries(
  Object.entries(ASSET_PATHS).map(([key, src]) => {
    const image = new Image();
    image.src = src;
    return [key, image];
  }),
);

const componentRegions = [
  { index: 0, x: 112, y: 504, rx: 52, ry: 34 },
  { index: 1, x: 208, y: 496, rx: 42, ry: 34 },
  { index: 2, x: 160, y: 584, rx: 64, ry: 28 },
];
const ROOM_HOTSPOTS = [
  { id: "clock", x: 4, y: 18, w: 54, h: 146 },
  { id: "bench-center", x: 110, y: 62, w: 56, h: 36 },
  { id: "worker-1", x: 0, y: 82, w: 28, h: 54 },
  { id: "worker-2", x: 50, y: 84, w: 28, h: 46 },
  { id: "worker-5", x: 92, y: 77, w: 28, h: 46 },
  { id: "worker-6", x: 120, y: 75, w: 28, h: 44 },
  { id: "worker-3", x: 132, y: 72, w: 44, h: 84 },
  { id: "worker-7", x: 182, y: 77, w: 34, h: 58 },
  { id: "worker-4", x: 214, y: 76, w: 40, h: 66 },
  { id: "worker-8", x: 252, y: 78, w: 30, h: 54 },
  { id: "worker-9", x: 278, y: 80, w: 30, h: 50 },
];
const REMOVED_WORKER_ORDER = ["worker-9", "worker-8", "worker-4", "worker-7", "worker-3", "worker-6", "worker-5", "worker-2", "worker-1"];
const ROOM_REMOVAL_PATCHES = [
  { id: "worker-9", source: { x: 294, y: 74, w: 22, h: 56 }, dest: { x: 278, y: 78, w: 30, h: 54 } },
  { id: "worker-8", source: { x: 286, y: 78, w: 26, h: 56 }, dest: { x: 250, y: 78, w: 32, h: 56 } },
  { id: "worker-4", source: { x: 240, y: 72, w: 28, h: 68 }, dest: { x: 212, y: 74, w: 42, h: 70 } },
  { id: "worker-7", source: { x: 196, y: 72, w: 26, h: 60 }, dest: { x: 180, y: 76, w: 36, h: 60 } },
  { id: "worker-3", source: { x: 154, y: 70, w: 20, h: 84 }, dest: { x: 132, y: 72, w: 44, h: 86 } },
  { id: "worker-6", source: { x: 140, y: 74, w: 18, h: 46 }, dest: { x: 120, y: 74, w: 28, h: 46 } },
  { id: "worker-5", source: { x: 102, y: 74, w: 16, h: 48 }, dest: { x: 92, y: 76, w: 28, h: 48 } },
  { id: "worker-2", source: { x: 58, y: 80, w: 16, h: 50 }, dest: { x: 50, y: 82, w: 28, h: 48 } },
  { id: "worker-1", source: { x: 18, y: 80, w: 12, h: 56 }, dest: { x: 0, y: 82, w: 28, h: 56 } },
];
const WORKER_PROFILES = {
  "worker-1": {
    description: ["stiff-backed", "careful-handed", "powder-dusted"],
    warmth: [
      ["Not right now.", "She turns back to her tray before the last word lands."],
      ["I have my own count to keep.", "Her voice is still clipped, but not quite as cold."],
      ["Keep your wrist loose and you'll waste less paint.", "She says it without looking up, which is warmer than yesterday."],
    ],
    appearance: [
      "Her hair is pinned tight and her apron is still clean at the hem.",
      "Loose strands have started to escape her pins and cling damply to her temples.",
      "A gap shows when she presses her mouth closed, as if she has been avoiding a sore tooth.",
      "Her smile never fully closes now. One side of her mouth looks tender and swollen.",
      "Her hair has thinned enough that the scalp shows beneath the pinned rolls.",
    ],
  },
  "worker-2": {
    description: ["narrow-eyed", "precise", "restless at the shoulders"],
    warmth: [
      ["What do you want.", "Her brush never pauses."],
      ["If you're going to ask, make it quick.", "The edge is still there, but less sharp."],
      ["You are getting faster.", "She sounds almost surprised to hear herself admit it."],
    ],
    appearance: [
      "She still sits perfectly straight, but keeps rolling her jaw as if testing it.",
      "Her lower lip is bitten pale. A few hairs cling to the dark collar of her dress.",
      "One tooth is plainly missing when she wets the brush between her lips.",
      "She keeps a hand over her mouth whenever she coughs.",
      "The skin under her eyes has gone waxy and thin, and her hairline has begun to fray.",
    ],
  },
  "worker-3": {
    description: ["quick-fingered", "watchful", "half-amused by everyone else"],
    warmth: [
      ["You're the new girl, right? Is that why you're dilly dallying?", "She says it with a sideways glance."],
      ["Still here? Then sit down and keep up.", "The tease lands more like rough camaraderie now."],
      ["You can have my lamp after supper if yours keeps flickering.", "It is the closest thing to kindness you have heard from her."],
    ],
    appearance: [
      "Her sleeves are rolled neatly and she still moves with practiced speed.",
      "She keeps touching one side of her jaw between strokes.",
      "When she smirks, you catch the dark absence of a back tooth.",
      "More hair has come loose around her ears than pins can hold.",
      "Her cheeks have hollowed and the skin along her gums looks oddly tender.",
    ],
  },
  "worker-4": {
    description: ["steady", "already half-finished", "confident in her tray work"],
    warmth: [
      ["3 handfuls powder, 2 handfuls tar, one dash of water...", "She recites it as though she is too tired to argue."],
      ["Keep the powder heavy. Thin paint wastes your whole hour.", "She taps her dish once with the brush handle."],
      ["You're not spoiling every face anymore.", "She almost smiles before looking away."],
    ],
    appearance: [
      "Her tray is already half done and her hair is still smoothed back tight.",
      "A dusting of broken hair clings to the shoulders of her blouse.",
      "When she speaks, the right side of her mouth collapses around a missing tooth.",
      "She swallows between words like even that much movement hurts.",
      "Her hair has gone patchy near the temple, and she keeps hiding her mouth behind her wrist.",
    ],
  },
  "worker-5": {
    description: ["silent", "head-down", "all concentration and no spare motion"],
    warmth: [
      ["Not right now.", "She keeps her head bent close to the dial."],
      ["Ask me after the bell, if you still mean to.", "The refusal is quieter today."],
      ["Leave your brush a little sharper than you think you need.", "She murmurs it without lifting her eyes."],
    ],
    appearance: [
      "She keeps her head down over the bench, hiding most of her face.",
      "The crown of her hair looks thinner where the lamplight catches it.",
      "Her mouth stays shut even when she exhales, as if she is guarding what is left of her teeth.",
      "A pin no longer holds because too much hair has come away with it.",
      "She looks as though she has shrunk inside her own dress since Monday.",
    ],
  },
  "worker-6": {
    description: ["lamp-lit", "tense at the jaw", "methodical in each stroke"],
    warmth: [
      ["What do you want.", "She does not stop counting under her breath."],
      ["If you spoil the edge, scrape it back and try again.", "The advice slips out before she can stop herself."],
      ["Here, watch the curve on the sixes.", "She turns the tray a fraction toward you."],
    ],
    appearance: [
      "She sits directly under the lamp, her face bright and expressionless.",
      "The light catches several broken hairs across her forehead.",
      "One side of her gums shows raw when she speaks.",
      "She works with her lips barely parted, careful not to expose the missing teeth underneath.",
      "Her lashes and brows seem thinner now, leaving her expression strangely bare.",
    ],
  },
  "worker-7": {
    description: ["efficient", "impatient", "moving in short practiced strokes"],
    warmth: [
      ["You're the new girl, right? Is that why you're dilly dallying?", "She sounds bored more than cruel."],
      ["At least you're not freezing up at the bench anymore.", "The jab lands softer than it used to."],
      ["If the manager walks by, keep your hands moving.", "It sounds like a warning given on your behalf."],
    ],
    appearance: [
      "Her hands move in short, practiced strokes and her collar is still neatly fastened.",
      "There is a brittle look to her hair, like it would come away if touched.",
      "She covers her mouth whenever she laughs at something down the row.",
      "A tooth is gone from the front now, impossible not to notice when she speaks.",
      "The skin around her jaw looks bruised from within.",
    ],
  },
  "worker-8": {
    description: ["rhythmic", "self-contained", "keeping time with the tray"],
    warmth: [
      ["3 handfuls powder, 2 handfuls tar, one dash of water...", "She offers it without turning her head."],
      ["The watch faces go dull if the water gets ahead of you.", "She says it like someone passing along a superstition."],
      ["You're still standing. That's worth something.", "It is not much, but it is meant kindly."],
    ],
    appearance: [
      "She keeps painting without breaking rhythm, though her shoulders look tight.",
      "Several strands of hair have come loose and stuck to her cheek.",
      "She no longer smiles with her mouth open.",
      "The edge of her gums shows dark in the lamplight.",
      "Her face has taken on a drawn, papery look that no amount of washing would fix.",
    ],
  },
  "worker-9": {
    description: ["guarded", "quick to glance away", "trying not to be noticed"],
    warmth: [
      ["Not right now.", "She flinches a little at her own sharpness."],
      ["You can sit here if the other bench is crowded.", "She offers it like she hopes you will not make a thing of it."],
      ["Tell me if your hand starts shaking. Mine did that first.", "The warning is quiet and sincere."],
    ],
    appearance: [
      "She only spares you a glance, but still looks almost untouched by the week.",
      "Her hair has started to look dry and coarse at the ends.",
      "She presses her tongue against a gap in her teeth when she thinks no one sees.",
      "The front of her dress is dusted with fallen hair she has stopped brushing away.",
      "She keeps one hand under her jaw as if holding something in place.",
    ],
  },
};

const spritePalettes = {
  clock: {
    ".": null,
    a: [12, 12, 12],
    b: [218, 218, 218],
    c: [130, 130, 130],
    d: [241, 244, 147],
  },
  bench: {
    ".": null,
    a: [50, 33, 24],
    b: [96, 65, 42],
    c: [151, 118, 80],
    d: [209, 193, 161],
  },
  worker: {
    ".": null,
    a: [16, 16, 16],
    b: [70, 112, 152],
    c: [144, 171, 196],
    d: [227, 200, 169],
    e: [255, 255, 255],
  },
  manager: {
    ".": null,
    a: [17, 17, 17],
    b: [69, 69, 69],
    c: [137, 137, 137],
    d: [225, 212, 192],
    e: [240, 240, 240],
  },
};

const spritePatterns = {
  clock: [
    "................",
    ".....bbbbbb.....",
    "...bbccccccbb...",
    "..bccbbbbbbccb..",
    "..ccbbddddbbcc..",
    ".bccbddddddbccb.",
    ".bccbdddaddbccb.",
    ".bccbdddaadbccb.",
    ".bccbddddddbccb.",
    ".bccbddddddbccb.",
    ".bccbbddddbbccb.",
    "..ccbbbbbbbbcc..",
    "..bccccccccccb..",
    "...bbccccccbb...",
    ".....bbbbbb.....",
    "................",
  ],
  bench: [
    "................",
    "................",
    "..cccccccccccc..",
    "..cbbbbbbbbbbc..",
    "..cbbbbbbbbbbc..",
    "..cbbbbbbbbbbc..",
    "...aaaaaaaaaa...",
    "...aa......aa...",
    "...aa......aa...",
    "...aa......aa...",
    "...aa......aa...",
    "...aa......aa...",
    "..aaaa....aaaa..",
    "..aaaa....aaaa..",
    "................",
    "................",
  ],
  worker: [
    "................",
    "......dd........",
    ".....dddd.......",
    ".....dddd.......",
    "......aa........",
    ".....bbbb.......",
    "....bbbbbb......",
    "....bbbbbb......",
    "....ccbbcc......",
    ".....bbbb.......",
    ".....bbbb.......",
    ".....b..b.......",
    "....bb..bb......",
    "...bbb..bbb.....",
    "................",
    "................",
  ],
  manager: [
    "................",
    "......dd........",
    ".....dddd.......",
    ".....dddd.......",
    "......aa........",
    ".....bbbb.......",
    "....bbccbb......",
    "....bccccc......",
    "....bccccc......",
    ".....bccc.......",
    ".....bccc.......",
    ".....b..b.......",
    "....bb..bb......",
    "...bbb..bbb.....",
    "................",
    "................",
  ],
};

function removedWorkerCount() {
  return Math.min(REMOVED_WORKER_ORDER.length, gameState.currentDay);
}

function isWorkerRemoved(id) {
  const index = REMOVED_WORKER_ORDER.indexOf(id);
  return index !== -1 && index < removedWorkerCount();
}

function drawBackgroundPatchFromDisplay(image, patch) {
  if (!imageReady(image)) return;
  const scaleX = image.naturalWidth / WIDTH;
  const scaleY = image.naturalHeight / HEIGHT;
  ctx.drawImage(
    image,
    patch.source.x * scaleX,
    patch.source.y * scaleY,
    patch.source.w * scaleX,
    patch.source.h * scaleY,
    patch.dest.x,
    patch.dest.y,
    patch.dest.w,
    patch.dest.h,
  );
}

function warmStage() {
  return Math.min(2, Math.floor(gameState.currentDay / 2));
}

function dayVariantIndex(id, length) {
  const numeric = Number(id.split("-")[1]) || 0;
  return (gameState.currentDay * 3 + numeric * 5) % length;
}

function workerAppearanceText(id) {
  const profile = WORKER_PROFILES[id];
  if (!profile) return "";
  const stage = Math.min(profile.appearance.length - 1, gameState.currentDay);
  return profile.appearance[stage];
}

function workerPromptText(id) {
  const profile = WORKER_PROFILES[id];
  if (!profile) return "She keeps her focus on the tray.";
  const descriptor = profile.description[dayVariantIndex(id, profile.description.length)];
  return `A ${descriptor} woman at the bench. ${workerAppearanceText(id)}`;
}

function workerDialogueLines(id) {
  const profile = WORKER_PROFILES[id];
  if (!profile) return ["Not right now.", ""];
  return profile.warmth[warmStage()];
}

const interactables = [
  {
    id: "clock",
    kind: "clock",
    name: "wall clock",
    x: 7.5,
    y: 9.15,
    prompt() {
      if (gameState.dayTransition) return "The day card still hangs over the room.";
      if (!gameState.shiftActive && !gameState.shiftEnded) return "Click to begin the shift.";
      if (gameState.shiftActive) return "Click when you're ready to end the shift.";
      return "The manager still has today's tally.";
    },
    interact() {
      if (gameState.dayTransition) {
        setMessage("The room needs a moment to settle.", "Then you can clock in.");
        return;
      }
      if (gameState.shiftEnded) {
        setMessage("Today's shift is already over.", "The manager has the tally.");
        return;
      }
      if (!gameState.shiftActive) {
        startShift();
      } else {
        endShift("manual");
      }
    },
  },
  {
    id: "bench-west",
    kind: "bench",
    name: "west workbench",
    x: 4.2,
    y: 6.95,
    prompt() {
      return gameState.shiftActive
        ? "Sit down and mix paint for the next watch."
        : "The bench is idle until the shift begins.";
    },
    interact() {
      if (!gameState.shiftActive) {
        setMessage("The bench is still.", "Clock in first, then start painting.");
        return;
      }
      openMinigame("west");
    },
  },
  {
    id: "bench-center",
    kind: "bench",
    name: "central workbench",
    x: 7.5,
    y: 6.95,
    prompt() {
      return gameState.shiftActive
        ? "Sit down and mix paint for the next watch."
        : "The bench is idle until the shift begins.";
    },
    interact() {
      if (!gameState.shiftActive) {
        setMessage("The bench is still.", "Clock in first, then start painting.");
        return;
      }
      openMinigame("central");
    },
  },
  {
    id: "bench-east",
    kind: "bench",
    name: "east workbench",
    x: 10.8,
    y: 6.95,
    prompt() {
      return gameState.shiftActive
        ? "Sit down and mix paint for the next watch."
        : "The bench is idle until the shift begins.";
    },
    interact() {
      if (!gameState.shiftActive) {
        setMessage("The bench is still.", "Clock in first, then start painting.");
        return;
      }
      openMinigame("east");
    },
  },
  {
    id: "worker-1",
    kind: "worker",
    name: "worker at the west tray",
    x: 2.6,
    y: 4.15,
    prompt() {
      return "She keeps painting without looking up.";
    },
    interact() {
      setMessage("Not right now.");
    },
  },
  {
    id: "worker-2",
    kind: "worker",
    name: "worker at the second tray",
    x: 5.4,
    y: 4.15,
    prompt() {
      return "Her eyes stay on the numerals in front of her.";
    },
    interact() {
      setMessage("What do you want.");
    },
  },
  {
    id: "worker-3",
    kind: "worker",
    name: "worker at the center tray",
    x: 8.2,
    y: 4.15,
    prompt() {
      return "She glances sideways without stopping her hand.";
    },
    interact() {
      setMessage("You're the new girl, right? Is that why you're dilly dallying?");
    },
  },
  {
    id: "worker-4",
    kind: "worker",
    name: "worker at the east tray",
    x: 11.0,
    y: 4.15,
    prompt() {
      return "Her tray is already half done.";
    },
    interact() {
      setMessage("3 handfuls powder, 2 handfuls tar, one dash of water...");
    },
  },
  {
    id: "worker-5",
    kind: "worker",
    name: "worker by the rear tray",
    prompt() {
      return "She keeps her head down over the bench.";
    },
    interact() {
      setMessage("Not right now.");
    },
  },
  {
    id: "worker-6",
    kind: "worker",
    name: "worker by the lamp",
    prompt() {
      return "She does not look up from the numerals.";
    },
    interact() {
      setMessage("What do you want.");
    },
  },
  {
    id: "worker-7",
    kind: "worker",
    name: "worker near the center lamp",
    prompt() {
      return "Her hands move in short, practiced strokes.";
    },
    interact() {
      setMessage("You're the new girl, right? Is that why you're dilly dallying?");
    },
  },
  {
    id: "worker-8",
    kind: "worker",
    name: "worker near the right bench",
    prompt() {
      return "She keeps painting without breaking rhythm.";
    },
    interact() {
      setMessage("3 handfuls powder, 2 handfuls tar, one dash of water...");
    },
  },
  {
    id: "worker-9",
    kind: "worker",
    name: "worker at the far right bench",
    prompt() {
      return "She only spares you a glance.";
    },
    interact() {
      setMessage("Not right now.");
    },
  },
];

for (const entry of interactables) {
  if (entry.kind !== "worker") continue;
  entry.prompt = () => workerPromptText(entry.id);
  entry.interact = () => {
    const [primary, secondary] = workerDialogueLines(entry.id);
    setMessage(primary, secondary);
  };
}

const sprites = [
  { type: "clock", x: 7.5, y: 9.05, scale: 1.15 },
  { type: "bench", x: 4.2, y: 6.98, scale: 1.05 },
  { type: "bench", x: 7.5, y: 6.98, scale: 1.05 },
  { type: "bench", x: 10.8, y: 6.98, scale: 1.05 },
  { type: "worker", x: 2.6, y: 4.15, scale: 1.08 },
  { type: "worker", x: 5.4, y: 4.15, scale: 1.08 },
  { type: "worker", x: 8.2, y: 4.15, scale: 1.08 },
  { type: "worker", x: 11.0, y: 4.15, scale: 1.08 },
  { type: "manager", x: 13.1, y: 4.05, scale: 1.15 },
];

function update(dt) {
  if (activeMessageTimer > 0) activeMessageTimer -= dt;

  if (titleFadeTimer > 0) {
    titleFadeTimer -= dt;
    if (titleFadeTimer <= 0) {
      titleCard.classList.remove("visible", "fade-out");
    }
  }

  if (gameState.shiftActive && dialogOverlay.classList.contains("hidden")) {
    gameState.shiftElapsed = Math.min(SHIFT_DURATION_SECONDS, gameState.shiftElapsed + dt);
    gameState.lastShiftProgress = gameState.shiftElapsed / SHIFT_DURATION_SECONDS;
    if (gameState.shiftElapsed >= SHIFT_DURATION_SECONDS) {
      endShift("timeout");
    }
  }

  updateHud();
}

function applyShade(color, shade) {
  return `rgb(${Math.floor(color[0] * shade)}, ${Math.floor(color[1] * shade)}, ${Math.floor(color[2] * shade)})`;
}

function getShiftProgress() {
  if (gameState.shiftActive || gameState.shiftEnded) {
    return Math.min(1, Math.max(0, gameState.shiftElapsed / SHIFT_DURATION_SECONDS));
  }
  return gameState.lastShiftProgress || 0;
}

function getSceneLightLevel() {
  const progress = getShiftProgress();
  return 1 - progress * 0.82;
}

function watchesGlowInDark() {
  return getShiftProgress() >= 0.5;
}

function roomHotspotAt(x, y) {
  return ROOM_HOTSPOTS.find((spot) => {
    if (isWorkerRemoved(spot.id)) return false;
    return x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h;
  }) || null;
}

function drawRoomScene() {
  const hoverSpot = roomHotspotAt(roomState.cursorX, roomState.cursorY);
  const background = assetImages.backgroundRoom;
  const roomClock = assetImages.roomClock;

  if (imageReady(background)) {
    ctx.save();
    ctx.globalAlpha = 0.68 + (1 - getShiftProgress()) * 0.28;
    ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
    ctx.restore();

    for (let i = 0; i < removedWorkerCount(); i += 1) {
      const patch = ROOM_REMOVAL_PATCHES[i];
      if (patch) drawBackgroundPatchFromDisplay(background, patch);
    }
  } else {
    const light = getSceneLightLevel();
    ctx.fillStyle = applyShade([98, 88, 74], light);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (hoverSpot) {
    ctx.strokeStyle = "rgba(248, 227, 168, 0.88)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hoverSpot.x, hoverSpot.y, hoverSpot.w, hoverSpot.h);
    ctx.fillStyle = "rgba(248, 227, 168, 0.12)";
    ctx.fillRect(hoverSpot.x, hoverSpot.y, hoverSpot.w, hoverSpot.h);
  }

  if (imageReady(roomClock)) {
    ctx.save();
    ctx.globalAlpha = 0.82 + (1 - getShiftProgress()) * 0.08;
    ctx.drawImage(roomClock, 0, 14, 58, 154);
    ctx.restore();
  }

  ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + getShiftProgress() * 0.74})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (watchesGlowInDark()) {
    ctx.fillStyle = `rgba(214, 255, 122, ${0.025 + (getShiftProgress() - 0.5) * 0.08})`;
    ctx.fillRect(0, 74, WIDTH, 76);
  }
}

function drawScene() {
  drawRoomScene();
}

function getTargetedInteractable() {
  const hotspot = roomHotspotAt(roomState.cursorX, roomState.cursorY);
  if (!hotspot) return null;
  const item = interactables.find((entry) => entry.id === hotspot.id);
  return item ? { item, distance: 0 } : null;
}

function setMessage(primary, secondary = "") {
  hint.textContent = primary;
  subhint.textContent = secondary;
  activeMessageTimer = 4;
}

function formatCurrency(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatShiftTime() {
  if (!gameState.shiftActive && !gameState.shiftEnded) return "Shift not started";

  const capped = Math.min(SHIFT_DURATION_SECONDS, gameState.shiftElapsed);
  const elapsedHours = Math.min(SHIFT_HOURS, Math.floor(capped / SECONDS_PER_HOUR));
  const partial = capped % SECONDS_PER_HOUR;
  const minuteValue = Math.min(59, Math.floor((partial / SECONDS_PER_HOUR) * 60));
  const militaryHour = 9 + elapsedHours;
  const meridiem = militaryHour >= 12 ? "PM" : "AM";
  const displayHour = ((militaryHour + 11) % 12) + 1;

  return `Time ${displayHour}:${minuteValue < 10 ? `0${minuteValue}` : minuteValue} ${meridiem} / Hour ${Math.min(SHIFT_HOURS, elapsedHours + 1)} of ${SHIFT_HOURS}`;
}

function updateHud() {
  dayLabel.textContent = `${DAY_NAMES[gameState.currentDay]} - DAY ${gameState.currentDay + 1}`;
  timeLabel.textContent = formatShiftTime();
  dialLabel.textContent = `Dials painted: ${gameState.dialsPaintedToday}`;
  earningsLabel.textContent = `Due today: ${formatCurrency(gameState.dayEarningsCents)}`;
}

function refreshHint() {
  if (!dialogOverlay.classList.contains("hidden")) return;

  const target = getTargetedInteractable();
  if (target) {
    hint.textContent = `Click to interact with the ${target.item.name}.`;
    subhint.textContent = target.item.prompt();
    return;
  }

  if (paintState.active) {
    hint.textContent = "Mix, paint, and inspect the numerals.";
    subhint.textContent = "The station has three unlabeled vessels and a watch face waiting under the lamp.";
    return;
  }

  if (gameState.dayTransition) {
    hint.textContent = "A new day is waiting.";
    subhint.textContent = "The room settles before the next shift begins.";
    return;
  }

  if (!gameState.shiftActive && !gameState.shiftEnded) {
    hint.textContent = "Clock in when you're ready.";
    subhint.textContent = "Click the wall clock or the back bench in the workshop image.";
    return;
  }

  if (gameState.shiftActive) {
    hint.textContent = "The shift is running.";
    subhint.textContent = "Click into the back bench to work, or the wall clock to end the day.";
    return;
  }

  hint.textContent = "The shift manager is tallying your work.";
  subhint.textContent = "Stay with the result screen to continue.";
}

function showTitleCard() {
  titleCardText.textContent = `${DAY_NAMES[gameState.currentDay]} - DAY ${gameState.currentDay + 1}`;
  titleCard.classList.add("visible");
  titleCard.classList.remove("fade-out");
  gameState.dayTransition = true;
}

function fadeTitleCard() {
  if (!titleCard.classList.contains("visible")) return;
  titleCard.classList.add("fade-out");
  titleFadeTimer = 1.25;
  gameState.dayTransition = false;
}

function setStationControlsHidden(hidden) {
  brushButton.classList.toggle("hidden", hidden);
  correctButton.classList.toggle("hidden", hidden);
  lickButton.classList.toggle("hidden", hidden);
  submitButton.classList.toggle("hidden", hidden);
  mixResetButton.classList.toggle("hidden", hidden);
}

function shouldOpenFracturePuzzle() {
  return gameState.fracturePending && !gameState.fractureResolved && gameState.currentDay >= 2;
}

function sendToDayStart(message) {
  if (shouldOpenFracturePuzzle()) {
    openFracturePuzzle(message);
    return;
  }

  showTitleCard();
  setMessage(
    `${DAY_NAMES[gameState.currentDay]} waits behind the lamps.`,
    message,
  );
}

function startShift() {
  fadeTitleCard();
  gameState.shiftActive = true;
  gameState.shiftEnded = false;
  gameState.shiftElapsed = 0;
  gameState.lastShiftProgress = 0;
  gameState.dialsPaintedToday = 0;
  gameState.watchesSubmittedToday = 0;
  gameState.dayEarningsCents = 0;
  setMessage(
    "The shift whistle kicks the room awake.",
    "Each hour now lasts 20 seconds. Every finished dial is worth 8 cents.",
  );
}

function managerLineForDay() {
  let line =
    `The shift manager tallies ${gameState.dialsPaintedToday} dial${gameState.dialsPaintedToday === 1 ? "" : "s"} ` +
    `across ${gameState.watchesSubmittedToday} watch${gameState.watchesSubmittedToday === 1 ? "" : "es"}. ` +
    `Amount due: ${formatCurrency(gameState.dayEarningsCents)}.`;

  if (gameState.dayEarningsCents < 0) {
    line += ' "This will be your last chance. Do better tomorrow."';
  } else if (gameState.dayEarningsCents < 96) {
    line += " The corrections cost you today.";
  } else {
    line += " Keep the mixture steady and the numerals clean.";
  }

  return line;
}

function finalEndingForHealth() {
  const health = gameState.hiddenStats.health;

  if (health >= 75) {
    return {
      title: "After The Factory",
      body:
        "You survived the seven days with more of yourself intact than most. Years later, when the truth about the glowing paint began to surface, you were still alive to speak, to remember the benches, and to stand among the women who forced the world to look at what had been done. The work marked you, but it did not silence you.",
    };
  }

  if (health >= 35) {
    return {
      title: "After The Factory",
      body:
        "By the end, the damage had already rooted itself deep inside you. Your jaw ached, your limbs weakened, and the slow, humiliating deterioration became impossible to hide. It did not happen all at once. It came day after day, one defect layered over another, until your body felt like something the factory had kept using long after it should have stopped.",
    };
  }

  return {
    title: "After The Factory",
    body:
      "There was no long decline left to measure. Your body gave out almost at once, spent by the poison you had carried so close for so long. The room, the benches, the luminous dust, and the tiny painted numerals ended with you before the week could become anything like a life beyond the factory.",
  };
}

function showEnding(title, body) {
  dialogTitle.textContent = title;
  dialogBody.textContent = body;
  dialogButton.textContent = "Try again?";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "restart";
}

function showLowHealthWarning() {
  dialogTitle.textContent = "On The Way Home";
  dialogBody.textContent =
    "On the walk home, you begin to notice something horribly wrong. Your teeth feel loose in your gums, though they should be fully grown and set. When you touch them, two come free at once and land in your palm.";
  dialogButton.textContent = "Continue";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "low-health-warning";
}

function endShift(reason) {
  if (!gameState.shiftActive) return;

  gameState.shiftActive = false;
  gameState.shiftEnded = true;
  closeMinigame();

  if (gameState.dayEarningsCents < 50) {
    gameState.lowPayDaysInRow += 1;
  } else {
    gameState.lowPayDaysInRow = 0;
  }

  if (gameState.lowPayDaysInRow >= 3) {
    showEnding(
      "Dismissed",
      "You came in to work the next morning, only to find a new worker already sitting at your bench.",
    );
    updateHud();
    return;
  }

  if (gameState.currentDay === 6) {
    const ending = finalEndingForHealth();
    showEnding(ending.title, ending.body);
    updateHud();
    return;
  }

  if (gameState.currentDay < 6 && gameState.hiddenStats.health < 60 && !gameState.warnedLowHealth) {
    gameState.warnedLowHealth = true;
    showLowHealthWarning();
    updateHud();
    return;
  }

  dialogTitle.textContent = `Shift manager - ${DAY_NAMES[gameState.currentDay]}`;
  dialogBody.textContent =
    `${reason === "timeout" ? "The bell cuts off the shift." : "The manager calls the day."} ` +
    managerLineForDay();
  dialogButton.textContent = "Next day";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "next-day";
  updateHud();
}

function continueAfterDialog() {
  dialogOverlay.classList.add("hidden");

  if (gameState.dialogMode === "next-day") {
    gameState.currentDay += 1;
    gameState.shiftEnded = false;
    gameState.shiftElapsed = 0;
    gameState.lastShiftProgress = 0;
    showTitleCard();
    setMessage(
      `${DAY_NAMES[gameState.currentDay]} waits behind the lamps.`,
      "Clock in again when the title card fades away.",
    );
  } else if (gameState.dialogMode === "low-health-warning") {
    gameState.currentDay += 1;
    gameState.shiftEnded = false;
    gameState.shiftElapsed = 0;
    gameState.lastShiftProgress = 0;
    showTitleCard();
    setMessage(
      `${DAY_NAMES[gameState.currentDay]} waits behind the lamps.`,
      "Something is wrong now, even away from the bench.",
    );
  } else if (gameState.dialogMode === "restart") {
    resetWeek();
  }
}

function resetWeek() {
  dialogOverlay.classList.add("hidden");
  gameState.currentDay = 0;
  gameState.shiftActive = false;
  gameState.shiftEnded = false;
  gameState.shiftElapsed = 0;
  gameState.lastShiftProgress = 0;
  gameState.dialsPaintedToday = 0;
  gameState.watchesSubmittedToday = 0;
  gameState.dayEarningsCents = 0;
  gameState.totalEarningsCents = 0;
  gameState.totalDialsPainted = 0;
  gameState.lowPayDaysInRow = 0;
  gameState.warnedLowHealth = false;
  gameState.hiddenStats.health = 100;
  gameState.hiddenStats.brushLicks = 0;
  gameState.hiddenStats.fingernailUses = 0;
  paintState.active = false;
  showTitleCard();
  setMessage(
    "A new week begins at the line.",
    "Click into the room, then use the wall clock to begin Monday.",
  );
  updateHud();
}

function buildDialState() {
  const dials = [];
  const labels = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

  for (let i = 0; i < 12; i += 1) {
    const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const x = WATCH_CENTER_X + Math.cos(angle) * NUMERAL_RADIUS;
    const y = WATCH_CENTER_Y + Math.sin(angle) * NUMERAL_RADIUS;
    dials.push({
      label: labels[i],
      x,
      y,
      targetPoints: buildNumeralPoints(labels[i], x, y),
      paintedMask: [],
      coverage: 0,
      mess: 0,
      corrected: false,
    });
  }

  for (const dial of dials) {
    dial.paintedMask = new Array(dial.targetPoints.length).fill(false);
  }

  paintState.dials = dials;
}

function digitSegments(digit) {
  return {
    0: ["a", "b", "c", "d", "e", "f"],
    1: ["b", "c"],
    2: ["a", "b", "g", "e", "d"],
    3: ["a", "b", "g", "c", "d"],
    4: ["f", "g", "b", "c"],
    5: ["a", "f", "g", "c", "d"],
    6: ["a", "f", "g", "e", "c", "d"],
    7: ["a", "b", "c"],
    8: ["a", "b", "c", "d", "e", "f", "g"],
    9: ["a", "b", "c", "d", "f", "g"],
  }[digit] || [];
}

function pushLinePoints(points, x1, y1, x2, y2, steps = 8) {
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
    });
  }
}

function buildDigitPoints(digit, offsetX, offsetY, scale) {
  const segments = digitSegments(Number(digit));
  const w = 16 * scale;
  const h = 28 * scale;
  const left = offsetX - w / 2;
  const top = offsetY - h / 2;
  const right = left + w;
  const midY = top + h / 2;
  const bottom = top + h;
  const points = [];

  for (const segment of segments) {
    if (segment === "a") pushLinePoints(points, left, top, right, top, 8);
    if (segment === "b") pushLinePoints(points, right, top, right, midY, 8);
    if (segment === "c") pushLinePoints(points, right, midY, right, bottom, 8);
    if (segment === "d") pushLinePoints(points, left, bottom, right, bottom, 8);
    if (segment === "e") pushLinePoints(points, left, midY, left, bottom, 8);
    if (segment === "f") pushLinePoints(points, left, top, left, midY, 8);
    if (segment === "g") pushLinePoints(points, left, midY, right, midY, 8);
  }

  return points;
}

function buildNumeralPoints(label, centerX, centerY) {
  const points = [];
  const chars = label.split("");
  const spacing = chars.length === 1 ? 0 : 16;
  const startX = centerX - ((chars.length - 1) * spacing) / 2;

  chars.forEach((char, index) => {
    const digitX = startX + index * spacing;
    const digitPoints = buildDigitPoints(char, digitX, centerY, chars.length === 1 ? 1.24 : 1.08);
    points.push(...digitPoints);
  });

  return points;
}

function resetMix() {
  paintState.mix = [0, 0, 0];
  paintState.mixQuality = 0;
}

function computeMixQuality() {
  const total = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  if (total <= 0) return 0;

  const ratios = paintState.mix.map((value) => value / total);
  const target = [3 / 6, 2 / 6, 1 / 6];
  const distance = Math.hypot(
    ratios[0] - target[0],
    ratios[1] - target[1],
    ratios[2] - target[2],
  );

  return Math.max(0.16, Math.min(1, 1 - distance * 1.65));
}

function mixTextureFeedback() {
  const total = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  if (total === 0) return "Three unlabeled vessels sit by the watch. Nothing has been mixed yet.";
  if (paintState.mixQuality > 0.88) return "The mixture settles into a dense, even glow.";
  if (paintState.mixQuality > 0.65) return "The mixture almost holds together. One ingredient still feels slightly off.";
  if (paintState.mixQuality > 0.4) return "The paint looks usable, but it separates quickly under the lamp.";
  return "The mixture is badly behaved: grainy, thin, and streaky at once.";
}

function currentStationMode() {
  if (paintState.tool === "nail") return "nail";
  const total = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  if (total === 0) return "mix";
  return "brush";
}

function imageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function initializeFracturePieces() {
  paintState.fracturePieces = [];
  const cols = 5;
  const rows = 4;
  const watchLeft = WATCH_CENTER_X - WATCH_DRAW_WIDTH / 2;
  const watchTop = WATCH_CENTER_Y - WATCH_DRAW_HEIGHT / 2;
  const pieceWidth = WATCH_DRAW_WIDTH / cols;
  const pieceHeight = WATCH_DRAW_HEIGHT / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const targetX = watchLeft + col * pieceWidth;
      const targetY = watchTop + row * pieceHeight;
      const scatterSide = index % 2 === 0 ? 0 : 1;
      const scatterX = scatterSide === 0
        ? 18 + (index % 3) * 46
        : paintCanvas.width - 88 - (index % 3) * 38;
      const scatterY = 34 + row * 128 + (col % 2) * 18;

      paintState.fracturePieces.push({
        sx: col * (assetImages.watchFace.naturalWidth / cols),
        sy: row * (assetImages.watchFace.naturalHeight / rows),
        sw: assetImages.watchFace.naturalWidth / cols,
        sh: assetImages.watchFace.naturalHeight / rows,
        x: scatterX,
        y: scatterY,
        w: pieceWidth,
        h: pieceHeight,
        targetX,
        targetY,
        placed: false,
      });
    }
  }
}

function openFracturePuzzle(message) {
  paintState.active = true;
  paintState.mode = "fracture";
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.draggedPieceIndex = -1;
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  initializeFracturePieces();
  setStationControlsHidden(true);
  minigameOverlay.classList.remove("hidden");
  paintPrompt.textContent = "The watch face comes apart in your hands, bloodied and wrong, as if the week itself has split open.";
  mixPrompt.textContent = "Drag the pieces back into place. When the clock is whole again, the next day can begin.";
  paintStats.textContent = "Shattered face 0/20 restored.";
  setMessage(
    `${DAY_NAMES[gameState.currentDay]} waits behind the lamps.`,
    message,
  );
  drawWatchMinigame();
}

function completeFracturePuzzle() {
  gameState.fracturePending = false;
  gameState.fractureResolved = true;
  paintState.mode = "watch";
  paintState.draggedPieceIndex = -1;
  closeMinigame();
  showTitleCard();
  setMessage(
    `${DAY_NAMES[gameState.currentDay]} waits behind the lamps.`,
    "The clock face settles back into one piece, though the room does not feel repaired.",
  );
}

function openMinigame(label) {
  paintState.active = true;
  paintState.mode = "watch";
  paintState.tableLabel = label;
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.watchIndex += 1;
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintState.readyToSubmit = false;
  resetMix();
  buildDialState();
  setStationControlsHidden(false);
  minigameOverlay.classList.remove("hidden");
  document.exitPointerLock();

  paintPrompt.textContent =
    "Combine something workable in the dish, then bring each numeral up to radiance. Poor mixes will need extra passes.";
  mixPrompt.textContent = mixTextureFeedback();
  updatePaintStats();
  drawWatchMinigame();
}

function closeMinigame() {
  paintState.active = false;
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.mode = "watch";
  paintState.fracturePieces = [];
  paintState.draggedPieceIndex = -1;
  setStationControlsHidden(false);
  minigameOverlay.classList.add("hidden");
}

function allDialsReady() {
  return paintState.dials.length > 0 && paintState.dials.every((dial) => dial.coverage >= 1);
}

function dialNeedsCorrection(dial) {
  return dial.coverage >= 1 && (dial.mess > 0.36 || dial.coverage > 1.22);
}

function correctionCount() {
  return paintState.dials.filter(dialNeedsCorrection).length;
}

function updatePaintStats() {
  const finished = paintState.dials.filter((dial) => dial.coverage >= 1).length;
  const correctionNeeded = correctionCount();
  const mixPercent = Math.round(paintState.mixQuality * 100);
  const brushState =
    paintState.brushSize <= 6.2 ? "fine tip" :
    paintState.brushSize <= 7.2 ? "slightly soft" :
    paintState.brushSize <= 8.5 ? "fanning" :
    "splayed";
  paintStats.textContent =
    `Mix quality ${mixPercent}%. Dials ready ${finished}/12. Corrections needed ${correctionNeeded}. Tool ${paintState.tool}. Brush ${brushState}.`;
  mixPrompt.textContent = mixTextureFeedback();
  correctButton.classList.toggle("hidden", correctionNeeded === 0);
  brushButton.classList.toggle("active", paintState.tool === "brush");
  correctButton.classList.toggle("active", paintState.tool === "nail");
  submitButton.textContent = correctionNeeded > 0 ? "Send watch in anyway" : "Send watch in";
}

function spendHealth(amount) {
  gameState.hiddenStats.health = Math.max(0, gameState.hiddenStats.health - amount);
}

function switchToNailMode(source = "toggle") {
  if (paintState.tool !== "nail") {
    gameState.hiddenStats.fingernailUses += 1;
    spendHealth(0.5);
    fanBrush("You set the brush aside.");
  }
  paintState.tool = "nail";
  paintState.correcting = true;
  if (source === "toggle") {
    paintPrompt.textContent = "Use your fingernails on the numerals to scrape away extra paint.";
  }
  updatePaintStats();
  drawWatchMinigame();
}

function switchToBrushMode(message = "You pick the brush back up and return to tracing the numerals.") {
  paintState.tool = "brush";
  paintState.correcting = false;
  paintPrompt.textContent = message;
  updatePaintStats();
  drawWatchMinigame();
}

function prepareNextWatch(message) {
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.readyToSubmit = false;
  resetMix();
  buildDialState();
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintPrompt.textContent = message;
  updatePaintStats();
  drawWatchMinigame();
}

function findNearestDial(x, y) {
  let best = null;

  for (const dial of paintState.dials) {
    const distance = Math.hypot(dial.x - x, dial.y - y);
    if (distance > 48) continue;
    if (!best || distance < best.distance) {
      best = { dial, distance };
    }
  }

  return best;
}

function findNearestTracePoint(x, y) {
  let best = null;

  for (const dial of paintState.dials) {
    for (let i = 0; i < dial.targetPoints.length; i += 1) {
      const point = dial.targetPoints[i];
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance > 36) continue;
      if (!best || distance < best.distance) {
        best = { dial, index: i, point, distance };
      }
    }
  }

  return best;
}

function bowlUnderCursor(x, y) {
  for (const region of componentRegions) {
    const dx = (x - region.x) / region.rx;
    const dy = (y - region.y) / region.ry;
    if (dx * dx + dy * dy <= 1) return region;
  }
  return null;
}

function addIngredient(region) {
  paintState.mix[region.index] += 1;
  paintState.mixQuality = computeMixQuality();

  if (region.index === 0) {
    paintPrompt.textContent = "The left vessel leaves a yellow dust in the dish.";
  } else if (region.index === 1) {
    paintPrompt.textContent = "The middle vessel thickens the dish with a sticky pull.";
  } else {
    paintPrompt.textContent = "The lower vessel thins the dish and darkens the surface reflection.";
  }

  updatePaintStats();
}

function paintAt(x, y) {
  if (paintState.mixQuality <= 0) {
    paintPrompt.textContent = "The brush drags dry. Nothing useful has been mixed yet.";
    return;
  }

  const hit = findNearestTracePoint(x, y);
  if (!hit) {
    paintPrompt.textContent = "Paint slips away from the numerals and wastes itself on the face.";
    for (const dial of paintState.dials) {
      const dialDistance = Math.hypot(dial.x - x, dial.y - y);
      if (dialDistance < 50) {
        dial.mess += 0.025 + (1 - paintState.mixQuality) * 0.09;
      }
    }
    updateCoverage();
    return;
  }

  const hitRadius = Math.max(14, paintState.brushSize * 1.7);
  let paintedPoints = 0;
  for (let i = 0; i < hit.dial.targetPoints.length; i += 1) {
    if (hit.dial.paintedMask[i]) continue;
    const point = hit.dial.targetPoints[i];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= hitRadius) {
      hit.dial.paintedMask[i] = true;
      paintedPoints += 1;
    }
  }

  const centerFactor = Math.max(0.58, 1 - hit.distance / 36);
  if (paintedPoints > 0) {
    hit.dial.mess += 0.006 + (1 - paintState.mixQuality) * 0.05 + (1 - centerFactor) * 0.03;
  } else {
    hit.dial.mess += 0.035 + (1 - paintState.mixQuality) * 0.08;
  }

  updateCoverage();

  if (allDialsReady()) {
    const correctionNeeded = correctionCount();
    if (correctionNeeded > 0) {
      paintPrompt.textContent =
        "Some numerals are too thick or ragged. Use your fingernails to correct them, or send the watch in for reduced pay.";
    } else {
      paintPrompt.textContent = "All twelve numerals hold their glow. You can send this watch in.";
    }
  }

  updatePaintStats();
}

function correctAt(x, y) {
  const target = findNearestDial(x, y);
  if (!target) {
    paintPrompt.textContent = "Your fingernail only skims the face where there is no paint to lift.";
    return;
  }

  let erased = 0;
  for (let i = 0; i < target.dial.targetPoints.length; i += 1) {
    if (!target.dial.paintedMask[i]) continue;
    const point = target.dial.targetPoints[i];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= 3) {
      target.dial.paintedMask[i] = false;
      erased += 1;
    }
  }

  if (erased === 0) {
    target.dial.mess = Math.max(0, target.dial.mess - 0.04);
    paintPrompt.textContent = "Your fingernail grazes the edge, but lifts almost nothing.";
  } else {
    target.dial.mess = Math.max(0, target.dial.mess - 0.18);
    target.dial.corrected = true;
    paintPrompt.textContent = "You scrape away some of the paint, erasing the numeral back toward a clean edge.";
  }

  updateCoverage();

  if (allDialsReady() && correctionCount() === 0) {
    paintPrompt.textContent = "The ragged edges are cleaned away. This watch can go in at full pay.";
  }

  updatePaintStats();
}

function updateCoverage() {
  for (const dial of paintState.dials) {
    const painted = dial.paintedMask.filter(Boolean).length;
    dial.coverage = dial.targetPoints.length === 0 ? 0 : painted / dial.targetPoints.length;
    if (dial.coverage > 1.18) dial.mess += 0.02;
  }
}

function sendCurrentWatch() {
  if (!allDialsReady()) {
    paintPrompt.textContent = "Not every numeral is luminous yet. The watch is not ready to send in.";
    return;
  }

  const uncorrected = correctionCount();
  const pay = 12 * PAY_PER_DIAL_CENTS - uncorrected * IGNORE_CORRECTION_FINE_CENTS;
  gameState.dialsPaintedToday += 12;
  gameState.watchesSubmittedToday += 1;
  gameState.dayEarningsCents += pay;
  gameState.totalEarningsCents += pay;
  gameState.totalDialsPainted += 12;

  if (uncorrected > 0) {
    paintPrompt.textContent =
      `The watch goes in with ${uncorrected} rough numeral${uncorrected === 1 ? "" : "s"}. Pay for this face: ${formatCurrency(pay)}.`;
  } else {
    paintPrompt.textContent = `The watch goes in clean. Pay for this face: ${formatCurrency(pay)}.`;
  }

  updateHud();
  updatePaintStats();

  window.setTimeout(() => {
    if (!paintState.active) return;
    prepareNextWatch("A fresh watch face is clipped into place. Mix again and bring each numeral up to radiance.");
  }, 1100);
}

function drawMosaicCrucible(cx, cy, rx, ry, palette, fillLevel, materialTint) {
  paintCtx.save();
  paintCtx.beginPath();
  paintCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  paintCtx.clip();

  for (let y = cy - ry; y < cy + ry; y += 8) {
    for (let x = cx - rx; x < cx + rx; x += 8) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1.06) continue;
      const noise = Math.sin(x * 0.17 + y * 0.11) + Math.cos(y * 0.23 - x * 0.09);
      const tile = palette[Math.abs(Math.floor(noise * 10)) % palette.length];
      paintCtx.fillStyle = tile;
      paintCtx.fillRect(x, y, 7, 7);
    }
  }

  paintCtx.restore();

  paintCtx.strokeStyle = "rgba(34, 26, 19, 0.92)";
  paintCtx.lineWidth = 6;
  paintCtx.beginPath();
  paintCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  paintCtx.stroke();

  paintCtx.strokeStyle = "rgba(240, 228, 205, 0.45)";
  paintCtx.lineWidth = 2;
  paintCtx.beginPath();
  paintCtx.ellipse(cx, cy - 4, rx * 0.82, ry * 0.72, 0, 0, Math.PI * 2);
  paintCtx.stroke();

  if (fillLevel > 0) {
    const innerRy = ry * (0.16 + fillLevel * 0.44);
    paintCtx.fillStyle = materialTint;
    paintCtx.beginPath();
    paintCtx.ellipse(cx, cy + ry * 0.1, rx * 0.72, innerRy, 0, 0, Math.PI * 2);
    paintCtx.fill();
  }
}

function drawMixDish(centerX, centerY) {
  const total = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  paintCtx.fillStyle = "#b7a285";
  paintCtx.beginPath();
  paintCtx.ellipse(centerX, centerY, 78, 44, 0, 0, Math.PI * 2);
  paintCtx.fill();

  paintCtx.fillStyle = "#eadac6";
  paintCtx.beginPath();
  paintCtx.ellipse(centerX, centerY, 68, 35, 0, 0, Math.PI * 2);
  paintCtx.fill();

  if (total > 0) {
    const yellow = paintState.mix[0] / total;
    const amber = paintState.mix[1] / total;
    const blue = paintState.mix[2] / total;
    const mixColor = [
      Math.floor(184 + yellow * 45 - blue * 18),
      Math.floor(163 + yellow * 35 - amber * 12),
      Math.floor(95 + amber * 28 + blue * 35),
    ];

    paintCtx.fillStyle = `rgb(${mixColor[0]}, ${mixColor[1]}, ${mixColor[2]})`;
    paintCtx.beginPath();
    paintCtx.ellipse(centerX, centerY + 4, 48, 20, 0, 0, Math.PI * 2);
    paintCtx.fill();

    paintCtx.fillStyle = `rgba(245, 245, 180, ${0.14 + paintState.mixQuality * 0.35})`;
    paintCtx.beginPath();
    paintCtx.ellipse(centerX - 10, centerY, 16, 8, -0.2, 0, Math.PI * 2);
    paintCtx.fill();
  }
}

function fanBrush(messageBase) {
  paintState.brushSize = Math.min(14, paintState.brushSize + 0.3);
  if (paintState.brushSize > 5.5) {
    paintPrompt.textContent = `${messageBase} The brush has started to splay.`;
  } else if (paintState.brushSize > 4) {
    paintPrompt.textContent = `${messageBase} The brush is beginning to fan.`;
  } else {
    paintPrompt.textContent = messageBase;
  }
}

function drawAssetCentered(image, x, y, width, height, alpha = 1) {
  if (!imageReady(image)) return false;
  paintCtx.save();
  paintCtx.globalAlpha = alpha;
  paintCtx.drawImage(image, x - width / 2, y - height / 2, width, height);
  paintCtx.restore();
  return true;
}

function drawWatchMinigame() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const centerX = WATCH_CENTER_X;
  const centerY = WATCH_CENTER_Y;
  const darkShift = getShiftProgress();
  const stationLight = 1 - Math.max(0, darkShift - 0.5) * 1.25;
  const faceGlowActive = watchesGlowInDark();
  const stationMode = currentStationMode();

  paintCtx.clearRect(0, 0, w, h);

  const tableGradient = paintCtx.createRadialGradient(centerX, centerY, 60, centerX, centerY, 360);
  tableGradient.addColorStop(0, "#6e5840");
  tableGradient.addColorStop(1, "#231b14");
  paintCtx.fillStyle = tableGradient;
  paintCtx.fillRect(0, 0, w, h);

  paintCtx.fillStyle = "rgba(0, 0, 0, 0.18)";
  paintCtx.fillRect(0, 0, 270, h);

  drawAssetCentered(assetImages.yellowPowder, 112, 504, 112, 154, paintState.mix[0] > 0 ? 1 : 0.42);
  drawAssetCentered(assetImages.gumArabic, 208, 496, 110, 82, paintState.mix[1] > 0 ? 1 : 0.42);
  drawAssetCentered(assetImages.waterPlate, 160, 584, 138, 84, paintState.mix[2] > 0 ? 1 : 0.42);
  drawMixDish(166, 418);

  const drewWatchFace = drawAssetCentered(assetImages.watchFace, centerX, centerY, WATCH_DRAW_WIDTH, WATCH_DRAW_HEIGHT, 1);
  if (!drewWatchFace) {
    paintCtx.fillStyle = "#c5b08d";
    paintCtx.beginPath();
    paintCtx.arc(centerX, centerY, 246, 0, Math.PI * 2);
    paintCtx.fill();

    paintCtx.fillStyle = "#f7f1e5";
    paintCtx.beginPath();
    paintCtx.arc(centerX, centerY, 214, 0, Math.PI * 2);
    paintCtx.fill();
  }

  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.font = "24px Trebuchet MS";

  for (const dial of paintState.dials) {
    const glow = Math.min(1.2, dial.coverage);
    const radius = 14 + glow * 10;

    if (glow > 0) {
      const darknessBoost = faceGlowActive ? 0.22 + (darkShift - 0.5) * 0.45 : 0;
      paintCtx.fillStyle = `rgba(233, 255, 134, ${0.12 + glow * 0.36 + darknessBoost})`;
      paintCtx.beginPath();
      paintCtx.arc(dial.x, dial.y, radius + (faceGlowActive ? 4 : 0), 0, Math.PI * 2);
      paintCtx.fill();
    }

    if (dialNeedsCorrection(dial)) {
      paintCtx.strokeStyle = paintState.correcting ? "#ffcf7a" : "#c04a3b";
      paintCtx.lineWidth = 3;
      paintCtx.beginPath();
      paintCtx.arc(dial.x, dial.y, radius + 6, 0, Math.PI * 2);
      paintCtx.stroke();
    }

    paintCtx.strokeStyle = "rgba(190, 190, 190, 0.18)";
    paintCtx.lineWidth = 2.3;
    paintCtx.lineJoin = "round";
    paintCtx.lineCap = "round";
    for (let i = 1; i < dial.targetPoints.length; i += 1) {
      const prev = dial.targetPoints[i - 1];
      const next = dial.targetPoints[i];
      if (Math.hypot(prev.x - next.x, prev.y - next.y) > 18) continue;
      paintCtx.beginPath();
      paintCtx.moveTo(prev.x, prev.y);
      paintCtx.lineTo(next.x, next.y);
      paintCtx.stroke();
    }

    for (let i = 0; i < dial.targetPoints.length; i += 1) {
      if (!dial.paintedMask[i]) continue;
      const point = dial.targetPoints[i];
      paintCtx.fillStyle = faceGlowActive ? "rgba(237,255,150,0.95)" : "rgba(201,229,95,0.92)";
      paintCtx.beginPath();
      paintCtx.arc(point.x, point.y, 3.8, 0, Math.PI * 2);
      paintCtx.fill();
    }
  }

  if (!drewWatchFace) {
    paintCtx.fillStyle = "#111";
    paintCtx.beginPath();
    paintCtx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    paintCtx.fill();

    paintCtx.fillStyle = "rgba(250, 244, 202, 0.18)";
    paintCtx.beginPath();
    paintCtx.ellipse(centerX - 60, centerY - 78, 100, 36, -0.35, 0, Math.PI * 2);
    paintCtx.fill();
  }

  if (faceGlowActive) {
    paintCtx.fillStyle = `rgba(215, 255, 132, ${0.08 + (darkShift - 0.5) * 0.22})`;
    paintCtx.beginPath();
    paintCtx.arc(centerX, centerY, 252, 0, Math.PI * 2);
    paintCtx.fill();
  }

  paintCtx.fillStyle = "#d0b893";
  paintCtx.fillRect(246, 498, 16, 86);
  paintCtx.fillStyle = "#f0eeaa";
  paintCtx.beginPath();
  paintCtx.arc(254, 490, Math.max(3, paintState.brushSize * 0.55), 0, Math.PI * 2);
  paintCtx.fill();

  paintCtx.fillStyle = paintState.tool === "brush" ? "#f4f1c1" : "#b9aa8a";
  paintCtx.fillRect(258, 422, 20, 90);
  paintCtx.fillStyle = paintState.tool === "brush" ? "#ccb38b" : "#8d785c";
  paintCtx.fillRect(264, 416, 8, 16);

  paintCtx.fillStyle = paintState.tool === "nail" ? "#f7d9b8" : "#8e7a67";
  paintCtx.beginPath();
  paintCtx.ellipse(280, 340, 28, 16, -0.4, 0, Math.PI * 2);
  paintCtx.fill();
  paintCtx.fillStyle = paintState.tool === "nail" ? "#fff0d6" : "#bba78d";
  paintCtx.beginPath();
  paintCtx.ellipse(288, 334, 10, 5, -0.4, 0, Math.PI * 2);
  paintCtx.fill();

  drawImageCursor(stationMode);

  if (gameState.shiftActive || gameState.shiftEnded) {
    paintCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - stationLight) * 0.62})`;
    paintCtx.fillRect(0, 0, w, h);
  }
}

function drawImageCursor(mode) {
  const image = mode === "mix"
    ? assetImages.cursorMix
    : mode === "brush"
      ? assetImages.cursorBrush
      : assetImages.cursorNail;

  if (!imageReady(image)) {
    paintCtx.save();
    paintCtx.strokeStyle = "rgba(255,255,255,0.9)";
    paintCtx.lineWidth = 2;
    paintCtx.beginPath();
    paintCtx.arc(paintState.cursorX, paintState.cursorY, 8, 0, Math.PI * 2);
    paintCtx.stroke();
    paintCtx.beginPath();
    paintCtx.moveTo(paintState.cursorX - 12, paintState.cursorY);
    paintCtx.lineTo(paintState.cursorX + 12, paintState.cursorY);
    paintCtx.moveTo(paintState.cursorX, paintState.cursorY - 12);
    paintCtx.lineTo(paintState.cursorX, paintState.cursorY + 12);
    paintCtx.stroke();
    paintCtx.restore();
    return;
  }

  if (mode === "brush") {
    const width = 74;
    const height = 74;
    const scaleX = width / 544;
    const scaleY = height / 543;
    const tipX = 84 * scaleX;
    const tipY = 503 * scaleY;
    paintCtx.drawImage(image, paintState.cursorX - tipX, paintState.cursorY - tipY, width, height);
    return;
  }

  if (mode === "nail") {
    const width = 78;
    const height = 78;
    const scaleX = width / 956;
    const scaleY = height / 956;
    const tipX = 72 * scaleX;
    const tipY = 60 * scaleY;
    paintCtx.drawImage(image, paintState.cursorX - tipX, paintState.cursorY - tipY, width, height);
    return;
  }

  const width = 72;
  const height = 64;
  const scaleX = width / 740;
  const scaleY = height / 656;
  const tipX = 44 * scaleX;
  const tipY = 66 * scaleY;
  paintCtx.drawImage(image, paintState.cursorX - tipX, paintState.cursorY - tipY, width, height);
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  drawScene();
  if (paintState.active) drawWatchMinigame();
  if (activeMessageTimer <= 0) refreshHint();

  requestAnimationFrame(frame);
}

function pointerInsidePaintCanvas(event) {
  const rect = paintCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * paintCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * paintCanvas.height;
  return {
    x: Math.max(0, Math.min(paintCanvas.width, x)),
    y: Math.max(0, Math.min(paintCanvas.height, y)),
  };
}

dialogButton.addEventListener("click", continueAfterDialog);

brushButton.addEventListener("click", () => {
  switchToBrushMode();
});

correctButton.addEventListener("click", () => {
  switchToNailMode();
});

lickButton.addEventListener("click", () => {
  gameState.hiddenStats.brushLicks += 1;
  spendHealth(2);
  paintState.tool = "brush";
  paintState.correcting = false;
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintPrompt.textContent = "You mouth-point the brush before tracing the next strokes. The tip narrows back into working shape.";
  updatePaintStats();
  drawWatchMinigame();
});

submitButton.addEventListener("click", sendCurrentWatch);

mixResetButton.addEventListener("click", () => {
  resetMix();
  paintPrompt.textContent = "You empty the dish and start the mixture again from nothing.";
  updatePaintStats();
  drawWatchMinigame();
});

paintCanvas.addEventListener("mousemove", (event) => {
  const position = pointerInsidePaintCanvas(event);
  paintState.cursorX = position.x;
  paintState.cursorY = position.y;

  if (paintState.active && paintState.isPainting) {
    if (paintState.tool === "brush") {
      paintAt(position.x, position.y);
    } else {
      correctAt(position.x, position.y);
    }
  }
});

paintCanvas.addEventListener("mousedown", (event) => {
  if (!paintState.active) return;

  const position = pointerInsidePaintCanvas(event);
  paintState.cursorX = position.x;
  paintState.cursorY = position.y;

  const region = bowlUnderCursor(position.x, position.y);
  if (region) {
    addIngredient(region);
    drawWatchMinigame();
    return;
  }

  if (Math.hypot(position.x - 266, position.y - 468) < 56) {
    switchToBrushMode("You pick up the brush from the side of the station.");
    return;
  }

  if (Math.hypot(position.x - 282, position.y - 340) < 36) {
    switchToNailMode("prop");
    paintPrompt.textContent = "You set the brush down and use your fingernails as an eraser instead.";
    updatePaintStats();
    drawWatchMinigame();
    return;
  }

  if (paintState.tool === "nail") {
    correctAt(position.x, position.y);
    drawWatchMinigame();
    return;
  }

  paintState.isPainting = true;
  paintAt(position.x, position.y);
  drawWatchMinigame();
});

window.addEventListener("mouseup", () => {
  paintState.isPainting = false;
});

document.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "Escape" && paintState.active) {
    closeMinigame();
    setMessage("You stand back up from the bench.", "The line keeps moving while the next watch waits under the lamp.");
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (paintState.active || !dialogOverlay.classList.contains("hidden")) return;

  if (gameState.dayTransition) {
    fadeTitleCard();
    setMessage(
      "The workshop settles around you.",
      "Click the wall clock, the workers, or the back bench in the workshop photo.",
    );
    return;
  }

  const target = getTargetedInteractable();
  if (target) {
    target.item.interact();
  } else {
    setMessage(
      "Nothing useful there.",
      "Click the wall clock, a worker, or the back bench in the workshop photo.",
    );
  }
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  roomState.cursorX = ((event.clientX - rect.left) / rect.width) * WIDTH;
  roomState.cursorY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
});

showTitleCard();
updateHud();
drawWatchMinigame();
requestAnimationFrame(frame);
