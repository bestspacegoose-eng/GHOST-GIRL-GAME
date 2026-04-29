// Shared DOM refs, constants, state, assets, and room layout.
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
const recapOverlay = document.getElementById("recapOverlay");
const recapTitle = document.getElementById("recapTitle");
const recapLines = document.getElementById("recapLines");
const recapButton = document.getElementById("recapButton");
const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBody = document.getElementById("dialogBody");
const dialogPager = document.getElementById("dialogPager");
const dialogPrevButton = document.getElementById("dialogPrevButton");
const dialogPageIndicator = document.getElementById("dialogPageIndicator");
const dialogNextButton = document.getElementById("dialogNextButton");
const dialogAltButton = document.getElementById("dialogAltButton");
const dialogThirdButton = document.getElementById("dialogThirdButton");
const dialogButton = document.getElementById("dialogButton");
const minigameOverlay = document.getElementById("minigameOverlay");
const minigameHeading = minigameOverlay.querySelector("h2");
const paintCanvas = document.getElementById("paintCanvas");
const paintCtx = paintCanvas.getContext("2d");
const paintPrompt = document.getElementById("paintPrompt");
const mixPrompt = document.getElementById("mixPrompt");
const paintStats = document.getElementById("paintStats");
const infoCanvas = document.getElementById("infoCanvas");
const infoCtx = infoCanvas ? infoCanvas.getContext("2d") : null;
const correctButton = document.getElementById("correctButton");
const lickButton = document.getElementById("lickButton");
const checkNumeralButton = document.getElementById("checkNumeralButton");
const restHandButton = document.getElementById("restHandButton");
const paintBackToMixButton = document.getElementById("paintBackToMixButton");
const mixSettleButton = document.getElementById("mixSettleButton");
const mixResetButton = document.getElementById("mixResetButton");
const workspaceBanner = document.getElementById("workspaceBanner");
const workspaceBannerTitle = document.getElementById("workspaceBannerTitle");
const workspaceBannerBody = document.getElementById("workspaceBannerBody");
const menuButton = document.getElementById("menuButton");
const menuOverlay = document.getElementById("menuOverlay");
const menuStatus = document.getElementById("menuStatus");
const saveSlotGrid = document.getElementById("saveSlotGrid");
const musicVolumeSlider = document.getElementById("musicVolumeSlider");
const musicVolumeValue = document.getElementById("musicVolumeValue");
const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
const sfxVolumeValue = document.getElementById("sfxVolumeValue");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const deleteSaveButton = document.getElementById("deleteSaveButton");
const newWeekButton = document.getElementById("newWeekButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const textLogList = document.getElementById("textLogList");
const bgMusic = document.getElementById("bgMusic");

const STATION_BUTTONS = {
  correct: correctButton,
  lick: lickButton,
  checkNumeral: checkNumeralButton,
  restHand: restHandButton,
  backToMix: paintBackToMixButton,
  mixSettle: mixSettleButton,
  mixReset: mixResetButton,
};

const TUTORIAL_BUTTON_STEP_MAP = {
  4: ["correct", "checkNumeral", "lick"],
};

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
const MINIGAME_SPEED_HEALTH_THRESHOLD = 80;
const MAX_MINIGAME_SPEED_MULTIPLIER = 1.65;
const LOCAL_SAVE_SCHEMA_VERSION = 2;
const LOCAL_SAVE_KEY = `ghost_girl_local_save_v${LOCAL_SAVE_SCHEMA_VERSION}`;
const LEGACY_LOCAL_SAVE_KEYS = ["ghost_girl_local_save_v1"];
const LOCAL_SAVE_SLOT_KEY_PREFIX = `ghost_girl_local_save_slots_v${LOCAL_SAVE_SCHEMA_VERSION}_slot_`;
const LOCAL_SAVE_SELECTED_SLOT_KEY = "ghost_girl_selected_save_slot_v1";
const LOCAL_SAVE_SLOT_COUNT = 6;
const LOCAL_AUDIO_SETTINGS_KEY = "ghost_girl_audio_settings_v1";
const COMPLETION_BELL_TRACK_URL = "https://soundcloud.com/user-966880386/tibetan-bell-04";
const COMPLETION_BELL_EMBED_URL =
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(COMPLETION_BELL_TRACK_URL)}`
  + "&auto_play=false&hide_related=true&show_comments=false&show_user=false"
  + "&show_reposts=false&show_teaser=false&visual=false&sharing=false&download=false"
  + "&buying=false&liking=false&single_active=false";
const SHIFT_TICK_TRACK_URL = "https://soundcloud.com/user-121701775/ticking-clock-sound-1-hour";
const SHIFT_TICK_EMBED_URL =
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(SHIFT_TICK_TRACK_URL)}`
  + "&auto_play=false&hide_related=true&show_comments=false&show_user=false"
  + "&show_reposts=false&show_teaser=false&visual=false&sharing=false&download=false"
  + "&buying=false&liking=false&single_active=false";
