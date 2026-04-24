function buildStyledNumeralPoints(label, centerX, centerY, angle) {
  const templates = extractNumeralTemplates(paintState.watchNumeralStyle);
  if (!templates) return null;
  const chars = label.split("");
  const composed = [];
  const glyphSpacing = 0.66;
  for (let i = 0; i < chars.length; i += 1) {
    const template = templates[chars[i]];
    if (!template || !template.points || template.points.length === 0) return null;
    const xOffset = chars.length === 1 ? 0 : (i - (chars.length - 1) / 2) * glyphSpacing;
    for (const point of template.points) {
      composed.push({
        x: point.x + xOffset,
        y: point.y,
      });
    }
  }

  if (composed.length === 0) return null;
  const radialX = Math.cos(angle);
  const radialY = Math.sin(angle);
  const inwardOffset = label.length === 1 ? -6 : -16;
  const scale = label.length === 1 ? 66 : 56;
  const baseX = centerX + radialX * inwardOffset;
  const baseY = centerY + radialY * inwardOffset;
  const points = composed.map((point) => ({
    x: baseX + point.x * scale,
    y: baseY + point.y * scale,
  }));

  return { points, guideMode: "cloud" };
}

function buildDialState() {
  const dials = [];
  const labels = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

  for (let i = 0; i < 12; i += 1) {
    const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const x = WATCH_CENTER_X + Math.cos(angle) * NUMERAL_RADIUS;
    const y = WATCH_CENTER_Y + Math.sin(angle) * NUMERAL_RADIUS;
    const styled = buildStyledNumeralPoints(labels[i], x, y, angle);
    const targetPoints = styled ? styled.points : buildNumeralPoints(labels[i], x, y, angle);
    dials.push({
      label: labels[i],
      angle,
      x,
      y,
      targetPoints,
      guideMode: styled ? styled.guideMode : "stroke",
      paintedMask: [],
      paintLevel: [],
      strayPoints: [],
      coverage: 0,
      mess: 0,
      corrected: false,
      credited: false,
      locked: false,
    });
  }

  for (const dial of dials) {
    dial.paintedMask = new Array(dial.targetPoints.length).fill(false);
    dial.paintLevel = new Array(dial.targetPoints.length).fill(0);
  }

  paintState.dials = dials;
  paintState.activeDialIndex = 0;
}

function cloneDials(dials) {
  return dials.map((dial) => ({
    ...dial,
    targetPoints: dial.targetPoints.map((point) => ({ ...point })),
    paintedMask: [...dial.paintedMask],
    paintLevel: dial.paintLevel
      ? [...dial.paintLevel]
      : dial.targetPoints.map((_, index) => (dial.paintedMask[index] ? PAINT_POINT_COMPLETE : 0)),
    strayPoints: dial.strayPoints.map((point) => ({ ...point })),
    guideMode: dial.guideMode || "stroke",
    locked: Boolean(dial.locked),
  }));
}

