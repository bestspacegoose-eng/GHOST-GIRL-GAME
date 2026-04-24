function sendCurrentWatch() {
  if (paintState.tutorial) {
    paintPrompt.textContent = "This is only the practice bench. Leave the tutorial and clock in when you are ready for the real shift.";
    return;
  }
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

function drawMixDish(centerX, centerY, hovered = false) {
  const total = paintState.mix[0] + paintState.mix[1] + paintState.mix[2];
  const dish = STATION_LAYOUT.dish;
  if (total > 0 && imageReady(assetImages.mixedPaint)) {
    const drawn = drawAssetContained(assetImages.mixedPaint, centerX, centerY, dish.w, dish.h, 0.98);
    if (drawn) {
      paintCtx.save();
      paintCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, (1 - paintState.mixQuality) * 0.62) + (hovered ? 0 : 0.18)})`;
      paintCtx.beginPath();
      paintCtx.ellipse(centerX, centerY, dish.rx, dish.ry, 0, 0, Math.PI * 2);
      paintCtx.fill();
      paintCtx.restore();
    }
  } else {
    if (!hovered) {
      paintCtx.fillStyle = "rgba(0, 0, 0, 0.38)";
      paintCtx.beginPath();
      paintCtx.ellipse(centerX, centerY, dish.rx, dish.ry, 0, 0, Math.PI * 2);
      paintCtx.fill();
    }
    paintCtx.strokeStyle = "rgba(255,255,255,0.16)";
    paintCtx.lineWidth = 2;
    paintCtx.beginPath();
    paintCtx.ellipse(centerX, centerY, dish.rx, dish.ry, 0, 0, Math.PI * 2);
    paintCtx.stroke();
  }
}

function fanBrush(messageBase) {
  paintState.brushSize = Math.min(MAX_BRUSH_SIZE, paintState.brushSize + 0.17);
  if (paintState.brushSize >= BRUSH_FANNED_THRESHOLD) {
    paintPrompt.textContent = `${messageBase} The brush has fully fanned out.`;
  } else if (paintState.brushSize >= BRUSH_ROUGH_THRESHOLD) {
    paintPrompt.textContent = `${messageBase} The brush is beginning to fan.`;
  } else {
    paintPrompt.textContent = messageBase;
  }
}

function dullBrushOnUse() {
  paintState.brushSize = Math.min(MAX_BRUSH_SIZE, paintState.brushSize + 0.009);
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

function drawAssetContainedMasked(image, x, y, boxWidth, boxHeight, hovered, alpha = 1) {
  const drawn = drawAssetContained(image, x, y, boxWidth, boxHeight, alpha);
  if (!drawn || hovered) return drawn;
  paintCtx.save();
  paintCtx.fillStyle = "rgba(0, 0, 0, 0.38)";
  paintCtx.fillRect(drawn.x, drawn.y, drawn.w, drawn.h);
  paintCtx.restore();
  return drawn;
}

function drawWorkbenchBrush(hovered) {
  const image = assetImages.workbenchBrush;
  const bounds = brushPropBounds();
  if (!imageReady(image)) {
    if (!hovered) {
      paintCtx.save();
      paintCtx.fillStyle = "rgba(0, 0, 0, 0.42)";
      paintCtx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      paintCtx.restore();
    }
    return bounds;
  }

  const sx = image.naturalWidth * 0.405;
  const sy = image.naturalHeight * 0.035;
  const sw = image.naturalWidth * 0.19;
  const sh = image.naturalHeight * 0.93;
  paintCtx.save();
  paintCtx.globalAlpha = 0.98;
  paintCtx.drawImage(image, sx, sy, sw, sh, bounds.x, bounds.y, bounds.w, bounds.h);
  if (!hovered) {
    paintCtx.fillStyle = "rgba(0, 0, 0, 0.4)";
    paintCtx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }
  paintCtx.restore();
  return bounds;
}

function drawZoomWipeHand(hovered, enabled) {
  const image = assetImages.directWipeHand;
  const bounds = zoomWipeBounds();
  if (!imageReady(image)) {
    paintCtx.save();
    paintCtx.fillStyle = enabled
      ? (hovered ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)")
      : "rgba(80,80,80,0.2)";
    paintCtx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    paintCtx.restore();
    return bounds;
  }

  const drawn = drawAssetContained(image, STATION_LAYOUT.zoomWipe.x, STATION_LAYOUT.zoomWipe.y, STATION_LAYOUT.zoomWipe.w, STATION_LAYOUT.zoomWipe.h, enabled ? 0.98 : 0.5);
  if (!drawn) return bounds;
  if (!hovered) {
    paintCtx.save();
    paintCtx.fillStyle = enabled ? "rgba(0, 0, 0, 0.26)" : "rgba(0, 0, 0, 0.48)";
    paintCtx.fillRect(drawn.x, drawn.y, drawn.w, drawn.h);
    paintCtx.restore();
  }
  return drawn;
}

function drawAssetCover(image, x, y, boxWidth, boxHeight, alpha = 1) {
  if (!imageReady(image)) return null;
  const scale = Math.max(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  paintCtx.save();
  paintCtx.globalAlpha = alpha;
  paintCtx.drawImage(image, x + (boxWidth - width) / 2, y + (boxHeight - height) / 2, width, height);
  paintCtx.restore();
  return { x: x + (boxWidth - width) / 2, y: y + (boxHeight - height) / 2, w: width, h: height };
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

function drawGroceriesView() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;

  paintCtx.clearRect(0, 0, w, h);
  if (!drawAssetCover(assetImages.groceries, 0, 0, w, h, 1)) {
    paintCtx.fillStyle = "#1c1c1c";
    paintCtx.fillRect(0, 0, w, h);
  }

  paintCtx.fillStyle = "rgba(0, 0, 0, 0.56)";
  paintCtx.fillRect(0, 0, w, h);

  paintCtx.fillStyle = "rgba(8, 8, 8, 0.82)";
  paintCtx.fillRect(GROCERY_LAYOUT.panel.x, GROCERY_LAYOUT.panel.y, GROCERY_LAYOUT.panel.w, GROCERY_LAYOUT.panel.h);
  paintCtx.strokeStyle = "rgba(255,255,255,0.18)";
  paintCtx.lineWidth = 2;
  paintCtx.strokeRect(GROCERY_LAYOUT.panel.x, GROCERY_LAYOUT.panel.y, GROCERY_LAYOUT.panel.w, GROCERY_LAYOUT.panel.h);

  paintCtx.textAlign = "left";
  paintCtx.textBaseline = "middle";
  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.font = "24px Georgia";
  paintCtx.fillText("GROCER", GROCERY_LAYOUT.panel.x + 16, 76);

  paintCtx.font = "14px Georgia";
  for (let i = 0; i < GROCERY_ITEMS.length; i += 1) {
    const item = GROCERY_ITEMS[i];
    const rect = groceryRowRect(i);
    const controls = groceryControlsRect(i);
    const affordable = gameState.groceryFundsTenths >= item.priceTenths;
    const count = gameState.groceryCart[item.id] || 0;

    paintCtx.fillStyle = affordable ? "rgba(255,255,255,0.08)" : "rgba(120,80,80,0.18)";
    paintCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    paintCtx.strokeStyle = affordable ? "rgba(255,255,255,0.18)" : "rgba(180,110,110,0.28)";
    paintCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    paintCtx.fillStyle = "#f5f5f5";
    paintCtx.fillText(`${item.label} (${item.unit})`, rect.x + 12, rect.y + rect.h / 2);
    paintCtx.textAlign = "right";
    paintCtx.fillStyle = affordable ? "#d9f57a" : "#f0a0a0";
    paintCtx.fillText(formatTenthsCents(item.priceTenths), controls.priceX, rect.y + rect.h / 2);
    paintCtx.textAlign = "center";
    paintCtx.fillStyle = count > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.44)";
    paintCtx.fillText(`${count}`, controls.countX, rect.y + rect.h / 2);

    for (const [symbol, box, enabled] of [
      ["-", controls.minus, count > 0],
      ["+", controls.plus, affordable],
    ]) {
      paintCtx.fillStyle = enabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)";
      paintCtx.fillRect(box.x, box.y, box.w, box.h);
      paintCtx.strokeStyle = enabled ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
      paintCtx.strokeRect(box.x, box.y, box.w, box.h);
      paintCtx.fillStyle = enabled ? "#f5f5f5" : "rgba(255,255,255,0.34)";
      paintCtx.fillText(symbol, box.x + box.w / 2, box.y + box.h / 2 + 1);
    }

    paintCtx.textAlign = "left";
  }

  const finish = groceryFinishRect();
  paintCtx.fillStyle = "rgba(217, 245, 122, 0.16)";
  paintCtx.fillRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.strokeStyle = "rgba(217, 245, 122, 0.7)";
  paintCtx.strokeRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.textAlign = "center";
  paintCtx.fillStyle = "#f5f5f5";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText("Finish shopping", finish.x + finish.w / 2, finish.y + finish.h / 2);

  paintCtx.textAlign = "left";
  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText(`Remaining: ${formatTenthsCents(gameState.groceryFundsTenths)}`, 36, 74);
  paintCtx.font = "14px Georgia";
  paintCtx.fillText(`Basket: ${groceryCartSummary()}`, 36, 102);

  drawImageCursor("mix");
}

function drawHemmingTimingCircle(timing) {
  const cx = 96;
  const cy = paintCanvas.height - 88;
  const radius = 52;

  paintCtx.save();
  paintCtx.fillStyle = "rgba(0, 0, 0, 0.74)";
  paintCtx.beginPath();
  paintCtx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
  paintCtx.fill();

  paintCtx.strokeStyle = "rgba(255,255,255,0.26)";
  paintCtx.lineWidth = 7;
  paintCtx.beginPath();
  paintCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  paintCtx.stroke();

  const targetAngle = timing.targetAngle;
  const targetWindows = [
    { key: "okay", color: "rgba(211, 169, 118, 0.52)", width: HEMMING_TIMING_WINDOWS.okay },
    { key: "good", color: "rgba(202, 226, 150, 0.68)", width: HEMMING_TIMING_WINDOWS.good },
    { key: "perfect", color: "rgba(245, 255, 186, 0.96)", width: HEMMING_TIMING_WINDOWS.perfect },
  ];
  for (const zone of targetWindows) {
    const spread = zone.width * Math.PI * 2;
    paintCtx.strokeStyle = zone.color;
    paintCtx.lineWidth = zone.key === "perfect" ? 10 : 7;
    paintCtx.beginPath();
    paintCtx.arc(cx, cy, radius, targetAngle - spread, targetAngle + spread);
    paintCtx.stroke();
  }

  const markerX = cx + Math.cos(timing.angle) * radius;
  const markerY = cy + Math.sin(timing.angle) * radius;
  paintCtx.fillStyle = "rgba(255, 248, 212, 0.98)";
  paintCtx.beginPath();
  paintCtx.arc(markerX, markerY, 6.3, 0, Math.PI * 2);
  paintCtx.fill();

  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.font = "bold 13px Georgia";
  paintCtx.fillText("TIME STITCH", cx, cy - 5);
  paintCtx.font = "12px Georgia";
  paintCtx.fillStyle = "rgba(255,255,255,0.74)";
  paintCtx.fillText("click now", cx, cy + 14);
  paintCtx.restore();
}

function drawHemmingView() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const timing = currentHemmingTimingState();

  paintCtx.clearRect(0, 0, w, h);
  const bg = paintCtx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a1316");
  bg.addColorStop(1, "#09090b");
  paintCtx.fillStyle = bg;
  paintCtx.fillRect(0, 0, w, h);

  paintCtx.fillStyle = "rgba(255, 235, 190, 0.04)";
  for (let y = 0; y < h; y += 26) {
    paintCtx.fillRect(0, y, w, 1);
  }

  paintCtx.fillStyle = "rgba(8, 8, 8, 0.8)";
  paintCtx.fillRect(HEMMING_LAYOUT.panel.x, HEMMING_LAYOUT.panel.y, HEMMING_LAYOUT.panel.w, HEMMING_LAYOUT.panel.h);
  paintCtx.strokeStyle = "rgba(255,255,255,0.18)";
  paintCtx.lineWidth = 2;
  paintCtx.strokeRect(HEMMING_LAYOUT.panel.x, HEMMING_LAYOUT.panel.y, HEMMING_LAYOUT.panel.w, HEMMING_LAYOUT.panel.h);

  paintCtx.textAlign = "left";
  paintCtx.textBaseline = "middle";
  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.font = "24px Georgia";
  paintCtx.fillText("HEMMING TABLE", HEMMING_LAYOUT.panel.x + 18, 88);

  paintCtx.font = "14px Georgia";
  gameState.hemmingTasks.forEach((task, index) => {
    const rect = hemmingRowRect(index);
    paintCtx.fillStyle = "rgba(255,255,255,0.07)";
    paintCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    paintCtx.strokeStyle = "rgba(255,255,255,0.16)";
    paintCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    paintCtx.fillStyle = "#f5f5f5";
    paintCtx.fillText(task.label, rect.x + 12, rect.y + 22);

    paintCtx.textAlign = "right";
    paintCtx.fillStyle = "rgba(255,255,255,0.76)";
    paintCtx.fillText(`${task.stitchesDone}/${task.stitchesNeeded}`, rect.x + rect.w - 12, rect.y + 22);
    paintCtx.fillStyle = "rgba(255,255,255,0.55)";
    paintCtx.font = "12px Georgia";
    paintCtx.fillText(taskHemmingQualityLabel(task), rect.x + rect.w - 12, rect.y + rect.h - 48);
    paintCtx.font = "14px Georgia";
    paintCtx.textAlign = "left";

    const lineY = rect.y + rect.h - 19;
    const lineStart = rect.x + 190;
    const lineEnd = rect.x + rect.w - 24;
    paintCtx.strokeStyle = "rgba(205, 184, 156, 0.42)";
    paintCtx.lineWidth = 2;
    paintCtx.beginPath();
    paintCtx.moveTo(lineStart, lineY);
    paintCtx.lineTo(lineEnd, lineY);
    paintCtx.stroke();

    for (let stitch = 0; stitch < task.stitchesNeeded; stitch += 1) {
      const spot = stitchPointForTask(index, stitch);
      const done = stitch < task.stitchesDone;
      const pendingTimed = timing
        && timing.active
        && timing.taskIndex === index
        && timing.stitchIndex === stitch;
      paintCtx.beginPath();
      paintCtx.arc(spot.x, spot.y, done ? 4.4 : (pendingTimed ? 5.2 : 3.3), 0, Math.PI * 2);
      paintCtx.fillStyle = done
        ? "rgba(255, 224, 140, 0.94)"
        : pendingTimed
          ? "rgba(249, 244, 186, 0.95)"
          : "rgba(208, 208, 208, 0.28)";
      paintCtx.fill();
      if (!done) {
        paintCtx.strokeStyle = pendingTimed ? "rgba(255, 245, 194, 0.88)" : "rgba(255,255,255,0.22)";
        paintCtx.lineWidth = pendingTimed ? 2.1 : 1.2;
        paintCtx.stroke();
      }
    }
  });

  const finish = hemmingFinishRect();
  paintCtx.fillStyle = hemmingAllFinished() ? "rgba(217, 245, 122, 0.2)" : "rgba(255,255,255,0.12)";
  paintCtx.fillRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.strokeStyle = hemmingAllFinished() ? "rgba(217, 245, 122, 0.78)" : "rgba(255,255,255,0.38)";
  paintCtx.strokeRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.textAlign = "center";
  paintCtx.fillStyle = "#f5f5f5";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText("Finish hemming", finish.x + finish.w / 2, finish.y + finish.h / 2);

  if (timing && timing.active) {
    drawHemmingTimingCircle(timing);
  }

  drawImageCursor("hemming");
}

function drawWatchMinigame() {
  if (paintState.mode === "fracture") {
    drawFracturePuzzle();
    return;
  }

  if (paintState.mode === "groceries") {
    drawGroceriesView();
    return;
  }

  if (paintState.mode === "hemming") {
    drawHemmingView();
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
  const hoveredStationTarget = stationHoverTargetAt(paintState.pointerX, paintState.pointerY);

  paintCtx.clearRect(0, 0, w, h);
  paintCtx.fillStyle = "#000";
  paintCtx.fillRect(0, 0, w, h);

  paintCtx.save();
  paintCtx.imageSmoothingEnabled = true;
  drawAssetContainedMasked(
    assetImages.yellowPowder,
    STATION_LAYOUT.powder.x,
    STATION_LAYOUT.powder.y,
    STATION_LAYOUT.powder.w,
    STATION_LAYOUT.powder.h,
    hoveredStationTarget?.label === "Powder",
    paintState.mix[0] > 0 ? 0.98 : 0.58,
  );
  drawAssetContainedMasked(
    assetImages.gumArabic,
    STATION_LAYOUT.gum.x,
    STATION_LAYOUT.gum.y,
    STATION_LAYOUT.gum.w,
    STATION_LAYOUT.gum.h,
    hoveredStationTarget?.label === "Tar",
    paintState.mix[1] > 0 ? 0.98 : 0.58,
  );
  drawAssetContainedMasked(
    assetImages.waterPlate,
    STATION_LAYOUT.water.x,
    STATION_LAYOUT.water.y,
    STATION_LAYOUT.water.w,
    STATION_LAYOUT.water.h,
    hoveredStationTarget?.label === "Water",
    paintState.mix[2] > 0 ? 0.98 : 0.58,
  );
  drawWorkbenchBrush(hoveredStationTarget?.type === "brush");
  const drewWatchFace = drawAssetCentered(currentWatchFaceImage(), centerX, centerY, WATCH_DRAW_WIDTH, WATCH_DRAW_HEIGHT, 1);
  paintCtx.restore();
  drawMixDish(STATION_LAYOUT.dish.x, STATION_LAYOUT.dish.y, hoveredStationTarget?.label === "Paint dish");
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

  if (hoveredStationTarget) {
    drawHoverLabel(paintCtx, hoveredStationTarget.centerX, hoveredStationTarget.topY, hoveredStationTarget.label);
  }

  drawTutorialPanel();
  drawImageCursor(stationMode);
}

function drawZoomedDialView() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const dial = activeDial();
  if (!dial) return;
  const hoveredStationTarget = stationHoverTargetAt(paintState.pointerX, paintState.pointerY);

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
    drawAssetContainedMasked(
      assetImages.mixedPaint,
      STATION_LAYOUT.zoomPaint.x,
      STATION_LAYOUT.zoomPaint.y,
      STATION_LAYOUT.zoomPaint.w,
      STATION_LAYOUT.zoomPaint.h,
      hoveredStationTarget?.label === "Paint dish",
      1,
    );
  }
  paintCtx.fillStyle = "rgba(255,255,255,0.56)";
  paintCtx.font = "13px Georgia";
  paintCtx.fillText("Dip brush", STATION_LAYOUT.zoomPaint.x, 170);

  const wipeEnabled = dialNeedsCorrection(dial);
  drawZoomWipeHand(hoveredStationTarget?.type === "wipe-direct", wipeEnabled);
  paintCtx.fillStyle = wipeEnabled ? "rgba(255,255,255,0.56)" : "rgba(255,255,255,0.28)";
  paintCtx.fillText("Wipe directly", STATION_LAYOUT.zoomWipe.x, STATION_LAYOUT.zoomWipe.y + STATION_LAYOUT.zoomWipe.h / 2 + 14);

  if (dial.guideMode === "cloud") {
    paintCtx.fillStyle = "rgba(185, 185, 185, 0.34)";
    for (const point of points) {
      paintCtx.beginPath();
      paintCtx.arc(point.x, point.y, 4.1, 0, Math.PI * 2);
      paintCtx.fill();
    }
  } else {
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

  if (hoveredStationTarget) {
    drawHoverLabel(paintCtx, hoveredStationTarget.centerX, hoveredStationTarget.topY, hoveredStationTarget.label);
  }

  drawTutorialPanel();
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

function drawTutorialPanel() {
  if (!paintState.tutorial) return;
  const step = tutorialStepData();
  if (!step) return;
  const frame = tutorialBoxFrame();
  const textFrame = {
    x: frame.x + 16,
    y: frame.y + 34,
    w: frame.w - 32,
    h: frame.h - 48,
  };
  const fitted = fitThoughtText(step.body, textFrame);

  paintCtx.save();
  paintCtx.fillStyle = "rgba(0, 0, 0, 0.9)";
  paintCtx.fillRect(frame.x, frame.y, frame.w, frame.h);
  paintCtx.strokeStyle = "rgba(255,255,255,0.18)";
  paintCtx.lineWidth = 2;
  paintCtx.strokeRect(frame.x, frame.y, frame.w, frame.h);

  paintCtx.fillStyle = "rgba(255,255,255,0.82)";
  paintCtx.font = "bold 14px Georgia";
  paintCtx.textAlign = "left";
  paintCtx.textBaseline = "middle";
  paintCtx.fillText(step.title, frame.x + 16, frame.y + 16);

  paintCtx.fillStyle = "#f5f5f5";
  paintCtx.font = `${fitted.fontSize}px Georgia`;
  const startY = textFrame.y + textFrame.h / 2 - ((fitted.lines.length - 1) * fitted.lineHeight) / 2;
  fitted.lines.forEach((line, index) => {
    paintCtx.fillText(line, textFrame.x, startY + index * fitted.lineHeight);
  });
  paintCtx.restore();
}

let cachedHemmingCursorImage = null;

function drawableImageReady(image) {
  if (!image) return false;
  if (typeof image.naturalWidth === "number") {
    return image.naturalWidth > 0;
  }
  return Boolean(image.width && image.height);
}

function preparedHemmingCursorImage() {
  if (cachedHemmingCursorImage) return cachedHemmingCursorImage;
  const source = assetImages.cursorHemming;
  if (!imageReady(source)) return null;

  const offscreen = document.createElement("canvas");
  offscreen.width = source.naturalWidth;
  offscreen.height = source.naturalHeight;
  const offCtx = offscreen.getContext("2d");
  offCtx.drawImage(source, 0, 0);

  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;
  const sampleA = (10 * offscreen.width + 10) * 4;
  const sampleB = (10 * offscreen.width + 60) * 4;
  const bgA = [data[sampleA], data[sampleA + 1], data[sampleA + 2]];
  const bgB = [data[sampleB], data[sampleB + 1], data[sampleB + 2]];

  const distanceTo = (r, g, b, bg) =>
    Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const distA = distanceTo(r, g, b, bgA);
    const distB = distanceTo(r, g, b, bgB);
    if (distA < 46 || distB < 46) {
      data[i + 3] = 0;
    }
  }

  offCtx.putImageData(imageData, 0, 0);
  cachedHemmingCursorImage = offscreen;
  return cachedHemmingCursorImage;
}

function drawImageCursor(mode) {
  let image;
  let useHemmingCursor = false;
  if (mode === "mix") {
    image = assetImages.cursorMix;
  } else if (mode === "hemming") {
    image = preparedHemmingCursorImage() || assetImages.cursorHemming;
    useHemmingCursor = true;
  } else if (mode === "brush") {
    image =
      paintState.brushSize >= BRUSH_FANNED_THRESHOLD
        ? assetImages.fannedBrush
        : paintState.brushSize >= BRUSH_ROUGH_THRESHOLD
          ? assetImages.roughBrush
          : assetImages.cursorBrush;
  } else {
    image = assetImages.cursorNail;
  }

  if (!drawableImageReady(image)) {
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
    let width = 66 + paintState.brushSize * 14;
    let height = width * (543 / 544);
    let tipX = 84 * (width / 544);
    let tipY = 503 * (height / 543);

    if (image === assetImages.roughBrush) {
      const roughProgress = Math.max(0, Math.min(1, (paintState.brushSize - BRUSH_ROUGH_THRESHOLD) / (BRUSH_FANNED_THRESHOLD - BRUSH_ROUGH_THRESHOLD)));
      width = 68 + roughProgress * 4;
      height = width * (917 / 544);
      tipX = 72 * (width / 544);
      tipY = 865 * (height / 917);
    } else if (image === assetImages.fannedBrush) {
      const fannedProgress = Math.max(0, Math.min(1, (paintState.brushSize - BRUSH_FANNED_THRESHOLD) / (MAX_BRUSH_SIZE - BRUSH_FANNED_THRESHOLD || 1)));
      width = 70 + fannedProgress * 4;
      height = width * (907 / 540);
      tipX = 86 * (width / 540);
      tipY = 874 * (height / 907);
    }

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

  if (useHemmingCursor) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sx = sourceWidth * 0.42;
    const sy = sourceHeight * 0.11;
    const sw = sourceWidth * 0.35;
    const sh = sourceHeight * 0.89;
    const width = 74;
    const height = width * (sh / sw);
    const tipX = width * 0.92;
    const tipY = height * 0.045;
    paintCtx.drawImage(image, sx, sy, sw, sh, paintState.cursorX - tipX, paintState.cursorY - tipY, width, height);
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