const COMPLETION_BELL_RETRIGGER_MS = 180;
const COMPLETION_BELL_MAX_PLAY_MS = 2000;
const BACKGROUND_MUSIC_VIDEO_ID = "x2aUyoujeUM";
const GUARANTEED_THRESHOLD_THOUGHT = "Why does my hand feel unsteady already? It shouldn't be this hard to hold a straight line.";
const DIALOG_PAGE_CHARACTER_LIMIT = 270;
const TEXT_LOG_LIMIT = 360;
const TIMING_FEEDBACK_DURATION_MS = 760;
const DEFAULT_BRUSH_SIZE = 0.22;
const BRUSH_ROUGH_THRESHOLD = 0.95;
const BRUSH_FANNED_THRESHOLD = 1.45;
const MAX_BRUSH_SIZE = 1.9;
const WATCH_SCREEN_MIXING = "mixing";
const WATCH_SCREEN_PAINTING = "painting";
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
const PAINT_DRAIN_PER_STROKE = 0.003;
const PAINT_POINT_COMPLETE = 1;
const PAINT_POINT_COVERAGE_THRESHOLD = 0.92;
const PAINT_POINT_SOFT_COVERAGE_THRESHOLD = 0.62;
const STATION_LAYOUT = {
  powder: { x: 130, y: 250, w: 110, h: 194 },
  gum: { x: 274, y: 250, w: 86, h: 194 },
  water: { x: 388, y: 250, w: 72, h: 194 },
  dish: { x: 520, y: 428, w: 146, h: 220, rx: 44, ry: 62 },
  mixPanel: { x: 34, y: 66, w: 572, h: 526 },
  recipePanel: { x: 446, y: 112, w: 134, h: 154 },
  zoomPaint: { x: 96, y: 108, w: 122, h: 90, rx: 44, ry: 30 },
  zoomWipe: { x: 96, y: 252, w: 126, h: 144 },
  brushProp: { x: 124, y: 194, w: 58, h: 204 },
  nailProp: { x: 246, y: 320, r: 24 },
};
const GROCERY_ITEMS = [
  { id: "steak", label: "Round Steak", unit: "lb", priceTenths: 395 },
  { id: "bacon", label: "Bacon", unit: "lb", priceTenths: 523 },
  { id: "milk", label: "Milk", unit: "qt", priceTenths: 167 },
  { id: "butter", label: "Butter", unit: "lb", priceTenths: 701 },
  { id: "eggs", label: "Eggs", unit: "doz", priceTenths: 681 },
  { id: "flour", label: "Flour", unit: "lb", priceTenths: 81 },
  { id: "potatoes", label: "Potatoes", unit: "lb", priceTenths: 63 },
  { id: "sugar", label: "Sugar", unit: "lb", priceTenths: 194 },
];
const GROCERY_LAYOUT = {
  panel: { x: 318, y: 42, w: 300, h: 574 },
  rowStartY: 104,
  rowHeight: 44,
  rowGap: 8,
  finish: { x: 470, y: 566, w: 132, h: 38 },
  basket: { x: 24, y: 190, w: 262, h: 244 },
  footer: { x: 24, y: 526, w: 276, h: 92 },
};
const GROCERY_DOLLAR_THRESHOLD_TENTHS = 1000;
const GROCERY_TIMING_WINDOWS = {
  perfect: 0.055,
  good: 0.13,
  okay: 0.24,
};
const GROCERY_DISCOUNT_RATES = {
  perfect: 0.22,
  good: 0.14,
  okay: 0.07,
  bad: 0,
};
const HEMMING_LAYOUT = {
  panel: { x: 56, y: 40, w: 528, h: 512 },
  garmentFrame: { x: 118, y: 106, w: 404, h: 290 },
  stitchLine: { x: 136, y: 448, w: 368 },
  progressY: 86,
  finish: { x: 398, y: 510, w: 160, h: 42 },
};
const HEMMING_TIMING_WIDGET_SIZE = 176;
const HEMMING_TIMING_WIDGET_MARGIN = 18;
const HEMMING_FAMILY_ITEMS = [
  "Your blue dress",
  "Elly's school skirt",
  "Denny's shirt hem",
  "Maggie's apron",
];
const HEMMING_HOME_DESCRIPTION_TABLE = {
  dress: {
    unfinished: "Your blue dress still has pins holding part of the hem where stitches should be.",
    bad: "Your blue dress is mended, but the hem puckers and shows where exhaustion hurried the thread.",
    okay: "Your blue dress will do for now, though the hemline sways a little where the stitches drift.",
    good: "Your blue dress hangs straight now, the new seam firm enough to trust.",
    perfect: "Your blue dress lies folded with a neat, patient hem that almost makes it look store-bought.",
  },
  elly: {
    unfinished: "Elly's school skirt still waits half-turned on the chair, its loose edge promising trouble by morning.",
    bad: "Elly's school skirt is closed up, but the hem buckles in places where the thread pulled too hard.",
    okay: "Elly's school skirt is wearable again, though the seam meanders if you look too closely.",
    good: "Elly's school skirt sits neatly mended, the new stitches keeping the edge clean and serviceable.",
    perfect: "Elly's school skirt has a crisp, even hem that should survive the week without complaint.",
  },
  denny: {
    unfinished: "Denny's shirt hem is still folded back on itself, waiting for more passes of the needle.",
    bad: "Denny's shirt hem is caught together, but the seam looks strained and easy to pick at.",
    okay: "Denny's shirt hem is secured well enough, though the line skips its rhythm here and there.",
    good: "Denny's shirt hem holds cleanly now, plain but sturdy under your fingers.",
    perfect: "Denny's shirt hem is set with small, even stitches that should keep it from fraying again soon.",
  },
  maggie: {
    unfinished: "Maggie's apron still has a loose edge curling away from the cloth.",
    bad: "Maggie's apron is stitched shut, but the edge sits lumpy where the work went rough.",
    okay: "Maggie's apron is usable again, though the hem wavers in a few stubborn spots.",
    good: "Maggie's apron is properly mended now, with a steady seam that should keep through chores.",
    perfect: "Maggie's apron has been turned and finished so neatly it almost brightens the whole garment.",
  },
};
const HEMMING_SIBLING_REACTION_TABLE = {
  Elly: {
    unfinished: "Elly tries not to stare at the still-open skirt hem, but school tomorrow is all she can think about.",
    bad: "Elly thanks you because she means it, but her fingers worry the rougher spots on the skirt as soon as she thinks you are not looking.",
    okay: "Elly thanks you quickly and says it will do, though she keeps peeking at the places where the seam wanders.",
    good: "Elly smiles with obvious relief, smoothing the skirt flat over her knees as if testing how safely she can trust it.",
    perfect: "Elly runs both palms over the skirt and beams, already talking about wearing it to school without having to mind the tear.",
  },
  Denny: {
    unfinished: "Denny lifts the shirt hem, then lets it drop again and shrugs like he is not disappointed.",
    bad: "Denny says it is fine, though he rubs the rough hem between thumb and knuckle like he expects it to give.",
    okay: "Denny accepts the shirt with a small grin, but he keeps checking whether the seam will hold if he moves too hard.",
    good: "Denny nods at the firmer hem with quiet satisfaction, already less guarded about wearing it tomorrow.",
    perfect: "Denny grins at the shirt and gives the repaired hem an approving tug, pleased it feels strong instead of fussy.",
  },
  Maggie: {
    unfinished: "Maggie watches you fold the still-unfinished apron and goes quiet in that careful way children do when they do not want to ask for more.",
    bad: "Maggie says it looks nice because she wants to be kind, but even she keeps patting the uneven hem with uncertain little hands.",
    okay: "Maggie is glad to have the apron back, even if she tilts her head at the wandering stitches like they puzzle her.",
    good: "Maggie smiles at the apron and hugs it to her middle, happy just to see it looking whole again.",
    perfect: "Maggie delights in the tidier apron at once, holding it up by the straps as though it has turned back into her favorite thing.",
  },
};
const HEMMING_IMMEDIATE_REACTION_TABLE = {
  dress: {
    bad: "You hold up your blue dress and wince. The seam is closed, but only barely, and the cloth shows every tired place in your hand.",
    okay: "You smooth your blue dress over your lap and tell yourself it will hold for now, even if the hem still wanders.",
    good: "You lift your blue dress by the hem and feel a little steadier. The new line sits cleanly enough to trust through tomorrow.",
    perfect: "You hold your blue dress to the light and let yourself enjoy it for a second. The hem lies so neatly it almost feels like getting something back.",
  },
  elly: {
    bad: "Elly turns the skirt edge through her fingers and says, \"It'll still get me through class.\" She means to be grateful, but she hears the roughness too.",
    okay: "Elly presses the school skirt flat and gives you a quick nod. \"It's all right. Better than it was this morning.\"",
    good: "Elly smiles the moment the skirt is back in her hands. \"This should hold,\" she says, already sounding less worried about tomorrow.",
    perfect: "Elly beams and runs both palms over the hem. \"It looks nearly new,\" she says, delighted enough to forget how tired you both are.",
  },
  denny: {
    bad: "Denny gives the shirt hem a careful tug and says, \"I can make this do.\" The words are brave, even if the seam still looks fragile.",
    okay: "Denny checks the line of stitches with a thoughtful squint, then nods once. \"That's plenty better,\" he says.",
    good: "Denny pulls the shirt hem straight, tests it, and grins. \"That'll last,\" he says, sounding relieved more than anything.",
    perfect: "Denny gives the repaired hem an approving snap between his fingers. \"Now that's proper work,\" he says with a grin he can't hide.",
  },
  maggie: {
    bad: "Maggie hugs the apron to her middle anyway. \"I still like it,\" she says softly, trying to rescue the moment for you.",
    okay: "Maggie tilts the apron, studies the stitches, and smiles in that small careful way of hers. \"It looks better,\" she says.",
    good: "Maggie brightens at once and lifts the apron by its straps. \"It's nice again,\" she says, pleased enough to rock on her heels.",
    perfect: "Maggie gasps when she sees the finished edge and holds the apron up like a prize. \"It's beautiful,\" she says, all simple certainty.",
  },
};
const HEMMING_GRADE_ORDER = ["bad", "okay", "good", "perfect"];
const HEMMING_TIMING_WINDOWS = {
  perfect: 0.045,
  good: 0.095,
  okay: 0.17,
};
const NUMERAL_SHEET_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const NUMERAL_STYLE_KEYS = ["numeralsStyleOrnate", "numeralsStyleBlock"];
const NUMERAL_STYLE_RULES = {
  numeralsStyleOrnate: {
    payMultiplier: 2,
    spillLeniency: 1.16,
  },
  numeralsStyleBlock: {
    payMultiplier: 1,
    spillLeniency: 1,
  },
};
const ASSET_PATHS = {
  backgroundRoom: "./assets/background-radium-girls.jpg",
  roomClock: "./assets/room-clock.png",
  cursorMix: "./assets/cursor-mix.png",
  cursorBrush: "./assets/cursor-brush.png",
  roughBrush: "./assets/RoughBrush.png",
  fannedBrush: "./assets/FannedBrush.png",
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
  mixPowderPhoto: "./assets/mix-powder-photo.jpg",
  mixBottle: "./assets/mix-tar-bottle.jpg",
  mixWaterDropper: "./assets/mix-water-dropper.jpg",
  mixBeaker: "./assets/mix-beaker-photo.jpg",
  paintMixSheet: "./assets/paint_mix_sheet.png",
  stirSpoonSheet: "./assets/stir_spoon_sheet.png",
  paintDripSheet: "./assets/paint_drip_sheet.png",
  paintRippleSheet: "./assets/paint_ripple_sheet.png",
  paintYellowOverlay: "./assets/paint_yellow_overlay.png",
  crucibleEmpty: "./assets/crucible_1.png",
  cruciblePowder: "./assets/crucible_2.png",
  cruciblePowderTar: "./assets/crucible_3.png",
  cruciblePaint: "./assets/crucible_4.png",
  hemDressSheet: "./assets/hemming-blue-dress-sheet.png",
  hemSkirtSheet: "./assets/hemming-school-skirt-sheet.png",
  hemShirtSheet: "./assets/hemming-shirt-hem-sheet.png",
  hemApronSheet: "./assets/hemming-apron-sheet.png",
  directWipeHand: "./assets/direct-wipe-hand.png",
  cursorHemming: "./assets/cursor-hemming.png",
  thoughtPopup: "./assets/thought-popup.png",
  groceries: "./assets/groceries.png",
  workbenchBrush: "./assets/workbench-brush.png",
  numeralsStyleOrnate: "./assets/numerals-style-ornate.png",
  numeralsStyleBlock: "./assets/numerals-style-block.png",
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
  dayPayDeductionsCents: 0,
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
  shiftThoughtLog: [],
  lastShiftThoughtLog: [],
  savedFundsTenths: 0,
  groceryBudgetTenths: 0,
  groceryFundsTenths: 0,
  groceryCart: {},
  groceryPurchasePrices: {},
  weekHappyGroceries: 0,
  weekSteadyGroceries: 0,
  weekLeanGroceries: 0,
  weekEmptyGroceries: 0,
  weekGroceryComfortScore: 0,
  postShiftActivity: "groceries",
  postHomeSummary: "",
  hemmingTasks: [],
  weekPerfectHems: 0,
  weekGoodHems: 0,
  weekOkayHems: 0,
  weekBadHems: 0,
  weekCompletedGarments: 0,
  workerProgress: {},
  tutorialSeen: false,
  handRestUnlocked: false,
  buttonHintState: { restHand: false },
  textLog: [],
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
  mixPhase: "empty",
  stirProgress: 0,
  mixStirring: false,
  mixLastStirX: 0,
  mixLastStirY: 0,
  mixRippleStartedAt: 0,
  mixDripStartedAt: 0,
  mixSettledAt: 0,
  dials: [],
  activeDialIndex: 0,
  zoomedDialIndex: -1,
  paintLoaded: 0,
  readyToSubmit: false,
  mode: "watch",
  watchScreen: WATCH_SCREEN_MIXING,
  fracturePieces: [],
  draggedPieceIndex: -1,
  dragOffsetX: 0,
  dragOffsetY: 0,
  thoughtPopup: null,
  nextThoughtTimer: 9,
  lastPointerMoveAt: 0,
  tutorial: null,
  autoSubmitTimer: -1,
  watchNumeralStyle: NUMERAL_STYLE_KEYS[0],
  showCoverageAssist: false,
  restHandOnSide: false,
  watchSubmissionPending: false,
  groceryTiming: {
    active: false,
    itemId: "",
    rowIndex: -1,
    startedAt: 0,
    durationMs: 1080,
    startRadius: 32,
    targetRadius: 11,
    checkoutActive: false,
    attemptsUsed: 0,
    bestGrade: "",
    bestProgress: 0,
    lastGrade: "",
    lastItemLabel: "",
    lastSavingsTenths: 0,
  },
  hemmingTiming: {
    active: false,
    taskIndex: -1,
    stitchIndex: -1,
    startedAt: 0,
    periodMs: 1200,
    target: 0.75,
    popupX: 0,
    popupY: 0,
    popupSize: HEMMING_TIMING_WIDGET_SIZE,
  },
  hemmingTaskIndex: 0,
  timingFeedback: {
    active: false,
    label: "",
    color: "rgba(255,255,255,0.94)",
    x: 0,
    y: 0,
    startedAt: 0,
    durationMs: TIMING_FEEDBACK_DURATION_MS,
  },
};

