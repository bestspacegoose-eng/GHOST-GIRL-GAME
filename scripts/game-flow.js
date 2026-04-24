function endShift(reason) {
  if (!gameState.shiftActive) return;

  gameState.shiftActive = false;
  gameState.shiftEnded = true;
  gameState.lastShiftThoughtLog = [...gameState.shiftThoughtLog];
  closeMinigame();

  if (gameState.hiddenStats.health <= 0) {
    const ending = finalEndingForHealth();
    showEnding(ending.title, ending.body);
    updateHud();
    return;
  }

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

  dialogTitle.textContent = `Shift manager - ${DAY_NAMES[gameState.currentDay]}`;
  dialogBody.textContent =
    `${reason === "timeout" ? "The bell cuts off the shift." : "The manager calls the day."} ` +
    `${managerLineForDay()} ${endOfDayReflection()} ${darkRoomGathering()}`;
  gameState.postShiftActivity = Math.random() < 0.5 ? "groceries" : "hemming";
  dialogButton.textContent = gameState.postShiftActivity === "groceries" ? "Buy groceries" : "Go hem clothes";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "post-shift-report";
  updateHud();
}

function groceryRowRect(index) {
  return {
    x: GROCERY_LAYOUT.panel.x + 16,
    y: GROCERY_LAYOUT.rowStartY + index * (GROCERY_LAYOUT.rowHeight + GROCERY_LAYOUT.rowGap),
    w: GROCERY_LAYOUT.panel.w - 32,
    h: GROCERY_LAYOUT.rowHeight,
  };
}

function groceryFinishRect() {
  return { ...GROCERY_LAYOUT.finish };
}

function groceryControlsRect(index) {
  const rect = groceryRowRect(index);
  return {
    minus: { x: rect.x + rect.w - 66, y: rect.y + 9, w: 20, h: rect.h - 18 },
    plus: { x: rect.x + rect.w - 22, y: rect.y + 9, w: 20, h: rect.h - 18 },
    countX: rect.x + rect.w - 34,
    priceX: rect.x + rect.w - 78,
  };
}

function groceryItemAt(x, y) {
  for (let i = 0; i < GROCERY_ITEMS.length; i += 1) {
    const rect = groceryRowRect(i);
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return { item: GROCERY_ITEMS[i], index: i };
    }
  }
  return null;
}

function groceryItemsPurchasedCount() {
  return Object.values(gameState.groceryCart).reduce((sum, count) => sum + count, 0);
}

function groceryCartSummary() {
  const parts = GROCERY_ITEMS
    .filter((item) => (gameState.groceryCart[item.id] || 0) > 0)
    .map((item) => `${gameState.groceryCart[item.id]} ${item.label.toLowerCase()}`);
  return parts.length > 0 ? parts.join(", ") : "nothing but the money still in your pocket";
}

function groceryCount(id) {
  return gameState.groceryCart[id] || 0;
}

function groceryPurchasedAny(ids) {
  return ids.some((id) => groceryCount(id) > 0);
}

function groceryReflectionText() {
  const health = gameState.hiddenStats.health;
  const lastThoughts = gameState.lastShiftThoughtLog.slice(-2);
  const remembered = lastThoughts.length === 0
    ? ""
    : lastThoughts.length === 1
      ? `The thought from the bench keeps circling back: "${lastThoughts[0]}"`
      : `The thoughts from the bench keep tangling together: "${lastThoughts[0]}" and "${lastThoughts[1]}"`;

  let condition;
  if (health >= 80) {
    condition = "The market is bright and busy, and for a moment you can almost pretend the shift stayed behind at the factory.";
  } else if (health >= 50) {
    condition = "Even with the bustle of the grocer around you, the ache in your jaw and the weakness in your hands follow you down the aisles.";
  } else {
    condition = "The walk through the grocer feels longer than it should. Every shelf seems a little too far away, and your body feels spent before you have even begun choosing what to bring home.";
  }

  return remembered ? `${condition} ${remembered}` : condition;
}

function updateGroceryStats() {
  paintStats.textContent =
    `Remaining ${formatTenthsCents(gameState.groceryFundsTenths)}. ` +
    `Bought ${groceryItemsPurchasedCount()} item${groceryItemsPurchasedCount() === 1 ? "" : "s"}. ` +
    `Basket: ${groceryCartSummary()}.`;
}

