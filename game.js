const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const subhint = document.getElementById("subhint");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const HALF_HEIGHT = HEIGHT / 2;
const FOV = Math.PI / 3;
const MAX_DEPTH = 22;
const MOVE_SPEED = 2.35;
const STRAFE_SPEED = 2.1;
const TURN_SPEED = 0.0026;
const LOOK_SPEED = 0.18;
const MAX_PITCH = HALF_HEIGHT * 0.72;

const keys = new Set();
let lastTime = performance.now();
let activeMessageTimer = 0;

const player = {
  x: 7.5,
  y: 7.5,
  angle: -Math.PI / 2,
  pitch: 0,
};

const state = {
  leverOn: false,
  valveOpen: false,
  consolePowered: false,
  crateInspected: false,
};

const cells = [
  "###############",
  "#......M......#",
  "#...B.....C.M.#",
  "#.............#",
  "#..###...###..#",
  "#M.#......M..V#",
  "#..#..=...=...#",
  "#..#..=...=...#",
  "#..#..=...=...#",
  "#..#......M..L#",
  "#..###...###..#",
  "#.............#",
  "#...S.....M...#",
  "#.............#",
  "###############",
];

const mapHeight = cells.length;
const mapWidth = cells[0].length;

const spritePalettes = {
  L: {
    ".": null,
    a: [71, 54, 40],
    b: [120, 91, 58],
    c: [198, 147, 70],
    d: [235, 205, 135],
  },
  V: {
    ".": null,
    a: [84, 70, 57],
    b: [131, 102, 76],
    c: [168, 82, 42],
    d: [226, 182, 131],
  },
  C: {
    ".": null,
    a: [37, 42, 47],
    b: [71, 79, 85],
    c: [110, 127, 138],
    d: [123, 188, 101],
    e: [227, 214, 182],
  },
  B: {
    ".": null,
    a: [60, 37, 22],
    b: [98, 60, 31],
    c: [141, 91, 49],
    d: [186, 143, 91],
  },
  S: {
    ".": null,
    a: [71, 56, 44],
    b: [110, 87, 63],
    c: [208, 194, 159],
    d: [242, 232, 214],
  },
  M: {
    ".": null,
    a: [38, 34, 32],
    b: [70, 63, 55],
    c: [109, 94, 76],
    d: [156, 126, 89],
    e: [212, 183, 134],
  },
};

const spritePatterns = {
  L: [
    "......aa........",
    "......aa........",
    "......aa........",
    "......aa........",
    "......aa........",
    "......aa..cc....",
    "......aa.cccc...",
    "......aaacccc...",
    "......aaaaaa....",
    ".....abbbbb.....",
    ".....abbbbb.....",
    ".....abbbbb.....",
    ".....abbbbb.....",
    "......bbbb......",
    "......bbbb......",
    "................",
  ],
  V: [
    "................",
    ".....bbbbbb.....",
    "....bbccccbb....",
    "...bbccddccbb...",
    "..bbccddddccbb..",
    "..bbccddddccbb..",
    "...bbccddccbb...",
    ".....bbbbbb.....",
    "......aaaa......",
    "......aaaa......",
    ".....aabbaa.....",
    "....aabbbbaa....",
    "....aabbbbaa....",
    ".....abbbba.....",
    "......abba......",
    "................",
  ],
  C: [
    "................",
    "...aaaaaaaaaa...",
    "..abbbbbbbbbba..",
    "..abccccccccba..",
    "..abceddddccba..",
    "..abceddddccba..",
    "..abccccccccba..",
    "..abbbbbbbbbba..",
    "...aaabbbbaaa...",
    ".....abbba......",
    ".....abbba......",
    "....abbbbba.....",
    "....abbbbba.....",
    "...abbbbbbba....",
    "...aa....aa.....",
    "................",
  ],
  B: [
    "................",
    "..aaaaaaaaaaaa..",
    "..abbbbbbbbbba..",
    "..abccccccccba..",
    "..abccccccccba..",
    "..abbbbdbbbbba..",
    "..abccccccccba..",
    "..abccccccccba..",
    "..abbbbdbbbbba..",
    "..abccccccccba..",
    "..abccccccccba..",
    "..abbbbdbbbbba..",
    "..abccccccccba..",
    "..abbbbbbbbbba..",
    "..aaaaaaaaaaaa..",
    "................",
  ],
  S: [
    ".......aa.......",
    "......abba......",
    "......acca......",
    "......acca......",
    "......acca......",
    "......acca......",
    "......adda......",
    "......adda......",
    "......acca......",
    "......acca......",
    "......acca......",
    "......acca......",
    "......acca......",
    "......abba......",
    ".......aa.......",
    "................",
  ],
  M: [
    "................",
    ".....aaaaaa.....",
    "...aabbbbccaa...",
    "..aabbbbbbccaa..",
    "..aabcccbbbbaa..",
    "..aabcccbbbbaa..",
    "..aabbbbbbccaa..",
    "...aabbbbccaa...",
    ".....aaaaaa.....",
    "....aa....aa....",
    "...aab....baa...",
    "..aabb....bbaa..",
    "..aabb....bbaa..",
    ".aaabb....bbbaa.",
    ".aa...........a.",
    "................",
  ],
};

