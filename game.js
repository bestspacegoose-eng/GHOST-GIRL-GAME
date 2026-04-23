const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const subhint = document.getElementById("subhint");
const dayLabel = document.getElementById("dayLabel");
const timeLabel = document.getElementById("timeLabel");
const dialLabel = document.getElementById("dialLabel");
const earningsLabel = document.getElementById("earningsLabel");
const healthLabel = document.getElementById("healthLabel");
const healthFill = document.getElementById("healthFill");
const titleCard = document.getElementById("titleCard");
const titleCardText = document.getElementById("titleCardText");
const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBody = document.getElementById("dialogBody");
const dialogAltButton = document.getElementById("dialogAltButton");
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
const wipeButton = document.getElementById("wipeButton");
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
const SECONDS_PER_HOUR = 60;
const SHIFT_DURATION_SECONDS = SHIFT_HOURS * SECONDS_PER_HOUR;
const PAY_PER_DIAL_CENTS = 8;
const IGNORE_CORRECTION_FINE_CENTS = 10;
const DAY_NAMES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const HEALTH_DRIFT_THRESHOLD = 80;
const GUARANTEED_THRESHOLD_THOUGHT = "Why does my hand feel unsteady already? It shouldn't be this hard to hold a straight line.";
const DEFAULT_BRUSH_SIZE = 0.22;
const WATCH_FACE_ASPECT = 1536 / 1024;
const WATCH_CENTER_X = 409;
const WATCH_CENTER_Y = 282;
const NUMERAL_RADIUS = 116;
const WATCH_DRAW_WIDTH = 426;
const WATCH_DRAW_HEIGHT = Math.round(WATCH_DRAW_WIDTH / WATCH_FACE_ASPECT);
const FRACTURE_DRAW_WIDTH = 592;
const FRACTURE_DRAW_HEIGHT = 472;
const FRACTURE_CENTER_X = 320;
const FRACTURE_CENTER_Y = WATCH_CENTER_Y;
const ZOOM_CENTER_X = paintCanvas.width / 2;
const ZOOM_CENTER_Y = paintCanvas.height / 2;
const ZOOM_SCALE = 4.35;
const MAX_PAINT_LOAD = 1;
const PAINT_DRAIN_PER_STROKE = 0.012;
const STATION_LAYOUT = {
  powder: { x: 98, y: 210, w: 118, h: 156, rx: 44, ry: 48 },
  gum: { x: 170, y: 352, w: 112, h: 86, rx: 42, ry: 28 },
  water: { x: 58, y: 362, w: 112, h: 84, rx: 42, ry: 28 },
  dish: { x: 112, y: 504, w: 156, h: 116, rx: 52, ry: 34 },
  zoomPaint: { x: 96, y: 108, w: 122, h: 90, rx: 44, ry: 30 },
  brushProp: { x: 236, y: 460, r: 48 },
  nailProp: { x: 252, y: 338, r: 30 },
};
const ASSET_PATHS = {
  backgroundRoom: "./assets/background-radium-girls.jpg",
  roomClock: "./assets/room-clock.png",
  cursorMix: "./assets/cursor-mix.png",
  cursorBrush: "./assets/cursor-brush.png",
  cursorNail: "./assets/cursor-nail.png",
  watchFace: "./assets/watch-face.png",
  completedWatchFace: "./assets/completed-watch-face.png",
  brokenClockPhoto: "./assets/broken-clock-photo.png",
  fractureOverlay: "./assets/fracture-overlay.png",
  factoryPatchPhoto: "./assets/factory-patch-photo.jpg",
  yellowPowder: "./assets/yellow-powder.png",
  gumArabic: "./assets/gum-arabic.png",
  waterPlate: "./assets/water-plate.png",
  mixedPaint: "./assets/mixed-paint.png",
  thoughtPopup: "./assets/thought-popup.png",
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
  dayOneIntroSeen: false,
  dayFiveCutsceneSeen: false,
  joinedWorkers: false,
  warnedLowHealth: false,
  fracturePending: false,
  fractureResolved: false,
  hiddenStats: {
    health: 100,
    brushLicks: 0,
    fingernailUses: 0,
  },
  thresholdThoughtQueued: false,
  thresholdThoughtShown: false,
  savedBenchWork: {},
};

const paintState = {
  active: false,
  pointerX: paintCanvas.width / 2,
  pointerY: paintCanvas.height / 2,
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
  activeDialIndex: 0,
  zoomedDialIndex: -1,
  paintLoaded: 0,
  readyToSubmit: false,
  mode: "watch",
  fracturePieces: [],
  draggedPieceIndex: -1,
  dragOffsetX: 0,
  dragOffsetY: 0,
  thoughtPopup: null,
  nextThoughtTimer: 9,
  lastPointerMoveAt: 0,
};

const THOUGHTS_LIGHT = [
  [
    "I wonder how Elly's doing in school right now.",
    "Did Mom remember to pack her lunch today?",
    "I have to pick Denny up later.",
    "I hope the first pay is as good as they promised.",
  ],
  [
    "I should stop by the grocer before he shuts the till.",
    "I need to remember the hem on my blue dress tonight.",
    "I hope the little ones aren't quarreling over supper again.",
    "Maybe I can bring something sweet home if this week goes well.",
  ],
  [
    "My jaw feels sore. Have I been holding it too tight?",
    "I need to keep my hand steady. I can't lose this work.",
    "I should write down what Denny needs for school before I forget.",
    "Maybe the exhaustion will wear off after a good night's sleep.",
  ],
  [
    "I ought to rest more. My body's acting up.",
    "If I come in early tomorrow, maybe I can make up today's total.",
    "I shouldn't keep thinking about the ache in my mouth.",
    "I need to remember to smile when I get home so no one worries.",
  ],
  [
    "If I keep quiet and keep working, everything will stay...fine.",
    "I can't bring bad news home on top of everything else.",
    "I should ask if Elly needs new shoes before the weather turns.",
    "The girls are kinder now. I didn't think that would happen.",
  ],
  [
    "I have to get through today and then the next one after it.",
    "Maybe if I don't touch my jaw it won't start throbbing again.",
    "I can't let them see how tired I am when I get home.",
    "If the little ones ask, I'll tell them work is going well.",
  ],
  [
    "Just finish the dial in front of you.",
    "Think about the next breath, not the whole night.",
    "If I can stand through this shift, I can stand through the next hour.",
    "I cannot let myself look frightened before I leave the room.",
  ],
];