function groceryHomeSceneText() {
  const health = gameState.hiddenStats.health;
  const purchases = groceryItemsPurchasedCount();
  const broughtHome = groceryCartSummary();
  const hasMeat = groceryPurchasedAny(["steak", "bacon"]);
  const hasSugar = groceryCount("sugar") > 0;
  const stapleCount =
    groceryCount("milk") +
    groceryCount("butter") +
    groceryCount("eggs") +
    groceryCount("flour") +
    groceryCount("potatoes");

  let opening;
  if (health >= 80) {
    opening = "Home is all lamplight and close walls after the factory.";
  } else if (health >= 50) {
    opening = "By the time you reach home, your body feels heavier than the grocery sack in your hand.";
  } else {
    opening = "You arrive home worn thin, carrying the groceries like something much heavier than they are.";
  }

  let arrival;
  if (purchases === 0) {
    arrival = "When you set your hands on the table, there is almost nothing to show for the day besides the ache you carried back with you.";
  } else {
    arrival = `You bring home ${broughtHome}.`;
  }

  let parents;
  if (hasMeat) {
    parents = "Your parents notice the meat first. Their relief is immediate and impossible to miss, the first real easing in their faces all evening.";
  } else if (stapleCount > 0) {
    parents = "Your parents glance over the plain groceries and answer with practical thanks, subdued and careful, already measuring how far such staples can stretch.";
  } else {
    parents = "Your parents try not to let their disappointment settle too visibly on the table, but the room still dims around what you could not bring home.";
  }

  let siblings;
  if (hasSugar) {
    siblings = "The younger children brighten at the sight of sugar at once, crowding close with the kind of happiness that makes the room feel younger for a minute.";
  } else if (stapleCount > 0 || hasMeat) {
    siblings = "The younger ones peer into the sack, then take in the plainness of it with a muted little nod before drifting back toward their places.";
  } else {
    siblings = "The younger ones watch your expression more than the sack, as if that will tell them whether to ask for anything at all.";
  }

  return `${opening} ${arrival} ${parents} ${siblings}`;
}

function openGroceriesTrip() {
  paintState.active = true;
  paintState.mode = "groceries";
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.pointerX = paintCanvas.width / 2;
  paintState.pointerY = paintCanvas.height / 2;
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  paintState.lastPointerMoveAt = performance.now();
  gameState.groceryBudgetTenths = Math.max(0, Math.round(gameState.dayEarningsCents * 10));
  gameState.groceryFundsTenths = gameState.groceryBudgetTenths;
  gameState.groceryCart = Object.fromEntries(GROCERY_ITEMS.map((item) => [item.id, 0]));
  minigameHeading.textContent = "Groceries";
  paintPrompt.textContent = groceryReflectionText();
  mixPrompt.textContent =
    `Today's tally gives you ${formatTenthsCents(gameState.groceryBudgetTenths)} to spend. ` +
    "Use + to add to the basket and - to put an item back before you finish shopping.";
  updateGroceryStats();
  setStationControlsHidden(true);
  minigameOverlay.classList.remove("hidden");
  drawWatchMinigame();
}

function buyGrocery(item) {
  if (!item) return;
  if (gameState.groceryFundsTenths < item.priceTenths) {
    paintPrompt.textContent = `${item.label} costs ${formatTenthsCents(item.priceTenths)}, more than you have left from today's pay.`;
    updateGroceryStats();
    return;
  }

  gameState.groceryFundsTenths -= item.priceTenths;
  gameState.groceryCart[item.id] = (gameState.groceryCart[item.id] || 0) + 1;
  paintPrompt.textContent = `You add ${item.label.toLowerCase()} to the basket and recalculate what else the family can manage tonight.`;
  updateGroceryStats();
}

function removeGrocery(item) {
  if (!item || groceryCount(item.id) <= 0) {
    paintPrompt.textContent = "There is nothing of that item in the basket to put back.";
    updateGroceryStats();
    return;
  }

  gameState.groceryCart[item.id] -= 1;
  gameState.groceryFundsTenths += item.priceTenths;
  paintPrompt.textContent = `You put ${item.label.toLowerCase()} back and count the money in your hand again.`;
  updateGroceryStats();
}

function hemmingRowRect(index) {
  return {
    x: HEMMING_LAYOUT.panel.x + 18,
    y: HEMMING_LAYOUT.rowStartY + index * (HEMMING_LAYOUT.rowHeight + HEMMING_LAYOUT.rowGap),
    w: HEMMING_LAYOUT.panel.w - 36,
    h: HEMMING_LAYOUT.rowHeight,
  };
}