const interactables = {
  L: {
    name: "main breaker lever",
    prompt: () => (state.leverOn ? "The breaker hums softly." : "A brass breaker lever waits for power."),
    interact: () => {
      state.leverOn = !state.leverOn;
      if (!state.leverOn) {
        state.consolePowered = false;
      }
      setMessage(
        state.leverOn
          ? "You pull the breaker. Lamps warm up and belts shiver overhead."
          : "You drop the breaker. The room exhales back into silence.",
        "The line still needs pressure and a command signal.",
      );
    },
  },
  V: {
    name: "steam valve",
    prompt: () => (state.valveOpen ? "Steam pressure is routed into the line." : "A wheel valve controls steam pressure."),
    interact: () => {
      state.valveOpen = !state.valveOpen;
      if (!state.valveOpen) {
        state.consolePowered = false;
      }
      setMessage(
        state.valveOpen
          ? "The valve opens with a deep groan. Pipes chatter through the rafters."
          : "You close the valve and the pipework calms.",
        state.leverOn
          ? "The room feels close to waking."
          : "Power still has to be restored before anything can run.",
      );
    },
  },
  C: {
    name: "control console",
    prompt: () =>
      state.consolePowered
        ? "The console shows LINE READY in green."
        : "A riveted console sits dark beside the line.",
    interact: () => {
      if (state.leverOn && state.valveOpen) {
        state.consolePowered = true;
        setMessage(
          "The console clacks alive. Rollers turn, belts blur, and the line begins its slow crawl.",
          "The first room is restored: power, pressure, and motion are synchronized.",
        );
      } else {
        setMessage(
          "The console refuses to start.",
          "It seems to need electrical power and steam pressure first.",
        );
      }
    },
  },
  B: {
    name: "supply crate",
    prompt: () => "A stamped crate sits just off the line.",
    interact: () => {
      state.crateInspected = true;
      setMessage(
        "Inside the crate: a note reading 'Prime the line. Power, then pressure, then command.'",
        "Someone designed this room to be restarted in sequence.",
      );
    },
  },
  S: {
    name: "time card station",
    prompt: () => "A brass-faced time clock marks the start of each shift.",
    interact: () => {
      setMessage(
        "A cracked slogan plate reads: 'Precision Is Duty.'",
        "Punch cards sit neatly stacked, as if the workers only stepped away for a moment.",
      );
    },
  },
};

function cellAt(x, y) {
  if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) {
    return "#";
  }
  return cells[Math.floor(y)][Math.floor(x)];
}

function isSolid(x, y) {
  return cellAt(x, y) === "#";
}

function isHazard(x, y) {
  return cellAt(x, y) === "=";
}

function attemptMove(dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const radius = 0.18;

  const checkX = nextX + Math.sign(dx || 1) * radius;
  const checkY = nextY + Math.sign(dy || 1) * radius;

  if (!isSolid(checkX, player.y) && !isHazard(nextX, player.y)) {
    player.x = nextX;
  }
  if (!isSolid(player.x, checkY) && !isHazard(player.x, nextY)) {
    player.y = nextY;
  }
}