const THOUGHTS_DARK = [
  [
    "I wonder what will happen to me...",
    "They said it's normal. Just trust them. Keep your head down. Keep working.",
    "Don't think too far ahead. Just finish the tray.",
    "If I bring home enough money, maybe none of this will matter.",
  ],
  [
    "What if this ache doesn't go away?",
    "Maybe everyone feels this bad and no one says it aloud.",
    "Don't think about your teeth. Just finish the dial.",
    "If I stop now, what happens to everyone at home?",
  ],
  [
    "Something is wrong. Keep working anyway.",
    "I shouldn't be this tired from sitting still.",
    "If I make enough today, I can ignore this for one more night.",
    "I don't want anyone at home to notice my face.",
  ],
  [
    "The dark makes the paint look beautiful. That feels like a trick.",
    "What if this follows me home and never leaves?",
    "Keep your head down. Let the hour pass.",
    "I can be afraid later. Not here. Not yet.",
  ],
  [
    "I don't know how much longer I can pretend this is normal.",
    "They keep saying it's fine. Then why does it hurt like this?",
    "If I tell the truth at home, they'll beg me to stop.",
    "Don't open your mouth too wide. Don't let them see.",
  ],
  [
    "I feel as if something is digesting me from the inside out.",
    "I wish I could leave before the room goes dark again.",
    "My body knows something my mind won't say.",
    "Keep working. Keep smiling. Keep earning. Keep quiet.",
  ],
  [
    "I don't know whether I am enduring this or dying inside it.",
    "What if the girls see it on me before I can hide it?",
    "If I leave, we lose the money. If I stay, what do I lose next?",
    "Just one more dial. Just one more.",
  ],
];

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
  { index: 0, x: STATION_LAYOUT.powder.x, y: STATION_LAYOUT.powder.y, rx: STATION_LAYOUT.powder.rx, ry: STATION_LAYOUT.powder.ry },
  { index: 1, x: STATION_LAYOUT.gum.x, y: STATION_LAYOUT.gum.y, rx: STATION_LAYOUT.gum.rx, ry: STATION_LAYOUT.gum.ry },
  { index: 2, x: STATION_LAYOUT.water.x, y: STATION_LAYOUT.water.y, rx: STATION_LAYOUT.water.rx, ry: STATION_LAYOUT.water.ry },
];
const ROOM_HOTSPOTS = [
  { id: "clock", x: 4, y: 18, w: 54, h: 146 },
  { id: "bench-center", x: 114, y: 64, w: 46, h: 28 },
  { id: "worker-1", x: 4, y: 86, w: 20, h: 46 },
  { id: "worker-2", x: 54, y: 86, w: 20, h: 42 },
  { id: "worker-5", x: 95, y: 80, w: 20, h: 40 },
  { id: "worker-6", x: 123, y: 78, w: 20, h: 38 },
  { id: "worker-3", x: 140, y: 74, w: 28, h: 74 },
  { id: "worker-7", x: 187, y: 80, w: 22, h: 50 },
  { id: "worker-4", x: 220, y: 79, w: 28, h: 58 },
  { id: "worker-8", x: 255, y: 81, w: 22, h: 48 },
  { id: "worker-9", x: 282, y: 82, w: 22, h: 44 },
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
    dailyDialogue: [
      ["I need this tray right the first time.", "She keeps her eyes on the numerals."],
      ["Count your strokes before you trust your hand.", "It sounds like instruction, not dismissal."],
      ["If your wrist locks, breathe once and start again.", "She spares you a quick glance."],
      ["You settle faster when you stop fighting the curve.", "Her tone has softened a little."],
      ["Leave the dish heavier and the paint will listen.", "She nudges her own tray toward you for a second."],
      ["You're doing steadier work than you did on Monday.", "She almost sounds proud to say it."],
      ["Sit beside me if the lamp on your bench starts acting up.", "The offer is quiet and sincere."],
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
    dailyDialogue: [
      ["Ask quick. I am on my ninth face already.", "Her brush keeps moving."],
      ["Keep your line lighter on the ones and tens.", "She says it like a correction, but she still says it."],
      ["Don't flood the stroke. Let the tip do the work.", "The advice comes before she can stop herself."],
      ["You are wasting less paint today.", "She sounds grudgingly impressed."],
      ["If your hand shakes, rest it against the rim first.", "She demonstrates with two fingers."],
      ["You picked this up faster than most new girls do.", "She lets the compliment stand."],
      ["Take the seat by the brighter lamp tomorrow if you need it.", "Her voice is gentle now."],
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
    dailyDialogue: [
      ["New girl, if you keep staring at the dial it won't paint itself.", "The tease lands sharp."],
      ["You're still here, so I suppose you mean to learn.", "She smirks without looking up."],
      ["Your sixes are cleaner than yesterday's.", "She says it like a challenge met."],
      ["Try pulling the second digit later on the elevens.", "Her hand sketches the motion in the air."],
      ["You can borrow my spare rag if yours is already stiff.", "The joke is gone from her voice."],
      ["I've been watching. You're not the slowest hand in this row anymore.", "That is practically affection from her."],
      ["If the manager presses you, send him to me.", "She says it like a promise."],
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
    dailyDialogue: [
      ["Three measures thick, one measure thin. That is all you need to remember.", "She speaks like she has said it a hundred times."],
      ["The paint should drag a little. If it runs, you have already lost the face.", "She taps her bowl with the brush handle."],
      ["Hold the edge on the tens a heartbeat longer.", "Her tray stays half-finished even while she advises you."],
      ["That last watch of yours looked almost respectable.", "She permits herself a brief smile."],
      ["You are finally painting like someone who expects to be paid for it.", "The line is dry, but not cruel."],
      ["Here, look at the weight on my twelves.", "She turns the dial toward you."],
      ["I knew you'd make yourself useful if you stayed long enough.", "It sounds warmer than she intends."],
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
    dailyDialogue: [
      ["Not now. I have to finish this face clean.", "Her head stays bent low."],
      ["If you're asking how to start, start smaller.", "She barely lifts her voice."],
      ["Keep the brush sharper than seems reasonable.", "She says it as though passing along a secret."],
      ["You can fix more with less paint than you think.", "Her tone has turned patient."],
      ["I noticed you stopped overfilling the lower strokes.", "She sounds almost relieved for you."],
      ["When you panic, slow the second pass instead of the first.", "The advice comes softly."],
      ["You've got a worker's hand now. That's hard won.", "She finally looks up when she says it."],
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
    dailyDialogue: [
      ["What is it. I am counting.", "She never loses the rhythm under her breath."],
      ["If the edge blooms, scrape it back before it hardens.", "The correction comes automatically."],
      ["Watch the curve on the sixes. Don't force the turn.", "She turns the tray a fraction toward you."],
      ["Your hand is steadier under this lamp than under the far one.", "She notices more than she admits."],
      ["You don't have to rush every stroke just because the room does.", "Her voice has softened."],
      ["Sit here a moment and watch the way I pull the twos.", "She makes space beside her tray."],
      ["You remind me of how I sounded my first week.", "She says it with an ache of fondness."],
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
    dailyDialogue: [
      ["If you're going to linger, at least pretend you're working.", "She does not look up."],
      ["You froze less today. That's an improvement.", "The jab lands lighter than yesterday."],
      ["Keep your hand moving if the manager comes down this row.", "The warning is clearly for your sake."],
      ["Don't let the first stroke bully the second one.", "She flicks her brush at the air."],
      ["You're starting to look like you belong at the bench.", "She says it briskly, but means it."],
      ["If your dish turns thin, steal a touch more powder and say nothing.", "Her mouth tightens around the advice."],
      ["I'd rather have you on this row than most of the girls they've lost.", "It is the kindest thing she has said all week."],
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
    dailyDialogue: [
      ["If the water gets ahead of you, the whole face goes dead.", "She speaks without breaking rhythm."],
      ["Listen to the paint. It tells on itself when the mix is wrong.", "Her voice is low and even."],
      ["You don't have to press so hard to make it bright.", "She nods toward your brush hand."],
      ["That's a cleaner nine than you gave me yesterday.", "Her approval is subtle but real."],
      ["You are still standing, and that counts for something here.", "The line carries more kindness now."],
      ["Take a breath before the twelves. Everybody crowds them.", "She says it like a sister would."],
      ["I save the seat near me when I think you'll need the room.", "She finally says it plainly."],
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
    dailyDialogue: [
      ["Not now. I'm trying not to lose this one.", "She glances away as soon as she says it."],
      ["If the other benches crowd you, there's room here.", "The offer is shy and quickly given."],
      ["Tell me if your hand starts shaking. Mine did that first.", "She watches your face when she says it."],
      ["Use less paint on the inside edge and it won't bunch.", "She taps the air with one finger."],
      ["I kept an extra clean rag in case you needed one.", "She slides it over without fanfare."],
      ["You don't have to prove yourself every second anymore.", "The reassurance comes awkwardly but honestly."],
      ["I'm glad you stayed.", "She says it so quietly you almost miss it."],
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
  const dayIndex = Math.min(6, gameState.currentDay);
  return profile.dailyDialogue[dayIndex];
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
      return !gameState.shiftActive && !gameState.shiftEnded
        ? "She looks like she might explain the work if you ask before the bell."
        : "She glances sideways without stopping her hand.";
    },
    interact() {
      if (!gameState.shiftActive && !gameState.shiftEnded) {
        showBenchTutorial();
        return;
      }
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
  if (entry.id === "worker-3") continue;
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

  updateThoughtPopups(dt);

  updateHud();
}

function workingAtBench() {
  return paintState.active && paintState.mode === "watch";
}

function currentThoughtPool() {
  const dayIndex = Math.min(6, gameState.currentDay);
  const poolSet = gameState.hiddenStats.health < 50 ? THOUGHTS_DARK : THOUGHTS_LIGHT;
  return poolSet[dayIndex];
}

function nextThoughtDelay() {
  if (gameState.currentDay <= 2) return 60;
  const healthFactor = 1 - Math.max(0, Math.min(100, gameState.hiddenStats.health)) / 100;
  return Math.max(9, 42 - healthFactor * 24);
}

function wrapThoughtText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (paintCtx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function fitThoughtText(text, frame) {
  const fontSize = 14;
  const lineHeight = 18;
  let lines = [text];
  let maxLineWidth = 0;
  paintCtx.save();
  paintCtx.font = `${fontSize}px Georgia`;
  lines = wrapThoughtText(text, frame.w);
  for (const line of lines) {
    maxLineWidth = Math.max(maxLineWidth, paintCtx.measureText(line).width);
  }
  paintCtx.restore();
  return { fontSize, lineHeight, lines, maxLineWidth };
}

function thoughtPopupAspect() {
  const image = assetImages.thoughtPopup;
  return imageReady(image) ? image.naturalWidth / image.naturalHeight : 1.5;
}

function thoughtPopupFrame(popup) {
  const aspect = thoughtPopupAspect();
  const width = popup.w;
  const height = width / aspect;
  return {
    x: popup.x,
    y: popup.y,
    w: width,
    h: height,
  };
}

function thoughtPanelFrame(popup) {
  const frame = thoughtPopupFrame(popup);
  return {
    x: frame.x + frame.w * 0.145,
    y: frame.y + frame.h * 0.225,
    w: frame.w * 0.62,
    h: frame.h * 0.56,
  };
}

function thoughtTextFrame(popup) {
  const frame = thoughtPanelFrame(popup);
  return {
    x: frame.x + 10,
    y: frame.y + 10,
    w: frame.w - 20,
    h: frame.h - 20,
  };
}

function spawnThoughtPopup(forcedText = null) {
  const pool = currentThoughtPool();
  const text = forcedText || pool[Math.floor(Math.random() * pool.length)];
  const dark = gameState.hiddenStats.health < 50;
  const aspect = thoughtPopupAspect();
  let width = dark ? 352 : 328;
  let height = Math.max(236, width / aspect);
  let fitted = fitThoughtText(text, thoughtTextFrame({ x: 0, y: 0, w: width, h: height }));

  while (
    (
      fitted.lines.length * fitted.lineHeight > thoughtTextFrame({ x: 0, y: 0, w: width, h: height }).h ||
      fitted.maxLineWidth > thoughtTextFrame({ x: 0, y: 0, w: width, h: height }).w
    ) &&
    width < 640
  ) {
    width += 20;
    height = Math.max(236, width / aspect);
    fitted = fitThoughtText(text, thoughtTextFrame({ x: 0, y: 0, w: width, h: height }));
  }

  const finalTextFrame = thoughtTextFrame({ x: 0, y: 0, w: width, h: height });
  height = Math.max(height, ((fitted.lines.length * fitted.lineHeight) + 20) / (finalTextFrame.h / height));
  const x = Math.max(24, Math.min(paintCanvas.width - width - 24, Math.random() * Math.max(1, paintCanvas.width - width - 48) + 24));
  const y = Math.max(24, Math.min(paintCanvas.height - height - 24, Math.random() * Math.max(1, paintCanvas.height - height - 48) + 24));
  const dial = activeDial();
  const requiresDismiss = Boolean(
    dial &&
    paintState.zoomedDialIndex !== -1 &&
    x < ZOOM_CENTER_X + 132 &&
    x + width > ZOOM_CENTER_X - 132 &&
    y < ZOOM_CENTER_Y + 132 &&
    y + height > ZOOM_CENTER_Y - 132
  );

  paintState.thoughtPopup = {
    text,
    dark,
    x,
    y,
    w: width,
    h: height,
    closeSize: 44,
    requiresDismiss,
    ttl: requiresDismiss ? Infinity : 8.5,
  };
}

function updateThoughtPopups(dt) {
  if (!workingAtBench() || !gameState.shiftActive || !dialogOverlay.classList.contains("hidden") || paintState.mode === "fracture") {
    return;
  }

  if (paintState.thoughtPopup) {
    if (!paintState.thoughtPopup.requiresDismiss) {
      paintState.thoughtPopup.ttl -= dt;
      if (paintState.thoughtPopup.ttl <= 0) {
        closeThoughtPopup();
      }
    }
    return;
  }

  if (gameState.thresholdThoughtQueued && !gameState.thresholdThoughtShown) {
    spawnThoughtPopup(GUARANTEED_THRESHOLD_THOUGHT);
    gameState.thresholdThoughtQueued = false;
    gameState.thresholdThoughtShown = true;
    paintState.nextThoughtTimer = nextThoughtDelay();
    return;
  }

  paintState.nextThoughtTimer -= dt;
  if (paintState.nextThoughtTimer > 0) return;

  spawnThoughtPopup();
  paintState.nextThoughtTimer = nextThoughtDelay();
}

function closeThoughtPopup() {
  paintState.thoughtPopup = null;
  paintState.nextThoughtTimer = nextThoughtDelay();
}

function thoughtCloseHitbox() {
  if (!paintState.thoughtPopup) return null;
  const frame = thoughtPopupFrame(paintState.thoughtPopup);
  return {
    x: frame.x + frame.w - paintState.thoughtPopup.closeSize - 26,
    y: frame.y + 20,
    w: paintState.thoughtPopup.closeSize,
    h: paintState.thoughtPopup.closeSize,
  };
}

function pointInsideThoughtClose(x, y) {
  const close = thoughtCloseHitbox();
  if (!close) return false;
  return x >= close.x && x <= close.x + close.w && y >= close.y && y <= close.y + close.h;
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
  const health = Math.max(0, Math.min(100, gameState.hiddenStats.health));
  dayLabel.textContent = `${DAY_NAMES[gameState.currentDay]} - DAY ${gameState.currentDay + 1}`;
  timeLabel.textContent = formatShiftTime();
  dialLabel.textContent = `Dials painted: ${gameState.dialsPaintedToday}`;
  earningsLabel.textContent = `Due today: ${formatCurrency(gameState.dayEarningsCents)}`;
  healthLabel.textContent = `Health: ${Math.round(health)}%`;
  healthFill.style.transform = `scaleX(${health / 100})`;
  healthFill.style.filter = health < 35 ? "saturate(0.7) brightness(0.8)" : "none";
}

function refreshHint() {
  if (!dialogOverlay.classList.contains("hidden")) return;

  const target = getTargetedInteractable();
  if (target) {
    hint.textContent = `Click to interact with the ${target.item.name}.`;
    subhint.textContent = target.item.prompt();
    return;
  }

  if (paintState.active && paintState.mode === "fracture") {
    hint.textContent = "The broken clock waits under your hands.";
    subhint.textContent = "Drag each piece back into place so that your mind slots into place.";
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
    if (gameState.currentDay === 4 && !gameState.dayFiveCutsceneSeen) {
      hint.textContent = "The girls are gathering before the bell.";
      subhint.textContent = "Click the wall clock to decide whether to stand with them or return to the bench.";
      return;
    }
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
  wipeButton.classList.toggle("hidden", hidden);
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

function startShift(force = false) {
  if (!force && gameState.currentDay === 0 && !gameState.dayOneIntroSeen) {
    showDayOneIntro();
    return;
  }

  if (!force && gameState.currentDay === 4 && !gameState.dayFiveCutsceneSeen && !gameState.joinedWorkers) {
    showDayFiveCutscene();
    return;
  }

  fadeTitleCard();
  gameState.shiftActive = true;
  gameState.shiftEnded = false;
  gameState.shiftElapsed = 0;
  gameState.lastShiftProgress = 0;
  gameState.savedBenchWork = {};
  gameState.dialsPaintedToday = 0;
  gameState.watchesSubmittedToday = 0;
  gameState.dayEarningsCents = 0;
  setMessage(
    "The shift whistle kicks the room awake.",
    "Each hour now lasts 1 real minute. Every finished dial is worth 8 cents.",
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

function endOfDayReflection() {
  const health = gameState.hiddenStats.health;
  const day = gameState.currentDay;

  const opening = day === 0
    ? "On the way home, you try to believe this factory might be the answer you were promised."
    : "On the way home, the day looms over you even as the neon lights fade from the shells of your eyes.";

  let body;
  if (health >= 80) {
    body =
      "You think about your family first: six siblings, too many hungry mouths, and you in the middle of them trying to turn one of the few jobs available to women into something steady and respectable. The pay still feels worth chasing. Any soreness in your hand or jaw is easy enough to dismiss as the cost of learning skilled work.";
  } else if (health >= 60) {
    body =
      "A little unease has begun to trail you home. Your mouth feels tender and your body more tired than it should after sitting at a bench all day, but you keep folding those thoughts away. Your family needs the wage more than you need certainty, and you tell yourself that modern paint and respectable pay cannot possibly be the danger some small frightened part of you imagines.";
  } else if (health >= 35) {
    body =
      "The defects are harder to ignore now. Your gums ache, your strength ebbs faster, and you catch yourself wondering whether the glow has left something inside you that will not come back out. Even so, you think of the family depending on you and make the same bargain again: one more day, one more shift, one more envelope of pay before you allow yourself to be afraid.";
  } else {
    body =
      "The damage is unmistakable now, and some part of you knows it. Still, the thought of leaving the work feels worse than the pain because the family at home still needs what this bench brings in. You swallow the fear, refuse to name what is happening to your body, and decide to report again in the morning so long as you can still stand.";
  }

  return `${opening} ${body}`;
}

function darkRoomGathering() {
  const day = gameState.currentDay;
  const scenes = [
    "After the tally, a few of the girls linger near the benches until the lamps are cut low. Their fingertips hold a faint light even then, a dim wash at the nails and cuffs, and one of them glances over her shoulder to check whether you are following. You hover at the edge, still too new to step in easily, but another girl gives you a shy half-smile and shifts aside so there is room for you in the dark.",
    "On the second night, they gather more quickly, as if the room itself has taught them where to meet once the light thins. The glow on their hands is stronger now, fine green fire caught along the cuticles and in the loose wisps of hair at their temples. One lifts her palm and says, almost laughing, that the dark is kinder to them than the day. Another angles her glowing knuckles beneath your gaze and asks, softer than she would have at the bench, whether yours shine too.",
    "By Wednesday the gathering has the hush of a ritual. They stand close enough for their brightness to mingle: fingertips, collars, the edge of a cheek, the ghostly trace of paint brushed over a nail. A constellation glimmers in this room. Someone says they ought to charge admission for such beauty. Another calls it the undark, and the others echo the word like a private blessing. When you hesitate, a girl touches your elbow and tells you not to stand off on your own. \"Come look,\" she says. \"You're one of us now.\"",
    "Thursday night turns them almost theatrical in the black. Leftover paint gleams where one girl has smoothed it over her nails, where another has drawn it lightly through a loosened strand of hair so it catches when she moves. They tilt toward one another to admire the effect, laughing low, their faces transformed into something tender and almost holy by the glittering green light. One of the women who barely looked up at you on your first day reaches for your wrist and lifts your hand into the glow beside hers, studying it with the care of a friend.",
    "On Friday, after the talk of standing together, the dark-room gathering feels closer, more deliberate. They cluster shoulder to shoulder while the undark rises from skin, apron hems, and the fine dust at the edges of their curls. Their warmth toward you is no longer tentative. Someone presses hip to hip against you to make space in the circle. Someone else, smiling through tiredness, tells you that your hands catch the light beautifully. In the black they seem briefly remade, not into ghosts but into women lit from within.",
    "Saturday's gathering is quieter, more intimate. The glow lies along their fingers and hair like dew caught in moonlight, and in the hush you can hear how gently they speak to one another now. One girl smooths paint over a thumbnail and reaches to compare it with yours; another watches your face and asks whether you are holding up. The kindness would have startled you at the start of the week. Now it lands like something you had already begun to need.",
    "By Sunday night the room is nearly empty before the last of them gather in the dark. The undark answers at once, threading itself through nails, cuffs, lashes, and the stray flyaway hairs that no pins can hold. They look unbearably lovely that way, as if each of them has stolen back a little private constellation from the factory floor. They burn so bright tonight. No one leaves you standing apart anymore. They draw you in by the hand, by the shoulder, by the easy angle of their bodies, and for one suspended moment the black room feels less like a place of ending than a place where all of you are trying, together, to remain visible.",
  ];
  return scenes[Math.min(6, day)];
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

function resetDialogButtons() {
  dialogAltButton.classList.add("hidden");
  dialogAltButton.textContent = "Alternative";
  dialogButton.textContent = "Continue";
}

function showEnding(title, body) {
  resetDialogButtons();
  dialogTitle.textContent = title;
  dialogBody.textContent = body;
  dialogButton.textContent = "Try again?";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "restart";
}

function showLowHealthWarning() {
  resetDialogButtons();
  dialogTitle.textContent = "On The Way Home";
  dialogBody.textContent =
    "On the walk home, you begin to notice something horribly wrong. Your teeth feel loose in your gums, though they should be fully grown and set. When you touch them, two come free at once and land in your palm.";
  dialogButton.textContent = "Continue";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "low-health-warning";
}

function showDayOneIntro() {
  resetDialogButtons();
  dialogTitle.textContent = "Day 1 - New Hire";
  dialogBody.textContent =
    "You've heard talk of it for weeks, months now; this lucrative new job where skill translates directly to high pay. Its one of the few jobs you could have taken-- as a woman, and one as young as you are. Unlike most other jobs, both attributes make you the perfect hire: young deft hands for this delicate work, and one of the few people left behind while the men valiantly fight for your country. You are a full-blown patriot now, a hero of your family and your country. oo long. At home, there are six siblings and too much need to go around, and as the middle child you have learned how often duty lands in the hands of the one who can least refuse it. So you take your place at the bench telling yourself this is what luck looks like at last. Everyone talks about the paint as if it belongs to the future: luminous, fashionable, and made with the same remarkable material turning up in all the newest products. You have even heard it said that it is good for the health. By the time the shift is ready to begin, you want very badly to believe every word of it.";
  dialogButton.textContent = "Begin shift";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "day-one-intro";
}

function showBenchTutorial() {
  resetDialogButtons();
  dialogTitle.textContent = "Center Bench Tutorial";
  dialogBody.textContent =
    "The girl at the center bench finally looks up. 'Listen closely. First, clock in at the wall clock to begin the shift. When you sit at a bench, use Pick up brush to paint, Switch to fingernails to clean up only the excess around a numeral, Sharpen brush to restore a fine point, Wipe paint directly if the open numeral needs a full clean correction, Send watch in once all twelve numerals are painted cleanly, and Empty the dish if your mixture goes bad. The three vessels build the paint: powder, tar, and water. In the main watch view, click a gray numeral marker to open it. In the zoomed view, paint inside the guide lines until the numeral is clean enough to count. If the edges get ragged, correct them before you send the watch in. Then clock out at the wall when you're finished.'";
  dialogButton.textContent = "Understood";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "bench-tutorial";
}

function showDayFiveCutscene() {
  resetDialogButtons();
  dialogTitle.textContent = "Day 5 - Before The Bell";
  dialogBody.textContent =
    "The remaining girls gather before the shift whistle. They speak in hushed bursts about the dial painters who came together in real life to demand compensation: the New Jersey women led by Grace Fryer, and later the Illinois workers who kept pressing their claims even while their health failed. The room goes still while they decide whether to stand together now, or let the benches swallow another day.";
  dialogAltButton.textContent = "Return to the bench";
  dialogAltButton.classList.remove("hidden");
  dialogButton.textContent = "Stand with the girls";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "day-five-choice";
}

function showSolidarityEnding() {
  resetDialogButtons();
  dialogTitle.textContent = "Stand Together";
  dialogBody.textContent =
    "You step away from the bench and join the others. In the years that follow, women like Grace Fryer in New Jersey and Catherine Donohue in Illinois force the poison in the dial rooms into court records, headlines, and public memory. The companies are pushed into settlements, medical payments, and legal accountability; the cases help strengthen occupational disease law and become part of the longer fight that reshapes workplace safety in the United States. You still die years later from the damage already done inside your body, but your refusal to stay quiet helps leave behind stronger labor protections than the factory ever meant to allow.";
  dialogButton.textContent = "Try again?";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "restart";
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
      "Three bad days in a row are enough. Before another shift can begin, the bench is given to someone else. You came in to work the next morning, only to find a new worker already sitting at your place.",
      "Ending one: Dismissed",
      "It feels awful, at first. It feels like an end to your early career, your early journey. It's not until the later years, after the lawsuits and the slow disintegration of your coworkers, that you understand. You were lucky to have been let go when you were, before the radiation had a chance to settle too deeply into your bones. You find other work, and though the pay is never as good, you are able to keep your health and your life for many more years."
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
    `${managerLineForDay()} ${endOfDayReflection()} ${darkRoomGathering()}`;
  dialogButton.textContent = "Next day";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "next-day";
  updateHud();
}

function continueAfterDialog() {
  dialogOverlay.classList.add("hidden");
  resetDialogButtons();

  if (gameState.dialogMode === "next-day") {
    gameState.currentDay += 1;
    gameState.shiftEnded = false;
    gameState.shiftElapsed = 0;
    gameState.lastShiftProgress = 0;
    sendToDayStart("Clock in again when the title card fades away.");
  } else if (gameState.dialogMode === "low-health-warning") {
    gameState.currentDay += 1;
    gameState.shiftEnded = false;
    gameState.shiftElapsed = 0;
    gameState.lastShiftProgress = 0;
    gameState.fracturePending = true;
    sendToDayStart("Something is wrong now, even away from the bench.");
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
  gameState.dayOneIntroSeen = false;
  gameState.dayFiveCutsceneSeen = false;
  gameState.joinedWorkers = false;
  gameState.warnedLowHealth = false;
  gameState.fracturePending = false;
  gameState.fractureResolved = false;
  gameState.hiddenStats.health = 100;
  gameState.hiddenStats.brushLicks = 0;
  gameState.hiddenStats.fingernailUses = 0;
  gameState.thresholdThoughtQueued = false;
  gameState.thresholdThoughtShown = false;
  gameState.savedBenchWork = {};
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
      angle,
      x,
      y,
      targetPoints: buildNumeralPoints(labels[i], x, y, angle),
      paintedMask: [],
      strayPoints: [],
      coverage: 0,
      mess: 0,
      corrected: false,
      credited: false,
    });
  }

  for (const dial of dials) {
    dial.paintedMask = new Array(dial.targetPoints.length).fill(false);
  }

  paintState.dials = dials;
  paintState.activeDialIndex = 0;
}

function cloneDials(dials) {
  return dials.map((dial) => ({
    ...dial,
    targetPoints: dial.targetPoints.map((point) => ({ ...point })),
    paintedMask: [...dial.paintedMask],
    strayPoints: dial.strayPoints.map((point) => ({ ...point })),
  }));
}

function saveCurrentBenchWork() {
  if (!paintState.tableLabel || paintState.mode !== "watch" || paintState.dials.length === 0) return;
  gameState.savedBenchWork[paintState.tableLabel] = {
    dials: cloneDials(paintState.dials),
    mix: [...paintState.mix],
    mixQuality: paintState.mixQuality,
    brushSize: paintState.brushSize,
    watchIndex: paintState.watchIndex,
    activeDialIndex: paintState.activeDialIndex,
    zoomedDialIndex: paintState.zoomedDialIndex,
    paintLoaded: paintState.paintLoaded,
    readyToSubmit: paintState.readyToSubmit,
  };
}

function restoreBenchWork(label) {
  const saved = gameState.savedBenchWork[label];
  if (!saved) return false;
  paintState.dials = cloneDials(saved.dials);
  paintState.mix = [...saved.mix];
  paintState.mixQuality = saved.mixQuality;
  paintState.brushSize = saved.brushSize;
  paintState.watchIndex = saved.watchIndex;
  paintState.activeDialIndex = saved.activeDialIndex;
  paintState.zoomedDialIndex = saved.zoomedDialIndex;
  paintState.paintLoaded = saved.paintLoaded;
  paintState.readyToSubmit = saved.readyToSubmit;
  if (paintState.zoomedDialIndex !== -1) {
    zoomCursorToDial(paintState.zoomedDialIndex);
  } else {
    moveCursorToActiveDial();
  }
  return true;
}

function clearBenchWork(label = paintState.tableLabel) {
  if (!label) return;
  delete gameState.savedBenchWork[label];
}

function leadingPointForDial(index = paintState.activeDialIndex) {
  const dial = paintState.dials[index];
  if (!dial || dial.targetPoints.length === 0) return { x: WATCH_CENTER_X, y: WATCH_CENTER_Y };
  return dial.targetPoints[Math.floor(dial.targetPoints.length / 2)];
}

function moveCursorToActiveDial() {
  const point = leadingPointForDial();
  paintState.pointerX = point.x;
  paintState.pointerY = point.y;
  paintState.lastPointerMoveAt = performance.now();
  refreshPaintCursor();
}

function updateActiveDialIndex() {
  const nextIndex = paintState.dials.findIndex((dial) => dial.coverage < 0.74 || dialNeedsCorrection(dial));
  paintState.activeDialIndex = nextIndex === -1 ? 0 : nextIndex;
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
  const w = 20 * scale;
  const h = 34 * scale;
  const left = offsetX - w / 2;
  const top = offsetY - h / 2;
  const right = left + w;
  const midY = top + h / 2;
  const bottom = top + h;
  const points = [];

  for (const segment of segments) {
    if (segment === "a") pushLinePoints(points, left, top, right, top, 10);
    if (segment === "b") pushLinePoints(points, right, top, right, midY, 10);
    if (segment === "c") pushLinePoints(points, right, midY, right, bottom, 10);
    if (segment === "d") pushLinePoints(points, left, bottom, right, bottom, 10);
    if (segment === "e") pushLinePoints(points, left, midY, left, bottom, 10);
    if (segment === "f") pushLinePoints(points, left, top, left, midY, 10);
    if (segment === "g") pushLinePoints(points, left, midY, right, midY, 10);
  }

  if (points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    const shiftX = offsetX - (minX + maxX) / 2;
    const shiftY = offsetY - (minY + maxY) / 2;
    for (const point of points) {
      point.x += shiftX;
      point.y += shiftY;
    }
  }

  return points;
}

function buildNumeralPoints(label, centerX, centerY, angle) {
  const points = [];
  const chars = label.split("");
  const radialX = Math.cos(angle);
  const radialY = Math.sin(angle);
  const layout = {
    "10": { spacing: 28, inwardOffset: -18, tangentShift: 0, scale: 0.9 },
    "11": { spacing: 24, inwardOffset: -18, tangentShift: 0, scale: 0.9 },
    "12": { spacing: 38, inwardOffset: -18, tangentShift: 0, scale: 0.9 },
  }[label] || { spacing: chars.length === 1 ? 0 : 32, inwardOffset: chars.length === 1 ? 0 : -14, tangentShift: 0, scale: chars.length === 1 ? 1.45 : 0.92 };
  const baseX = centerX + radialX * layout.inwardOffset;
  const baseY = centerY + radialY * layout.inwardOffset;

  chars.forEach((char, index) => {
    const horizontalOffset = chars.length === 1
      ? 0
      : (index - (chars.length - 1) / 2) * layout.spacing + layout.tangentShift;
    const digitX = baseX + horizontalOffset;
    const digitY = baseY;
    const digitPoints = buildDigitPoints(char, digitX, digitY, layout.scale);
    points.push(...digitPoints);
  });

  return points;
}

function pointBounds(points) {
  if (!points || points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
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
  if (paintState.zoomedDialIndex === -1) return "mix";
  return "brush";
}

function activeDial() {
  return paintState.dials[paintState.zoomedDialIndex] || paintState.dials[paintState.activeDialIndex] || null;
}

function dialZoomAnchor(dial) {
  if (!dial || !dial.targetPoints || dial.targetPoints.length === 0) {
    return { x: dial?.x || WATCH_CENTER_X, y: dial?.y || WATCH_CENTER_Y };
  }

  const bounds = pointBounds(dial.targetPoints);
  return { x: bounds.centerX, y: bounds.centerY };
}

function dialRenderPoints(dial) {
  if (!dial) return [];
  if (paintState.zoomedDialIndex === -1) return dial.targetPoints;
  const anchor = dialZoomAnchor(dial);
  return dial.targetPoints.map((point) => ({
    x: ZOOM_CENTER_X + (point.x - anchor.x) * ZOOM_SCALE,
    y: ZOOM_CENTER_Y + (point.y - anchor.y) * ZOOM_SCALE,
  }));
}

function strayRenderPoints(dial) {
  if (!dial) return [];
  if (paintState.zoomedDialIndex === -1) return dial.strayPoints;
  const anchor = dialZoomAnchor(dial);
  return dial.strayPoints.map((point) => ({
    x: ZOOM_CENTER_X + (point.x - anchor.x) * ZOOM_SCALE,
    y: ZOOM_CENTER_Y + (point.y - anchor.y) * ZOOM_SCALE,
    r: point.r * ZOOM_SCALE,
    a: point.a,
  }));
}

function worldPointForDial(dial, x, y) {
  if (paintState.zoomedDialIndex === -1) return { x, y };
  const anchor = dialZoomAnchor(dial);
  return {
    x: anchor.x + (x - ZOOM_CENTER_X) / ZOOM_SCALE,
    y: anchor.y + (y - ZOOM_CENTER_Y) / ZOOM_SCALE,
  };
}

function zoomCursorToDial(index) {
  const dial = paintState.dials[index];
  if (!dial) return;
  const points = dialRenderPoints(dial);
  const point = points[Math.floor(points.length / 2)] || { x: ZOOM_CENTER_X, y: ZOOM_CENTER_Y };
  paintState.pointerX = point.x;
  paintState.pointerY = point.y;
  paintState.lastPointerMoveAt = performance.now();
  refreshPaintCursor();
}

function enterDialZoom(index) {
  const dial = paintState.dials[index];
  if (!dial) return;
  paintState.zoomedDialIndex = index;
  paintState.paintLoaded = MAX_PAINT_LOAD;
  zoomCursorToDial(index);
  paintPrompt.textContent = `The ${dial.label} fills the dark. Paint inside the faint guide while the brush still holds paint.`;
  updatePaintStats();
  drawWatchMinigame();
}

function exitDialZoom(message = "You pull back from the numeral to survey the full watch face.") {
  paintState.zoomedDialIndex = -1;
  moveCursorToActiveDial();
  paintPrompt.textContent = message;
  updatePaintStats();
  drawWatchMinigame();
}

function imageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function initializeFracturePieces() {
  paintState.fracturePieces = [];
  const cols = 5;
  const rows = 4;
  const fractureImage = imageReady(assetImages.brokenClockPhoto) ? assetImages.brokenClockPhoto : assetImages.watchFace;
  const sourceWidth = imageReady(fractureImage) ? fractureImage.naturalWidth : WATCH_DRAW_WIDTH;
  const sourceHeight = imageReady(fractureImage) ? fractureImage.naturalHeight : WATCH_DRAW_HEIGHT;
  const watchLeft = FRACTURE_CENTER_X - FRACTURE_DRAW_WIDTH / 2;
  const watchTop = FRACTURE_CENTER_Y - FRACTURE_DRAW_HEIGHT / 2;
  const pieceWidth = FRACTURE_DRAW_WIDTH / cols;
  const pieceHeight = FRACTURE_DRAW_HEIGHT / rows;

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
        sx: col * (sourceWidth / cols),
        sy: row * (sourceHeight / rows),
        sw: sourceWidth / cols,
        sh: sourceHeight / rows,
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
  paintState.pointerX = paintCanvas.width / 2;
  paintState.pointerY = paintCanvas.height / 2;
  paintState.lastPointerMoveAt = performance.now();
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  initializeFracturePieces();
  setStationControlsHidden(true);
  minigameOverlay.classList.remove("hidden");
  paintPrompt.textContent = "The watch face comes apart in your hands, bloodied and wrong. Time itself has fractured in your hands.";
  mixPrompt.textContent = "Drag the pieces back into place. Put the clock back together-- and your own dwindling psyche.";
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
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.thoughtPopup = null;
  paintState.nextThoughtTimer = nextThoughtDelay();
  if (!restoreBenchWork(label)) {
    paintState.watchIndex += 1;
    paintState.brushSize = DEFAULT_BRUSH_SIZE;
    paintState.paintLoaded = 0;
    paintState.zoomedDialIndex = -1;
    paintState.readyToSubmit = false;
    resetMix();
    buildDialState();
    moveCursorToActiveDial();
  }
  setStationControlsHidden(false);
  minigameOverlay.classList.remove("hidden");
  document.exitPointerLock();

  paintPrompt.textContent =
    "Mix the paint in the dish, then click one of the gray numeral markers to open that spot in close view and paint inside the guide lines.";
  mixPrompt.textContent = mixTextureFeedback();
  updatePaintStats();
  drawWatchMinigame();
}

function closeMinigame() {
  saveCurrentBenchWork();
  paintState.active = false;
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.mode = "watch";
  paintState.zoomedDialIndex = -1;
  paintState.paintLoaded = 0;
  paintState.thoughtPopup = null;
  paintState.fracturePieces = [];
  paintState.draggedPieceIndex = -1;
  setStationControlsHidden(false);
  minigameOverlay.classList.add("hidden");
}

function allDialsReady() {
  return paintState.dials.length > 0 && paintState.dials.every(dialCountsAsPainted);
}

function dialNeedsCorrection(dial) {
  return dial.coverage >= 0.96 && (dial.mess > 0.24 || dial.strayPoints.length > 0);
}

function correctionCount() {
  return paintState.dials.filter(dialNeedsCorrection).length;
}

function updatePaintStats() {
  const finished = paintState.dials.filter((dial) => dial.coverage >= 1).length;
  const correctionNeeded = correctionCount();
  const mixPercent = Math.round(paintState.mixQuality * 100);
  const brushState =
    paintState.brushSize <= 0.7 ? "fine tip" :
    paintState.brushSize <= 1.2 ? "slightly soft" :
    paintState.brushSize <= 1.8 ? "fanning" :
    "splayed";
  const currentDial = activeDial();
  const currentDialText = currentDial
    ? ` Numeral ${currentDial.label} coverage ${Math.round(currentDial.coverage * 100)}%.`
    : "";
  paintStats.textContent =
    `Mix quality ${mixPercent}%. Paid dials today ${gameState.dialsPaintedToday}. Corrections needed ${correctionNeeded}. Tool ${paintState.tool}. Brush ${brushState}.${currentDialText}`;
  mixPrompt.textContent = mixTextureFeedback();
  brushButton.classList.toggle("active", paintState.tool === "brush");
  correctButton.classList.toggle("active", paintState.tool === "nail");
  wipeButton.disabled = paintState.zoomedDialIndex === -1 || !currentDial || !dialNeedsCorrection(currentDial);
  submitButton.textContent = correctionNeeded > 0 ? "Send watch in anyway" : "Send watch in";
}

function spendHealth(amount) {
  const previousHealth = gameState.hiddenStats.health;
  gameState.hiddenStats.health = Math.max(0, gameState.hiddenStats.health - amount);
  if (
    previousHealth > HEALTH_DRIFT_THRESHOLD &&
    gameState.hiddenStats.health <= HEALTH_DRIFT_THRESHOLD &&
    !gameState.thresholdThoughtShown
  ) {
    gameState.thresholdThoughtQueued = true;
  }
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
    paintPrompt.textContent = "Use your fingernails to lift only the excess paint around the numeral, wiping only a small area at a time.";
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
  clearBenchWork();
  paintState.correcting = false;
  paintState.tool = "brush";
  paintState.zoomedDialIndex = -1;
  paintState.readyToSubmit = false;
  resetMix();
  buildDialState();
  moveCursorToActiveDial();
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintState.paintLoaded = 0;
  paintState.thoughtPopup = null;
  paintState.nextThoughtTimer = nextThoughtDelay();
  paintPrompt.textContent = message;
  updatePaintStats();
  drawWatchMinigame();
}

function findNearestDial(x, y) {
  let best = null;
  const dialSet = paintState.zoomedDialIndex === -1
    ? paintState.dials
    : [activeDial()].filter(Boolean);

  for (const dial of dialSet) {
    const dialX = paintState.zoomedDialIndex === -1 ? dial.x : ZOOM_CENTER_X;
    const dialY = paintState.zoomedDialIndex === -1 ? dial.y : ZOOM_CENTER_Y;
    const referenceDistance = Math.hypot(dialX - x, dialY - y);
    const limit = paintState.zoomedDialIndex === -1 ? 62 : 220;
    if (referenceDistance > limit) continue;
    if (!best || referenceDistance < best.distance) {
      best = { dial, distance: referenceDistance };
    }
  }

  return best;
}

function findNearestTracePoint(x, y) {
  let best = null;

  const dialSet = paintState.zoomedDialIndex === -1
    ? paintState.dials
    : [activeDial()].filter(Boolean);

  for (const dial of dialSet) {
    const renderPoints = dialRenderPoints(dial);
    for (let i = 0; i < renderPoints.length; i += 1) {
      const point = renderPoints[i];
      const distance = Math.hypot(point.x - x, point.y - y);
      const limit = paintState.zoomedDialIndex === -1 ? 52 : 84;
      if (distance > limit) continue;
      if (!best || distance < best.distance) {
        best = { dial, index: i, point, distance };
      }
    }
  }

  return best;
}

function bowlUnderCursor(x, y) {
  const regions = paintState.zoomedDialIndex === -1
    ? componentRegions
    : [{ index: 3, x: STATION_LAYOUT.zoomPaint.x, y: STATION_LAYOUT.zoomPaint.y, rx: STATION_LAYOUT.zoomPaint.rx, ry: STATION_LAYOUT.zoomPaint.ry }];

  for (const region of regions) {
    const dx = (x - region.x) / region.rx;
    const dy = (y - region.y) / region.ry;
    if (dx * dx + dy * dy <= 1) return region;
  }
  return null;
}

function addIngredient(region) {
  if (region.index === 3) {
    paintState.paintLoaded = MAX_PAINT_LOAD;
    paintState.tool = "brush";
    paintState.correcting = false;
    paintPrompt.textContent = "You dip the brush back into the paint dish at your side.";
    updatePaintStats();
    return;
  }

  paintState.mix[region.index] += 1;
  paintState.mixQuality = computeMixQuality();
  paintState.paintLoaded = MAX_PAINT_LOAD;

  if (region.index === 0) {
    paintPrompt.textContent = "The left vessel leaves a yellow dust in the dish.";
  } else if (region.index === 1) {
    paintPrompt.textContent = "The middle vessel thickens the dish with a sticky pull.";
  } else {
    paintPrompt.textContent = "The lower vessel thins the dish and lightens the surface reflection.";
  }

  updatePaintStats();
}

function dialCountsAsPainted(dial) {
  return dial.coverage >= 0.96 && !dialNeedsCorrection(dial);
}

function creditCompletedDials() {
  let creditedNow = 0;
  for (const dial of paintState.dials) {
    if (dial.credited || !dialCountsAsPainted(dial)) continue;
    dial.credited = true;
    creditedNow += 1;
  }

  if (creditedNow > 0) {
    gameState.dialsPaintedToday += creditedNow;
    gameState.dayEarningsCents += creditedNow * PAY_PER_DIAL_CENTS;
    gameState.totalEarningsCents += creditedNow * PAY_PER_DIAL_CENTS;
    gameState.totalDialsPainted += creditedNow;
    updateHud();
  }
}

function paintTone() {
  const alpha = 0.58 + paintState.mixQuality * 0.32;
  return {
    stroke: `rgba(236, 216, 120, ${alpha})`,
    fill: `rgba(240, 222, 132, ${alpha + 0.06})`,
    stray: `rgba(228, 204, 104, ${0.5 + paintState.mixQuality * 0.22})`,
  };
}

function drawDialPaint(dial, zoomed = false) {
  const points = dialRenderPoints(dial);
  const tone = paintTone();
  const lineWidth = zoomed ? 18 : 6.4;
  const dotRadius = zoomed ? 8.2 : 3.2;

  paintCtx.strokeStyle = tone.stroke;
  paintCtx.lineWidth = lineWidth;
  paintCtx.lineJoin = "round";
  paintCtx.lineCap = "round";

  let segmentOpen = false;
  for (let i = 0; i < points.length; i += 1) {
    if (!dial.paintedMask[i]) {
      if (segmentOpen) {
        paintCtx.stroke();
        segmentOpen = false;
      }
      continue;
    }
    const point = points[i];
    if (!segmentOpen) {
      paintCtx.beginPath();
      paintCtx.moveTo(point.x, point.y);
      segmentOpen = true;
    } else {
      const prev = points[i - 1];
      if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < (zoomed ? 84 : 18)) {
        paintCtx.lineTo(point.x, point.y);
      } else {
        paintCtx.stroke();
        paintCtx.beginPath();
        paintCtx.moveTo(point.x, point.y);
      }
    }
  }
  if (segmentOpen) paintCtx.stroke();

  paintCtx.fillStyle = tone.fill;
  for (let i = 0; i < points.length; i += 1) {
    if (!dial.paintedMask[i]) continue;
    const point = points[i];
    paintCtx.beginPath();
    paintCtx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    paintCtx.fill();
  }
}

function drawStrayPaint(dial, zoomed = false) {
  const stray = strayRenderPoints(dial);
  if (stray.length === 0) return;
  const tone = paintTone();
  for (const mark of stray) {
    paintCtx.fillStyle = tone.stray;
    paintCtx.beginPath();
    paintCtx.arc(mark.x, mark.y, zoomed ? Math.max(4, mark.r) : Math.max(1.6, mark.r), 0, Math.PI * 2);
    paintCtx.fill();
    paintCtx.strokeStyle = zoomed ? "rgba(255, 92, 92, 0.95)" : "rgba(255, 92, 92, 0.85)";
    paintCtx.lineWidth = zoomed ? 2 : 1.2;
    paintCtx.beginPath();
    paintCtx.arc(mark.x, mark.y, (zoomed ? Math.max(4, mark.r) : Math.max(1.6, mark.r)) + (zoomed ? 3 : 1.5), 0, Math.PI * 2);
    paintCtx.stroke();
  }
}

function paintAt(x, y) {
  if (paintState.mixQuality <= 0) {
    paintPrompt.textContent = "The brush drags dry. Nothing useful has been mixed yet.";
    return;
  }

  if (paintState.paintLoaded <= 0) {
    paintPrompt.textContent = "The brush runs dry. Press Escape to pull back and gather more paint from the dish, or dip brush directly.";
    return;
  }

  const hit = findNearestTracePoint(x, y);
  if (!hit) {
    paintPrompt.textContent = "The stroke slips outside the guide and leaves a visible mistake.";
    const relevantDials = paintState.zoomedDialIndex === -1
      ? paintState.dials
      : [activeDial()].filter(Boolean);
    for (const dial of relevantDials) {
      const dialCenterX = paintState.zoomedDialIndex === -1 ? dial.x : ZOOM_CENTER_X;
      const dialCenterY = paintState.zoomedDialIndex === -1 ? dial.y : ZOOM_CENTER_Y;
      const dialDistance = Math.hypot(dialCenterX - x, dialCenterY - y);
      if (dialDistance < (paintState.zoomedDialIndex === -1 ? 58 : 220)) {
        const worldPoint = worldPointForDial(dial, x, y);
        dial.strayPoints.push({
          x: worldPoint.x,
          y: worldPoint.y,
          r: paintState.zoomedDialIndex === -1 ? 2.4 : 2.1 + paintState.brushSize * 4.2,
          a: 0.72,
        });
        if (dial.strayPoints.length > 48) dial.strayPoints.shift();
        dial.mess += paintState.zoomedDialIndex === -1
          ? 0.01 + (1 - paintState.mixQuality) * 0.025
          : 0.004 + (1 - paintState.mixQuality) * 0.012;
      }
    }
    paintState.paintLoaded = Math.max(0, paintState.paintLoaded - PAINT_DRAIN_PER_STROKE);
    updateCoverage();
    return;
  }

  const hitRadius = paintState.zoomedDialIndex === -1
    ? Math.max(12, paintState.brushSize * 10)
    : Math.max(32, paintState.brushSize * 58);
  let paintedPoints = 0;
  let overlapPoints = 0;
  let offGuidePoints = 0;
  const renderPoints = dialRenderPoints(hit.dial);
  for (let i = 0; i < renderPoints.length; i += 1) {
    const point = renderPoints[i];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= hitRadius) {
      if (hit.dial.paintedMask[i]) {
        overlapPoints += 1;
      } else {
        hit.dial.paintedMask[i] = true;
        paintedPoints += 1;
      }
    }
  }

  const strictRadius = paintState.zoomedDialIndex === -1
    ? Math.max(6, paintState.brushSize * 4.5)
    : Math.max(10, paintState.brushSize * 18);
  if (hit.distance > strictRadius) {
    offGuidePoints += 1;
  }

  const centerFactor = Math.max(0.78, 1 - hit.distance / (paintState.zoomedDialIndex === -1 ? 52 : 84));
  if (paintedPoints > 0) {
    hit.dial.mess += 0.002 + (1 - paintState.mixQuality) * 0.012 + (1 - centerFactor) * 0.006;
  } else if (overlapPoints === 0) {
    hit.dial.mess += 0.008 + (1 - paintState.mixQuality) * 0.018;
  }
  if (offGuidePoints > 0) {
    const worldPoint = worldPointForDial(hit.dial, x, y);
    hit.dial.strayPoints.push({
      x: worldPoint.x,
      y: worldPoint.y,
      r: paintState.zoomedDialIndex === -1 ? 2.8 : 2.8 + paintState.brushSize * 4.6,
      a: 0.9,
    });
    if (hit.dial.strayPoints.length > 64) hit.dial.strayPoints.shift();
    hit.dial.mess += 0.05 + (1 - paintState.mixQuality) * 0.03;
    paintPrompt.textContent = "Paint has slipped outside the numeral and will need to be scraped back cleanly.";
  }

  paintState.paintLoaded = Math.max(0, paintState.paintLoaded - PAINT_DRAIN_PER_STROKE);
  updateCoverage();
  creditCompletedDials();

  if (paintedPoints === 0 && overlapPoints > 0 && offGuidePoints === 0) {
    paintPrompt.textContent = "The stroke settles into paint already laid down.";
  }

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

function smoothDialMask(dial) {
  let paintedCount = dial.paintedMask.filter(Boolean).length;
  const targetCount = Math.ceil(dial.targetPoints.length * 0.92);
  if (paintedCount <= targetCount) return;

  for (let i = dial.paintedMask.length - 1; i >= 0 && paintedCount > targetCount; i -= 1) {
    if (!dial.paintedMask[i]) continue;
    if (i % 2 === 0 || paintedCount - targetCount > 6) {
      dial.paintedMask[i] = false;
      paintedCount -= 1;
    }
  }
}

function cleanDial(dial, amount) {
  dial.mess = Math.max(0, dial.mess - amount);
  smoothDialMask(dial);
  const minimumCoverage = Math.ceil(dial.targetPoints.length * 0.9);
  let paintedCount = dial.paintedMask.filter(Boolean).length;
  for (let i = 0; i < dial.paintedMask.length && paintedCount < minimumCoverage; i += 1) {
    if (dial.paintedMask[i]) continue;
    dial.paintedMask[i] = true;
    paintedCount += 1;
  }
  dial.corrected = true;
}

function perfectDial(dial) {
  dial.mess = 0;
  dial.corrected = true;
  dial.strayPoints = [];
  for (let i = 0; i < dial.paintedMask.length; i += 1) {
    dial.paintedMask[i] = true;
  }
}

function correctAt(x, y) {
  const target = findNearestDial(x, y);
  if (!target) {
    paintPrompt.textContent = "Your fingernail only skims the face where there is no paint to lift.";
    return;
  }

  const correctionRadius = paintState.zoomedDialIndex === -1 ? 12 : 24;
  let cleanedMarks = 0;
  let nearbyPaintPoints = 0;

  const renderPoints = dialRenderPoints(target.dial);
  for (let i = 0; i < renderPoints.length; i += 1) {
    if (!target.dial.paintedMask[i]) continue;
    const point = renderPoints[i];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= correctionRadius) {
      nearbyPaintPoints += 1;
    }
  }

  const remainingStray = [];
  const anchor = paintState.zoomedDialIndex === -1 ? null : dialZoomAnchor(target.dial);
  for (const mark of target.dial.strayPoints) {
    const renderX = paintState.zoomedDialIndex === -1 ? mark.x : ZOOM_CENTER_X + (mark.x - anchor.x) * ZOOM_SCALE;
    const renderY = paintState.zoomedDialIndex === -1 ? mark.y : ZOOM_CENTER_Y + (mark.y - anchor.y) * ZOOM_SCALE;
    const distance = Math.hypot(renderX - x, renderY - y);
    if (distance <= correctionRadius) {
      cleanedMarks += 1;
      continue;
    }
    remainingStray.push(mark);
  }
  target.dial.strayPoints = remainingStray;

  const messReduction = Math.min(0.12, nearbyPaintPoints * 0.006) + cleanedMarks * 0.045;
  if (messReduction <= 0) {
    paintPrompt.textContent = "Your fingernail grazes the edge, but lifts almost nothing.";
  } else {
    target.dial.mess = Math.max(0, target.dial.mess - messReduction);
    target.dial.corrected = true;
    paintPrompt.textContent = "You lift away a narrow patch of excess paint without cutting into the numeral itself.";
  }

  updateCoverage();
  creditCompletedDials();

  if (allDialsReady() && correctionCount() === 0) {
    paintPrompt.textContent = "The ragged edges are cleaned away. This watch can go in at full pay.";
  }

  updatePaintStats();
}

function wipeNearestDial() {
  const target = paintState.zoomedDialIndex === -1 ? null : activeDial();

  if (!target || !dialNeedsCorrection(target)) {
    paintPrompt.textContent = "Direct wiping only helps when the open numeral needs cleanup.";
    return;
  }

  const preservedBrushSize = paintState.brushSize;
  const preservedPaintLoad = paintState.paintLoaded;
  const preservedTool = paintState.tool;
  const preservedCorrecting = paintState.correcting;
  spendHealth(2);
  perfectDial(target);
  paintState.brushSize = preservedBrushSize;
  paintState.paintLoaded = preservedPaintLoad;
  paintState.tool = preservedTool;
  paintState.correcting = preservedCorrecting;
  updateCoverage();
  creditCompletedDials();
  updatePaintStats();
  paintPrompt.textContent = "You wipe the ragged excess away with your hands and leave the numeral clean again.";
}

function updateCoverage() {
  for (const dial of paintState.dials) {
    const painted = dial.paintedMask.filter(Boolean).length;
    dial.coverage = dial.targetPoints.length === 0 ? 0 : painted / dial.targetPoints.length;
  }
  updateActiveDialIndex();
}

function sendCurrentWatch() {
  if (!allDialsReady()) {
    paintPrompt.textContent = "Not every numeral is luminous yet. The watch is not ready to send in.";
    return;
  }

  const paidNow = paintState.dials.filter((dial) => dial.credited).length;
  const missed = 12 - paidNow;
  gameState.watchesSubmittedToday += 1;
  clearBenchWork();

  if (missed > 0) {
    paintPrompt.textContent =
      `The watch is sent in. ${paidNow} dial${paidNow === 1 ? "" : "s"} on this face counted toward pay; ${missed} still needed cleaner work.`;
  } else {
    paintPrompt.textContent = "The watch is sent in with every dial counted toward pay.";
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
  const dish = STATION_LAYOUT.dish;
  if (total > 0 && imageReady(assetImages.mixedPaint)) {
    const drawn = drawAssetContained(assetImages.mixedPaint, centerX, centerY, dish.w, dish.h, 0.98);
    if (drawn) {
      paintCtx.save();
      paintCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, (1 - paintState.mixQuality) * 0.62)})`;
      paintCtx.beginPath();
      paintCtx.ellipse(centerX, centerY, dish.rx, dish.ry, 0, 0, Math.PI * 2);
      paintCtx.fill();
      paintCtx.restore();
    }
  } else {
    paintCtx.strokeStyle = "rgba(255,255,255,0.16)";
    paintCtx.lineWidth = 2;
    paintCtx.beginPath();
    paintCtx.ellipse(centerX, centerY, dish.rx, dish.ry, 0, 0, Math.PI * 2);
    paintCtx.stroke();
  }
}

function fanBrush(messageBase) {
  paintState.brushSize = Math.min(6, paintState.brushSize + 0.3);
  if (paintState.brushSize > 2.2) {
    paintPrompt.textContent = `${messageBase} The brush has started to splay.`;
  } else if (paintState.brushSize > 1.1) {
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

function drawAssetContained(image, x, y, boxWidth, boxHeight, alpha = 1) {
  if (!imageReady(image)) return null;
  const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  paintCtx.save();
  paintCtx.globalAlpha = alpha;
  paintCtx.drawImage(image, x - width / 2, y - height / 2, width, height);
  paintCtx.restore();
  return { x: x - width / 2, y: y - height / 2, w: width, h: height };
}

function currentWatchFaceImage() {
  if (allDialsReady() && imageReady(assetImages.completedWatchFace)) {
    return assetImages.completedWatchFace;
  }
  return assetImages.watchFace;
}

function drawDialMarker(dial) {
  const markerWidth = dial.label.length === 2 ? 28 : 20;
  const markerHeight = 14;
  const left = dial.x - markerWidth / 2;
  const top = dial.y - markerHeight / 2;
  const fillAlpha = 0.18 + Math.min(0.62, dial.coverage * 0.46);

  paintCtx.fillStyle = `rgba(156, 156, 156, ${fillAlpha})`;
  paintCtx.fillRect(left, top, markerWidth, markerHeight);

  if (dial.coverage > 0) {
    paintCtx.fillStyle = `rgba(241, 224, 124, ${0.3 + Math.min(0.58, dial.coverage * 0.45)})`;
    paintCtx.fillRect(left + 2, top + 2, Math.max(4, (markerWidth - 4) * Math.min(1, dial.coverage)), markerHeight - 4);
  }

  paintCtx.strokeStyle = dialNeedsCorrection(dial)
    ? (paintState.correcting ? "rgba(255, 207, 122, 0.96)" : "rgba(192, 74, 59, 0.96)")
    : dial.coverage >= 0.96
      ? "rgba(241, 224, 124, 0.82)"
      : "rgba(190, 190, 190, 0.5)";
  paintCtx.lineWidth = dial === activeDial() ? 2.6 : 1.5;
  paintCtx.strokeRect(left, top, markerWidth, markerHeight);

}

function drawFracturePuzzle() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  paintCtx.clearRect(0, 0, w, h);

  const bgGradient = paintCtx.createLinearGradient(0, 0, w, h);
  bgGradient.addColorStop(0, "#100203");
  bgGradient.addColorStop(0.55, "#270709");
  bgGradient.addColorStop(1, "#040404");
  paintCtx.fillStyle = bgGradient;
  paintCtx.fillRect(0, 0, w, h);

  if (imageReady(assetImages.fractureOverlay)) {
    paintCtx.save();
    paintCtx.globalAlpha = 0.72;
    paintCtx.drawImage(assetImages.fractureOverlay, 0, 0, w, h);
    paintCtx.restore();
  }

  paintCtx.strokeStyle = "rgba(255,255,255,0.08)";
  paintCtx.setLineDash([4, 5]);
  paintCtx.strokeRect(
    FRACTURE_CENTER_X - FRACTURE_DRAW_WIDTH / 2,
    FRACTURE_CENTER_Y - FRACTURE_DRAW_HEIGHT / 2,
    FRACTURE_DRAW_WIDTH,
    FRACTURE_DRAW_HEIGHT,
  );
  paintCtx.setLineDash([]);

  const restored = paintState.fracturePieces.filter((piece) => piece.placed).length;
  paintStats.textContent = `Shattered face ${restored}/${paintState.fracturePieces.length} restored.`;

  for (const piece of paintState.fracturePieces) {
    paintCtx.save();
    paintCtx.beginPath();
    paintCtx.rect(piece.x, piece.y, piece.w, piece.h);
    paintCtx.clip();
    const fractureImage = imageReady(assetImages.brokenClockPhoto) ? assetImages.brokenClockPhoto : assetImages.watchFace;
    if (imageReady(fractureImage)) {
      paintCtx.drawImage(
        fractureImage,
        piece.sx,
        piece.sy,
        piece.sw,
        piece.sh,
        piece.x,
        piece.y,
        piece.w,
        piece.h,
      );
    } else {
      paintCtx.fillStyle = "#f0f0f0";
      paintCtx.fillRect(piece.x, piece.y, piece.w, piece.h);
    }

    paintCtx.fillStyle = "rgba(138, 0, 0, 0.26)";
    paintCtx.fillRect(piece.x, piece.y, piece.w, piece.h);
    paintCtx.strokeStyle = "rgba(35,0,0,0.9)";
    paintCtx.lineWidth = 2;
    paintCtx.beginPath();
    paintCtx.moveTo(piece.x + 4, piece.y + 4);
    paintCtx.lineTo(piece.x + piece.w - 6, piece.y + piece.h - 8);
    paintCtx.moveTo(piece.x + piece.w * 0.3, piece.y + 3);
    paintCtx.lineTo(piece.x + piece.w * 0.75, piece.y + piece.h - 3);
    paintCtx.stroke();
    paintCtx.restore();

    paintCtx.strokeStyle = piece.placed ? "rgba(245, 236, 200, 0.55)" : "rgba(12, 8, 8, 0.92)";
    paintCtx.lineWidth = 2;
    paintCtx.strokeRect(piece.x, piece.y, piece.w, piece.h);
  }

  drawImageCursor("nail");
}

function drawWatchMinigame() {
  if (paintState.mode === "fracture") {
    drawFracturePuzzle();
    return;
  }

  if (paintState.zoomedDialIndex !== -1) {
    drawZoomedDialView();
    return;
  }

  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const centerX = WATCH_CENTER_X;
  const centerY = WATCH_CENTER_Y;
  const stationMode = currentStationMode();

  paintCtx.clearRect(0, 0, w, h);
  paintCtx.fillStyle = "#000";
  paintCtx.fillRect(0, 0, w, h);

  paintCtx.save();
  paintCtx.imageSmoothingEnabled = true;
  drawAssetContained(assetImages.yellowPowder, STATION_LAYOUT.powder.x, STATION_LAYOUT.powder.y, STATION_LAYOUT.powder.w, STATION_LAYOUT.powder.h, paintState.mix[0] > 0 ? 0.98 : 0.58);
  drawAssetContained(assetImages.gumArabic, STATION_LAYOUT.gum.x, STATION_LAYOUT.gum.y, STATION_LAYOUT.gum.w, STATION_LAYOUT.gum.h, paintState.mix[1] > 0 ? 0.98 : 0.58);
  drawAssetContained(assetImages.waterPlate, STATION_LAYOUT.water.x, STATION_LAYOUT.water.y, STATION_LAYOUT.water.w, STATION_LAYOUT.water.h, paintState.mix[2] > 0 ? 0.98 : 0.58);
  const drewWatchFace = drawAssetCentered(currentWatchFaceImage(), centerX, centerY, WATCH_DRAW_WIDTH, WATCH_DRAW_HEIGHT, 1);
  paintCtx.restore();
  drawMixDish(STATION_LAYOUT.dish.x, STATION_LAYOUT.dish.y);
  if (!drewWatchFace) {
    paintCtx.strokeStyle = "rgba(255,255,255,0.18)";
    paintCtx.lineWidth = 2;
    paintCtx.strokeRect(centerX - WATCH_DRAW_WIDTH / 2, centerY - WATCH_DRAW_HEIGHT / 2, WATCH_DRAW_WIDTH, WATCH_DRAW_HEIGHT);
  }

  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.font = "24px Georgia";

  for (const dial of paintState.dials) {
    drawDialMarker(dial);
  }

  if (!drewWatchFace) {
    paintCtx.fillStyle = "#111";
    paintCtx.beginPath();
    paintCtx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    paintCtx.fill();
  }

  const previewRadius = paintState.tool === "nail" ? 14 : Math.max(5, paintState.brushSize * 8);
  paintCtx.save();
  paintCtx.strokeStyle = paintState.tool === "nail" ? "rgba(255, 132, 132, 0.92)" : "rgba(245, 245, 190, 0.92)";
  paintCtx.fillStyle = paintState.tool === "nail" ? "rgba(170, 0, 0, 0.12)" : "rgba(245, 245, 190, 0.12)";
  paintCtx.lineWidth = 2;
  paintCtx.beginPath();
  paintCtx.arc(paintState.cursorX, paintState.cursorY, previewRadius, 0, Math.PI * 2);
  paintCtx.fill();
  paintCtx.stroke();
  paintCtx.restore();

  drawImageCursor(stationMode);
}

function drawZoomedDialView() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const dial = activeDial();
  if (!dial) return;

  paintCtx.clearRect(0, 0, w, h);
  paintCtx.fillStyle = "#000";
  paintCtx.fillRect(0, 0, w, h);

  const points = dialRenderPoints(dial);
  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.fillStyle = "rgba(255,255,255,0.68)";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText(`NUMERAL ${dial.label}`, w / 2, 40);
  paintCtx.fillText("Press Escape to pull back from the numeral.", w / 2, h - 28);

  if (imageReady(assetImages.mixedPaint)) {
    drawAssetContained(assetImages.mixedPaint, STATION_LAYOUT.zoomPaint.x, STATION_LAYOUT.zoomPaint.y, STATION_LAYOUT.zoomPaint.w, STATION_LAYOUT.zoomPaint.h, 1);
  }
  paintCtx.fillStyle = "rgba(255,255,255,0.56)";
  paintCtx.font = "13px Georgia";
  paintCtx.fillText("Dip brush", STATION_LAYOUT.zoomPaint.x, 170);

  paintCtx.strokeStyle = "rgba(185, 185, 185, 0.28)";
  paintCtx.lineWidth = 8;
  paintCtx.lineJoin = "round";
  paintCtx.lineCap = "round";
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (Math.hypot(prev.x - next.x, prev.y - next.y) > 84) continue;
    paintCtx.beginPath();
    paintCtx.moveTo(prev.x, prev.y);
    paintCtx.lineTo(next.x, next.y);
    paintCtx.stroke();
  }

  drawStrayPaint(dial, true);
  drawDialPaint(dial, true);
  if (dialNeedsCorrection(dial)) {
    paintCtx.strokeStyle = "rgba(255, 120, 120, 0.96)";
    paintCtx.lineWidth = 4;
    paintCtx.beginPath();
    paintCtx.arc(ZOOM_CENTER_X, ZOOM_CENTER_Y, 136, 0, Math.PI * 2);
    paintCtx.stroke();
  }

  const paintMeterWidth = 180;
  paintCtx.strokeStyle = "rgba(255,255,255,0.28)";
  paintCtx.lineWidth = 2;
  paintCtx.strokeRect(w - 212, 28, paintMeterWidth, 16);
  paintCtx.fillStyle = "rgba(229, 208, 109, 0.95)";
  paintCtx.fillRect(w - 211, 29, (paintMeterWidth - 2) * paintState.paintLoaded, 14);
  paintCtx.fillStyle = "rgba(255,255,255,0.58)";
  paintCtx.font = "14px Georgia";
  paintCtx.fillText("paint on brush", w - 122, 58);

  const previewRadius = paintState.tool === "nail" ? 8 : Math.max(5, paintState.brushSize * 28);
  paintCtx.save();
  paintCtx.strokeStyle = paintState.tool === "nail" ? "rgba(255, 122, 122, 0.96)" : "rgba(245, 245, 190, 0.96)";
  paintCtx.fillStyle = paintState.tool === "nail" ? "rgba(170, 0, 0, 0.12)" : "rgba(245, 245, 190, 0.08)";
  paintCtx.lineWidth = 3;
  paintCtx.beginPath();
  paintCtx.arc(paintState.cursorX, paintState.cursorY, previewRadius, 0, Math.PI * 2);
  paintCtx.fill();
  paintCtx.stroke();
  paintCtx.restore();

  drawImageCursor(currentStationMode());
  drawThoughtPopup();
}

function drawThoughtPopup() {
  const popup = paintState.thoughtPopup;
  if (!popup) return;

  const frame = thoughtPopupFrame(popup);
  const textFrame = thoughtTextFrame(popup);
  const close = thoughtCloseHitbox();
  paintCtx.save();
  const image = assetImages.thoughtPopup;
  const drewPopup = imageReady(image)
    ? (paintCtx.save(), paintCtx.globalAlpha = popup.requiresDismiss ? 0.98 : 0.84, paintCtx.drawImage(image, frame.x, frame.y, frame.w, frame.h), paintCtx.restore(), true)
    : false;
  if (!drewPopup) {
    paintCtx.fillStyle = popup.dark ? "rgba(12, 12, 12, 0.96)" : "rgba(248, 248, 248, 0.97)";
    paintCtx.strokeStyle = popup.dark ? "rgba(170, 60, 60, 0.72)" : "rgba(0, 0, 0, 0.34)";
    paintCtx.lineWidth = 2;
    paintCtx.fillRect(frame.x, frame.y, frame.w, frame.h);
    paintCtx.strokeRect(frame.x, frame.y, frame.w, frame.h);
  }

  if (close) {
    paintCtx.fillStyle = popup.dark ? "rgba(120, 0, 0, 0.96)" : "rgba(255,255,255,0.98)";
    paintCtx.fillRect(close.x, close.y, close.w, close.h);
    paintCtx.strokeStyle = popup.dark ? "rgba(255, 220, 220, 0.96)" : "rgba(0,0,0,0.88)";
    paintCtx.lineWidth = 3;
    paintCtx.strokeRect(close.x, close.y, close.w, close.h);
    paintCtx.fillStyle = popup.dark ? "#ffe7e7" : "#111";
    paintCtx.font = "bold 14px Georgia";
    paintCtx.fillText("X", close.x + close.w / 2, close.y + 15);
    paintCtx.font = "bold 10px Georgia";
    paintCtx.fillText("CLOSE", close.x + close.w / 2, close.y + close.h - 10);
    paintCtx.strokeStyle = popup.dark ? "rgba(255, 220, 220, 0.96)" : "rgba(0,0,0,0.88)";
    paintCtx.beginPath();
    paintCtx.moveTo(close.x + 9, close.y + 9);
    paintCtx.lineTo(close.x + close.w - 9, close.y + close.h - 22);
    paintCtx.moveTo(close.x + close.w - 9, close.y + 9);
    paintCtx.lineTo(close.x + 9, close.y + close.h - 22);
    paintCtx.stroke();
  }

  const fitted = fitThoughtText(popup.text, textFrame);
  paintCtx.fillStyle = "#f7f7f7";
  paintCtx.font = `${fitted.fontSize}px Georgia`;
  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.shadowColor = "rgba(0, 0, 0, 0.7)";
  paintCtx.shadowBlur = 2;
  paintCtx.shadowOffsetX = 0;
  paintCtx.shadowOffsetY = 1;
  const startY = textFrame.y + textFrame.h / 2 - ((fitted.lines.length - 1) * fitted.lineHeight) / 2;
  fitted.lines.forEach((line, index) => {
    paintCtx.fillText(line, textFrame.x + textFrame.w / 2, startY + index * fitted.lineHeight);
  });
  paintCtx.restore();
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

function fracturePieceAt(x, y) {
  for (let i = paintState.fracturePieces.length - 1; i >= 0; i -= 1) {
    const piece = paintState.fracturePieces[i];
    if (piece.placed) continue;
    if (x >= piece.x && x <= piece.x + piece.w && y >= piece.y && y <= piece.y + piece.h) {
      return i;
    }
  }
  return -1;
}

function beginFractureDrag(x, y) {
  const pieceIndex = fracturePieceAt(x, y);
  if (pieceIndex === -1) return;
  const [piece] = paintState.fracturePieces.splice(pieceIndex, 1);
  paintState.fracturePieces.push(piece);
  paintState.draggedPieceIndex = paintState.fracturePieces.length - 1;
  paintState.dragOffsetX = x - piece.x;
  paintState.dragOffsetY = y - piece.y;
}

function moveFractureDrag(x, y) {
  if (paintState.draggedPieceIndex === -1) return;
  const piece = paintState.fracturePieces[paintState.draggedPieceIndex];
  piece.x = Math.max(0, Math.min(paintCanvas.width - piece.w, x - paintState.dragOffsetX));
  piece.y = Math.max(0, Math.min(paintCanvas.height - piece.h, y - paintState.dragOffsetY));
}

function endFractureDrag() {
  if (paintState.draggedPieceIndex === -1) return;
  const piece = paintState.fracturePieces[paintState.draggedPieceIndex];
  if (Math.hypot(piece.x - piece.targetX, piece.y - piece.targetY) < 28) {
    piece.x = piece.targetX;
    piece.y = piece.targetY;
    piece.placed = true;
  }
  paintState.draggedPieceIndex = -1;

  if (paintState.fracturePieces.length > 0 && paintState.fracturePieces.every((entry) => entry.placed)) {
    completeFracturePuzzle();
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  drawScene();
  if (paintState.active) {
    refreshPaintCursor();
    drawWatchMinigame();
  }
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

function refreshPaintCursor() {
  const driftedPosition = applyPaintingDrift({
    x: paintState.pointerX,
    y: paintState.pointerY,
  });
  paintState.cursorX = driftedPosition.x;
  paintState.cursorY = driftedPosition.y;
  return driftedPosition;
}

function paintingDriftStrength() {
  const health = Math.max(0, Math.min(100, gameState.hiddenStats.health));
  if (health > 80) return 0;
  return (80 - health) / 80;
}

function applyPaintingDrift(position) {
  if (!paintState.active || paintState.mode !== "watch") {
    return position;
  }

  const severity = paintingDriftStrength();
  if (severity <= 0) return position;

  const now = performance.now();
  const idleElapsed = Math.max(0, now - paintState.lastPointerMoveAt);
  const idleFactor = Math.min(1, Math.max(0, idleElapsed - 110) / 650);
  const strokeBoost = paintState.isPainting && paintState.tool === "brush" ? 1.15 : 1;
  const shakeRadius = (1.8 + severity * 7.2) * strokeBoost;
  const idleRadius = (12 + severity * 44) * idleFactor;
  const driftX =
    Math.sin(now * 0.08 + paintState.watchIndex * 0.71) * shakeRadius * 0.62 +
    Math.sin(now * 0.16 + paintState.activeDialIndex * 1.11) * shakeRadius * 0.32 +
    Math.cos(now * 0.23 + paintState.watchIndex * 0.43) * shakeRadius * 0.18 +
    Math.sin(now * 0.012 + paintState.watchIndex * 0.34) * idleRadius * 0.92 +
    Math.cos(now * 0.019 + paintState.activeDialIndex * 0.58) * idleRadius * 0.46;
  const driftY =
    Math.cos(now * 0.09 + paintState.watchIndex * 0.39) * shakeRadius * 0.58 +
    Math.sin(now * 0.175 + paintState.activeDialIndex * 0.93) * shakeRadius * 0.28 +
    Math.cos(now * 0.21 + paintState.watchIndex * 0.27) * shakeRadius * 0.17 +
    Math.cos(now * 0.011 + paintState.watchIndex * 0.29) * idleRadius * 0.88 +
    Math.sin(now * 0.017 + paintState.activeDialIndex * 0.47) * idleRadius * 0.44;

  return {
    x: Math.max(0, Math.min(paintCanvas.width, position.x + driftX)),
    y: Math.max(0, Math.min(paintCanvas.height, position.y + driftY)),
  };
}

dialogButton.addEventListener("click", () => {
  if (gameState.dialogMode === "day-one-intro") {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    gameState.dayOneIntroSeen = true;
    startShift(true);
    return;
  }

  if (gameState.dialogMode === "day-five-choice") {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    gameState.dayFiveCutsceneSeen = true;
    gameState.joinedWorkers = true;
    showSolidarityEnding();
    return;
  }
  if (gameState.dialogMode === "bench-tutorial") {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    setMessage(
      "The center worker has shown you the process.",
      "Clock in at the wall clock when you're ready to start the shift.",
    );
    return;
  }
  continueAfterDialog();
});

dialogAltButton.addEventListener("click", () => {
  if (gameState.dialogMode !== "day-five-choice") return;
  dialogOverlay.classList.add("hidden");
  resetDialogButtons();
  gameState.dayFiveCutsceneSeen = true;
  gameState.joinedWorkers = false;
  startShift(true);
});

brushButton.addEventListener("click", () => {
  switchToBrushMode();
});

correctButton.addEventListener("click", () => {
  switchToNailMode();
});

lickButton.addEventListener("click", () => {
  gameState.hiddenStats.brushLicks += 1;
  spendHealth(2);
  const preservedPaintLoad = paintState.paintLoaded;
  paintState.tool = "brush";
  paintState.correcting = false;
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintState.paintLoaded = preservedPaintLoad;
  paintPrompt.textContent = "You mouth-point the brush before tracing the next strokes. The tip narrows back into working shape.";
  updatePaintStats();
  drawWatchMinigame();
});

wipeButton.addEventListener("click", () => {
  wipeNearestDial();
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
  if (paintState.mode === "fracture") {
    paintState.pointerX = position.x;
    paintState.pointerY = position.y;
    paintState.lastPointerMoveAt = performance.now();
    paintState.cursorX = position.x;
    paintState.cursorY = position.y;
    moveFractureDrag(position.x, position.y);
    return;
  }

  paintState.pointerX = position.x;
  paintState.pointerY = position.y;
  paintState.lastPointerMoveAt = performance.now();

  if (paintState.thoughtPopup && paintState.thoughtPopup.requiresDismiss) {
    refreshPaintCursor();
    return;
  }

  const driftedPosition = refreshPaintCursor();

  if (paintState.active && paintState.isPainting) {
    if (paintState.tool === "brush") {
      paintAt(driftedPosition.x, driftedPosition.y);
    } else {
      correctAt(driftedPosition.x, driftedPosition.y);
    }
  }
});

paintCanvas.addEventListener("mousedown", (event) => {
  if (!paintState.active) return;

  const position = pointerInsidePaintCanvas(event);
  paintState.pointerX = position.x;
  paintState.pointerY = position.y;
  paintState.lastPointerMoveAt = performance.now();

  if (paintState.mode === "fracture") {
    paintState.cursorX = position.x;
    paintState.cursorY = position.y;
    beginFractureDrag(position.x, position.y);
    drawWatchMinigame();
    return;
  }

  const driftedPosition = refreshPaintCursor();

  if (paintState.thoughtPopup) {
    if (pointInsideThoughtClose(position.x, position.y)) {
      closeThoughtPopup();
      drawWatchMinigame();
      return;
    }
  }

  if (paintState.thoughtPopup && paintState.thoughtPopup.requiresDismiss) {
    if (!pointInsideThoughtClose(position.x, position.y)) {
      paintPrompt.textContent = "The thought sits over your work until you close it.";
      drawWatchMinigame();
      return;
    }
  }

  const region = bowlUnderCursor(position.x, position.y);
  if (region) {
    addIngredient(region);
    drawWatchMinigame();
    return;
  }

  if (paintState.zoomedDialIndex === -1 && Math.hypot(position.x - STATION_LAYOUT.brushProp.x, position.y - STATION_LAYOUT.brushProp.y) < STATION_LAYOUT.brushProp.r) {
    switchToBrushMode("You pick up the brush from the side of the station.");
    return;
  }

  if (paintState.zoomedDialIndex === -1 && Math.hypot(position.x - STATION_LAYOUT.nailProp.x, position.y - STATION_LAYOUT.nailProp.y) < STATION_LAYOUT.nailProp.r) {
    switchToNailMode("prop");
    paintPrompt.textContent = "You set the brush down and use your fingernails as a precise wipe instead.";
    updatePaintStats();
    drawWatchMinigame();
    return;
  }

  if (paintState.zoomedDialIndex === -1) {
    if (paintState.mixQuality <= 0) {
      paintPrompt.textContent = "Mix the dish first. Then click one of the gray numeral markers to work on it up close.";
      drawWatchMinigame();
      return;
    }
    const dial = findNearestDial(position.x, position.y)?.dial;
    if (dial) {
      enterDialZoom(paintState.dials.indexOf(dial));
      return;
    }
    paintPrompt.textContent = "Click one of the gray numeral markers to open it against the dark.";
    drawWatchMinigame();
    return;
  }

  if (paintState.tool === "nail") {
    correctAt(driftedPosition.x, driftedPosition.y);
    drawWatchMinigame();
    return;
  }

  paintState.isPainting = true;
  const paintingPosition = refreshPaintCursor();
  paintAt(paintingPosition.x, paintingPosition.y);
  drawWatchMinigame();
});

window.addEventListener("mouseup", () => {
  if (paintState.mode === "fracture") {
    endFractureDrag();
  }
  paintState.isPainting = false;
});

document.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.shiftKey && event.code === "KeyF") {
    event.preventDefault();
    gameState.currentDay = Math.max(gameState.currentDay, 3);
    gameState.shiftActive = false;
    gameState.shiftEnded = false;
    gameState.fracturePending = true;
    gameState.fractureResolved = false;
    openFracturePuzzle("Debug shortcut: the broken watch scene has been opened directly so you can inspect it.");
    return;
  }

  if (event.code === "Escape" && paintState.active && paintState.mode !== "fracture") {
    if (paintState.zoomedDialIndex !== -1) {
      exitDialZoom();
    } else {
      closeMinigame();
      setMessage("You stand back up from the bench.", "The line keeps moving while the next watch waits under the lamp.");
    }
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