function hemmingFinishRect() {
  return { ...HEMMING_LAYOUT.finish };
}

function createHemmingTasks() {
  return HEMMING_FAMILY_ITEMS.map((label, index) => {
    const base = 6 + Math.min(3, gameState.currentDay);
    const healthPush = gameState.hiddenStats.health < 50 ? 2 : gameState.hiddenStats.health < 75 ? 1 : 0;
    return {
      id: `hem-${index}`,
      label,
      stitchesNeeded: base + healthPush + Math.floor(Math.random() * 3),
      stitchesDone: 0,
      ratings: [],
    };
  });
}

function emptyHemmingGradeCounts() {
  return { bad: 0, okay: 0, good: 0, perfect: 0 };
}

function hemmingGradeWeight(grade) {
  if (grade === "perfect") return 4;
  if (grade === "good") return 3;
  if (grade === "okay") return 2;
  return 1;
}

function taskHemmingGradeCounts(task) {
  const counts = emptyHemmingGradeCounts();
  if (!task || !task.ratings) return counts;
  for (const grade of task.ratings) {
    if (counts[grade] !== undefined) counts[grade] += 1;
  }
  return counts;
}

function taskHemmingQuality(task) {
  if (!task || !task.ratings || task.ratings.length === 0) return "bad";
  const total = task.ratings.reduce((sum, grade) => sum + hemmingGradeWeight(grade), 0);
  const average = total / task.ratings.length;
  if (average >= 3.55) return "perfect";
  if (average >= 2.75) return "good";
  if (average >= 1.95) return "okay";
  return "bad";
}

function taskHemmingQualityLabel(task) {
  if (!task || !task.ratings || task.ratings.length === 0) return "Unrated";
  const quality = taskHemmingQuality(task);
  if (quality === "perfect") return "Perfect";
  if (quality === "good") return "Good";
  if (quality === "okay") return "Okay";
  return "Bad";
}

function hemmingOverallGradeCounts() {
  const counts = emptyHemmingGradeCounts();
  for (const task of gameState.hemmingTasks) {
    if (!task.ratings) continue;
    for (const grade of task.ratings) {
      if (counts[grade] !== undefined) counts[grade] += 1;
    }
  }
  return counts;
}

function currentHemmingTimingState(now = performance.now()) {
  const timing = paintState.hemmingTiming;
  if (!timing || !timing.active) return null;
  const elapsed = Math.max(0, now - timing.startedAt);
  const phase = (elapsed % timing.periodMs) / timing.periodMs;
  return {
    ...timing,
    phase,
    angle: phase * Math.PI * 2 - Math.PI / 2,
    targetAngle: timing.target * Math.PI * 2 - Math.PI / 2,
  };
}

function timingGradeFromDiff(diff) {
  if (diff <= HEMMING_TIMING_WINDOWS.perfect) return "perfect";
  if (diff <= HEMMING_TIMING_WINDOWS.good) return "good";
  if (diff <= HEMMING_TIMING_WINDOWS.okay) return "okay";
  return "bad";
}

function startHemmingTiming(taskIndex) {
  const task = gameState.hemmingTasks[taskIndex];
  if (!task || task.stitchesDone >= task.stitchesNeeded) return false;
  paintState.hemmingTiming = {
    active: true,
    taskIndex,
    stitchIndex: task.stitchesDone,
    startedAt: performance.now(),
    periodMs: 1200 - Math.min(280, gameState.currentDay * 38),
    target: 0.66 + Math.random() * 0.24,
  };
  paintPrompt.textContent = `Thread ready for ${task.label}. Click again when the timing ring lines up.`;
  return true;
}