function update(dt) {
  let forward = 0;
  let strafe = 0;

  if (keys.has("KeyW")) forward += 1;
  if (keys.has("KeyS")) forward -= 1;
  if (keys.has("KeyD")) strafe += 1;
  if (keys.has("KeyA")) strafe -= 1;

  if (forward !== 0 && strafe !== 0) {
    forward *= 0.7071;
    strafe *= 0.7071;
  }

  if (forward !== 0) {
    attemptMove(
      Math.cos(player.angle) * forward * MOVE_SPEED * dt,
      Math.sin(player.angle) * forward * MOVE_SPEED * dt,
    );
  }

  if (strafe !== 0) {
    attemptMove(
      Math.cos(player.angle + Math.PI / 2) * strafe * STRAFE_SPEED * dt,
      Math.sin(player.angle + Math.PI / 2) * strafe * STRAFE_SPEED * dt,
    );
  }

  if (activeMessageTimer > 0) {
    activeMessageTimer -= dt;
  }
}

function castRay(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  for (let depth = 0; depth < MAX_DEPTH; depth += 0.02) {
    const x = player.x + cos * depth;
    const y = player.y + sin * depth;
    const cell = cellAt(x, y);

    if (cell === "#") {
      return { depth, cell, hitX: x, hitY: y };
    }
  }

  return { depth: MAX_DEPTH, cell: "#" };
}

function applyShade(color, shade) {
  return `rgb(${Math.floor(color[0] * shade)}, ${Math.floor(color[1] * shade)}, ${Math.floor(color[2] * shade)})`;
}

function sampleWall(hitX, hitY, depth) {
  const tx = hitX - Math.floor(hitX);
  const ty = hitY - Math.floor(hitY);
  const mortar = tx < 0.04 || ty < 0.05;
  const beam = tx > 0.42 && tx < 0.58;
  const rivet = (Math.abs(tx - 0.18) < 0.03 || Math.abs(tx - 0.82) < 0.03) && Math.abs(ty - 0.18) < 0.03;

  let color = [108, 78, 54];
  if (mortar) color = [71, 54, 42];
  else if (beam) color = [88, 91, 88];
  else if (rivet) color = [183, 146, 94];
  else if ((Math.floor(tx * 8) + Math.floor(ty * 6)) % 2 === 0) color = [128, 94, 67];

  const shade = Math.max(0.22, 1 - depth / 12);
  return applyShade(color, shade);
}

function sampleFloor(worldX, worldY, distance) {
  const cell = cellAt(worldX, worldY);
  const fx = worldX - Math.floor(worldX);
  const fy = worldY - Math.floor(worldY);

  let color = [66, 53, 43];

  if (cell === "=") {
    const roller = Math.abs(fx - 0.5) > 0.38 || Math.abs(fy - 0.5) < 0.12;
    const belt = fy > 0.32 && fy < 0.68;
    if (roller) color = [136, 121, 96];
    else if (belt) color = state.consolePowered ? [118, 85, 51] : [84, 64, 47];
    else color = [82, 74, 62];
  } else {
    const grout = fx < 0.03 || fy < 0.03;
    const oil = Math.hypot(fx - 0.65, fy - 0.4) < 0.14;
    const lineShadow = (Math.floor(worldX) === 5 || Math.floor(worldX) === 10) && fy > 0.2 && fy < 0.8;

    if (grout) color = [46, 39, 34];
    else if (oil) color = [29, 24, 22];
    else if (lineShadow) color = [89, 70, 50];
    else if ((Math.floor(worldX * 2) + Math.floor(worldY * 2)) % 2 === 0) color = [74, 60, 48];
  }

  const shade = Math.max(0.16, 1 - distance / 13);
  return applyShade(color, shade);
}