function saveCurrentBenchWork() {
  if (paintState.tutorial || !paintState.tableLabel || paintState.mode !== "watch" || paintState.dials.length === 0) return;
  gameState.savedBenchWork[paintState.tableLabel] = {
    dials: cloneDials(paintState.dials),
    mix: [...paintState.mix],
    mixQuality: paintState.mixQuality,
    brushSize: paintState.brushSize,
    watchNumeralStyle: paintState.watchNumeralStyle,
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
  paintState.watchNumeralStyle = saved.watchNumeralStyle || NUMERAL_STYLE_KEYS[0];
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
  const nextIndex = paintState.dials.findIndex((dial) => !dial.locked && (dial.coverage < 0.74 || dialNeedsCorrection(dial)));
  if (nextIndex !== -1) {
    paintState.activeDialIndex = nextIndex;
    return;
  }
  const firstUnlocked = paintState.dials.findIndex((dial) => !dial.locked);
  paintState.activeDialIndex = firstUnlocked === -1 ? 0 : firstUnlocked;
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
  if (paintState.tool === "brush") return "brush";
  return "mix";
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
  advanceTutorialStep("zoom");
  updatePaintStats();
  drawWatchMinigame();
}

function exitDialZoom(message = "You pull back from the numeral to survey the full watch face.") {
  paintState.zoomedDialIndex = -1;
  moveCursorToActiveDial();
  paintPrompt.textContent = message;
  advanceTutorialStep("exit-zoom");
  updatePaintStats();
  drawWatchMinigame();
}

function tutorialStepData() {
  return paintState.tutorial ? TUTORIAL_STEPS[paintState.tutorial.step] : null;
}

function tutorialBoxFrame() {
  return {
    x: 20,
    y: 468,
    w: 600,
    h: 132,
  };
}

function setTutorialStep(step) {
  if (!paintState.tutorial) return;
  paintState.tutorial.step = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step));
  const current = tutorialStepData();
  if (!current) return;
  paintPrompt.textContent = current.body;
  mixPrompt.textContent =
    paintState.tutorial.step <= 1
      ? "Follow the woman at the center bench step by step before the shift begins."
      : mixTextureFeedback();
  updatePaintStats();
}

function advanceTutorialStep(eventName) {
  if (!paintState.tutorial) return;
  const step = paintState.tutorial.step;
  const totalMix = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  const dial = activeDial();

  if (step === 0 && eventName === "brush") {
    setTutorialStep(1);
    return;
  }

  if (step === 1 && eventName === "mix" && totalMix >= 6 && paintState.mixQuality > 0.88) {
    setTutorialStep(2);
    return;
  }

  if (step === 2 && eventName === "zoom") {
    setTutorialStep(3);
    return;
  }

  if (step === 3 && eventName === "paint-complete" && dial && dial.coverage >= 0.96 && !dialNeedsCorrection(dial)) {
    setTutorialStep(4);
    return;
  }

  if (step === 4 && eventName === "exit-zoom") {
    setTutorialStep(5);
  }
}

function openTutorialMinigame() {
  openMinigame("tutorial");
  paintState.tutorial = { step: 0 };
  paintState.tool = "mix";
  paintState.correcting = false;
  paintState.paintLoaded = 0;
  gameState.tutorialSeen = true;
  setTutorialStep(0);
  drawWatchMinigame();
}

function closeTutorialMinigame() {
  paintState.tutorial = null;
  closeMinigame();
  setMessage(
    "The woman lets you stand back up from the bench.",
    "Clock in at the wall clock when you are ready to begin the shift.",
  );
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
  paintState.tool = "mix";
  paintState.thoughtPopup = null;
  paintState.tutorial = null;
  paintState.autoSubmitTimer = -1;
  paintState.nextThoughtTimer = nextThoughtDelay();
  if (!restoreBenchWork(label)) {
    paintState.watchIndex += 1;
    paintState.brushSize = DEFAULT_BRUSH_SIZE;
    paintState.watchNumeralStyle = chooseRandomNumeralStyle(paintState.watchNumeralStyle);
    paintState.paintLoaded = 0;
    paintState.zoomedDialIndex = -1;
    paintState.readyToSubmit = false;
    resetMix();
    buildDialState();
    moveCursorToActiveDial();
  }
  minigameHeading.textContent = "Watch Painting";
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
  paintState.tool = "mix";
  paintState.mode = "watch";
  paintState.zoomedDialIndex = -1;
  paintState.paintLoaded = 0;
  paintState.thoughtPopup = null;
  paintState.tutorial = null;
  paintState.autoSubmitTimer = -1;
  paintState.fracturePieces = [];
  paintState.draggedPieceIndex = -1;
  minigameHeading.textContent = "Watch Painting";
  setStationControlsHidden(false);
  minigameOverlay.classList.add("hidden");
}

function allDialsReady() {
  return paintState.dials.length > 0 && paintState.dials.every(dialCountsAsPainted);
}

function dialNeedsCorrection(dial) {
  return dial.coverage >= 0.9 && (dial.mess > 0.24 || dial.strayPoints.length > 0);
}