function resolveHemmingTiming() {
  const timing = currentHemmingTimingState();
  if (!timing) return false;
  const task = gameState.hemmingTasks[timing.taskIndex];
  if (!task || task.stitchesDone >= task.stitchesNeeded) {
    paintState.hemmingTiming.active = false;
    return false;
  }

  const rawDiff = Math.abs(timing.phase - timing.target);
  const wrappedDiff = Math.min(rawDiff, 1 - rawDiff);
  const grade = timingGradeFromDiff(wrappedDiff);
  task.ratings.push(grade);
  task.stitchesDone = Math.min(task.stitchesNeeded, task.stitchesDone + 1);
  paintState.hemmingTiming.active = false;

  const gradeWord = grade === "perfect"
    ? "perfect"
    : grade === "good"
      ? "good"
      : grade === "okay"
        ? "okay"
        : "bad";
  if (task.stitchesDone >= task.stitchesNeeded) {
    paintPrompt.textContent = `${task.label} finished with ${taskHemmingQualityLabel(task).toLowerCase()} stitching.`;
  } else {
    paintPrompt.textContent = `${gradeWord.toUpperCase()} timing. Continue along ${task.label}.`;
  }

  updateHemmingStats();
  if (hemmingAllFinished()) {
    mixPrompt.textContent = "Every hem is stitched. Finish chores when you're ready to head to bed.";
  }
  return true;
}

function hemmingTotalStitchesNeeded() {
  return gameState.hemmingTasks.reduce((sum, task) => sum + task.stitchesNeeded, 0);
}

function hemmingTotalStitchesDone() {
  return gameState.hemmingTasks.reduce((sum, task) => sum + task.stitchesDone, 0);
}

function hemmingCompletedCount() {
  return gameState.hemmingTasks.filter((task) => task.stitchesDone >= task.stitchesNeeded).length;
}

function hemmingAllFinished() {
  return gameState.hemmingTasks.length > 0 && gameState.hemmingTasks.every((task) => task.stitchesDone >= task.stitchesNeeded);
}

function hemmingSummary() {
  const completed = hemmingCompletedCount();
  const counts = hemmingOverallGradeCounts();
  const stitched = counts.bad + counts.okay + counts.good + counts.perfect;
  if (completed <= 0) return "no finished hems tonight";
  if (completed >= gameState.hemmingTasks.length) {
    return `every hem finished (${counts.perfect} perfect, ${counts.good} good, ${counts.okay} okay, ${counts.bad} bad)`;
  }
  return `${completed} hem${completed === 1 ? "" : "s"} finished with ${stitched} timed stitches`;
}

function hemmingReflectionText() {
  const health = gameState.hiddenStats.health;
  const lastThought = gameState.lastShiftThoughtLog[gameState.lastShiftThoughtLog.length - 1];
  let opening;
  if (health >= 80) {
    opening = "The house is quieter than the workshop. Needle, thread, and lamp-light ask for steady work of a different kind.";
  } else if (health >= 50) {
    opening = "Your hands are tired from the bench, but the family mending still waits on the table tonight.";
  } else {
    opening = "Even lifting the fabric feels heavy now, but the loose hems cannot wait another day.";
  }
  return lastThought ? `${opening} "${lastThought}" keeps echoing while you sew.` : opening;
}

function updateHemmingStats() {
  const counts = hemmingOverallGradeCounts();
  paintStats.textContent =
    `Hemmed ${hemmingCompletedCount()}/${gameState.hemmingTasks.length} garments. ` +
    `Stitches ${hemmingTotalStitchesDone()}/${hemmingTotalStitchesNeeded()}. ` +
    `Perfect ${counts.perfect} Good ${counts.good} Okay ${counts.okay} Bad ${counts.bad}.`;
}

function openHemmingTrip() {
  paintState.active = true;
  paintState.mode = "hemming";
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.pointerX = paintCanvas.width / 2;
  paintState.pointerY = paintCanvas.height / 2;
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  paintState.lastPointerMoveAt = performance.now();
  paintState.hemmingTiming.active = false;
  paintState.hemmingTiming.taskIndex = -1;
  paintState.hemmingTiming.stitchIndex = -1;
  gameState.hemmingTasks = createHemmingTasks();
  minigameHeading.textContent = "Evening Hemming";
  paintPrompt.textContent = hemmingReflectionText();
  mixPrompt.textContent = "Click a stitch dot to start timing, then click again for bad/okay/good/perfect stitch quality.";
  updateHemmingStats();
  setStationControlsHidden(true);
  minigameOverlay.classList.remove("hidden");
  drawWatchMinigame();
}

function stitchPointForTask(taskIndex, stitchIndex) {
  const rect = hemmingRowRect(taskIndex);
  const lineStart = rect.x + 190;
  const lineEnd = rect.x + rect.w - 24;
  const count = Math.max(1, gameState.hemmingTasks[taskIndex].stitchesNeeded);
  const x = lineStart + ((lineEnd - lineStart) * (stitchIndex + 0.5)) / count;
  const y = rect.y + rect.h - 19;
  return { x, y };
}