function sampleCeiling(worldX, worldY, distance) {
  const fx = worldX - Math.floor(worldX);
  const fy = worldY - Math.floor(worldY);
  const beam = fx < 0.08 || fy < 0.08;
  const shaft = fy > 0.44 && fy < 0.56;
  const pulley = Math.hypot(fx - 0.5, fy - 0.5) < 0.12;

  let color = [88, 72, 53];
  if (beam) color = [52, 41, 31];
  else if (shaft) color = [65, 57, 47];
  if (pulley) color = [125, 103, 76];

  const shade = Math.max(0.15, 1 - distance / 14);
  return applyShade(color, shade);
}

function drawEnvironment() {
  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const planeScale = Math.tan(FOV / 2);
  const planeX = -dirY * planeScale;
  const planeY = dirX * planeScale;
  const posZ = HALF_HEIGHT;
  const horizon = HALF_HEIGHT + player.pitch;
  const floorStart = Math.max(0, Math.floor(horizon) + 1);

  ctx.fillStyle = "#20160f";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let y = floorStart; y < HEIGHT; y += 1) {
    const p = y - horizon;
    if (p <= 0.001) continue;
    const rowDistance = posZ / p;

    const leftRayX = dirX - planeX;
    const leftRayY = dirY - planeY;
    const rightRayX = dirX + planeX;
    const rightRayY = dirY + planeY;

    const stepX = (rowDistance * (rightRayX - leftRayX)) / WIDTH;
    const stepY = (rowDistance * (rightRayY - leftRayY)) / WIDTH;

    let floorX = player.x + rowDistance * leftRayX;
    let floorY = player.y + rowDistance * leftRayY;
    const ceilingY = HEIGHT - y - 1;

    for (let x = 0; x < WIDTH; x += 1) {
      ctx.fillStyle = sampleFloor(floorX, floorY, rowDistance);
      ctx.fillRect(x, y, 1, 1);

      ctx.fillStyle = sampleCeiling(floorX, floorY, rowDistance);
      ctx.fillRect(x, ceilingY, 1, 1);

      floorX += stepX;
      floorY += stepY;
    }
  }

  ctx.fillStyle = "rgba(216, 163, 97, 0.12)";
  ctx.fillRect(0, 0, WIDTH, Math.max(0, horizon));
}

function drawWalls() {
  const zBuffer = new Array(WIDTH);
  const horizon = HALF_HEIGHT + player.pitch;

  for (let x = 0; x < WIDTH; x += 1) {
    const cameraX = (x / WIDTH) * 2 - 1;
    const rayAngle = player.angle + cameraX * (FOV / 2);
    const ray = castRay(rayAngle);
    const correctedDepth = ray.depth * Math.cos(rayAngle - player.angle);
    const wallHeight = Math.min(HEIGHT, (HEIGHT / Math.max(correctedDepth, 0.0001)) * 0.95);
    const wallTop = horizon - wallHeight / 2;

    zBuffer[x] = correctedDepth;
    ctx.fillStyle = sampleWall(ray.hitX || 0, ray.hitY || 0, correctedDepth);
    ctx.fillRect(x, wallTop, 1, wallHeight);

    if (wallHeight < HEIGHT) {
      ctx.fillStyle = "rgba(239, 215, 166, 0.1)";
      ctx.fillRect(x, wallTop, 1, 2);
    }
  }

  return zBuffer;
}

function worldToCamera(wx, wy) {
  const dx = wx - player.x;
  const dy = wy - player.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) - player.angle;
  const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  return { distance, angle: normalized };
}

function getSprites() {
  const sprites = [];

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const cell = cells[y][x];
      if (!spritePatterns[cell]) continue;
      sprites.push({ cell, x: x + 0.5, y: y + 0.5 });
    }
  }

  return sprites;
}

function sampleSpritePixel(cell, u, v, distance) {
  const pattern = spritePatterns[cell];
  const palette = spritePalettes[cell];

  const px = Math.max(0, Math.min(15, Math.floor(u * 16)));
  const py = Math.max(0, Math.min(15, Math.floor(v * 16)));
  const symbol = pattern[py][px];
  const base = palette[symbol];

  if (!base) return null;

  const shade = Math.max(0.25, 1 - distance / 10);
  return applyShade(base, shade);
}