let workerConversationState = null;
let activeShiftEndReason = "";
let selectedSaveSlotIndex = 0;

const recapState = {
  active: false,
  continuation: null,
  lineTimers: [],
  buttonTimer: 0,
};

const workspaceBannerState = {
  visible: false,
  hideTimer: 0,
  cycleIndex: 0,
};

const bellState = {
  iframe: null,
  widget: null,
  widgetReady: false,
  pendingPlay: false,
  lastPlayAt: -Infinity,
  stopTimer: 0,
};

const shiftTickState = {
  iframe: null,
  widget: null,
  widgetReady: false,
  pendingPlay: false,
  active: false,
};

const soundCloudApiState = {
  scriptLoading: false,
  ready: false,
  pendingInitializers: [],
};

const backgroundMusicState = {
  unlocked: false,
  ready: false,
  pendingStart: false,
  player: null,
  apiReady: false,
};

const audioSettings = {
  musicVolume: 32,
  sfxVolume: 70,
};

const dialogPageState = {
  pages: [""],
  index: 0,
  title: "",
  fullText: "",
};

const TUTORIAL_STEPS = [
  {
    title: "Center Bench Tutorial",
    body:
      "The woman at the center bench waves you in before the bell. \"We will do this properly. First, click the brush lying beside the mixing board. You do not paint bare-handed.\"",
  },
  {
    title: "Center Bench Tutorial",
    body:
      "She watches your grip, then nods once. Before she can say more, another girl further down the row mutters without looking up: \"Three powder, two tar, one water.\" Queue those measures into the glass, then settle the batch.",
  },
  {
    title: "Center Bench Tutorial",
    body:
      "\"Good. Now choose a numeral on the watch face. Click one of the gray markers so you can work on it up close.\"",
  },
  {
    title: "Center Bench Tutorial",
    body:
      "\"Trace the numeral carefully,\" she says. \"Keep the paint on the guide and make it clean enough to count.\" Finish this numeral.",
  },
  {
    title: "Center Bench Tutorial",
    body:
      "\"That is the heart of it. If the paint strays, use Clean edges with nails for a small correction. If you lose the weak spots, Check numeral will show them back to you. Use Sharpen brush when the tip starts to spread. Press Escape to pull back from the numeral.\"",
  },
  {
    title: "Center Bench Tutorial",
    body:
      "\"That is the whole process. When you are ready to begin the real day, leave the bench and clock in at the wall.\"",
  },
];

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
    image.crossOrigin = "anonymous";
    image.src = src;
    return [key, image];
  }),
);
const numeralTemplateCache = {};