function applyHemStitch(x, y) {
  if (paintState.hemmingTiming.active) {
    resolveHemmingTiming();
    return;
  }

  let best = null;
  for (let i = 0; i < gameState.hemmingTasks.length; i += 1) {
    const task = gameState.hemmingTasks[i];
    if (task.stitchesDone >= task.stitchesNeeded) continue;
    const spot = stitchPointForTask(i, task.stitchesDone);
    const distance = Math.hypot(spot.x - x, spot.y - y);
    if (!best || distance < best.distance) {
      best = { task, taskIndex: i, distance };
    }
  }

  if (!best || best.distance > 24) {
    paintPrompt.textContent = "Click the next stitch dot to begin timing that stitch.";
    return;
  }
  startHemmingTiming(best.taskIndex);
}

function hemmingHomeSceneText() {
  const completed = hemmingCompletedCount();
  const total = gameState.hemmingTasks.length;
  const health = gameState.hiddenStats.health;

  let opening;
  if (health >= 80) {
    opening = "You carry the folded clothes into the next room while the house settles for the night.";
  } else if (health >= 50) {
    opening = "Your fingers ache by the time you set down the needle, but the pile of mending has thinned.";
  } else {
    opening = "You finish as much mending as you can with trembling hands and a jaw that will not stop throbbing.";
  }

  const perHem = gameState.hemmingTasks
    .map((task) => {
      if (task.stitchesDone < task.stitchesNeeded) {
        return `${task.label} is still unfinished at the hem.`;
      }
      const quality = taskHemmingQuality(task);
      if (quality === "perfect") {
        return `${task.label} has tiny, even stitches that look nearly professional.`;
      }
      if (quality === "good") {
        return `${task.label} holds together with solid, clean stitching.`;
      }
      if (quality === "okay") {
        return `${task.label} is wearable, though the seam wanders in places.`;
      }
      return `${task.label} is stitched, but the line is rough and visibly rushed.`;
    })
    .join(" ");

  const counts = hemmingOverallGradeCounts();
  let family;
  if (completed >= total && counts.perfect + counts.good >= counts.okay + counts.bad) {
    family = "Your siblings brighten at the repaired clothes, and your parents thank you with real relief in their voices.";
  } else if (completed > 0) {
    family = "The family quietly sorts what you managed tonight, grateful but still worried about the pieces that need better repair.";
  } else {
    family = "There is little to show beyond effort tonight, and everyone speaks softly while planning around worn edges.";
  }

  return `${opening} ${perHem} ${family}`;
}

function showHomeScene(bodyText, summaryText) {
  resetDialogButtons();
  dialogTitle.textContent = "At Home";
  dialogBody.textContent = bodyText;
  dialogButton.textContent = "Continue";
  dialogOverlay.classList.remove("hidden");
  gameState.postHomeSummary = summaryText;
  gameState.dialogMode = "post-home";
}

function showHomeSceneAfterShopping() {
  showHomeScene(groceryHomeSceneText(), groceryCartSummary());
}

function finishGroceriesTrip() {
  closeMinigame();
  showHomeSceneAfterShopping();
  updateHud();
}

function finishHemmingTrip() {
  if (paintState.hemmingTiming.active) {
    paintPrompt.textContent = "Finish the current timing stitch first.";
    drawWatchMinigame();
    return;
  }
  if (!hemmingAllFinished()) {
    paintPrompt.textContent = "There are still loose hems. Finish each garment's stitch line before heading to bed.";
    drawWatchMinigame();
    return;
  }
  closeMinigame();
  showHomeScene(hemmingHomeSceneText(), hemmingSummary());
  updateHud();
}

