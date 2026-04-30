function frame(now) {
  currentFrameNumber += 1;
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

mixResetButton.addEventListener("click", () => {
  resetMix();
  paintPrompt.textContent = "You empty the dish and start the mixture again from nothing.";
  updatePaintStats();
  drawWatchMinigame();
});

paintCanvas.addEventListener("mousemove", (event) => {
  const position = pointerInsidePaintCanvas(event);
  if (paintState.mode === "groceries" || paintState.mode === "hemming") {
    paintState.pointerX = position.x;
    paintState.pointerY = position.y;
    paintState.cursorX = position.x;
    paintState.cursorY = position.y;
    return;
  }

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

  if (paintState.mode === "groceries") {
    const finish = groceryFinishRect();
    if (position.x >= finish.x && position.x <= finish.x + finish.w && position.y >= finish.y && position.y <= finish.y + finish.h) {
      finishGroceriesTrip();
      return;
    }

    const rowHit = groceryItemAt(position.x, position.y);
    if (rowHit) {
      const controls = groceryControlsRect(rowHit.index);
      if (pointInsideRect(position.x, position.y, controls.minus)) {
        removeGrocery(rowHit.item);
      } else {
        buyGrocery(rowHit.item);
      }
      drawWatchMinigame();
    }
    return;
  }

  if (paintState.mode === "hemming") {
    const finish = hemmingFinishRect();
    if (position.x >= finish.x && position.x <= finish.x + finish.w && position.y >= finish.y && position.y <= finish.y + finish.h) {
      finishHemmingTrip();
      return;
    }
    applyHemStitch(position.x, position.y);
    drawWatchMinigame();
    return;
  }

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

  if (paintState.zoomedDialIndex !== -1 && pointInsideRect(position.x, position.y, zoomWipeBounds())) {
    wipeNearestDial();
    drawWatchMinigame();
    return;
  }

  if (paintState.zoomedDialIndex === -1 && pointInsideRect(position.x, position.y, brushPropBounds())) {
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
      if (dial.locked) {
        paintPrompt.textContent = `Numeral ${dial.label} is already complete and sealed.`;
        drawWatchMinigame();
        return;
      }
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

  if (paintState.tool !== "brush") {
    paintPrompt.textContent = "Pick up the brush on the bench before you try to paint the numeral.";
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

  if (event.code === "Escape" && paintState.active && (paintState.mode === "groceries" || paintState.mode === "hemming")) {
    if (paintState.mode === "hemming") {
      finishHemmingTrip();
    } else {
      finishGroceriesTrip();
    }
    return;
  }

  if (event.code === "Escape" && paintState.active && paintState.mode !== "fracture") {
    if (paintState.zoomedDialIndex !== -1) {
      exitDialZoom();
    } else if (paintState.tutorial) {
      closeTutorialMinigame();
    } else {
      closeMinigame();
      setMessage("You stand back up from the bench.", "The line keeps moving while the next watch waits under the lamp.");
    }
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", (event) => {
  if (paintState.active || !dialogOverlay.classList.contains("hidden")) return;
  const rect = canvas.getBoundingClientRect();
  roomState.cursorX = ((event.clientX - rect.left) / rect.width) * WIDTH;
  roomState.cursorY = ((event.clientY - rect.top) / rect.height) * HEIGHT;

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