const componentRegions = [
  { index: 0, label: "Powder", x: STATION_LAYOUT.powder.x, y: STATION_LAYOUT.powder.y, w: STATION_LAYOUT.powder.w, h: STATION_LAYOUT.powder.h },
  { index: 1, label: "Tar", x: STATION_LAYOUT.gum.x, y: STATION_LAYOUT.gum.y, w: STATION_LAYOUT.gum.w, h: STATION_LAYOUT.gum.h },
  { index: 2, label: "Water", x: STATION_LAYOUT.water.x, y: STATION_LAYOUT.water.y, w: STATION_LAYOUT.water.w, h: STATION_LAYOUT.water.h },
];
const ROOM_HOTSPOTS = [
  { id: "clock", x: 4, y: 18, w: 54, h: 146 },
  { id: "bench-center", x: 229, y: 137, w: 58, h: 32 },
  { id: "worker-1", x: 9, y: 92, w: 20, h: 48 },
  { id: "worker-2", x: 53, y: 90, w: 20, h: 44 },
  { id: "worker-5", x: 92, y: 86, w: 22, h: 42 },
  { id: "worker-6", x: 120, y: 84, w: 22, h: 40 },
  { id: "worker-3", x: 138, y: 77, w: 28, h: 74 },
  { id: "worker-7", x: 184, y: 84, w: 24, h: 50 },
  { id: "worker-4", x: 219, y: 82, w: 28, h: 58 },
  { id: "worker-8", x: 253, y: 84, w: 24, h: 48 },
  { id: "worker-9", x: 279, y: 85, w: 22, h: 46 },
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