function drawSprites(zBuffer) {
  const sprites = getSprites();
  const horizon = HALF_HEIGHT + player.pitch;

  sprites.sort((a, b) => {
    const da = Math.hypot(a.x - player.x, a.y - player.y);
    const db = Math.hypot(b.x - player.x, b.y - player.y);
    return db - da;
  });

  for (const sprite of sprites) {
    const cam = worldToCamera(sprite.x, sprite.y);
    if (Math.abs(cam.angle) > FOV * 0.7 || cam.distance < 0.25) continue;

    const screenX = (0.5 + cam.angle / FOV) * WIDTH;
    const size = Math.min(HEIGHT, HEIGHT / cam.distance);
    const top = horizon - size / 2;
    const bottom = top + size;
    const left = screenX - size / 2;

    const start = Math.max(0, Math.floor(left));
    const end = Math.min(WIDTH - 1, Math.floor(left + size));

    for (let stripe = start; stripe <= end; stripe += 1) {
      if (cam.distance >= zBuffer[stripe]) continue;

      const u = (stripe - left) / size;
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(HEIGHT, Math.floor(bottom)); y += 1) {
        const v = (y - top) / size;
        const color = sampleSpritePixel(sprite.cell, u, v, cam.distance);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(stripe, y, 1, 1);
      }
    }
  }
}

function drawAmbientEffects() {
  ctx.fillStyle = "rgba(28, 18, 10, 0.15)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (state.leverOn) {
    ctx.fillStyle = "rgba(255, 191, 97, 0.06)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (state.consolePowered) {
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = `rgba(245, 220, 170, ${0.02 + i * 0.015})`;
      ctx.fillRect(16 + i * 72, 0, 14, HALF_HEIGHT);
    }
  }
}

function drawScene() {
  drawEnvironment();
  const zBuffer = drawWalls();
  drawSprites(zBuffer);
  drawAmbientEffects();
}

function getTargetedInteractable() {
  let best = null;

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const cell = cells[y][x];
      if (!interactables[cell]) continue;

      const wx = x + 0.5;
      const wy = y + 0.5;
      const dx = wx - player.x;
      const dy = wy - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 2.6) continue;

      const angleTo = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(angleTo - player.angle), Math.cos(angleTo - player.angle));
      if (Math.abs(delta) > 0.12) continue;

      const ray = castRay(angleTo);
      if (ray.depth + 0.05 < distance) continue;

      if (!best || distance < best.distance) {
        best = { key: cell, distance };
      }
    }
  }

  return best;
}

function setMessage(primary, secondary = "") {
  hint.textContent = primary;
  subhint.textContent = secondary;
  activeMessageTimer = 4;
}

function refreshHint() {
  const target = getTargetedInteractable();

  if (target) {
    hint.textContent = `Click to interact with the ${interactables[target.key].name}.`;
    subhint.textContent = interactables[target.key].prompt();
    return;
  }

  if (state.consolePowered) {
    hint.textContent = "The production line is running again.";
    subhint.textContent = "The room now reads like a living machine shop instead of a dead shell.";
    return;
  }

  hint.textContent = "Explore the factory floor.";
  subhint.textContent = state.crateInspected
    ? "The startup order was power, pressure, then command."
    : "The room is full of old belt-driven machines and a silent line waiting to be restarted.";
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  drawScene();
  if (activeMessageTimer <= 0) {
    refreshHint();
  }
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    setMessage(
      "You step into the middle of the factory line.",
      "Conveyor rollers frame a narrow walking path between belt-driven machines and soot-dark rafters.",
    );
    return;
  }

  const target = getTargetedInteractable();
  if (target) {
    interactables[target.key].interact();
  }
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  player.angle += event.movementX * TURN_SPEED;
  player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch + event.movementY * LOOK_SPEED));
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    setMessage(
      "Factory controls engaged.",
      "Use WASD to walk the line, mouse to look around, and click when machinery is centered in view.",
    );
  } else {
    setMessage(
      "Pointer released.",
      "Click back into the scene to continue exploring.",
    );
  }
});

requestAnimationFrame(frame);