function continueAfterDialog() {
  dialogOverlay.classList.add("hidden");
  resetDialogButtons();

  if (gameState.dialogMode === "post-shift-report") {
    if (gameState.postShiftActivity === "hemming") {
      openHemmingTrip();
    } else {
      openGroceriesTrip();
    }
  } else if (gameState.dialogMode === "post-home") {
    if (gameState.currentDay < 6 && gameState.hiddenStats.health < 60 && !gameState.warnedLowHealth) {
      gameState.warnedLowHealth = true;
      showLowHealthWarning();
      setMessage(
        "The walk home leaves you hollowed out.",
        `Inside, the family gathers around ${gameState.postHomeSummary}.`,
      );
      updateHud();
      return;
    }
    advanceToNextDay(`Home settles around ${gameState.postHomeSummary}. Clock in again when the title card fades away.`);
  } else if (gameState.dialogMode === "low-health-warning") {
    gameState.fracturePending = true;
    advanceToNextDay("Something is wrong now, even away from the bench.");
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
  gameState.shiftThoughtLog = [];
  gameState.lastShiftThoughtLog = [];
  gameState.groceryBudgetTenths = 0;
  gameState.groceryFundsTenths = 0;
  gameState.groceryCart = {};
  gameState.postShiftActivity = "groceries";
  gameState.postHomeSummary = "";
  gameState.hemmingTasks = [];
  paintState.active = false;
  paintState.watchNumeralStyle = NUMERAL_STYLE_KEYS[0];
  paintState.hemmingTiming.active = false;
  paintState.hemmingTiming.taskIndex = -1;
  paintState.hemmingTiming.stitchIndex = -1;
  showTitleCard();
  setMessage(
    "A new week begins at the line.",
    "Click into the room, then use the wall clock to begin Monday.",
  );
  updateHud();
}

function chooseRandomNumeralStyle() {
  const index = Math.floor(Math.random() * NUMERAL_STYLE_KEYS.length);
  return NUMERAL_STYLE_KEYS[index] || NUMERAL_STYLE_KEYS[0];
}

function rowSortComponents(components) {
  const sorted = [...components].sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
  const rows = [];
  for (const component of sorted) {
    const last = rows[rows.length - 1];
    if (!last || component.minY > last.maxY + 48) {
      rows.push({ maxY: component.maxY, items: [component] });
      continue;
    }
    last.maxY = Math.max(last.maxY, component.maxY);
    last.items.push(component);
  }

  return rows
    .flatMap((row) => row.items.sort((a, b) => a.minX - b.minX))
    .slice(0, NUMERAL_SHEET_DIGITS.length);
}

function extractNumeralTemplates(styleKey) {
  if (numeralTemplateCache[styleKey]) return numeralTemplateCache[styleKey];
  const image = assetImages[styleKey];
  if (!imageReady(image)) return null;

  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const offCtx = offscreen.getContext("2d");
  offCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
  const { data } = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const width = offscreen.width;
  const height = offscreen.height;

  const visited = new Uint8Array(width * height);
  const components = [];
  const queue = [];
  const isInk = (x, y) => {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3];
    if (alpha < 25) return false;
    const luminance = (0.2126 * data[index]) + (0.7152 * data[index + 1]) + (0.0722 * data[index + 2]);
    return luminance < 122;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = y * width + x;
      if (visited[seed] || !isInk(x, y)) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      queue.length = 0;
      queue.push(seed);
      visited[seed] = 1;

      while (queue.length > 0) {
        const current = queue.pop();
        const cx = current % width;
        const cy = Math.floor(current / width);
        area += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (visited[next] || !isInk(nx, ny)) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (area >= 1200) {
        components.push({ minX, maxX, minY, maxY, area });
      }
    }
  }

  const ordered = rowSortComponents(components);
  if (ordered.length < NUMERAL_SHEET_DIGITS.length) return null;

  const templates = {};
  for (let i = 0; i < NUMERAL_SHEET_DIGITS.length; i += 1) {
    const component = ordered[i];
    const label = NUMERAL_SHEET_DIGITS[i];
    const points = [];
    const glyphW = component.maxX - component.minX + 1;
    const glyphH = component.maxY - component.minY + 1;
    const stride = Math.max(3, Math.round(Math.min(glyphW, glyphH) / 24));

    for (let py = component.minY; py <= component.maxY; py += stride) {
      for (let px = component.minX; px <= component.maxX; px += stride) {
        if (!isInk(px, py)) continue;
        points.push({ x: px, y: py });
      }
    }

    const centerX = (component.minX + component.maxX) / 2;
    const centerY = (component.minY + component.maxY) / 2;
    const denom = Math.max(glyphW, glyphH) || 1;
    templates[label] = {
      points: points.map((point) => ({
        x: (point.x - centerX) / denom,
        y: (point.y - centerY) / denom,
      })),
      guideMode: "cloud",
    };
  }

  numeralTemplateCache[styleKey] = templates;
  return templates;
}