function correctionCount() {
  return paintState.dials.filter(dialNeedsCorrection).length;
}

function updatePaintStats() {
  const finished = paintState.dials.filter((dial) => dial.locked || dialCountsAsPainted(dial)).length;
  const correctionNeeded = correctionCount();
  const mixPercent = Math.round(paintState.mixQuality * 100);
  const brushState =
    paintState.brushSize <= BRUSH_ROUGH_THRESHOLD * 0.7 ? "fine tip" :
    paintState.brushSize < BRUSH_ROUGH_THRESHOLD ? "slightly soft" :
    paintState.brushSize < BRUSH_FANNED_THRESHOLD ? "roughening" :
    "fully fanned";
  const currentDial = activeDial();
  const currentDialText = currentDial
    ? ` Numeral ${currentDial.label} coverage ${Math.round(currentDial.coverage * 100)}%.`
    : "";
  paintStats.textContent =
    `Mix quality ${mixPercent}%. Paid dials today ${gameState.dialsPaintedToday}. Corrections needed ${correctionNeeded}. Tool ${paintState.tool}. Brush ${brushState}.${currentDialText}`;
  mixPrompt.textContent = mixTextureFeedback();
  correctButton.classList.toggle("active", paintState.tool === "nail");
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
  advanceTutorialStep("brush");
  updatePaintStats();
  drawWatchMinigame();
}

function prepareNextWatch(message) {
  clearBenchWork();
  paintState.correcting = false;
  paintState.tool = "mix";
  paintState.zoomedDialIndex = -1;
  paintState.readyToSubmit = false;
  resetMix();
  paintState.watchNumeralStyle = chooseRandomNumeralStyle(paintState.watchNumeralStyle);
  buildDialState();
  moveCursorToActiveDial();
  paintState.paintLoaded = 0;
  paintState.thoughtPopup = null;
  paintState.autoSubmitTimer = -1;
  paintState.nextThoughtTimer = nextThoughtDelay();
  paintPrompt.textContent = message;
  updatePaintStats();
  drawWatchMinigame();
}

function findNearestDial(x, y) {
  let best = null;
  const dialSet = paintState.zoomedDialIndex === -1
    ? paintState.dials.filter((dial) => !dial.locked)
    : [activeDial()].filter((dial) => dial && !dial.locked);

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
    ? paintState.dials.filter((dial) => !dial.locked)
    : [activeDial()].filter((dial) => dial && !dial.locked);

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
    : [{ index: 3, label: "Paint dish", x: STATION_LAYOUT.zoomPaint.x, y: STATION_LAYOUT.zoomPaint.y, rx: STATION_LAYOUT.zoomPaint.rx, ry: STATION_LAYOUT.zoomPaint.ry }];

  for (const region of regions) {
    const dx = (x - region.x) / region.rx;
    const dy = (y - region.y) / region.ry;
    if (dx * dx + dy * dy <= 1) return region;
  }
  return null;
}

function brushPropBounds() {
  return {
    x: STATION_LAYOUT.brushProp.x - STATION_LAYOUT.brushProp.w / 2,
    y: STATION_LAYOUT.brushProp.y - STATION_LAYOUT.brushProp.h / 2,
    w: STATION_LAYOUT.brushProp.w,
    h: STATION_LAYOUT.brushProp.h,
  };
}

function zoomWipeBounds() {
  return {
    x: STATION_LAYOUT.zoomWipe.x - STATION_LAYOUT.zoomWipe.w / 2,
    y: STATION_LAYOUT.zoomWipe.y - STATION_LAYOUT.zoomWipe.h / 2,
    w: STATION_LAYOUT.zoomWipe.w,
    h: STATION_LAYOUT.zoomWipe.h,
  };
}

function pointInsideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function stationHoverTargetAt(x, y) {
  if (paintState.mode !== "watch") return null;

  if (paintState.zoomedDialIndex === -1) {
    const brushBounds = brushPropBounds();
    if (pointInsideRect(x, y, brushBounds)) {
      return { type: "brush", label: "Pick up brush", centerX: STATION_LAYOUT.brushProp.x, topY: brushBounds.y };
    }
  } else {
    const wipeBounds = zoomWipeBounds();
    if (pointInsideRect(x, y, wipeBounds)) {
      return { type: "wipe-direct", label: "Wipe paint directly", centerX: STATION_LAYOUT.zoomWipe.x, topY: wipeBounds.y };
    }
  }

  const region = bowlUnderCursor(x, y);
  if (region) {
    return { type: "ingredient", label: region.label, centerX: region.x, topY: region.y - region.ry };
  }

  return null;
}

function addIngredient(region) {
  if (region.index === 3) {
    paintState.paintLoaded = MAX_PAINT_LOAD;
    paintState.tool = "brush";
    paintState.correcting = false;
    paintPrompt.textContent = "You dip the brush back into the paint dish at your side.";
    advanceTutorialStep("brush");
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

  advanceTutorialStep("mix");
  updatePaintStats();
}

function dialCountsAsPainted(dial) {
  return dial.coverage >= 0.94 && !dialNeedsCorrection(dial);
}

function creditCompletedDials() {
  if (paintState.tutorial) return;
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
  const mixQuality = Math.max(0, Math.min(1, paintState.mixQuality));
  const alpha = 0.28 + mixQuality * 0.72;
  const fillAlpha = Math.min(1, alpha + 0.08);
  const strayAlpha = 0.3 + mixQuality * 0.54;
  return {
    stroke: `rgba(236, 216, 120, ${alpha})`,
    fill: `rgba(240, 222, 132, ${fillAlpha})`,
    stray: `rgba(228, 204, 104, ${strayAlpha})`,
  };
}

function drawDialPaint(dial, zoomed = false) {
  const points = dialRenderPoints(dial);
  const tone = paintTone();
  const lineWidth = zoomed ? 18 : 6.4;
  const dotRadius = zoomed ? 8.2 : 3.2;
  const cloudGuide = dial.guideMode === "cloud";
  const levelSet = dial.paintLevel && dial.paintLevel.length === points.length
    ? dial.paintLevel
    : points.map((_, index) => (dial.paintedMask[index] ? PAINT_POINT_COMPLETE : 0));

  if (!cloudGuide) {
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
  }

  paintCtx.fillStyle = tone.fill;
  const mixOpacity = 0.28 + Math.max(0, Math.min(1, paintState.mixQuality)) * 0.72;
  for (let i = 0; i < points.length; i += 1) {
    const pointLevel = Math.max(0, Math.min(PAINT_POINT_COMPLETE, levelSet[i] || 0));
    if (pointLevel <= 0) continue;
    const point = points[i];
    const opacity = Math.max(0.08, Math.min(1, (pointLevel / PAINT_POINT_COMPLETE) * mixOpacity));
    paintCtx.save();
    paintCtx.globalAlpha = opacity;
    paintCtx.beginPath();
    paintCtx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    paintCtx.fill();
    paintCtx.restore();
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

function nearestGuideDistance(renderPoints, x, y) {
  let best = Infinity;
  for (const point of renderPoints) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < best) best = distance;
  }
  return best;
}

function brushFootprintOverflow(renderPoints, x, y, hitRadius) {
  if (!renderPoints || renderPoints.length === 0) return 1;

  const zoomed = paintState.zoomedDialIndex !== -1;
  const ringSampleCount = zoomed ? 18 : 14;
  const rings = [0.58, 0.8, 1];
  const baseTolerance = zoomed ? 14 : 5.5;
  let outsideCount = 0;
  let sampleCount = 0;

  for (const ringFactor of rings) {
    const ringRadius = hitRadius * ringFactor;
    const tolerance = baseTolerance + (1 - ringFactor) * (zoomed ? 7 : 2.6);
    for (let i = 0; i < ringSampleCount; i += 1) {
      const angle = (Math.PI * 2 * i) / ringSampleCount;
      const sampleX = x + Math.cos(angle) * ringRadius;
      const sampleY = y + Math.sin(angle) * ringRadius;
      const distanceToGuide = nearestGuideDistance(renderPoints, sampleX, sampleY);
      sampleCount += 1;
      if (distanceToGuide > tolerance) outsideCount += 1;
    }
  }

  return sampleCount === 0 ? 0 : outsideCount / sampleCount;
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

  if (paintState.zoomedDialIndex !== -1) {
    const focusedDial = activeDial();
    if (focusedDial?.locked) {
      paintPrompt.textContent = `Numeral ${focusedDial.label} is already complete and sealed. Move to another marker.`;
      return;
    }
  }

  dullBrushOnUse();

  const hit = findNearestTracePoint(x, y);
  if (!hit) {
    paintPrompt.textContent = "The stroke slips outside the guide and leaves a visible mistake.";
    const relevantDials = paintState.zoomedDialIndex === -1
      ? paintState.dials.filter((dial) => !dial.locked)
      : [activeDial()].filter((dial) => dial && !dial.locked);
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
  let partialPoints = 0;
  let overlapPoints = 0;
  let offGuidePoints = 0;
  const renderPoints = dialRenderPoints(hit.dial);
  if (!hit.dial.paintLevel || hit.dial.paintLevel.length !== renderPoints.length) {
    hit.dial.paintLevel = renderPoints.map((_, index) => (hit.dial.paintedMask[index] ? PAINT_POINT_COMPLETE : 0));
  }
  for (let i = 0; i < renderPoints.length; i += 1) {
    const point = renderPoints[i];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= hitRadius) {
      if (hit.dial.paintedMask[i]) {
        overlapPoints += 1;
      } else {
        const edgeFactor = Math.max(0.2, 1 - distance / Math.max(1, hitRadius));
        const depositBase = paintState.zoomedDialIndex === -1 ? 0.28 : 0.48;
        const qualityScale = 0.35 + paintState.mixQuality * 0.95;
        const deposit = depositBase * qualityScale * edgeFactor;
        const nextLevel = Math.min(PAINT_POINT_COMPLETE, (hit.dial.paintLevel[i] || 0) + deposit);
        hit.dial.paintLevel[i] = nextLevel;
        if (nextLevel >= PAINT_POINT_COVERAGE_THRESHOLD) {
          hit.dial.paintedMask[i] = true;
          paintedPoints += 1;
        } else {
          partialPoints += 1;
        }
      }
    }
  }

  const strictRadius = paintState.zoomedDialIndex === -1
    ? Math.max(6, paintState.brushSize * 4.5)
    : Math.max(10, paintState.brushSize * 18);
  if (hit.distance > strictRadius) {
    offGuidePoints += 1;
  }
  const overflowRatio = brushFootprintOverflow(renderPoints, x, y, hitRadius);
  if (overflowRatio > 0.18) {
    offGuidePoints += Math.max(1, Math.round(overflowRatio * 4));
  }

  const centerFactor = Math.max(0.78, 1 - hit.distance / (paintState.zoomedDialIndex === -1 ? 52 : 84));
  if (paintedPoints > 0) {
    hit.dial.mess += 0.002 + (1 - paintState.mixQuality) * 0.012 + (1 - centerFactor) * 0.006;
  } else if (overlapPoints === 0) {
    hit.dial.mess += 0.008 + (1 - paintState.mixQuality) * 0.018;
  }
  const spreadPenalty = Math.max(0, (paintState.brushSize - BRUSH_ROUGH_THRESHOLD) / Math.max(0.001, MAX_BRUSH_SIZE - BRUSH_ROUGH_THRESHOLD));
  if (spreadPenalty > 0 && paintedPoints > 0) {
    hit.dial.mess += (paintState.zoomedDialIndex === -1 ? 0.009 : 0.016) * spreadPenalty;
  }
  if (offGuidePoints > 0) {
    const spillMarks = Math.max(1, Math.ceil(1 + overflowRatio * 3));
    for (let i = 0; i < spillMarks; i += 1) {
      const angle = (Math.PI * 2 * i) / spillMarks + Math.random() * 0.32;
      const radius = hitRadius * (0.52 + Math.random() * 0.54);
      const spillX = x + Math.cos(angle) * radius;
      const spillY = y + Math.sin(angle) * radius;
      const worldPoint = worldPointForDial(hit.dial, spillX, spillY);
      hit.dial.strayPoints.push({
        x: worldPoint.x,
        y: worldPoint.y,
        r: (paintState.zoomedDialIndex === -1 ? 2.4 : 2.4) + paintState.brushSize * (paintState.zoomedDialIndex === -1 ? 2.2 : 3.2),
        a: 0.9,
      });
    }
    if (hit.dial.strayPoints.length > 64) hit.dial.strayPoints.shift();
    hit.dial.mess +=
      0.03 +
      overflowRatio * 0.12 +
      spreadPenalty * 0.035 +
      (1 - paintState.mixQuality) * 0.03;
    paintPrompt.textContent = "The spread brush bleeds past the numeral edges. This watch will need cleanup.";
  }

  paintState.paintLoaded = Math.max(0, paintState.paintLoaded - PAINT_DRAIN_PER_STROKE);
  updateCoverage();
  creditCompletedDials();

  if (paintedPoints === 0 && partialPoints > 0 && offGuidePoints === 0) {
    paintPrompt.textContent = "The paint is building, but this mix needs more passes to fully take.";
  } else if (paintedPoints === 0 && overlapPoints > 0 && offGuidePoints === 0) {
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

  if (paintState.tutorial) {
    const tutorialDial = activeDial();
    if (tutorialDial && tutorialDial.coverage >= 0.96 && !dialNeedsCorrection(tutorialDial)) {
      advanceTutorialStep("paint-complete");
    }
  }

  updatePaintStats();
}

function smoothDialMask(dial) {
  if (!dial.paintLevel || dial.paintLevel.length !== dial.paintedMask.length) {
    dial.paintLevel = dial.paintedMask.map((painted) => (painted ? PAINT_POINT_COMPLETE : 0));
  }
  let paintedCount = dial.paintedMask.filter(Boolean).length;
  const targetCount = Math.ceil(dial.targetPoints.length * 0.92);
  if (paintedCount <= targetCount) return;

  for (let i = dial.paintedMask.length - 1; i >= 0 && paintedCount > targetCount; i -= 1) {
    if (!dial.paintedMask[i]) continue;
    if (i % 2 === 0 || paintedCount - targetCount > 6) {
      dial.paintedMask[i] = false;
      dial.paintLevel[i] = PAINT_POINT_COVERAGE_THRESHOLD * 0.45;
      paintedCount -= 1;
    }
  }
}

function cleanDial(dial, amount) {
  if (!dial.paintLevel || dial.paintLevel.length !== dial.paintedMask.length) {
    dial.paintLevel = dial.paintedMask.map((painted) => (painted ? PAINT_POINT_COMPLETE : 0));
  }
  dial.mess = Math.max(0, dial.mess - amount);
  smoothDialMask(dial);
  const minimumCoverage = Math.ceil(dial.targetPoints.length * 0.9);
  let paintedCount = dial.paintedMask.filter(Boolean).length;
  for (let i = 0; i < dial.paintedMask.length && paintedCount < minimumCoverage; i += 1) {
    if (dial.paintedMask[i]) continue;
    dial.paintedMask[i] = true;
    dial.paintLevel[i] = PAINT_POINT_COMPLETE;
    paintedCount += 1;
  }
  dial.corrected = true;
}

function perfectDial(dial) {
  if (!dial.paintLevel || dial.paintLevel.length !== dial.paintedMask.length) {
    dial.paintLevel = dial.paintedMask.map((painted) => (painted ? PAINT_POINT_COMPLETE : 0));
  }
  dial.mess = 0;
  dial.corrected = true;
  dial.strayPoints = [];
  for (let i = 0; i < dial.paintedMask.length; i += 1) {
    dial.paintedMask[i] = true;
    dial.paintLevel[i] = PAINT_POINT_COMPLETE;
  }
}

function correctAt(x, y) {
  const target = findNearestDial(x, y);
  if (!target) {
    paintPrompt.textContent = "Your fingernail only skims the face where there is no paint to lift.";
    return;
  }

  if (target.dial.locked) {
    paintPrompt.textContent = `Numeral ${target.dial.label} is already complete and sealed.`;
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

  if (paintState.tutorial) {
    const tutorialDial = activeDial();
    if (tutorialDial && tutorialDial.coverage >= 0.96 && !dialNeedsCorrection(tutorialDial)) {
      advanceTutorialStep("paint-complete");
    }
  }

  updatePaintStats();
}

function wipeNearestDial() {
  const target = paintState.zoomedDialIndex === -1 ? null : activeDial();

  if (!target || !dialNeedsCorrection(target)) {
    paintPrompt.textContent = "Direct wiping only helps when the open numeral needs cleanup.";
    return;
  }

  if (target.locked) {
    paintPrompt.textContent = `Numeral ${target.label} is already complete and sealed.`;
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
  if (paintState.tutorial) {
    const tutorialDial = activeDial();
    if (tutorialDial && tutorialDial.coverage >= 0.96 && !dialNeedsCorrection(tutorialDial)) {
      advanceTutorialStep("paint-complete");
    }
  }
  updatePaintStats();
  paintPrompt.textContent = "You wipe the ragged excess away with your hands and leave the numeral clean again.";
}

function updateCoverage() {
  for (const [dialIndex, dial] of paintState.dials.entries()) {
    if (!dial.paintLevel || dial.paintLevel.length !== dial.paintedMask.length) {
      dial.paintLevel = dial.paintedMask.map((painted) => (painted ? PAINT_POINT_COMPLETE : 0));
    }
    let effectivePaint = 0;
    for (let i = 0; i < dial.targetPoints.length; i += 1) {
      const level = Math.max(0, Math.min(PAINT_POINT_COMPLETE, dial.paintLevel[i] || 0));
      if (level >= PAINT_POINT_COVERAGE_THRESHOLD) {
        dial.paintedMask[i] = true;
        effectivePaint += 1;
        continue;
      }
      if (dial.paintedMask[i]) {
        effectivePaint += 1;
        continue;
      }
      if (level >= PAINT_POINT_SOFT_COVERAGE_THRESHOLD) {
        effectivePaint += Math.min(1, level / PAINT_POINT_COVERAGE_THRESHOLD);
      }
    }
    dial.coverage = dial.targetPoints.length === 0 ? 0 : effectivePaint / dial.targetPoints.length;
    if (!dial.locked && dialCountsAsPainted(dial)) {
      dial.locked = true;
      if (paintState.zoomedDialIndex === dialIndex) {
        paintPrompt.textContent = `Numeral ${dial.label} is complete and sealed.`;
      }
    }
  }
  updateActiveDialIndex();
}

function updateAutoSubmit(dt) {
  if (!paintState.active || paintState.mode !== "watch" || paintState.tutorial) {
    paintState.autoSubmitTimer = -1;
    return;
  }

  if (!allDialsReady()) {
    paintState.autoSubmitTimer = -1;
    return;
  }

  if (paintState.zoomedDialIndex !== -1) {
    exitDialZoom("The finished watch settles under the lamp for a brief inspection.");
    paintState.autoSubmitTimer = 1;
    return;
  }

  if (paintState.autoSubmitTimer < 0) {
    paintState.autoSubmitTimer = 1;
    paintPrompt.textContent = "The finished watch settles under the lamp for a brief inspection.";
    return;
  }

  paintState.autoSubmitTimer -= dt;
  if (paintState.autoSubmitTimer <= 0) {
    paintState.autoSubmitTimer = -1;
    sendCurrentWatch();
  }
}
