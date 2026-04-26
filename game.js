// Main runtime, rendering, input, saving, and game loop.
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

function buildDefaultWorkerTalkTopics() {
  return {
    work: 0,
    wry: 0,
    personal: 0,
    home: 0,
  };
}

function buildDefaultWorkerProgress() {
  const progress = {};
  for (const id of Object.keys(WORKER_PROFILES)) {
    progress[id] = {
      talks: 0,
      familiarity: "stranger",
      nameKnown: false,
      lastDaySpoken: -1,
      lastDayShiftTalk: -1,
      lastDayAfterShiftTalk: -1,
      lastShiftTopic: "",
      lastAfterShiftTopic: "",
      lastAdviceTopic: "",
      talkTopics: buildDefaultWorkerTalkTopics(),
    };
  }
  return progress;
}

function buildDefaultButtonHintState() {
  return {
    restHand: false,
  };
}

function ensureWorkerProgressState() {
  if (!gameState.workerProgress || typeof gameState.workerProgress !== "object") {
    gameState.workerProgress = buildDefaultWorkerProgress();
    return gameState.workerProgress;
  }
  for (const [id, defaultState] of Object.entries(buildDefaultWorkerProgress())) {
    if (!gameState.workerProgress[id]) {
      gameState.workerProgress[id] = { ...defaultState };
      continue;
    }
    for (const [key, value] of Object.entries(defaultState)) {
      if (gameState.workerProgress[id][key] === undefined) {
        gameState.workerProgress[id][key] = value && typeof value === "object" ? clonePlain(value) : value;
      }
    }
    const talkTopics = gameState.workerProgress[id].talkTopics;
    if (!talkTopics || typeof talkTopics !== "object") {
      gameState.workerProgress[id].talkTopics = buildDefaultWorkerTalkTopics();
    } else {
      const topicDefaults = buildDefaultWorkerTalkTopics();
      for (const topicKey of Object.keys(topicDefaults)) {
        talkTopics[topicKey] = Math.max(0, Number(talkTopics[topicKey] ?? 0));
      }
    }
    if (Number(gameState.workerProgress[id].talks || 0) <= 0) {
      gameState.workerProgress[id].nameKnown = false;
    }
  }
  return gameState.workerProgress;
}

function ensureButtonHintState() {
  if (!gameState.buttonHintState || typeof gameState.buttonHintState !== "object") {
    gameState.buttonHintState = buildDefaultButtonHintState();
    return gameState.buttonHintState;
  }

  const defaults = buildDefaultButtonHintState();
  for (const key of Object.keys(defaults)) {
    gameState.buttonHintState[key] = Boolean(gameState.buttonHintState[key]);
  }
  return gameState.buttonHintState;
}

function workerProgressFor(id) {
  const state = ensureWorkerProgressState();
  if (!state[id]) {
    state[id] = {
      talks: 0,
      familiarity: "stranger",
      nameKnown: false,
      lastDaySpoken: -1,
      lastDayShiftTalk: -1,
      lastDayAfterShiftTalk: -1,
      lastShiftTopic: "",
      lastAfterShiftTopic: "",
      lastAdviceTopic: "",
      talkTopics: buildDefaultWorkerTalkTopics(),
    };
  }
  return state[id];
}

function workerFamiliarityFromTalks(talks) {
  if (talks >= 2) return "familiar";
  if (talks >= 1) return "acquainted";
  return "stranger";
}

function workerNameRevealDay(id) {
  return WORKER_NAME_REVEAL_DAY[id] ?? 6;
}

function workerName(id) {
  return WORKER_NAMES[id] || "Unknown worker";
}

function workerDisplayName(id) {
  const progress = workerProgressFor(id);
  return progress.nameKnown ? workerName(id) : "???";
}

function lowercaseLeading(text) {
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workerNameVisibleInConversation(id) {
  if (
    workerConversationState
    && workerConversationState.workerId === id
    && workerConversationState.relationship
  ) {
    return workerConversationState.relationship.hadKnownName || Boolean(workerConversationState.relationship.revealText);
  }
  return workerProgressFor(id).nameKnown;
}

function concealUnknownWorkerName(text, id) {
  if (!text || workerNameVisibleInConversation(id)) return text;
  const name = workerName(id);
  const escaped = escapeRegExp(name);
  return text
    .replace(new RegExp(`\\b${escaped}'s\\b`, "g"), "her")
    .replace(new RegExp(`(^|[.!?]\\s+|[\"“]\\s*)${escaped}\\b`, "g"), (match, prefix) => `${prefix}She`)
    .replace(new RegExp(`\\b${escaped}\\b`, "g"), "she");
}

function workerAlreadyTalkedThisDay(id, context = "shift") {
  const progress = workerProgressFor(id);
  if (context === "afterShift") {
    return progress.lastDayAfterShiftTalk === gameState.currentDay;
  }
  return progress.lastDayShiftTalk === gameState.currentDay;
}

function workerRepeatPromptText(id) {
  const progress = workerProgressFor(id);
  return progress.familiarity === "familiar"
    ? "She has already given you today's little pocket of conversation."
    : "She has already spent today's spare words.";
}

function workerRepeatMessage(id) {
  const progress = workerProgressFor(id);
  const label = progress.nameKnown ? workerDisplayName(id) : "She";
  return {
    primary: progress.nameKnown ? `${label} has nothing else to spare just now.` : "She has nothing else to spare just now.",
    secondary: progress.familiarity === "familiar"
      ? "You've already had today's one bench-side conversation."
      : "You only get one real exchange with each worker during the day.",
  };
}

function workerConversationCoda(id, context) {
  const appearance = workerAppearanceText(id);
  if (!appearance) return "";
  const frames = context === "afterShift" ? AFTER_SHIFT_CONVERSATION_DAY_FRAMES : SHIFT_CONVERSATION_DAY_FRAMES;
  const frame = frames[Math.min(frames.length - 1, gameState.currentDay)] || frames[frames.length - 1];
  return `${frame} ${lowercaseLeading(appearance)}`;
}

function advanceWorkerProgress(id, context = "shift") {
  const progress = workerProgressFor(id);
  const hadKnownName = progress.nameKnown;
  const firstTalk = progress.talks === 0;
  const revealEligible = !progress.nameKnown && progress.talks > 0 && gameState.currentDay >= workerNameRevealDay(id);
  let revealText = "";
  let withheldText = "";

  if (revealEligible) {
    progress.nameKnown = true;
    revealText = `"I'm ${workerName(id)}," she says.`;
  } else if (firstTalk && !progress.nameKnown) {
    withheldText = "She still keeps her name to herself.";
  }

  const previousFamiliarity = progress.familiarity;
  progress.talks += 1;
  progress.lastDaySpoken = gameState.currentDay;
  if (context === "afterShift") {
    progress.lastDayAfterShiftTalk = gameState.currentDay;
  } else {
    progress.lastDayShiftTalk = gameState.currentDay;
  }
  progress.familiarity = workerFamiliarityFromTalks(progress.talks);

  let familiarityText = "";
  if (progress.familiarity === "acquainted" && previousFamiliarity === "stranger") {
    familiarityText = "She starts to recognize you now.";
  } else if (progress.familiarity === "familiar" && previousFamiliarity !== "familiar") {
    familiarityText = "You have reached familiar standing with her.";
  }

  return {
    progress,
    hadKnownName,
    firstTalk,
    revealText,
    withheldText,
    familiarityText,
  };
}

function familiarWorkersCount() {
  const progress = ensureWorkerProgressState();
  return Object.values(progress).filter((entry) => entry.familiarity === "familiar").length;
}

function canStandWithWorkers() {
  return familiarWorkersCount() >= FAMILIAR_WORKERS_REQUIRED;
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
  const progress = workerProgressFor(id);
  const descriptor = profile.description[dayVariantIndex(id, profile.description.length)];
  const lead = progress.nameKnown
    ? `${workerDisplayName(id)} at the bench.`
    : `A ${descriptor} woman at the bench.`;
  if (workerAlreadyTalkedThisDay(id, "shift")) {
    return `${lead} ${workerRepeatPromptText(id)}`;
  }
  if (progress.familiarity === "familiar") {
    return `${lead} She looks up when you approach. ${workerAppearanceText(id)}`;
  }
  if (progress.familiarity === "acquainted") {
    return `${lead} She recognizes you now. ${workerAppearanceText(id)}`;
  }
  return `${lead} ${workerAppearanceText(id)}`;
}

function workerDialogueLines(id) {
  const profile = WORKER_PROFILES[id];
  if (!profile) return ["Not right now.", ""];
  const dayIndex = Math.min(6, gameState.currentDay);
  return profile.dailyDialogue[dayIndex];
}

function workerConversationNotes(relationship) {
  return [relationship.revealText, relationship.withheldText, relationship.familiarityText]
    .filter(Boolean)
    .join(" ");
}

function workerTopicValues(id) {
  return WORKER_DIALOGUE_TOPICS[id] || {
    bench: "this tray",
    detail: "the worst part of the line",
    joke: "surviving this room",
    tell: "how worn down you look",
    home: "what waits for you at home",
  };
}

function fillWorkerConversationTemplate(template, values) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function workerConversationChoices(id, context) {
  const templateGroup = WORKER_CONVERSATION_TEMPLATES[context] || WORKER_CONVERSATION_TEMPLATES.shift;
  const categories = Object.keys(templateGroup);
  const dayIndex = Math.max(0, Math.min(6, gameState.currentDay));
  const values = workerTopicValues(id);
  return categories.map((category) => ({
    id: category,
    label: fillWorkerConversationTemplate(templateGroup[category][dayIndex], values),
  }));
}

function workerConversationTitle(id, context, relationship = null) {
  const canUseName = relationship
    ? (relationship.hadKnownName || Boolean(relationship.revealText))
    : workerNameVisibleInConversation(id);
  const label = canUseName ? workerName(id) : "???";
  if (context === "afterShift") {
    return `${label} - After The Bell`;
  }
  return `${label} - At The Bench`;
}

function workerConversationPrompt(id, context, relationship) {
  const progress = workerProgressFor(id);
  const label = relationship.hadKnownName || relationship.revealText ? workerName(id) : "One of the women";
  const notes = workerConversationNotes(relationship);
  const openness = relationship.familiarityText.includes("familiar standing")
    ? "She makes a little more room for the conversation than she used to."
    : relationship.familiarityText.includes("recognize")
      ? "There is less distance in the pause this time."
      : progress.familiarity === "familiar"
        ? "She leaves the silence open long enough for you to choose your angle."
        : progress.familiarity === "acquainted"
          ? "She waits a beat to hear what you will say."
          : "It is only a narrow opening, the sort you could lose by saying the wrong thing.";
  const setup = context === "afterShift"
    ? (relationship.firstTalk
      ? `${label} lingers near the benches instead of slipping straight for the door.`
      : `${label} slows beside you once the lamps go low, more open now that the trays are dark.`)
    : (relationship.firstTalk
      ? `${label} finally pauses long enough to look you over.`
      : `${label} glances up from the tray and leaves you just enough room to speak.`);
  return `${setup} ${workerAppearanceText(id)} ${openness}${notes ? ` ${notes}` : ""}`;
}

function workerConversationResponse(id, context, choice) {
  const progress = workerProgressFor(id);
  const choiceId = choice?.id || "";
  const coda = workerConversationCoda(id, context);
  let responseText = "";
  if (context === "afterShift") {
    const profile = WORKER_AFTER_SHIFT_DIALOGUE[id] || {};
    if (profile[choiceId]) {
      responseText = `${profile[choiceId]} ${coda}`.trim();
    } else if (choiceId === "home") {
      responseText = `She looks away for a moment, then admits home is mostly another list of things that still need doing before she can rest. ${coda}`.trim();
    } else if (choiceId === "wry") {
      responseText = `She answers the joke with a tired smile, grateful for a moment that asks something from her besides endurance. ${coda}`.trim();
    } else {
      responseText = `She says the work gets easier to repeat long before it gets easier to live with. ${coda}`.trim();
    }
    return concealUnknownWorkerName(responseText, id);
  }

  if (id === "worker-2" && choiceId === "work" && gameState.currentDay >= 1 && !gameState.handRestUnlocked) {
    gameState.handRestUnlocked = true;
    responseText = `Ruth watches the stiffness in your wrist before speaking. "If your hand starts going uncertain, brace the heel of it on the side of the face," she says, showing you with two fingers against the rim. "It eats the clock, but it keeps the numeral true." You could try that at the bench now. ${coda}`.trim();
    return concealUnknownWorkerName(responseText, id);
  }

  const profile = WORKER_SHIFT_CHOICE_DIALOGUE[id] || {};
  if (choiceId === "work") {
    if (profile.work) {
      responseText = `${profile.work} ${coda}`.trim();
    } else {
      const [primary, secondary] = workerDialogueLines(id);
      responseText = `${[primary, secondary].filter(Boolean).join(" ")} ${coda}`.trim();
    }
    return concealUnknownWorkerName(responseText, id);
  }

  if (profile[choiceId]) {
    responseText = `${profile[choiceId]} ${coda}`.trim();
    return concealUnknownWorkerName(responseText, id);
  }

  if (choiceId === "personal") {
    responseText = (progress.familiarity === "familiar"
      ? "She answers more honestly than she means to, then returns to the tray before the feeling can settle."
      : "She hesitates, gives you the smallest honest answer she can afford, and bends back over the dial.")
      + ` ${coda}`;
    return concealUnknownWorkerName(responseText.trim(), id);
  }
  responseText = `That finally earns a brief smile before the room pulls her attention back to the tray. ${coda}`.trim();
  return concealUnknownWorkerName(responseText, id);
}

function rememberWorkerConversationChoice(workerId, context, choiceId) {
  const progress = workerProgressFor(workerId);
  const topicKey = ["work", "wry", "personal", "home"].includes(choiceId) ? choiceId : "";
  if (!topicKey) return;
  if (!progress.talkTopics || typeof progress.talkTopics !== "object") {
    progress.talkTopics = buildDefaultWorkerTalkTopics();
  }
  progress.talkTopics[topicKey] = Math.max(0, Number(progress.talkTopics[topicKey] || 0)) + 1;
  progress.lastAdviceTopic = topicKey;
  if (context === "afterShift") {
    progress.lastAfterShiftTopic = topicKey;
  } else {
    progress.lastShiftTopic = topicKey;
  }
}

function workerMemoryDisplayName(id) {
  const progress = workerProgressFor(id);
  if (progress.nameKnown) return workerName(id);
  const description = WORKER_PROFILES[id]?.description?.[0] || "other";
  return `the ${description} woman`;
}

function mostDiscussedTopicForWorker(id) {
  const progress = workerProgressFor(id);
  if (progress.lastAdviceTopic) return progress.lastAdviceTopic;
  const talkTopics = progress.talkTopics || buildDefaultWorkerTalkTopics();
  let bestTopic = "";
  let bestCount = -1;
  for (const topicKey of ["work", "wry", "personal", "home"]) {
    const count = Number(talkTopics[topicKey] || 0);
    if (count > bestCount) {
      bestCount = count;
      bestTopic = topicKey;
    }
  }
  return bestCount > 0 ? bestTopic : "";
}

function workerMemoryFlavorLine(id, topicKey) {
  const values = workerTopicValues(id);
  switch (topicKey) {
    case "work":
      return `Her note about ${values.detail} settles your hand before the next stroke.`;
    case "wry":
      return `Even remembering her crack about ${values.joke} keeps your grip from tightening.`;
    case "personal":
      return `The memory of what she said about ${values.tell} keeps you from overworking the brush.`;
    case "home":
      return `Thinking about what she said about ${values.home} makes you pace the face more carefully.`;
    default:
      return "A little of her steadiness comes back to you at the bench.";
  }
}

function workerMemoryMessage(id) {
  return {
    title: `You remember ${workerMemoryDisplayName(id)}'s advice.`,
    body: `${WORKER_MEMORY_BASE_LINES[id] || "Keep the next stroke cleaner than the last."} ${workerMemoryFlavorLine(id, mostDiscussedTopicForWorker(id))} The painting goes a little smoother, and the work takes a little less out of you.`,
  };
}

function familiarityHealthDiscountRate() {
  let reduction = 0;
  for (const progress of Object.values(ensureWorkerProgressState())) {
    if (progress.familiarity === "familiar") {
      reduction += 0.085;
    } else if (progress.familiarity === "acquainted") {
      reduction += 0.04;
    }
  }
  return Math.min(0.42, reduction);
}

function shiftTalkedWorkerIds() {
  return Object.keys(WORKER_PROFILES).filter((id) => workerProgressFor(id).lastDayShiftTalk === gameState.currentDay);
}

function workerShiftSummaryFragment(id) {
  const progress = workerProgressFor(id);
  const values = workerTopicValues(id);
  const topicKey = progress.lastShiftTopic || progress.lastAdviceTopic;
  let summary = "spared you a few bench-side words";
  if (topicKey === "work") {
    summary = `shared a tip about ${values.detail}`;
  } else if (topicKey === "wry") {
    summary = `traded a joke about ${values.joke}`;
  } else if (topicKey === "personal") {
    summary = `opened up about ${values.tell}`;
  } else if (topicKey === "home") {
    summary = `talked about ${values.home}`;
  }
  return `${workerMemoryDisplayName(id)} ${summary} (${progress.familiarity})`;
}

function workersTalkedSummaryText() {
  const talked = shiftTalkedWorkerIds();
  if (talked.length === 0) {
    return "Workers spoken to: no one today.";
  }
  const fragments = talked.map(workerShiftSummaryFragment);
  if (fragments.length <= 3) {
    return `Workers spoken to: ${fragments.join("; ")}.`;
  }
  const shown = fragments.slice(0, 3).join("; ");
  return `Workers spoken to: ${shown}; and ${fragments.length - 3} other${fragments.length - 3 === 1 ? "" : "s"}.`;
}

function configureDialogChoiceButton(button, text, choiceId = "") {
  button.textContent = text;
  button.dataset.choiceId = choiceId;
  button.classList.remove("hidden");
  syncDialogActionButtons();
}

function openWorkerConversation(id, context = "shift") {
  if (workerAlreadyTalkedThisDay(id, context)) {
    if (context === "shift") {
      const repeat = workerRepeatMessage(id);
      setMessage(repeat.primary, repeat.secondary);
    }
    return;
  }

  const relationship = advanceWorkerProgress(id, context);
  workerConversationState = {
    workerId: id,
    context,
    relationship,
    options: workerConversationChoices(id, context),
  };

  const choices = workerConversationState.options;
  resetDialogButtons();
  setDialogContent(
    workerConversationTitle(id, context, relationship),
    workerConversationPrompt(id, context, relationship),
  );
  configureDialogChoiceButton(dialogAltButton, choices[0].label, choices[0].id);
  configureDialogChoiceButton(dialogThirdButton, choices[1].label, choices[1].id);
  configureDialogChoiceButton(dialogButton, choices[2].label, choices[2].id);
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "worker-talk-choice";
}

function resolveWorkerConversationChoice(choiceId) {
  if (!workerConversationState) return;
  const { workerId, context, options = [] } = workerConversationState;
  const choice = options.find((entry) => entry.id === choiceId) || { id: choiceId, label: "" };
  rememberWorkerConversationChoice(workerId, context, choice.id);
  resetDialogButtons();
  setDialogContent(
    workerConversationTitle(workerId, context),
    workerConversationResponse(workerId, context, choice),
  );
  dialogButton.textContent = context === "afterShift" ? "Continue to chores" : "Back to the room";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "worker-talk-result";
}

function afterShiftConversationCandidates() {
  return Object.keys(WORKER_PROFILES)
    .filter((id) => !isWorkerRemoved(id))
    .filter((id) => !workerAlreadyTalkedThisDay(id, "afterShift"))
    .sort((a, b) => {
      const progressA = workerProgressFor(a);
      const progressB = workerProgressFor(b);
      const score = (progress) =>
        progress.talks * 2
        + (progress.familiarity === "familiar" ? 4 : progress.familiarity === "acquainted" ? 2 : 0)
        + (progress.nameKnown ? 1 : 0)
        + (progress.lastDaySpoken === gameState.currentDay ? 1 : 0);
      return score(progressB) - score(progressA) || a.localeCompare(b);
    });
}

function pickAfterShiftConversationWorker() {
  const candidates = afterShiftConversationCandidates();
  if (candidates.length === 0) return null;
  const shortlist = candidates.slice(0, Math.min(4, candidates.length));
  const index = (gameState.currentDay + gameState.totalDialsPainted + familiarWorkersCount()) % shortlist.length;
  return shortlist[index];
}

function openAfterShiftConversation() {
  const workerId = pickAfterShiftConversationWorker();
  if (!workerId) {
    gameState.dialogMode = "post-shift-report";
    continueAfterDialog();
    return;
  }
  openWorkerConversation(workerId, "afterShift");
}

function interactableDisplayName(item) {
  if (!item) return "";
  if (item.kind === "worker") return workerDisplayName(item.id);
  if (item.kind === "bench") return "Workbench";
  if (item.kind === "clock") return "Wall Clock";
  return item.name;
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
      return !gameState.shiftActive && !gameState.shiftEnded && gameState.currentDay === 0 && !gameState.tutorialSeen
        ? "She looks like she might explain the work if you ask before the bell."
        : workerPromptText("worker-3");
    },
    interact() {
      if (!gameState.shiftActive && !gameState.shiftEnded && gameState.currentDay === 0 && !gameState.tutorialSeen) {
        showBenchTutorial();
        return;
      }
      openWorkerConversation("worker-3");
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
    openWorkerConversation(entry.id);
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
    gameState.shiftElapsed = Math.min(SHIFT_DURATION_SECONDS, gameState.shiftElapsed + dt * watchShiftTimeAdvanceMultiplier());
    gameState.lastShiftProgress = gameState.shiftElapsed / SHIFT_DURATION_SECONDS;
    if (gameState.shiftElapsed >= SHIFT_DURATION_SECONDS) {
      endShift("timeout");
    }
  }

  updateFractureDrift(dt);
  updateThoughtPopups(dt);
  updateAutoSubmit(dt);

  if (workspaceBannerState.visible && workspaceBannerState.hideTimer > 0) {
    workspaceBannerState.hideTimer = Math.max(0, workspaceBannerState.hideTimer - dt);
    if (workspaceBannerState.hideTimer <= 0) {
      hideWorkspaceBanner();
    }
  }

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

function rememberShiftThought(text) {
  if (!gameState.shiftActive || !text) return;
  if (gameState.shiftThoughtLog.includes(text)) return;
  gameState.shiftThoughtLog.push(text);
  if (gameState.shiftThoughtLog.length > 6) gameState.shiftThoughtLog.shift();
}

function nextThoughtDelay() {
  if (gameState.currentDay <= 2) return 60;
  const healthFactor = 1 - Math.max(0, Math.min(100, gameState.hiddenStats.health)) / 100;
  return Math.max(9, 42 - healthFactor * 24);
}

function minigameSpeedMultiplier() {
  const health = Math.max(0, Math.min(100, gameState.hiddenStats.health));
  if (health >= MINIGAME_SPEED_HEALTH_THRESHOLD) return 1;
  const severity = (MINIGAME_SPEED_HEALTH_THRESHOLD - health) / MINIGAME_SPEED_HEALTH_THRESHOLD;
  return 1 + severity * (MAX_MINIGAME_SPEED_MULTIPLIER - 1);
}

function clonePlain(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function clampPercent(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function isMenuOpen() {
  return Boolean(menuOverlay && !menuOverlay.classList.contains("hidden"));
}

function readAudioSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIO_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveAudioSettings() {
  try {
    localStorage.setItem(LOCAL_AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
  } catch (error) {
    // Ignore audio-setting persistence failures in restricted file contexts.
  }
}

function updateAudioControls() {
  if (musicVolumeSlider) musicVolumeSlider.value = String(audioSettings.musicVolume);
  if (musicVolumeValue) musicVolumeValue.textContent = `${audioSettings.musicVolume}%`;
  if (sfxVolumeSlider) sfxVolumeSlider.value = String(audioSettings.sfxVolume);
  if (sfxVolumeValue) sfxVolumeValue.textContent = `${audioSettings.sfxVolume}%`;
}

function applyMusicVolume() {
  if (!bgMusic) return;
  if (backgroundMusicState.player && typeof backgroundMusicState.player.setVolume === "function") {
    backgroundMusicState.player.setVolume(audioSettings.musicVolume);
    if (audioSettings.musicVolume <= 0 || !backgroundMusicState.unlocked) {
      if (typeof backgroundMusicState.player.mute === "function") backgroundMusicState.player.mute();
    } else if (typeof backgroundMusicState.player.unMute === "function") {
      backgroundMusicState.player.unMute();
    }
    return;
  }

  postBackgroundMusicCommand(audioSettings.musicVolume <= 0 || !backgroundMusicState.unlocked ? "mute" : "unMute");
  postBackgroundMusicCommand("setVolume", [audioSettings.musicVolume]);
}

function applySfxVolume() {
  if (bellState.widgetReady && bellState.widget) {
    bellState.widget.setVolume(audioSettings.sfxVolume);
  }
  if (shiftTickState.widgetReady && shiftTickState.widget) {
    shiftTickState.widget.setVolume(audioSettings.sfxVolume);
  }
}

function applyAudioSettings() {
  updateAudioControls();
  applyMusicVolume();
  applySfxVolume();
}

function initializeAudioSettings() {
  const stored = readAudioSettings();
  if (stored) {
    audioSettings.musicVolume = clampPercent(stored.musicVolume, audioSettings.musicVolume);
    audioSettings.sfxVolume = clampPercent(stored.sfxVolume, audioSettings.sfxVolume);
  }
  applyAudioSettings();
}

function currentDayLogLabel(dayIndex = gameState.currentDay) {
  const safeDay = Math.max(0, Math.min(DAY_NAMES.length - 1, Number(dayIndex || 0)));
  return `${DAY_NAMES[safeDay]} - DAY ${safeDay + 1}`;
}

function normalizeLogText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shouldHideTextLogEntry(source = "", title = "") {
  const normalizedSource = normalizeLogText(source);
  const normalizedTitle = normalizeLogText(title).toLowerCase();
  if (normalizedSource === "Workspace memory") return true;
  if (normalizedSource === "Minigame" && normalizedTitle.startsWith("watch painting")) return true;
  return false;
}

function appendTextLog(title, body, source = "Log") {
  const normalizedTitle = normalizeLogText(title);
  const normalizedBody = normalizeLogText(body);
  if (!normalizedTitle && !normalizedBody) return;
  if (shouldHideTextLogEntry(source, normalizedTitle)) return;

  const entry = {
    source,
    title: normalizedTitle,
    body: normalizedBody,
    dayIndex: Math.max(0, Math.min(DAY_NAMES.length - 1, gameState.currentDay)),
    dayLabel: currentDayLogLabel(),
  };

  const lastEntry = gameState.textLog[gameState.textLog.length - 1];
  if (
    lastEntry
    && lastEntry.source === entry.source
    && lastEntry.title === entry.title
    && lastEntry.body === entry.body
    && lastEntry.dayIndex === entry.dayIndex
  ) {
    return;
  }

  gameState.textLog.push(entry);
  if (gameState.textLog.length > TEXT_LOG_LIMIT) {
    gameState.textLog.splice(0, gameState.textLog.length - TEXT_LOG_LIMIT);
  }

  if (isMenuOpen()) {
    renderTextLog();
  }
}

function renderTextLog() {
  if (!textLogList) return;
  textLogList.replaceChildren();

  const entries = Array.isArray(gameState.textLog)
    ? gameState.textLog.filter((entry) => !shouldHideTextLogEntry(entry?.source, entry?.title))
    : [];

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-log-empty";
    empty.textContent = "No logged text yet.";
    textLogList.appendChild(empty);
    return;
  }

  for (const entry of entries.slice().reverse()) {
    const article = document.createElement("article");
    article.className = "text-log-entry";

    const meta = document.createElement("p");
    meta.className = "text-log-meta";
    meta.textContent = `${entry.source} · ${entry.dayLabel}`;
    article.appendChild(meta);

    if (entry.title) {
      const title = document.createElement("h3");
      title.className = "text-log-title";
      title.textContent = entry.title;
      article.appendChild(title);
    }

    if (entry.body) {
      const body = document.createElement("p");
      body.className = "text-log-body";
      body.textContent = entry.body;
      article.appendChild(body);
    }

    textLogList.appendChild(article);
  }
}

function observeLoggedTextNode(element, source, titleResolver = null) {
  if (!element) return;
  let previous = normalizeLogText(element.textContent);
  const observer = new MutationObserver(() => {
    const current = normalizeLogText(element.textContent);
    if (!current || current === previous) return;
    previous = current;
    if (!paintState.active && minigameOverlay.classList.contains("hidden")) return;
    const title = typeof titleResolver === "function" ? titleResolver() : "";
    appendTextLog(title, current, source);
  });
  observer.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function splitLongDialogSegment(segment, maxChars) {
  const chunks = [];
  let remaining = segment.trim();
  while (remaining.length > maxChars) {
    let breakAt = remaining.lastIndexOf(", ", maxChars);
    if (breakAt < Math.floor(maxChars * 0.5)) {
      breakAt = remaining.lastIndexOf(" ", maxChars);
    }
    if (breakAt < Math.floor(maxChars * 0.4)) {
      breakAt = maxChars;
    }
    chunks.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function splitDialogBodyIntoPages(bodyText, maxChars = DIALOG_PAGE_CHARACTER_LIMIT) {
  const raw = String(bodyText || "").replace(/\r/g, "").trim();
  if (!raw) return [""];

  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const pages = [];
  for (const paragraph of paragraphs) {
    const fragments = paragraph.match(/[^.!?]+(?:[.!?]+["']?)*|.+$/g) || [paragraph];
    const segments = fragments
      .map((fragment) => fragment.trim())
      .filter(Boolean)
      .flatMap((fragment) => (fragment.length > maxChars ? splitLongDialogSegment(fragment, maxChars) : [fragment]));

    let page = "";
    for (const segment of segments) {
      const candidate = page ? `${page} ${segment}` : segment;
      if (candidate.length <= maxChars) {
        page = candidate;
      } else {
        if (page) {
          pages.push(page.trim());
        }
        page = segment;
      }
    }
    if (page) {
      pages.push(page.trim());
    }
  }

  return pages.length > 0 ? pages : [raw];
}

function resetDialogPaging() {
  dialogPageState.pages = [""];
  dialogPageState.index = 0;
  dialogPageState.title = "";
  dialogPageState.fullText = "";
  if (dialogPager) {
    dialogPager.classList.add("hidden");
  }
  if (dialogPageIndicator) {
    dialogPageIndicator.textContent = "";
  }
  if (dialogPrevButton) {
    dialogPrevButton.disabled = true;
  }
  if (dialogNextButton) {
    dialogNextButton.disabled = true;
  }
}

function syncDialogActionButtons() {
  const lockActions = dialogPageState.pages.length > 1 && dialogPageState.index < dialogPageState.pages.length - 1;
  for (const button of [dialogAltButton, dialogThirdButton, dialogButton]) {
    if (!button) continue;
    button.disabled = lockActions && !button.classList.contains("hidden");
  }
}

function renderDialogPage() {
  const pages = dialogPageState.pages.length > 0 ? dialogPageState.pages : [""];
  const index = Math.max(0, Math.min(pages.length - 1, dialogPageState.index));
  dialogPageState.index = index;
  dialogBody.textContent = pages[index] || "";

  const multiplePages = pages.length > 1;
  if (dialogPager) {
    dialogPager.classList.toggle("hidden", !multiplePages);
  }
  if (dialogPageIndicator) {
    dialogPageIndicator.textContent = multiplePages ? `${index + 1} / ${pages.length}` : "";
  }
  if (dialogPrevButton) {
    dialogPrevButton.disabled = !multiplePages || index === 0;
  }
  if (dialogNextButton) {
    dialogNextButton.disabled = !multiplePages || index >= pages.length - 1;
  }
  syncDialogActionButtons();
}

function setDialogContent(title, body, options = {}) {
  const {
    log = true,
    source = "Dialogue",
  } = options;
  dialogTitle.textContent = title;
  dialogPageState.title = title;
  dialogPageState.fullText = String(body || "");
  dialogPageState.pages = splitDialogBodyIntoPages(dialogPageState.fullText);
  dialogPageState.index = 0;
  renderDialogPage();
  if (log) {
    appendTextLog(title, dialogPageState.fullText, source);
  }
}

function shiftDialogPage(step) {
  const nextIndex = dialogPageState.index + step;
  if (nextIndex < 0 || nextIndex >= dialogPageState.pages.length) return;
  dialogPageState.index = nextIndex;
  renderDialogPage();
}

function alternatingPostShiftActivity(dayIndex = gameState.currentDay) {
  return dayIndex % 2 === 0 ? "groceries" : "hemming";
}

observeLoggedTextNode(
  paintPrompt,
  "Minigame",
  () => `${normalizeLogText(minigameHeading?.textContent || "Minigame")} prompt`,
);
observeLoggedTextNode(
  mixPrompt,
  "Minigame",
  () => `${normalizeLogText(minigameHeading?.textContent || "Minigame")} note`,
);

function normalizeSaveSlotIndex(value) {
  return Math.max(0, Math.min(LOCAL_SAVE_SLOT_COUNT - 1, Number(value) || 0));
}

function saveSlotStorageKey(slotIndex) {
  return `${LOCAL_SAVE_SLOT_KEY_PREFIX}${normalizeSaveSlotIndex(slotIndex) + 1}`;
}

function saveSlotLabel(slotIndex) {
  return `Slot ${normalizeSaveSlotIndex(slotIndex) + 1}`;
}

function parseStoredSave(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (payload && typeof payload === "object") {
      payload.__storageKey = key;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function readLegacyLocalSave() {
  const keys = [LOCAL_SAVE_KEY, ...LEGACY_LOCAL_SAVE_KEYS];
  for (const key of keys) {
    const payload = parseStoredSave(key);
    if (payload) return payload;
  }
  return null;
}

function readSlotSave(slotIndex) {
  return parseStoredSave(saveSlotStorageKey(slotIndex));
}

function readAllSlotSaves() {
  return Array.from({ length: LOCAL_SAVE_SLOT_COUNT }, (_, slotIndex) => readSlotSave(slotIndex));
}

function readLocalSave(slotIndex = selectedSaveSlotIndex) {
  const slotted = readSlotSave(slotIndex);
  if (slotted) return slotted;
  if (readAllSlotSaves().some(Boolean)) return null;
  return readLegacyLocalSave();
}

function persistSelectedSaveSlotIndex() {
  try {
    localStorage.setItem(LOCAL_SAVE_SELECTED_SLOT_KEY, String(selectedSaveSlotIndex));
  } catch (error) {
    // Ignore browsers that deny persistence.
  }
}

function loadSelectedSaveSlotIndex() {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_SELECTED_SLOT_KEY);
    return normalizeSaveSlotIndex(raw);
  } catch (error) {
    return 0;
  }
}

function ensureSaveSlotsMigrated() {
  try {
    if (readAllSlotSaves().some(Boolean)) return false;
    const legacy = readLegacyLocalSave();
    if (!legacy) return false;
    const targetKey = saveSlotStorageKey(selectedSaveSlotIndex);
    const payload = clonePlain(legacy);
    delete payload.__storageKey;
    localStorage.setItem(targetKey, JSON.stringify(payload));
    localStorage.removeItem(LOCAL_SAVE_KEY);
    for (const key of LEGACY_LOCAL_SAVE_KEYS) {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function saveSlotSummary(save) {
  if (!save || !save.gameState) {
    return {
      subtitle: "Empty slot",
      meta: "No saved week yet.",
    };
  }

  const day = Number.isFinite(save.gameState.currentDay) ? save.gameState.currentDay + 1 : "?";
  const dials = Math.max(0, Number(save.gameState.totalDialsPainted ?? 0));
  const money = formatCurrency(Number(save.gameState.totalEarningsCents ?? 0));
  return {
    subtitle: `Day ${day} • ${dials} dials • ${money}`,
    meta: `Saved ${formatSaveTimestamp(save.savedAt)}`,
  };
}

function renderSaveSlotGrid() {
  if (!saveSlotGrid) return;
  saveSlotGrid.replaceChildren();
  const slotSaves = readAllSlotSaves();

  for (let slotIndex = 0; slotIndex < LOCAL_SAVE_SLOT_COUNT; slotIndex += 1) {
    const card = document.createElement("button");
    const save = slotSaves[slotIndex];
    const summary = saveSlotSummary(save);
    card.type = "button";
    card.className = `save-slot-card${slotIndex === selectedSaveSlotIndex ? " selected" : ""}${save ? "" : " empty"}`;
    card.setAttribute("aria-pressed", slotIndex === selectedSaveSlotIndex ? "true" : "false");

    const title = document.createElement("p");
    title.className = "save-slot-title";
    title.textContent = slotIndex === selectedSaveSlotIndex
      ? `${saveSlotLabel(slotIndex)} • selected`
      : saveSlotLabel(slotIndex);

    const subtitle = document.createElement("p");
    subtitle.className = "save-slot-subtitle";
    subtitle.textContent = summary.subtitle;

    const meta = document.createElement("p");
    meta.className = "save-slot-meta";
    meta.textContent = summary.meta;

    card.append(title, subtitle, meta);
    bindPress(card, () => {
      selectedSaveSlotIndex = slotIndex;
      persistSelectedSaveSlotIndex();
      renderSaveSlotGrid();
      updateMenuStatus();
    });
    saveSlotGrid.appendChild(card);
  }
}

function formatSaveTimestamp(value) {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return date.toLocaleString();
}

function updateMenuStatus(message = "") {
  if (!menuStatus) return;
  if (!message) {
    ensureSaveSlotsMigrated();
  }
  const save = readLocalSave(selectedSaveSlotIndex);
  if (message) {
    menuStatus.textContent = message;
    return;
  }
  if (!save) {
    menuStatus.textContent = `${saveSlotLabel(selectedSaveSlotIndex)} is empty.`;
    return;
  }
  const day = Number.isFinite(save?.gameState?.currentDay) ? save.gameState.currentDay + 1 : "?";
  menuStatus.textContent = `${saveSlotLabel(selectedSaveSlotIndex)}: Day ${day}. Saved ${formatSaveTimestamp(save.savedAt)}.`;
}

function openMenu() {
  if (!menuOverlay) return;
  ensureSaveSlotsMigrated();
  menuOverlay.classList.remove("hidden");
  updateAudioControls();
  renderSaveSlotGrid();
  updateMenuStatus();
  renderTextLog();
}

function closeMenu() {
  if (!menuOverlay) return;
  menuOverlay.classList.add("hidden");
}

function clearRecapTimers() {
  for (const timer of recapState.lineTimers) {
    window.clearTimeout(timer);
  }
  recapState.lineTimers = [];
  if (recapState.buttonTimer) {
    window.clearTimeout(recapState.buttonTimer);
    recapState.buttonTimer = 0;
  }
}

function hideShiftRecap() {
  clearRecapTimers();
  recapState.active = false;
  recapState.continuation = null;
  activeShiftEndReason = "";
  if (recapLines) recapLines.replaceChildren();
  if (recapButton) {
    recapButton.classList.add("hidden");
    recapButton.disabled = true;
  }
  if (recapOverlay) {
    recapOverlay.classList.add("hidden");
  }
}

function shiftRecapLines() {
  return [
    `Paint dials completed: ${gameState.dialsPaintedToday}`,
    `Amount earned: ${formatCurrency(gameState.dayEarningsCents)}`,
    `Money subtracted from pay: ${formatCurrency(gameState.dayPayDeductionsCents)}`,
    workersTalkedSummaryText(),
  ];
}

function showShiftRecap(onContinue) {
  if (!recapOverlay || !recapLines || !recapButton || !recapTitle) {
    if (typeof onContinue === "function") onContinue();
    return;
  }

  hideShiftRecap();
  recapState.active = true;
  recapState.continuation = onContinue;
  recapTitle.textContent = `${DAY_NAMES[gameState.currentDay]} TALLY`;
  recapOverlay.classList.remove("hidden");
  recapButton.textContent = "Continue";
  recapButton.disabled = true;

  const lines = shiftRecapLines();
  appendTextLog(recapTitle.textContent, lines.join("\n"), "Shift recap");
  lines.forEach((line, index) => {
    const element = document.createElement("p");
    element.className = "recap-line";
    element.textContent = line;
    recapLines.appendChild(element);
    const timer = window.setTimeout(() => {
      element.classList.add("visible");
    }, 180 + index * 360);
    recapState.lineTimers.push(timer);
  });

  recapState.buttonTimer = window.setTimeout(() => {
    recapButton.classList.remove("hidden");
    recapButton.disabled = false;
  }, 180 + lines.length * 360 + 180);
}

function eligibleWorkspaceMemoryWorkers() {
  return Object.keys(WORKER_PROFILES)
    .filter((id) => !isWorkerRemoved(id))
    .filter((id) => {
      const progress = workerProgressFor(id);
      return progress.talks > 0 && progress.familiarity !== "stranger";
    })
    .sort((a, b) => {
      const progressA = workerProgressFor(a);
      const progressB = workerProgressFor(b);
      const score = (progress) =>
        (progress.familiarity === "familiar" ? 4 : progress.familiarity === "acquainted" ? 2 : 0)
        + (progress.lastDaySpoken === gameState.currentDay ? 3 : 0)
        + Math.min(3, Number(progress.talks || 0));
      return score(progressB) - score(progressA) || a.localeCompare(b);
    });
}

function hideWorkspaceBanner(immediate = false) {
  if (!workspaceBanner) return;
  workspaceBannerState.visible = false;
  workspaceBannerState.hideTimer = 0;
  workspaceBanner.classList.remove("visible");
  workspaceBanner.classList.add("hidden");
  if (immediate) {
    workspaceBannerTitle.textContent = "";
    workspaceBannerBody.textContent = "";
  }
}

function showWorkspaceMemoryBanner() {
  if (!workspaceBanner || !workspaceBannerTitle || !workspaceBannerBody) return;
  if (!gameState.shiftActive || paintState.mode !== "watch" || paintState.tutorial) {
    hideWorkspaceBanner(true);
    return;
  }

  const candidates = eligibleWorkspaceMemoryWorkers();
  if (candidates.length === 0) {
    hideWorkspaceBanner(true);
    return;
  }

  const workerId = candidates[workspaceBannerState.cycleIndex % candidates.length];
  workspaceBannerState.cycleIndex = (workspaceBannerState.cycleIndex + 1) % Math.max(1, candidates.length);
  const memory = workerMemoryMessage(workerId);
  workspaceBannerTitle.textContent = memory.title;
  workspaceBannerBody.textContent = memory.body;
  appendTextLog(memory.title, memory.body, "Workspace memory");
  workspaceBanner.classList.remove("hidden");
  workspaceBanner.classList.add("visible");
  workspaceBannerState.visible = true;
  workspaceBannerState.hideTimer = 4.2;
}

function toggleMenu() {
  if (!menuOverlay) return;
  if (isMenuOpen()) {
    closeMenu();
  } else {
    openMenu();
  }
}

function postBackgroundMusicCommand(func, args = []) {
  if (!bgMusic?.contentWindow) return;
  bgMusic.contentWindow.postMessage(JSON.stringify({
    event: "command",
    func,
    args,
  }), "*");
}

function createBackgroundMusicPlayer() {
  if (!bgMusic || backgroundMusicState.player || !window.YT || typeof window.YT.Player !== "function") return;
  backgroundMusicState.player = new window.YT.Player("bgMusic", {
    videoId: BACKGROUND_MUSIC_VIDEO_ID,
    playerVars: {
      autoplay: 1,
      loop: 1,
      playlist: BACKGROUND_MUSIC_VIDEO_ID,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      enablejsapi: 1,
    },
    events: {
      onReady: (event) => {
        backgroundMusicState.ready = true;
        event.target.mute();
        event.target.setVolume(audioSettings.musicVolume);
        event.target.playVideo();
        if (backgroundMusicState.pendingStart || backgroundMusicState.unlocked) {
          startBackgroundMusic(true);
        }
      },
      onStateChange: (event) => {
        if (!window.YT || typeof window.YT.PlayerState === "undefined") return;
        if (event.data === window.YT.PlayerState.ENDED) {
          event.target.seekTo(0);
          event.target.playVideo();
        }
      },
    },
  });
}

function startBackgroundMusic(force = false) {
  if (!bgMusic) return;
  if (!force && backgroundMusicState.unlocked) return;
  backgroundMusicState.unlocked = true;
  backgroundMusicState.pendingStart = false;
  createBackgroundMusicPlayer();
  applyMusicVolume();
  if (backgroundMusicState.player && typeof backgroundMusicState.player.playVideo === "function") {
    backgroundMusicState.player.playVideo();
    if (audioSettings.musicVolume > 0 && typeof backgroundMusicState.player.unMute === "function") {
      backgroundMusicState.player.unMute();
    }
    return;
  }
  postBackgroundMusicCommand("playVideo");
}

function primeBackgroundMusic() {
  if (!bgMusic) return;
  createBackgroundMusicPlayer();
  if (backgroundMusicState.ready) {
    startBackgroundMusic();
    return;
  }
  backgroundMusicState.pendingStart = true;
}

function ensureSoundCloudWidgetApi(initializer) {
  if (window.SC && typeof window.SC.Widget === "function") {
    soundCloudApiState.ready = true;
    initializer();
    return;
  }

  soundCloudApiState.pendingInitializers.push(initializer);
  if (soundCloudApiState.scriptLoading) return;

  soundCloudApiState.scriptLoading = true;
  const script = document.createElement("script");
  script.src = "https://w.soundcloud.com/player/api.js";
  script.async = true;
  script.onload = () => {
    soundCloudApiState.scriptLoading = false;
    soundCloudApiState.ready = true;
    const initializers = [...soundCloudApiState.pendingInitializers];
    soundCloudApiState.pendingInitializers = [];
    for (const callback of initializers) callback();
  };
  script.onerror = () => {
    soundCloudApiState.scriptLoading = false;
    soundCloudApiState.pendingInitializers = [];
  };
  document.head.appendChild(script);
}

function ensureCompletionBellWidget() {
  if (!bellState.iframe) {
    const iframe = document.createElement("iframe");
    iframe.className = "youtube-player-host";
    iframe.id = "completionBellPlayer";
    iframe.src = COMPLETION_BELL_EMBED_URL;
    iframe.title = "Completion bell";
    iframe.allow = "autoplay";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    bellState.iframe = iframe;
  }

  if (bellState.widget || bellState.widgetReady) return;
  ensureSoundCloudWidgetApi(initializeCompletionBellWidget);
}

function initializeCompletionBellWidget() {
  if (!bellState.iframe || bellState.widget || !window.SC || typeof window.SC.Widget !== "function") return;
  bellState.widget = window.SC.Widget(bellState.iframe);
  bellState.widget.bind(window.SC.Widget.Events.READY, () => {
    bellState.widgetReady = true;
    applySfxVolume();
    if (bellState.pendingPlay) {
      bellState.pendingPlay = false;
      playCompletionBell(true);
    }
  });
}

function stopCompletionBellLater() {
  if (!bellState.widgetReady || !bellState.widget) return;
  window.clearTimeout(bellState.stopTimer);
  bellState.stopTimer = window.setTimeout(() => {
    if (!bellState.widgetReady || !bellState.widget) return;
    bellState.widget.pause();
    bellState.widget.seekTo(0);
  }, COMPLETION_BELL_MAX_PLAY_MS);
}

function playCompletionBell(fromPending = false) {
  ensureCompletionBellWidget();
  const now = performance.now();
  if (!fromPending && now - bellState.lastPlayAt < COMPLETION_BELL_RETRIGGER_MS) return;
  bellState.lastPlayAt = now;

  if (!bellState.widgetReady || !bellState.widget) {
    bellState.pendingPlay = true;
    return;
  }

  bellState.widget.seekTo(0);
  bellState.widget.play();
  stopCompletionBellLater();
}

function ensureShiftTickWidget() {
  if (!shiftTickState.iframe) {
    const iframe = document.createElement("iframe");
    iframe.className = "youtube-player-host";
    iframe.id = "shiftTickPlayer";
    iframe.src = SHIFT_TICK_EMBED_URL;
    iframe.title = "Shift ticking";
    iframe.allow = "autoplay";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    shiftTickState.iframe = iframe;
  }

  if (shiftTickState.widget || shiftTickState.widgetReady) return;
  ensureSoundCloudWidgetApi(initializeShiftTickWidget);
}

function initializeShiftTickWidget() {
  if (!shiftTickState.iframe || shiftTickState.widget || !window.SC || typeof window.SC.Widget !== "function") return;
  shiftTickState.widget = window.SC.Widget(shiftTickState.iframe);
  shiftTickState.widget.bind(window.SC.Widget.Events.READY, () => {
    shiftTickState.widgetReady = true;
    applySfxVolume();
    if (shiftTickState.pendingPlay || shiftTickState.active) {
      shiftTickState.pendingPlay = false;
      startShiftTicking(true);
    }
  });
}

function startShiftTicking(fromPending = false) {
  shiftTickState.active = true;
  ensureShiftTickWidget();
  if (!shiftTickState.widgetReady || !shiftTickState.widget) {
    shiftTickState.pendingPlay = true;
    return;
  }

  shiftTickState.pendingPlay = false;
  if (!fromPending) {
    shiftTickState.widget.seekTo(0);
  }
  shiftTickState.widget.play();
}

function stopShiftTicking() {
  shiftTickState.active = false;
  shiftTickState.pendingPlay = false;
  if (!shiftTickState.widgetReady || !shiftTickState.widget) return;
  shiftTickState.widget.pause();
  shiftTickState.widget.seekTo(0);
}

function buildLocalSavePayload() {
  if (paintState.active && paintState.mode === "watch" && !paintState.tutorial) {
    saveCurrentBenchWork();
  }

  return {
    version: LOCAL_SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    gameState: {
      currentDay: gameState.currentDay,
      shiftActive: gameState.shiftActive,
      shiftEnded: gameState.shiftEnded,
      dayTransition: gameState.dayTransition,
      shiftElapsed: gameState.shiftElapsed,
      dialsPaintedToday: gameState.dialsPaintedToday,
      watchesSubmittedToday: gameState.watchesSubmittedToday,
      dayEarningsCents: gameState.dayEarningsCents,
      dayPayDeductionsCents: gameState.dayPayDeductionsCents,
      totalEarningsCents: gameState.totalEarningsCents,
      totalDialsPainted: gameState.totalDialsPainted,
      lastShiftProgress: gameState.lastShiftProgress,
      lowPayDaysInRow: gameState.lowPayDaysInRow,
      dayOneIntroSeen: gameState.dayOneIntroSeen,
      dayFiveCutsceneSeen: gameState.dayFiveCutsceneSeen,
      joinedWorkers: gameState.joinedWorkers,
      warnedLowHealth: gameState.warnedLowHealth,
      fracturePending: gameState.fracturePending,
      fractureResolved: gameState.fractureResolved,
      hiddenStats: clonePlain(gameState.hiddenStats),
      thresholdThoughtQueued: gameState.thresholdThoughtQueued,
      thresholdThoughtShown: gameState.thresholdThoughtShown,
      savedBenchWork: clonePlain(gameState.savedBenchWork),
      shiftThoughtLog: clonePlain(gameState.shiftThoughtLog),
      lastShiftThoughtLog: clonePlain(gameState.lastShiftThoughtLog),
      savedFundsTenths: gameState.savedFundsTenths,
      groceryBudgetTenths: gameState.groceryBudgetTenths,
      groceryFundsTenths: gameState.groceryFundsTenths,
      groceryCart: clonePlain(gameState.groceryCart),
      groceryPurchasePrices: clonePlain(gameState.groceryPurchasePrices),
      postShiftActivity: gameState.postShiftActivity,
      postHomeSummary: gameState.postHomeSummary,
      hemmingTasks: clonePlain(gameState.hemmingTasks),
      workerProgress: clonePlain(gameState.workerProgress),
      tutorialSeen: gameState.tutorialSeen,
      handRestUnlocked: gameState.handRestUnlocked,
      buttonHintState: clonePlain(gameState.buttonHintState),
      textLog: clonePlain(gameState.textLog),
    },
    paintState: {
      tableLabel: paintState.tableLabel,
      watchIndex: paintState.watchIndex,
      brushSize: paintState.brushSize,
      mix: clonePlain(paintState.mix),
      mixQuality: paintState.mixQuality,
      paintLoaded: paintState.paintLoaded,
      watchNumeralStyle: paintState.watchNumeralStyle,
      activeDialIndex: paintState.activeDialIndex,
      zoomedDialIndex: paintState.zoomedDialIndex,
      readyToSubmit: paintState.readyToSubmit,
      tool: paintState.tool,
      correcting: paintState.correcting,
      restHandOnSide: paintState.restHandOnSide,
    },
    roomState: {
      cursorX: roomState.cursorX,
      cursorY: roomState.cursorY,
    },
  };
}

function saveGameToLocal(slotIndex = selectedSaveSlotIndex) {
  try {
    const targetSlotIndex = normalizeSaveSlotIndex(slotIndex);
    selectedSaveSlotIndex = targetSlotIndex;
    persistSelectedSaveSlotIndex();
    localStorage.setItem(saveSlotStorageKey(targetSlotIndex), JSON.stringify(buildLocalSavePayload()));
    renderSaveSlotGrid();
    updateMenuStatus(`Saved to ${saveSlotLabel(targetSlotIndex)}.`);
    return true;
  } catch (error) {
    updateMenuStatus(`Saving failed for ${saveSlotLabel(slotIndex)} in this browser context.`);
    return false;
  }
}

function loadGameFromLocal(slotIndex = selectedSaveSlotIndex) {
  const targetSlotIndex = normalizeSaveSlotIndex(slotIndex);
  selectedSaveSlotIndex = targetSlotIndex;
  persistSelectedSaveSlotIndex();
  ensureSaveSlotsMigrated();
  const payload = readLocalSave(targetSlotIndex);
  if (!payload || !payload.gameState) {
    updateMenuStatus(`${saveSlotLabel(targetSlotIndex)} is empty.`);
    return false;
  }

  const loadedGame = payload.gameState || {};
  const loadedPaint = payload.paintState || {};
  const loadedRoom = payload.roomState || {};
  const saveSchemaVersion = Number(payload.version ?? 1);
  const needsNumeralMigration = saveSchemaVersion < 2;

  if (!dialogOverlay.classList.contains("hidden")) {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
  }
  if (paintState.active) {
    closeMinigame();
  }
  workerConversationState = null;

  gameState.currentDay = Math.max(0, Math.min(6, Number(loadedGame.currentDay ?? 0)));
  gameState.shiftActive = Boolean(loadedGame.shiftActive);
  gameState.shiftEnded = Boolean(loadedGame.shiftEnded);
  gameState.dayTransition = Boolean(loadedGame.dayTransition);
  gameState.shiftElapsed = Math.max(0, Math.min(SHIFT_DURATION_SECONDS, Number(loadedGame.shiftElapsed ?? 0)));
  gameState.dialsPaintedToday = Math.max(0, Number(loadedGame.dialsPaintedToday ?? 0));
  gameState.watchesSubmittedToday = Math.max(0, Number(loadedGame.watchesSubmittedToday ?? 0));
  gameState.dayEarningsCents = Number(loadedGame.dayEarningsCents ?? 0);
  gameState.dayPayDeductionsCents = Math.max(0, Number(loadedGame.dayPayDeductionsCents ?? 0));
  gameState.totalEarningsCents = Number(loadedGame.totalEarningsCents ?? 0);
  gameState.totalDialsPainted = Math.max(0, Number(loadedGame.totalDialsPainted ?? 0));
  gameState.lastShiftProgress = Math.max(0, Math.min(1, Number(loadedGame.lastShiftProgress ?? 0)));
  gameState.lowPayDaysInRow = Math.max(0, Number(loadedGame.lowPayDaysInRow ?? 0));
  gameState.dayOneIntroSeen = Boolean(loadedGame.dayOneIntroSeen);
  gameState.dayFiveCutsceneSeen = Boolean(loadedGame.dayFiveCutsceneSeen);
  gameState.joinedWorkers = Boolean(loadedGame.joinedWorkers);
  gameState.warnedLowHealth = Boolean(loadedGame.warnedLowHealth);
  gameState.fracturePending = Boolean(loadedGame.fracturePending);
  gameState.fractureResolved = Boolean(loadedGame.fractureResolved);
  gameState.hiddenStats = clonePlain(loadedGame.hiddenStats || { health: 100, brushLicks: 0, fingernailUses: 0 });
  gameState.hiddenStats.health = Math.max(0, Math.min(100, Number(gameState.hiddenStats.health ?? 100)));
  gameState.hiddenStats.brushLicks = Math.max(0, Number(gameState.hiddenStats.brushLicks ?? 0));
  gameState.hiddenStats.fingernailUses = Math.max(0, Number(gameState.hiddenStats.fingernailUses ?? 0));
  gameState.thresholdThoughtQueued = Boolean(loadedGame.thresholdThoughtQueued);
  gameState.thresholdThoughtShown = Boolean(loadedGame.thresholdThoughtShown);
  gameState.savedBenchWork = needsNumeralMigration ? {} : clonePlain(loadedGame.savedBenchWork || {});
  gameState.shiftThoughtLog = clonePlain(loadedGame.shiftThoughtLog || []);
  gameState.lastShiftThoughtLog = clonePlain(loadedGame.lastShiftThoughtLog || []);
  gameState.savedFundsTenths = Math.max(0, Number(loadedGame.savedFundsTenths ?? 0));
  gameState.groceryBudgetTenths = Math.max(0, Number(loadedGame.groceryBudgetTenths ?? 0));
  gameState.groceryFundsTenths = Math.max(0, Number(loadedGame.groceryFundsTenths ?? 0));
  gameState.groceryCart = clonePlain(loadedGame.groceryCart || {});
  gameState.groceryPurchasePrices = clonePlain(loadedGame.groceryPurchasePrices || {});
  for (const item of GROCERY_ITEMS) {
    if (!Array.isArray(gameState.groceryPurchasePrices[item.id])) {
      gameState.groceryPurchasePrices[item.id] = [];
    }
  }
  gameState.postShiftActivity = loadedGame.postShiftActivity === "hemming" ? "hemming" : "groceries";
  gameState.postHomeSummary = String(loadedGame.postHomeSummary || "");
  gameState.hemmingTasks = clonePlain(loadedGame.hemmingTasks || []);
  gameState.workerProgress = clonePlain(loadedGame.workerProgress || buildDefaultWorkerProgress());
  gameState.tutorialSeen = Boolean(loadedGame.tutorialSeen);
  gameState.handRestUnlocked = Boolean(loadedGame.handRestUnlocked);
  gameState.buttonHintState = clonePlain(loadedGame.buttonHintState || buildDefaultButtonHintState());
  ensureButtonHintState();
  gameState.textLog = Array.isArray(loadedGame.textLog)
    ? loadedGame.textLog
      .map((entry) => ({
        source: normalizeLogText(entry?.source || "Log"),
        title: normalizeLogText(entry?.title || ""),
        body: normalizeLogText(entry?.body || ""),
        dayIndex: Math.max(0, Math.min(DAY_NAMES.length - 1, Number(entry?.dayIndex ?? gameState.currentDay))),
        dayLabel: normalizeLogText(entry?.dayLabel || currentDayLogLabel(Number(entry?.dayIndex ?? gameState.currentDay))),
      }))
      .filter((entry) => (entry.title || entry.body) && !shouldHideTextLogEntry(entry.source, entry.title))
      .slice(-TEXT_LOG_LIMIT)
    : [];
  gameState.dialogMode = "";

  paintState.active = false;
  paintState.isPainting = false;
  paintState.correcting = Boolean(loadedPaint.correcting);
  paintState.tool = loadedPaint.tool === "nail" ? "nail" : loadedPaint.tool === "mix" ? "mix" : "brush";
  paintState.dials = [];
  paintState.tableLabel = String(loadedPaint.tableLabel || "central");
  paintState.watchIndex = Math.max(0, Number(loadedPaint.watchIndex ?? 0));
  paintState.brushSize = Math.max(DEFAULT_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Number(loadedPaint.brushSize ?? DEFAULT_BRUSH_SIZE)));
  paintState.mix = Array.isArray(loadedPaint.mix) && loadedPaint.mix.length === 3
    ? loadedPaint.mix.map((value) => Math.max(0, Number(value || 0)))
    : [0, 0, 0];
  paintState.mixQuality = Math.max(0, Math.min(1, Number(loadedPaint.mixQuality ?? 0)));
  paintState.activeDialIndex = Math.max(0, Number(loadedPaint.activeDialIndex ?? 0));
  paintState.zoomedDialIndex = -1;
  paintState.paintLoaded = Math.max(0, Math.min(1, Number(loadedPaint.paintLoaded ?? 0)));
  paintState.readyToSubmit = Boolean(loadedPaint.readyToSubmit);
  paintState.restHandOnSide = Boolean(loadedPaint.restHandOnSide) && gameState.handRestUnlocked;
  paintState.mode = "watch";
  paintState.fracturePieces = [];
  paintState.draggedPieceIndex = -1;
  paintState.tutorial = null;
  paintState.autoSubmitTimer = -1;
  paintState.thoughtPopup = null;
  paintState.watchNumeralStyle = NUMERAL_STYLE_KEYS.includes(loadedPaint.watchNumeralStyle)
    ? loadedPaint.watchNumeralStyle
    : NUMERAL_STYLE_KEYS[0];
  paintState.groceryTiming.active = false;
  paintState.groceryTiming.itemId = "";
  paintState.groceryTiming.rowIndex = -1;
  paintState.groceryTiming.checkoutActive = false;
  paintState.groceryTiming.attemptsUsed = 0;
  paintState.groceryTiming.bestGrade = "";
  paintState.groceryTiming.bestProgress = 0;
  paintState.groceryTiming.lastGrade = "";
  paintState.groceryTiming.lastItemLabel = "";
  paintState.groceryTiming.lastSavingsTenths = 0;
  paintState.hemmingTiming.active = false;
  paintState.hemmingTiming.taskIndex = -1;
  paintState.hemmingTiming.stitchIndex = -1;
  paintState.hemmingTiming.popupX = 0;
  paintState.hemmingTiming.popupY = 0;
  paintState.hemmingTiming.popupSize = HEMMING_TIMING_WIDGET_SIZE;
  clearTimingFeedback();

  roomState.cursorX = Math.max(0, Math.min(WIDTH, Number(loadedRoom.cursorX ?? WIDTH / 2)));
  roomState.cursorY = Math.max(0, Math.min(HEIGHT, Number(loadedRoom.cursorY ?? HEIGHT / 2)));

  if (gameState.dayTransition) {
    showTitleCard();
  } else {
    titleCard.classList.remove("visible", "fade-out");
  }

  minigameOverlay.classList.add("hidden");
  hideInfoCanvas();
  paintCanvas.style.cursor = "none";
  setStationControlsHidden(false);
  updateCoverage();
  updateHud();
  setMessage(
    `${DAY_NAMES[gameState.currentDay]} restored from local save.`,
    needsNumeralMigration
      ? "Older in-progress watch faces were refreshed so the numeral shapes use the corrected font."
      : gameState.shiftActive
      ? "Shift is still live. Clock out at the wall clock when you're done, or return to the bench."
      : "Click the wall clock to begin when you're ready.",
  );
  if (gameState.shiftActive) {
    startShiftTicking();
  } else {
    stopShiftTicking();
  }
  const targetKey = saveSlotStorageKey(targetSlotIndex);
  if (payload.__storageKey !== targetKey || needsNumeralMigration) {
    try {
      localStorage.setItem(targetKey, JSON.stringify(buildLocalSavePayload()));
      if (payload.__storageKey === LOCAL_SAVE_KEY) {
        localStorage.removeItem(LOCAL_SAVE_KEY);
      }
      for (const key of LEGACY_LOCAL_SAVE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Keep the loaded state even if the browser refuses the migration write.
    }
  }
  closeMenu();
  renderSaveSlotGrid();
  updateMenuStatus(
    needsNumeralMigration
      ? `${saveSlotLabel(targetSlotIndex)} loaded and updated.`
      : `${saveSlotLabel(targetSlotIndex)} loaded.`,
  );
  return true;
}

function deleteLocalSave(slotIndex = selectedSaveSlotIndex) {
  try {
    const targetSlotIndex = normalizeSaveSlotIndex(slotIndex);
    selectedSaveSlotIndex = targetSlotIndex;
    persistSelectedSaveSlotIndex();
    localStorage.removeItem(saveSlotStorageKey(targetSlotIndex));
    if (targetSlotIndex === 0) {
      localStorage.removeItem(LOCAL_SAVE_KEY);
      for (const key of LEGACY_LOCAL_SAVE_KEYS) {
        localStorage.removeItem(key);
      }
    }
    renderSaveSlotGrid();
    updateMenuStatus(`${saveSlotLabel(targetSlotIndex)} deleted.`);
    return true;
  } catch (error) {
    updateMenuStatus(`Could not delete ${saveSlotLabel(slotIndex)} in this browser context.`);
    return false;
  }
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
  const maxWidth = Math.max(60, frame.w);
  const maxHeight = Math.max(48, frame.h);
  for (let fontSize = 14; fontSize >= 11; fontSize -= 1) {
    const lineHeight = Math.round(fontSize * 1.3);
    let lines = [text];
    let maxLineWidth = 0;
    paintCtx.save();
    paintCtx.font = `${fontSize}px Georgia`;
    lines = wrapThoughtText(text, maxWidth);
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, paintCtx.measureText(line).width);
    }
    paintCtx.restore();
    if (maxLineWidth <= maxWidth && lines.length * lineHeight <= maxHeight) {
      return { fontSize, lineHeight, lines, maxLineWidth };
    }
  }

  const fontSize = 11;
  const lineHeight = Math.round(fontSize * 1.3);
  let lines = [text];
  let maxLineWidth = 0;
  paintCtx.save();
  paintCtx.font = `${fontSize}px Georgia`;
  lines = wrapThoughtText(text, maxWidth);
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
    x: frame.x + frame.w * 0.252,
    y: frame.y + frame.h * 0.225,
    w: frame.w * 0.496,
    h: frame.h * 0.548,
  };
}

function thoughtTextFrame(popup) {
  const frame = thoughtPanelFrame(popup);
  return {
    x: frame.x + 10,
    y: frame.y + 10,
    w: Math.max(40, frame.w - 20),
    h: Math.max(32, frame.h - 20),
  };
}

function spawnThoughtPopup(forcedText = null) {
  const pool = currentThoughtPool();
  const text = forcedText || pool[Math.floor(Math.random() * pool.length)];
  rememberShiftThought(text);
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
    const hoveredItem = interactables.find((entry) => entry.id === hoverSpot.id);
    drawHoverLabel(ctx, hoverSpot.x + hoverSpot.w / 2, hoverSpot.y, interactableDisplayName(hoveredItem));
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

function drawHoverLabel(drawCtx, centerX, topY, text) {
  if (!text) return;
  drawCtx.save();
  drawCtx.font = "12px Georgia";
  drawCtx.textAlign = "center";
  drawCtx.textBaseline = "middle";
  const textWidth = drawCtx.measureText(text).width;
  const paddingX = 10;
  const boxWidth = Math.max(52, textWidth + paddingX * 2);
  const boxHeight = 22;
  const x = Math.max(6, Math.min(centerX - boxWidth / 2, drawCtx.canvas.width - boxWidth - 6));
  const y = Math.max(6, topY - boxHeight - 6);
  drawCtx.fillStyle = "rgba(0, 0, 0, 0.88)";
  drawCtx.fillRect(x, y, boxWidth, boxHeight);
  drawCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  drawCtx.lineWidth = 1;
  drawCtx.strokeRect(x, y, boxWidth, boxHeight);
  drawCtx.fillStyle = "#f4f4f4";
  drawCtx.fillText(text, x + boxWidth / 2, y + boxHeight / 2 + 1);
  drawCtx.restore();
}

function setMessage(primary, secondary = "") {
  hint.textContent = primary;
  subhint.textContent = secondary;
  activeMessageTimer = 4;
  appendTextLog(primary, secondary, "Status");
}

function formatCurrency(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatTenthsCents(tenths) {
  const sign = tenths < 0 ? "-" : "";
  return `${sign}${(Math.abs(tenths) / 10).toFixed(1)}c`;
}

function formatTenthsDollars(tenths) {
  const sign = tenths < 0 ? "-" : "";
  return `${sign}$${(Math.abs(tenths) / 1000).toFixed(2)}`;
}

function formatGroceryAmount(tenths) {
  if (Math.abs(tenths) >= GROCERY_DOLLAR_THRESHOLD_TENTHS) {
    return formatTenthsDollars(tenths);
  }
  return formatTenthsCents(tenths);
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
  earningsLabel.textContent = `Amount earned today: ${formatCurrency(gameState.dayEarningsCents)}`;
  healthLabel.textContent = `Health: ${Math.round(health)}%`;
  healthFill.style.transform = `scaleX(${health / 100})`;
  healthFill.style.filter = health < 35 ? "saturate(0.7) brightness(0.8)" : "none";
}

function refreshHint() {
  if (!dialogOverlay.classList.contains("hidden")) return;

  const target = getTargetedInteractable();
  if (target) {
    hint.textContent = `Click to interact with ${interactableDisplayName(target.item)}.`;
    subhint.textContent = target.item.prompt();
    return;
  }

  if (paintState.active && paintState.mode === "fracture") {
    hint.textContent = "The broken clock waits under your hands.";
    subhint.textContent = "Drag each piece back into place so that your mind slots into place.";
    return;
  }

  if (paintState.active && paintState.mode === "groceries") {
    hint.textContent = "Spend your saved wages before you head home.";
    subhint.textContent = "Click + to start a pulsing haggle for that item, - to put something back, and finish when the basket is settled.";
    return;
  }

  if (paintState.active && paintState.mode === "hemming") {
    hint.textContent = "Repair clothes before bed.";
    subhint.textContent = "Click a stitch dot to start timing, then click the time-stitch box when the moving marker lines up.";
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
      const familiarCount = familiarWorkersCount();
      hint.textContent = "The girls are gathering before the bell.";
      subhint.textContent = canStandWithWorkers()
        ? "Click the wall clock to decide whether to stand with them or return to the bench."
        : `You need familiar standing with at least ${FAMILIAR_WORKERS_REQUIRED} workers to stand with them (${familiarCount}/${FAMILIAR_WORKERS_REQUIRED}).`;
      return;
    }
    hint.textContent = "Clock in when you're ready.";
    subhint.textContent = "Click the wall clock or the workbench in the workshop image.";
    return;
  }

  if (gameState.shiftActive) {
    hint.textContent = "The shift is running.";
    subhint.textContent = "Click the workbench to work, or the wall clock to end the day.";
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
  appendTextLog("Day card", titleCardText.textContent, "Day start");
}

function fadeTitleCard() {
  if (!titleCard.classList.contains("visible")) return;
  titleCard.classList.add("fade-out");
  titleFadeTimer = 1.25;
  gameState.dayTransition = false;
}

function setStationControlsHidden(hidden) {
  correctButton.classList.toggle("hidden", hidden);
  lickButton.classList.toggle("hidden", hidden);
  checkNumeralButton.classList.toggle("hidden", hidden);
  restHandButton.classList.toggle("hidden", hidden || !canUseRestHandSupport());
  mixResetButton.classList.toggle("hidden", hidden);
  syncStationButtonHighlights();
}

function stationButtonVisible(button) {
  return Boolean(button) && !button.classList.contains("hidden");
}

function tutorialHighlightedButtonKeys() {
  if (!paintState.tutorial) return new Set();
  return new Set(TUTORIAL_BUTTON_STEP_MAP[paintState.tutorial.step] || []);
}

function syncStationButtonHighlights() {
  const buttonHintState = ensureButtonHintState();
  const tutorialKeys = tutorialHighlightedButtonKeys();

  for (const [key, button] of Object.entries(STATION_BUTTONS)) {
    if (!button) continue;
    const visible = stationButtonVisible(button);
    button.classList.toggle("tutorial-focus", visible && tutorialKeys.has(key));
    button.classList.toggle(
      "new-control",
      key === "restHand" && visible && !buttonHintState.restHand,
    );
  }
}

function acknowledgeStationButtonHint(key) {
  const buttonHintState = ensureButtonHintState();
  if (key === "restHand") {
    buttonHintState.restHand = true;
  }
  syncStationButtonHighlights();
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
  gameState.shiftThoughtLog = [];
  gameState.dialsPaintedToday = 0;
  gameState.watchesSubmittedToday = 0;
  gameState.dayEarningsCents = 0;
  gameState.dayPayDeductionsCents = 0;
  activeShiftEndReason = "";
  hideShiftRecap();
  startShiftTicking();
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
  } else if (gameState.dayPayDeductionsCents > 0) {
    line += ` ${formatCurrency(gameState.dayPayDeductionsCents)} has been docked for reworked faces.`;
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
      "A little unease has begun to trail you home. Your mouth feels tender and your body more tired than it should after sitting at a bench all day, but you keep folding those thoughts away. Your family needs the wage more than you need certainty, and you tell yourself that a clean bench and a promised envelope of pay cannot possibly hide the danger some small frightened part of you imagines.";
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
      title: "What Remains",
      body:
        "The week ends and you are still upright, still speaking, still able to leave the room under your own power. That feels like far too small a victory for what the lamps have taken from all of you, but you cling to it anyway. You step out carrying your pay, your fatigue, and the stubborn knowledge that you are not yet finished.",
    };
  }

  if (health >= 35) {
    return {
      title: "What Remains",
      body:
        "By the end of the week, the damage has already sunk too deep to ignore. Your jaw aches, your strength comes and goes, and every ordinary motion now carries a little dread inside it. You leave knowing the room is still in you, whether you return to the bench or not.",
    };
  }

  return {
    title: "What Remains",
    body:
      "There is almost nothing left to bargain with by the time the week closes around you. The poison, the hunger, the strain, and the light itself have spent you down to the bone. The room takes more than your labor in the end, and there is no strength left to pretend otherwise.",
  };
}

function resetDialogButtons() {
  resetDialogPaging();
  dialogAltButton.classList.add("hidden");
  dialogThirdButton.classList.add("hidden");
  dialogAltButton.textContent = "Alternative";
  dialogThirdButton.textContent = "Third option";
  dialogButton.textContent = "Continue";
  delete dialogAltButton.dataset.choiceId;
  delete dialogThirdButton.dataset.choiceId;
  delete dialogButton.dataset.choiceId;
}

function showEnding(title, body) {
  resetDialogButtons();
  setDialogContent(title, body);
  dialogButton.textContent = "Try again?";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "restart";
}

function showLowHealthWarning() {
  resetDialogButtons();
  setDialogContent(
    "On The Way Home",
    "On the walk home, you begin to notice something horribly wrong. Your teeth feel loose in your gums, though they should be fully grown and set. When you touch them, two come free at once and land in your palm.",
  );
  dialogButton.textContent = "Continue";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "low-health-warning";
}

function showDayOneIntro() {
  resetDialogButtons();
  setDialogContent(
    "Day 1 - New Hire",
    "You've heard talk of it for weeks, months now; this lucrative new job where skill translates directly to high pay. Its one of the few jobs you could have taken-- as a woman, and one as young as you are. Unlike most other jobs, both attributes make you the perfect hire: young deft hands for this delicate work, and one of the few people left behind while the men valiantly fight for your country. You are a full-blown patriot now, a hero of your family and your country. oo long. At home, there are six siblings and too much need to go around, and as the middle child you have learned how often duty lands in the hands of the one who can least refuse it. So you take your place at the bench telling yourself this is what luck looks like at last. Everyone talks about the paint as if it belongs to the future: luminous, fashionable, and made with the same remarkable material turning up in all the newest products. You have even heard it said that it is good for the health. By the time the shift is ready to begin, you want very badly to believe every word of it.",
  );
  dialogButton.textContent = "Begin shift";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "day-one-intro";
}

function showBenchTutorial() {
  openTutorialMinigame();
}

function showDayFiveCutscene() {
  resetDialogButtons();
  const familiarCount = familiarWorkersCount();
  const unlocksSolidarity = canStandWithWorkers();
  const sharedIntro =
    "The remaining girls gather before the shift whistle. Their voices stay low, urgent, and close to the floor. Some want to keep their heads down and survive the day. Others say the room has already taken too much, and that if anyone is going to speak, it will have to be together.";
  if (unlocksSolidarity) {
    setDialogContent(
      "Day 5 - Before The Bell",
      `${sharedIntro} The room goes still while they decide whether to stand together now, or let the benches swallow another day. ` +
        `You have earned familiar standing with ${familiarCount} workers, enough that they ask you to choose with them.`,
    );
    dialogAltButton.textContent = "Return to the bench";
    dialogAltButton.classList.remove("hidden");
    dialogButton.textContent = "Stand with the girls";
    gameState.dialogMode = "day-five-choice";
  } else {
    setDialogContent(
      "Day 5 - Before The Bell",
      `${sharedIntro} You are still outside the inner circle: familiar standing with ${familiarCount}/${FAMILIAR_WORKERS_REQUIRED} workers. ` +
        "No one asks you to join the stand yet, and the line moves on without your voice in that room.",
    );
    dialogButton.textContent = "Return to the bench";
    gameState.dialogMode = "day-five-locked";
  }
  dialogOverlay.classList.remove("hidden");
}

function showSolidarityEnding() {
  resetDialogButtons();
  setDialogContent(
    "Stand Together",
    "You step away from the bench and join the others. One by one the girls stop working until the room is filled with the sound of nobody yielding. The foreman barks, the silence holds, and for one charged moment the benches no longer decide the shape of your bodies or your fear. Whether the room breaks tomorrow or simply hardens again, tonight you are not standing alone inside it.",
  );
  dialogButton.textContent = "Try again?";
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "restart";
}

function advanceToNextDay(message) {
  gameState.currentDay += 1;
  gameState.shiftEnded = false;
  gameState.shiftElapsed = 0;
  gameState.lastShiftProgress = 0;
  sendToDayStart(message);
}

function continueAfterShiftRecap(reason) {
  activeShiftEndReason = "";
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

  gameState.savedFundsTenths += Math.max(0, Math.round(gameState.dayEarningsCents * 10));

  if (gameState.lowPayDaysInRow >= 3) {
    showEnding(
      "Dismissed",
      "Three bad days in a row are enough. Before another shift can begin, the bench is given to someone else. You arrive the next morning to find another girl already sitting in your place. The shame of it burns all the way home, yet underneath it there is a quieter feeling too: relief, thin and guilty, because for the first time in days the room is no longer waiting to swallow you whole.",
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

  setDialogContent(
    `Shift manager - ${DAY_NAMES[gameState.currentDay]}`,
    `${reason === "timeout" ? "The bell cuts off the shift." : "The manager calls the day."} ` +
      `${managerLineForDay()} ${endOfDayReflection()} ${darkRoomGathering()}`,
  );
  gameState.postShiftActivity = alternatingPostShiftActivity(gameState.currentDay);
  dialogButton.textContent = gameState.postShiftActivity === "groceries" ? "Buy groceries" : "Go hem clothes";
  dialogAltButton.textContent = "Talk with the women";
  dialogAltButton.classList.remove("hidden");
  dialogOverlay.classList.remove("hidden");
  gameState.dialogMode = "post-shift-report";
  updateHud();
}

function endShift(reason) {
  if (!gameState.shiftActive) return;

  gameState.shiftActive = false;
  gameState.shiftEnded = true;
  stopShiftTicking();
  gameState.lastShiftThoughtLog = [...gameState.shiftThoughtLog];
  closeMinigame();
  activeShiftEndReason = reason;
  showShiftRecap(() => {
    continueAfterShiftRecap(activeShiftEndReason || reason);
  });
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

function groceryBackRect() {
  return {
    x: GROCERY_LAYOUT.panel.x + 16,
    y: GROCERY_LAYOUT.finish.y,
    w: 108,
    h: GROCERY_LAYOUT.finish.h,
  };
}

function groceryBargainRect() {
  return {
    x: GROCERY_LAYOUT.panel.x + 16,
    y: GROCERY_LAYOUT.finish.y - 50,
    w: GROCERY_LAYOUT.panel.w - 32,
    h: 38,
  };
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

function bargainGradeLabel(grade) {
  if (!grade) return "";
  return timingFeedbackLabel(grade).replace("!", "");
}

function groceryCartBaseTotalTenths() {
  return GROCERY_ITEMS.reduce((sum, item) => sum + groceryCount(item.id) * item.priceTenths, 0);
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
  const cartTotal = groceryCartBaseTotalTenths();
  const projectedSavings = groceryCurrentSavingsTenths();
  const bestDeal = paintState.groceryTiming.bestGrade
    ? ` Best bargain: ${bargainGradeLabel(paintState.groceryTiming.bestGrade)}${projectedSavings > 0 ? ` (-${formatTenthsCents(projectedSavings)})` : ""}.`
    : "";
  const attempts = ` Bargains ${paintState.groceryTiming.attemptsUsed}/3.`;
  const checkoutState = paintState.groceryTiming.checkoutActive
    ? ` Checkout total ${formatGroceryAmount(cartTotal)}.${projectedSavings > 0 ? ` After bargaining: ${formatGroceryAmount(Math.max(0, cartTotal - projectedSavings))}.` : ""}`
    : "";
  paintStats.textContent =
    `Remaining ${formatGroceryAmount(gameState.groceryFundsTenths)}. ` +
    `Bought ${groceryItemsPurchasedCount()} item${groceryItemsPurchasedCount() === 1 ? "" : "s"}. ` +
    `Basket: ${groceryCartSummary()}.${attempts}${bestDeal}${checkoutState}`;
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
  gameState.groceryBudgetTenths = Math.max(0, Math.round(gameState.savedFundsTenths));
  gameState.groceryFundsTenths = gameState.groceryBudgetTenths;
  gameState.groceryCart = Object.fromEntries(GROCERY_ITEMS.map((item) => [item.id, 0]));
  gameState.groceryPurchasePrices = Object.fromEntries(GROCERY_ITEMS.map((item) => [item.id, []]));
  paintState.groceryTiming.active = false;
  paintState.groceryTiming.itemId = "";
  paintState.groceryTiming.rowIndex = -1;
  paintState.groceryTiming.startedAt = 0;
  paintState.groceryTiming.durationMs = Math.max(520, Math.round((980 + Math.random() * 360) / minigameSpeedMultiplier()));
  paintState.groceryTiming.startRadius = 32;
  paintState.groceryTiming.targetRadius = 11;
  paintState.groceryTiming.checkoutActive = false;
  paintState.groceryTiming.attemptsUsed = 0;
  paintState.groceryTiming.bestGrade = "";
  paintState.groceryTiming.bestProgress = 0;
  paintState.groceryTiming.lastGrade = "";
  paintState.groceryTiming.lastItemLabel = "";
  paintState.groceryTiming.lastSavingsTenths = 0;
  clearTimingFeedback();
  hideWorkspaceBanner(true);
  minigameHeading.textContent = "Groceries";
  paintPrompt.textContent = groceryReflectionText();
  mixPrompt.textContent =
    `You enter the market with ${formatGroceryAmount(gameState.groceryBudgetTenths)} saved for the week. ` +
    "Click + to add items at their marked price and - to put them back. When the basket is settled, go to checkout and decide whether to spend one of your three bargaining attempts.";
  updateGroceryStats();
  setStationControlsHidden(true);
  minigameOverlay.classList.remove("hidden");
  drawWatchMinigame();
}

function buyGrocery(item) {
  if (!item) return;
  const finalPriceTenths = Math.max(0, item.priceTenths);
  if (gameState.groceryFundsTenths < finalPriceTenths) {
    paintPrompt.textContent =
      `${item.label} costs ${formatTenthsCents(finalPriceTenths)}, but only ${formatGroceryAmount(gameState.groceryFundsTenths)} remains in your wallet.`;
    updateGroceryStats();
    return;
  }

  gameState.groceryFundsTenths -= finalPriceTenths;
  gameState.groceryCart[item.id] = (gameState.groceryCart[item.id] || 0) + 1;
  if (!Array.isArray(gameState.groceryPurchasePrices[item.id])) {
    gameState.groceryPurchasePrices[item.id] = [];
  }
  gameState.groceryPurchasePrices[item.id].push(finalPriceTenths);
  paintPrompt.textContent = `${item.label} goes into the basket at the marked price. You can still try to bargain the total down when you reach checkout.`;
  updateGroceryStats();
}

function removeGrocery(item) {
  if (!item || groceryCount(item.id) <= 0) {
    paintPrompt.textContent = "There is nothing of that item in the basket to put back.";
    updateGroceryStats();
    return;
  }

  gameState.groceryCart[item.id] -= 1;
  const refundStack = Array.isArray(gameState.groceryPurchasePrices[item.id])
    ? gameState.groceryPurchasePrices[item.id]
    : [];
  const refundTenths = refundStack.length > 0 ? refundStack.pop() : item.priceTenths;
  gameState.groceryFundsTenths += refundTenths;
  paintPrompt.textContent = `You put ${item.label.toLowerCase()} back and count the money in your hand again.`;
  updateGroceryStats();
}

function groceryTimingCircle() {
  const innerRadius = 11;
  const maxRadius = 32;
  return {
    x: 146,
    y: 356,
    innerRadius,
    maxRadius,
    targetRadius: innerRadius + (maxRadius - innerRadius) * 0.5,
  };
}

function currentGroceryTimingState() {
  if (!paintState.groceryTiming.active) return null;
  const elapsed = Math.max(0, performance.now() - paintState.groceryTiming.startedAt);
  const cyclePhase = (elapsed % Math.max(1, paintState.groceryTiming.durationMs)) / Math.max(1, paintState.groceryTiming.durationMs);
  const circle = groceryTimingCircle();
  const minRadius = Math.min(paintState.groceryTiming.startRadius, paintState.groceryTiming.targetRadius);
  const maxRadius = Math.max(paintState.groceryTiming.startRadius, paintState.groceryTiming.targetRadius);
  const radiusRange = Math.max(1, maxRadius - minRadius);
  const pulse = (Math.sin(cyclePhase * Math.PI * 2 - Math.PI / 2) + 1) * 0.5;
  const pulseRadius = minRadius + radiusRange * pulse;
  const sweetSpotRadius = minRadius + radiusRange * 0.5;
  const closeness = Math.max(0, 1 - Math.abs(pulseRadius - sweetSpotRadius) / (radiusRange * 0.5));
  return {
    active: true,
    progress: closeness,
    cyclePhase,
    x: circle.x,
    y: circle.y,
    innerRadius: minRadius,
    maxRadius,
    targetRadius: sweetSpotRadius,
    outerRadius: pulseRadius,
  };
}

function groceryTimingGradeFromProgress(progress) {
  const delta = Math.abs(1 - Math.min(1, Math.max(0, progress)));
  if (delta <= GROCERY_TIMING_WINDOWS.perfect) return "perfect";
  if (delta <= GROCERY_TIMING_WINDOWS.good) return "good";
  if (delta <= GROCERY_TIMING_WINDOWS.okay) return "okay";
  return "bad";
}

function groceryCurrentSavingsTenths() {
  const bestGrade = paintState.groceryTiming.bestGrade;
  if (!bestGrade) return 0;
  const discountRate = GROCERY_DISCOUNT_RATES[bestGrade] || 0;
  return Math.round(groceryCartBaseTotalTenths() * discountRate);
}

function groceryCheckoutStatusText() {
  const attemptsLeft = Math.max(0, 3 - paintState.groceryTiming.attemptsUsed);
  if (paintState.groceryTiming.bestGrade) {
    return `Best result so far: ${bargainGradeLabel(paintState.groceryTiming.bestGrade)}. ${attemptsLeft} bargain${attemptsLeft === 1 ? "" : "s"} left.`;
  }
  return `No bargain landed yet. ${attemptsLeft} bargain${attemptsLeft === 1 ? "" : "s"} left.`;
}

function enterGroceryCheckout() {
  paintState.groceryTiming.checkoutActive = true;
  paintState.groceryTiming.active = false;
  paintPrompt.textContent = "You step up to the grocer and decide whether to bargain before you pay.";
  mixPrompt.textContent =
    "Choose Bargain if you want to risk one of your three tries on the total. The best timing you land will be kept, and you can pay whenever you like.";
  updateGroceryStats();
}

function leaveGroceryCheckout() {
  paintState.groceryTiming.checkoutActive = false;
  paintState.groceryTiming.active = false;
  paintPrompt.textContent = "You step back from the counter and look over the basket again.";
  mixPrompt.textContent =
    "Click + to add items, - to put them back, and go to checkout again when you are ready.";
  updateGroceryStats();
}

function timingFeedbackLabel(grade) {
  if (grade === "perfect") return "Perfect!";
  if (grade === "good") return "Good!";
  if (grade === "okay") return "Okay!";
  return "Bad!";
}

function timingFeedbackColor(grade) {
  if (grade === "perfect") return "rgba(255, 246, 176, 0.98)";
  if (grade === "good") return "rgba(214, 244, 165, 0.98)";
  if (grade === "okay") return "rgba(232, 198, 140, 0.98)";
  return "rgba(255, 156, 156, 0.98)";
}

function clearTimingFeedback() {
  paintState.timingFeedback.active = false;
  paintState.timingFeedback.label = "";
  paintState.timingFeedback.startedAt = 0;
}

function showTimingFeedback(grade, x, y) {
  paintState.timingFeedback.active = true;
  paintState.timingFeedback.label = timingFeedbackLabel(grade);
  paintState.timingFeedback.color = timingFeedbackColor(grade);
  paintState.timingFeedback.x = x;
  paintState.timingFeedback.y = y;
  paintState.timingFeedback.startedAt = performance.now();
  paintState.timingFeedback.durationMs = TIMING_FEEDBACK_DURATION_MS;
}

function currentTimingFeedback(now = performance.now()) {
  const feedback = paintState.timingFeedback;
  if (!feedback?.active) return null;
  const durationMs = Math.max(1, Number(feedback.durationMs || TIMING_FEEDBACK_DURATION_MS));
  const elapsed = Math.max(0, now - Number(feedback.startedAt || 0));
  if (elapsed >= durationMs) {
    clearTimingFeedback();
    return null;
  }
  return {
    ...feedback,
    progress: elapsed / durationMs,
    ageMs: elapsed,
  };
}

function drawTimingFeedback() {
  const feedback = currentTimingFeedback();
  if (!feedback) return;
  const eased = feedback.progress;
  const alpha = Math.max(0, 1 - eased);
  const rise = 18 * eased;
  const x = Math.max(56, Math.min(paintCanvas.width - 56, feedback.x));
  const y = Math.max(40, Math.min(paintCanvas.height - 24, feedback.y - rise));

  paintCtx.save();
  paintCtx.globalAlpha = alpha;
  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.font = "bold 26px Georgia";
  paintCtx.lineWidth = 4;
  paintCtx.strokeStyle = "rgba(12, 12, 12, 0.72)";
  paintCtx.strokeText(feedback.label, x, y);
  paintCtx.fillStyle = feedback.color;
  paintCtx.fillText(feedback.label, x, y);
  paintCtx.restore();
}

function beginGroceryBargain() {
  if (paintState.groceryTiming.active) {
    paintPrompt.textContent = "Finish the pulsing bargain already in motion before trying again.";
    updateGroceryStats();
    return;
  }
  if (!paintState.groceryTiming.checkoutActive) {
    paintPrompt.textContent = "Go to checkout before you try to bargain with the grocer.";
    updateGroceryStats();
    return;
  }
  if (groceryItemsPurchasedCount() <= 0) {
    paintPrompt.textContent = "There is nothing in the basket to bargain over yet.";
    updateGroceryStats();
    return;
  }
  if (paintState.groceryTiming.attemptsUsed >= 3) {
    paintPrompt.textContent = "You have already used all three bargain attempts for today. Pay now or step back to change the basket.";
    updateGroceryStats();
    return;
  }
  paintState.groceryTiming.active = true;
  paintState.groceryTiming.itemId = "";
  paintState.groceryTiming.rowIndex = -1;
  paintState.groceryTiming.startedAt = performance.now();
  paintState.groceryTiming.durationMs = Math.max(460, Math.round((960 + Math.random() * 340) / minigameSpeedMultiplier()));
  paintState.groceryTiming.startRadius = 32;
  paintState.groceryTiming.targetRadius = 11;
  paintPrompt.textContent = "The grocer watches your face, waiting to see whether you press your luck. Click when the pulsing ring crosses the middle guide.";
  updateGroceryStats();
}

function resolveGroceryPurchase(reason = "click") {
  const timing = currentGroceryTimingState();
  if (!timing || !timing.active) return false;
  paintState.groceryTiming.active = false;
  paintState.groceryTiming.itemId = "";
  paintState.groceryTiming.rowIndex = -1;
  const grade = reason === "timeout" ? "bad" : groceryTimingGradeFromProgress(timing.progress);
  paintState.groceryTiming.attemptsUsed = Math.min(3, paintState.groceryTiming.attemptsUsed + 1);
  paintState.groceryTiming.lastGrade = grade;
  if (timing.progress >= paintState.groceryTiming.bestProgress) {
    paintState.groceryTiming.bestProgress = timing.progress;
    paintState.groceryTiming.bestGrade = grade;
  }
  paintState.groceryTiming.lastSavingsTenths = groceryCurrentSavingsTenths();
  showTimingFeedback(grade, timing.x, timing.y - Math.max(30, timing.outerRadius + 18));
  paintPrompt.textContent =
    `${timingFeedbackLabel(grade)} ${groceryCheckoutStatusText()} ` +
    `${paintState.groceryTiming.attemptsUsed >= 3 ? "That is the last bargain you get today." : "You can try again, step back to the basket, or pay with the best result you have."}`;
  mixPrompt.textContent =
    paintState.groceryTiming.bestGrade
      ? `If you pay now, the best bargain so far cuts ${formatTenthsCents(groceryCurrentSavingsTenths())} from the total.`
      : "If you pay now, you will pay the marked total.";
  updateGroceryStats();
  return true;
}

function updateGroceryTiming() {
  if (!paintState.active || paintState.mode !== "groceries" || !paintState.groceryTiming.active) return;
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

function hemmingTimingPopupRect() {
  const timing = paintState.hemmingTiming;
  const size = Math.max(144, Number(timing.popupSize || HEMMING_TIMING_WIDGET_SIZE));
  return {
    x: Number(timing.popupX || HEMMING_TIMING_WIDGET_MARGIN),
    y: Number(timing.popupY || HEMMING_TIMING_WIDGET_MARGIN),
    w: size,
    h: size,
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
  );
}

function randomHemmingTimingPopupRect() {
  const size = HEMMING_TIMING_WIDGET_SIZE;
  const margin = HEMMING_TIMING_WIDGET_MARGIN;
  const safeBounds = {
    x: margin,
    y: margin,
    w: paintCanvas.width - margin * 2,
    h: paintCanvas.height - margin * 2,
  };
  const finish = hemmingFinishRect();
  const maxX = safeBounds.x + Math.max(0, safeBounds.w - size);
  const maxY = safeBounds.y + Math.max(0, safeBounds.h - size);
  let choice = { x: safeBounds.x, y: safeBounds.y, w: size, h: size };

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = {
      x: safeBounds.x + Math.random() * Math.max(0, maxX - safeBounds.x),
      y: safeBounds.y + Math.random() * Math.max(0, maxY - safeBounds.y),
      w: size,
      h: size,
    };
    if (!rectsOverlap(candidate, finish)) {
      choice = candidate;
      break;
    }
    choice = candidate;
  }

  choice.x = Math.round(choice.x);
  choice.y = Math.round(choice.y);
  return choice;
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

function hemmingTaskByLabel(fragment) {
  return gameState.hemmingTasks.find((task) => task.label.toLowerCase().includes(fragment.toLowerCase())) || null;
}

function hemmingTaskNarrativeKey(task) {
  const label = String(task?.label || "").toLowerCase();
  if (label.includes("blue dress")) return "dress";
  if (label.includes("elly")) return "elly";
  if (label.includes("denny")) return "denny";
  if (label.includes("maggie")) return "maggie";
  return "generic";
}

function hemmingTaskOutcomeKey(task) {
  if (!task || task.stitchesDone < task.stitchesNeeded) return "unfinished";
  return taskHemmingQuality(task);
}

function genericHemmingTaskDescription(task, outcome) {
  if (outcome === "unfinished") return `${task?.label || "The garment"} is still unfinished at the hem.`;
  if (outcome === "perfect") return `${task?.label || "The garment"} has tiny, even stitches that look nearly professional.`;
  if (outcome === "good") return `${task?.label || "The garment"} holds together with solid, clean stitching.`;
  if (outcome === "okay") return `${task?.label || "The garment"} is wearable, though the seam wanders in places.`;
  return `${task?.label || "The garment"} is stitched, but the line is rough and visibly rushed.`;
}

function describeHemmingTaskAtHome(task) {
  const key = hemmingTaskNarrativeKey(task);
  const outcome = hemmingTaskOutcomeKey(task);
  return HEMMING_HOME_DESCRIPTION_TABLE[key]?.[outcome] || genericHemmingTaskDescription(task, outcome);
}

function siblingReactionForTask(task, name, garment) {
  const outcome = hemmingTaskOutcomeKey(task);
  if (HEMMING_SIBLING_REACTION_TABLE[name]?.[outcome]) return HEMMING_SIBLING_REACTION_TABLE[name][outcome];
  if (outcome === "unfinished") {
    return `${name} looks at the unfinished ${garment} and tries to hide the disappointment behind a quick nod.`;
  }
  if (outcome === "perfect") {
    return `${name} lights up the moment they see the ${garment}, turning the hem over in their hands as if it were something new.`;
  }
  if (outcome === "good") {
    return `${name} smiles at the cleaner seam on the ${garment} and thanks you with the kind of relief that makes them sound younger.`;
  }
  if (outcome === "okay") {
    return `${name} accepts the ${garment} carefully, pleased to have it mended even if the stitches still wander a little.`;
  }
  return `${name} says thank you anyway, but keeps tracing the rough seam on the ${garment} with uncertain fingers.`;
}

function immediateHemmingReactionForTask(task) {
  const key = hemmingTaskNarrativeKey(task);
  const outcome = hemmingTaskOutcomeKey(task);
  return HEMMING_IMMEDIATE_REACTION_TABLE[key]?.[outcome] || "";
}

function parentsReactionForHemming(completed, total, counts) {
  const strongWork = counts.perfect + counts.good;
  const weakWork = counts.bad + counts.okay;
  if (completed === 0) {
    return "Your parents keep their voices gentle, but the way they glance over the worn clothes says they are already counting what still will not hold.";
  }
  if (completed >= total && counts.perfect >= 2 && strongWork >= weakWork + 2) {
    return "Your parents run the hems between tired fingers and exchange a look of real relief. Your mother says these stitches might finally last, and your father agrees before the sentence is even finished.";
  }
  if (completed >= total && strongWork > weakWork) {
    return "Your parents inspect the repaired edges one by one, and the worry in their faces eases when they see how many of the seams will truly hold.";
  }
  if (counts.bad >= 2 || completed < total) {
    return "Your parents thank you first and worry second, speaking in hushed voices about which hems may need another pass before the week is over.";
  }
  return "Your parents are grateful for the work, but they keep smoothing the cloth flat against the table, checking each seam with the practiced caution of people used to making things last.";
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
  const basePeriodMs = 1200 - Math.min(280, gameState.currentDay * 38);
  const randomPeriodOffsetMs = (Math.random() * 260) - 130;
  const popup = randomHemmingTimingPopupRect();
  paintState.hemmingTiming = {
    active: true,
    taskIndex,
    stitchIndex: task.stitchesDone,
    startedAt: performance.now(),
    periodMs: Math.max(440, Math.round((basePeriodMs + randomPeriodOffsetMs) / minigameSpeedMultiplier())),
    target: 0.66 + Math.random() * 0.24,
    popupX: popup.x,
    popupY: popup.y,
    popupSize: popup.w,
  };
  paintPrompt.textContent = `Thread ready for ${task.label}. Click the time-stitch box when the moving marker lines up.`;
  return true;
}

function resolveHemmingTiming() {
  const timing = currentHemmingTimingState();
  if (!timing) return false;
  const task = gameState.hemmingTasks[timing.taskIndex];
  if (!task || task.stitchesDone >= task.stitchesNeeded) {
    paintState.hemmingTiming.active = false;
    paintState.hemmingTiming.popupX = 0;
    paintState.hemmingTiming.popupY = 0;
    return false;
  }

  const rawDiff = Math.abs(timing.phase - timing.target);
  const wrappedDiff = Math.min(rawDiff, 1 - rawDiff);
  const grade = timingGradeFromDiff(wrappedDiff);
  task.ratings.push(grade);
  task.stitchesDone = Math.min(task.stitchesNeeded, task.stitchesDone + 1);
  paintState.hemmingTiming.active = false;
  paintState.hemmingTiming.popupX = 0;
  paintState.hemmingTiming.popupY = 0;
  showTimingFeedback(grade, timing.popupX + timing.popupSize / 2, timing.popupY - 18);

  const gradeWord = grade === "perfect"
    ? "perfect"
    : grade === "good"
      ? "good"
      : grade === "okay"
        ? "okay"
        : "bad";
  let immediateReaction = "";
  if (task.stitchesDone >= task.stitchesNeeded) {
    paintPrompt.textContent = `${task.label} finished with ${taskHemmingQualityLabel(task).toLowerCase()} stitching.`;
    immediateReaction = immediateHemmingReactionForTask(task);
    if (immediateReaction) {
      mixPrompt.textContent = immediateReaction;
    }
  } else {
    paintPrompt.textContent = `${gradeWord.toUpperCase()} timing. Continue along ${task.label}.`;
  }

  updateHemmingStats();
  if (hemmingAllFinished()) {
    mixPrompt.textContent = immediateReaction
      ? `${immediateReaction} Every hem is stitched now. Finish chores when you're ready to head to bed.`
      : "Every hem is stitched. Finish chores when you're ready to head to bed.";
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
  paintState.hemmingTiming.popupX = 0;
  paintState.hemmingTiming.popupY = 0;
  paintState.hemmingTiming.popupSize = HEMMING_TIMING_WIDGET_SIZE;
  clearTimingFeedback();
  gameState.hemmingTasks = createHemmingTasks();
  hideWorkspaceBanner(true);
  minigameHeading.textContent = "Evening Hemming";
  paintPrompt.textContent = hemmingReflectionText();
  mixPrompt.textContent = "Click a stitch dot to start timing. A time-stitch box will pop up somewhere on the cloth; click it when the moving marker lines up for bad/okay/good/perfect quality. You can also skip the rest of the hemming if you need to head to bed.";
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
    if (pointInsideRect(x, y, hemmingTimingPopupRect())) {
      resolveHemmingTiming();
    } else {
      paintPrompt.textContent = "Watch the time-stitch box and click inside it when the moving marker lines up.";
    }
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
  const ellyTask = hemmingTaskByLabel("Elly");
  const dennyTask = hemmingTaskByLabel("Denny");
  const maggieTask = hemmingTaskByLabel("Maggie");

  let opening;
  if (health >= 80) {
    opening = "You carry the folded clothes into the next room while the house settles for the night.";
  } else if (health >= 50) {
    opening = "Your fingers ache by the time you set down the needle, but the pile of mending has thinned.";
  } else {
    opening = "You finish as much mending as you can with trembling hands and a jaw that will not stop throbbing.";
  }

  const perHem = gameState.hemmingTasks
    .map((task) => describeHemmingTaskAtHome(task))
    .join(" ");

  const counts = hemmingOverallGradeCounts();
  const parents = parentsReactionForHemming(completed, total, counts);
  const siblings = [
    siblingReactionForTask(ellyTask, "Elly", "school skirt"),
    siblingReactionForTask(dennyTask, "Denny", "shirt hem"),
    siblingReactionForTask(maggieTask, "Maggie", "apron"),
  ].join(" ");

  return `${opening} ${perHem} ${parents} ${siblings}`;
}

function showHomeScene(bodyText, summaryText) {
  resetDialogButtons();
  setDialogContent("At Home", bodyText);
  dialogButton.textContent = "Continue";
  dialogOverlay.classList.remove("hidden");
  gameState.postHomeSummary = summaryText;
  gameState.dialogMode = "post-home";
}

function showHomeSceneAfterShopping() {
  showHomeScene(groceryHomeSceneText(), groceryCartSummary());
}

function finishGroceriesTrip() {
  if (paintState.groceryTiming.active) {
    paintPrompt.textContent = "Finish the bargain already in motion before you leave the grocer.";
    drawWatchMinigame();
    return;
  }
  if (!paintState.groceryTiming.checkoutActive && groceryItemsPurchasedCount() > 0) {
    enterGroceryCheckout();
    drawWatchMinigame();
    return;
  }
  const savingsTenths = groceryCurrentSavingsTenths();
  if (savingsTenths > 0) {
    gameState.groceryFundsTenths += savingsTenths;
    paintState.groceryTiming.lastSavingsTenths = savingsTenths;
  }
  gameState.savedFundsTenths = Math.max(0, Math.round(gameState.groceryFundsTenths));
  closeMinigame();
  showHomeSceneAfterShopping();
  updateHud();
}

function finishHemmingTrip() {
  if (paintState.hemmingTiming.active) {
    paintState.hemmingTiming.active = false;
    paintState.hemmingTiming.taskIndex = -1;
    paintState.hemmingTiming.stitchIndex = -1;
    paintState.hemmingTiming.popupX = 0;
    paintState.hemmingTiming.popupY = 0;
    paintState.hemmingTiming.popupSize = HEMMING_TIMING_WIDGET_SIZE;
  }
  closeMinigame();
  showHomeScene(hemmingHomeSceneText(), hemmingSummary());
  updateHud();
}

function continueAfterDialog() {
  dialogOverlay.classList.add("hidden");
  resetDialogButtons();
  workerConversationState = null;
  hideShiftRecap();
  hideWorkspaceBanner(true);

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
  workerConversationState = null;
  stopShiftTicking();
  gameState.currentDay = 0;
  gameState.shiftActive = false;
  gameState.shiftEnded = false;
  gameState.shiftElapsed = 0;
  gameState.lastShiftProgress = 0;
  gameState.dialsPaintedToday = 0;
  gameState.watchesSubmittedToday = 0;
  gameState.dayEarningsCents = 0;
  gameState.dayPayDeductionsCents = 0;
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
  gameState.savedFundsTenths = 0;
  gameState.groceryBudgetTenths = 0;
  gameState.groceryFundsTenths = 0;
  gameState.groceryCart = {};
  gameState.groceryPurchasePrices = {};
  gameState.postShiftActivity = "groceries";
  gameState.postHomeSummary = "";
  gameState.hemmingTasks = [];
  gameState.workerProgress = buildDefaultWorkerProgress();
  gameState.handRestUnlocked = false;
  gameState.buttonHintState = buildDefaultButtonHintState();
  gameState.textLog = [];
  paintState.active = false;
  paintState.watchNumeralStyle = NUMERAL_STYLE_KEYS[0];
  paintState.restHandOnSide = false;
  paintState.groceryTiming.active = false;
  paintState.groceryTiming.itemId = "";
  paintState.groceryTiming.rowIndex = -1;
  paintState.groceryTiming.checkoutActive = false;
  paintState.groceryTiming.attemptsUsed = 0;
  paintState.groceryTiming.bestGrade = "";
  paintState.groceryTiming.bestProgress = 0;
  paintState.groceryTiming.lastGrade = "";
  paintState.groceryTiming.lastItemLabel = "";
  paintState.groceryTiming.lastSavingsTenths = 0;
  paintState.hemmingTiming.active = false;
  paintState.hemmingTiming.taskIndex = -1;
  paintState.hemmingTiming.stitchIndex = -1;
  paintState.hemmingTiming.popupX = 0;
  paintState.hemmingTiming.popupY = 0;
  paintState.hemmingTiming.popupSize = HEMMING_TIMING_WIDGET_SIZE;
  clearTimingFeedback();
  hideShiftRecap();
  hideWorkspaceBanner(true);
  showTitleCard();
  setMessage(
    "A new week begins at the line.",
    "Click into the room, then use the wall clock to begin Monday.",
  );
  updateHud();
}

function chooseRandomNumeralStyle(previousStyle = null) {
  const stylePool = NUMERAL_STYLE_KEYS.filter((styleKey) => styleKey !== previousStyle);
  const candidates = stylePool.length > 0 ? stylePool : NUMERAL_STYLE_KEYS;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] || NUMERAL_STYLE_KEYS[0];
}

const NUMERAL_SHEET_ROW_LAYOUTS = {
  numeralsStyleBlock: [10],
  numeralsStyleOrnate: [5, 5],
};

function groupNumeralComponentsByRow(components) {
  const sorted = [...components].sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
  const rows = [];
  for (const component of sorted) {
    const centerY = (component.minY + component.maxY) / 2;
    const compHeight = component.maxY - component.minY + 1;
    const last = rows[rows.length - 1];
    if (!last) {
      rows.push({ centerY, avgHeight: compHeight, items: [component] });
      continue;
    }
    const tolerance = Math.max(56, last.avgHeight * 0.72, compHeight * 0.72);
    if (Math.abs(centerY - last.centerY) > tolerance) {
      rows.push({ centerY, avgHeight: compHeight, items: [component] });
      continue;
    }
    const nextCount = last.items.length + 1;
    last.centerY = ((last.centerY * last.items.length) + centerY) / nextCount;
    last.avgHeight = ((last.avgHeight * last.items.length) + compHeight) / nextCount;
    last.items.push(component);
  }

  return rows.map((row) => ({
    ...row,
    items: [...row.items].sort((a, b) => a.minX - b.minX),
  }));
}

function selectNumeralTemplateComponents(styleKey, rows) {
  const layout = NUMERAL_SHEET_ROW_LAYOUTS[styleKey];
  if (layout) {
    const selected = [];
    for (let i = 0; i < layout.length && i < rows.length; i += 1) {
      selected.push(...rows[i].items.slice(0, layout[i]));
    }
    if (selected.length >= NUMERAL_SHEET_DIGITS.length) {
      return selected.slice(0, NUMERAL_SHEET_DIGITS.length);
    }
  }

  const ordered = [];
  for (const row of rows) {
    ordered.push(...row.items);
    if (ordered.length >= NUMERAL_SHEET_DIGITS.length) break;
  }
  return ordered.slice(0, NUMERAL_SHEET_DIGITS.length);
}

function extractNumeralTemplates(styleKey) {
  if (numeralTemplateCache[styleKey] === false) return null;
  if (numeralTemplateCache[styleKey]) return numeralTemplateCache[styleKey];
  const image = assetImages[styleKey];
  if (!imageReady(image)) return null;

  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const offCtx = offscreen.getContext("2d");
  let data;
  try {
    offCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    ({ data } = offCtx.getImageData(0, 0, offscreen.width, offscreen.height));
  } catch (error) {
    numeralTemplateCache[styleKey] = false;
    console.warn(`Numeral template extraction disabled for ${styleKey}; using built-in fallback numerals instead.`, error);
    return null;
  }
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

  const rows = groupNumeralComponentsByRow(components);
  const ordered = selectNumeralTemplateComponents(styleKey, rows);
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
    restHandOnSide: paintState.restHandOnSide,
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
  paintState.restHandOnSide = Boolean(saved.restHandOnSide) && gameState.handRestUnlocked;
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
  paintState.showCoverageAssist = false;
  paintState.paintLoaded = MAX_PAINT_LOAD;
  zoomCursorToDial(index);
  paintPrompt.textContent = `The ${dial.label} fills the dark. Paint inside the faint guide while the brush still holds paint.`;
  advanceTutorialStep("zoom");
  updatePaintStats();
  drawWatchMinigame();
}

function exitDialZoom(message = "You pull back from the numeral to survey the full watch face.") {
  paintState.showCoverageAssist = false;
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
  syncStationButtonHighlights();
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
  paintState.restHandOnSide = false;
  gameState.tutorialSeen = true;
  hideWorkspaceBanner(true);
  setTutorialStep(0);
  drawWatchMinigame();
}

function closeTutorialMinigame(
  primary = "The woman at the center bench gives a short nod.",
  secondary = "\"Good. That's a finished face. Clock in at the wall clock when you're ready for the real shift.\"",
) {
  paintState.tutorial = null;
  closeMinigame();
  setMessage(primary, secondary);
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
  paintState.restHandOnSide = false;
  paintState.draggedPieceIndex = -1;
  paintState.pointerX = paintCanvas.width / 2;
  paintState.pointerY = paintCanvas.height / 2;
  paintState.lastPointerMoveAt = performance.now();
  paintState.cursorX = paintCanvas.width / 2;
  paintState.cursorY = paintCanvas.height / 2;
  initializeFracturePieces();
  hideWorkspaceBanner(true);
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

function safeExitPointerLock() {
  const exitPointerLock =
    document.exitPointerLock
    || document.mozExitPointerLock
    || document.webkitExitPointerLock;
  if (typeof exitPointerLock !== "function") return;
  try {
    exitPointerLock.call(document);
  } catch (error) {
    // Ignore browser-specific pointer lock exit failures in external file contexts.
  }
}

function openMinigame(label) {
  paintState.active = true;
  paintState.mode = "watch";
  paintState.tableLabel = label;
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "mix";
  paintState.showCoverageAssist = false;
  paintState.thoughtPopup = null;
  paintState.tutorial = null;
  paintState.autoSubmitTimer = -1;
  paintState.nextThoughtTimer = nextThoughtDelay();
  if (!restoreBenchWork(label)) {
    paintState.watchIndex += 1;
    paintState.brushSize = DEFAULT_BRUSH_SIZE;
    paintState.watchNumeralStyle = chooseRandomNumeralStyle(paintState.watchNumeralStyle);
    paintState.paintLoaded = 0;
    paintState.restHandOnSide = false;
    paintState.zoomedDialIndex = -1;
    paintState.readyToSubmit = false;
    resetMix();
    buildDialState();
    moveCursorToActiveDial();
  }
  minigameHeading.textContent = "Watch Painting";
  setStationControlsHidden(false);
  minigameOverlay.classList.remove("hidden");
  safeExitPointerLock();

  paintPrompt.textContent =
    "Mix the paint in the dish, then click one of the gray numeral markers to open that spot in close view and paint inside the guide lines.";
  mixPrompt.textContent = mixTextureFeedback();
  updatePaintStats();
  drawWatchMinigame();
  showWorkspaceMemoryBanner();
}

function closeMinigame() {
  saveCurrentBenchWork();
  paintState.active = false;
  paintState.isPainting = false;
  paintState.correcting = false;
  paintState.tool = "mix";
  paintState.showCoverageAssist = false;
  paintState.mode = "watch";
  paintState.zoomedDialIndex = -1;
  paintState.paintLoaded = 0;
  paintState.restHandOnSide = false;
  paintState.thoughtPopup = null;
  paintState.tutorial = null;
  paintState.autoSubmitTimer = -1;
  paintState.fracturePieces = [];
  paintState.draggedPieceIndex = -1;
  paintState.groceryTiming.active = false;
  paintState.groceryTiming.checkoutActive = false;
  paintState.groceryTiming.attemptsUsed = 0;
  paintState.groceryTiming.bestGrade = "";
  paintState.groceryTiming.bestProgress = 0;
  clearTimingFeedback();
  minigameHeading.textContent = "Watch Painting";
  setStationControlsHidden(false);
  paintCanvas.style.cursor = "none";
  hideInfoCanvas();
  hideWorkspaceBanner(true);
  minigameOverlay.classList.add("hidden");
}

function allDialsReady() {
  return paintState.dials.length > 0 && paintState.dials.every(dialCountsAsPainted);
}

function ensureDialPaintLevel(dial) {
  if (!dial.paintLevel || dial.paintLevel.length !== dial.paintedMask.length) {
    dial.paintLevel = dial.paintedMask.map((painted) => (painted ? PAINT_POINT_COMPLETE : 0));
  }
}

function recalculateDialCoverage(dial) {
  ensureDialPaintLevel(dial);
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
}

function trimDialEdgeNoise(dial, sealed = false) {
  if (!dial || !dial.strayPoints || dial.strayPoints.length === 0) return;
  const before = dial.strayPoints.length;
  const baseTolerance = sealed ? 7.4 : 4.6;
  const radiusScale = sealed ? 0.94 : 0.38;
  dial.strayPoints = dial.strayPoints.filter((mark) => {
    const markRadius = Math.max(0.8, mark.r || 0);
    const distanceToGuide = nearestGuideDistance(dial.targetPoints, mark.x, mark.y);
    return distanceToGuide > baseTolerance + markRadius * radiusScale;
  });
  const removed = before - dial.strayPoints.length;
  if (removed > 0) {
    const cleanupCredit = sealed ? 0.016 : 0.01;
    dial.mess = Math.max(0, dial.mess - (removed * cleanupCredit));
  }
}

function computeDialStraySeverity(dial) {
  const marks = Array.isArray(dial?.strayPoints) ? dial.strayPoints : [];
  if (marks.length === 0) return 0;
  let severity = 0;
  for (const mark of marks) {
    const markRadius = Math.max(0.8, mark.r || 0);
    const distanceToGuide = nearestGuideDistance(dial.targetPoints, mark.x, mark.y);
    const edgeAllowance = 4.5 + markRadius * 0.58;
    const overspill = Math.max(0, distanceToGuide - edgeAllowance);
    if (overspill <= 0.35) continue;
    const alphaWeight = Math.max(0.45, mark.a || 0.7);
    const radiusWeight = 0.5 + Math.min(0.8, markRadius * 0.08);
    severity += overspill * alphaWeight * radiusWeight;
  }
  return severity;
}

function visibleSpillCount(dial, minOverspill = 0.85, minRadius = 0) {
  const marks = Array.isArray(dial?.strayPoints) ? dial.strayPoints : [];
  if (marks.length === 0) return 0;
  let count = 0;
  for (const mark of marks) {
    const markRadius = Math.max(0.8, mark.r || 0);
    if (markRadius < minRadius) continue;
    const distanceToGuide = nearestGuideDistance(dial.targetPoints, mark.x, mark.y);
    const edgeAllowance = 4.5 + markRadius * 0.58;
    const overspill = Math.max(0, distanceToGuide - edgeAllowance);
    if (overspill >= minOverspill) count += 1;
  }
  return count;
}

function correctionHotspotsForDial(dial, limit = 6) {
  if (!dial) return [];
  const guidePoints = dialRenderPoints(dial);
  const strayPoints = strayRenderPoints(dial);
  if (!guidePoints || guidePoints.length === 0 || strayPoints.length === 0) return [];

  const zoomed = paintState.zoomedDialIndex !== -1;
  const hotspots = [];

  for (const mark of strayPoints) {
    const markRadius = Math.max(0.8, mark.r || 0);
    const distanceToGuide = nearestGuideDistance(guidePoints, mark.x, mark.y);
    const edgeAllowance = (zoomed ? 6.1 : 4.8) + markRadius * (zoomed ? 0.72 : 0.58);
    const overspill = Math.max(0, distanceToGuide - edgeAllowance);
    if (overspill < 0.62) continue;
    const alphaWeight = Math.max(0.45, mark.a || 0.7);
    const score = overspill * alphaWeight * (0.74 + Math.min(1.2, markRadius * 0.12));
    hotspots.push({
      x: mark.x,
      y: mark.y,
      r: markRadius,
      overspill,
      score,
    });
  }

  hotspots.sort((a, b) => b.score - a.score);
  return hotspots.slice(0, limit);
}

function smoothDialShapeOnLock(dial) {
  ensureDialPaintLevel(dial);
  const points = dial.targetPoints;
  if (!points || points.length === 0) return;

  const count = points.length;
  const bounds = pointBounds(points);
  const span = Math.max(1, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
  const spacing = Math.max(3.2, Math.sqrt((span * span) / Math.max(1, count)));
  const neighborRadius = Math.max(7, spacing * 2.05);
  const neighborRadiusSq = neighborRadius * neighborRadius;
  const neighbors = Array.from({ length: count }, () => []);

  for (let i = 0; i < count; i += 1) {
    const pi = points[i];
    for (let j = i + 1; j < count; j += 1) {
      const pj = points[j];
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      if ((dx * dx) + (dy * dy) <= neighborRadiusSq) {
        neighbors[i].push(j);
        neighbors[j].push(i);
      }
    }
  }

  let levels = dial.paintLevel.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    const next = levels.slice();
    for (let i = 0; i < count; i += 1) {
      const near = neighbors[i];
      if (near.length === 0) continue;
      let sum = levels[i];
      let nearCovered = 0;
      for (const index of near) {
        const value = levels[index];
        sum += value;
        if (value >= PAINT_POINT_SOFT_COVERAGE_THRESHOLD) nearCovered += 1;
      }
      const average = sum / (near.length + 1);
      const coverRatio = nearCovered / near.length;
      let blended = levels[i] * 0.68 + average * 0.32;
      if (coverRatio > 0.78 && blended < PAINT_POINT_COVERAGE_THRESHOLD) {
        blended = Math.max(blended, PAINT_POINT_COVERAGE_THRESHOLD * 0.97);
      } else if (coverRatio < 0.24 && blended > PAINT_POINT_COVERAGE_THRESHOLD) {
        blended = Math.min(blended, PAINT_POINT_COVERAGE_THRESHOLD * 0.88);
      }
      next[i] = Math.max(0, Math.min(PAINT_POINT_COMPLETE, blended));
    }
    levels = next;
  }

  dial.paintLevel = levels;
  for (let i = 0; i < count; i += 1) {
    const near = neighbors[i];
    const level = dial.paintLevel[i];
    if (level >= PAINT_POINT_COVERAGE_THRESHOLD) {
      dial.paintedMask[i] = true;
      continue;
    }
    let paintedNeighbors = 0;
    for (const index of near) {
      if (dial.paintLevel[index] >= PAINT_POINT_COVERAGE_THRESHOLD * 0.92) paintedNeighbors += 1;
    }
    const nearRatio = near.length > 0 ? paintedNeighbors / near.length : 0;
    if (level >= PAINT_POINT_SOFT_COVERAGE_THRESHOLD && nearRatio >= 0.64) {
      dial.paintedMask[i] = true;
      dial.paintLevel[i] = Math.max(level, PAINT_POINT_COVERAGE_THRESHOLD * 0.95);
    } else {
      dial.paintedMask[i] = false;
    }
  }

  for (let i = 0; i < count; i += 1) {
    if (dial.paintedMask[i]) continue;
    const near = neighbors[i];
    if (near.length < 3) continue;
    let paintedNeighbors = 0;
    for (const index of near) {
      if (dial.paintedMask[index]) paintedNeighbors += 1;
    }
    if (paintedNeighbors / near.length >= 0.86) {
      dial.paintedMask[i] = true;
      dial.paintLevel[i] = Math.max(dial.paintLevel[i], PAINT_POINT_COVERAGE_THRESHOLD * 0.95);
    }
  }

  const visited = new Uint8Array(count);
  const stack = [];
  for (let i = 0; i < count; i += 1) {
    if (visited[i] || !dial.paintedMask[i]) continue;
    const component = [];
    stack.push(i);
    visited[i] = 1;
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const index of neighbors[current]) {
        if (visited[index] || !dial.paintedMask[index]) continue;
        visited[index] = 1;
        stack.push(index);
      }
    }
    if (component.length <= 2) {
      for (const index of component) {
        dial.paintedMask[index] = false;
        dial.paintLevel[index] = Math.min(dial.paintLevel[index], PAINT_POINT_SOFT_COVERAGE_THRESHOLD * 0.8);
      }
    }
  }

  trimDialEdgeNoise(dial, true);
  dial.mess = Math.max(0, dial.mess * 0.72);
}

function dialNeedsCorrection(dial) {
  if (dial.coverage < 0.9) return false;
  const hotspots = correctionHotspotsForDial(dial, 10);
  const visibleSpills = hotspots.length;
  if (visibleSpills === 0) return false;
  const visibleLargeSpills = hotspots.filter((hotspot) => hotspot.overspill >= 1.24 && hotspot.r >= 5.5).length;
  const visibleMediumSpills = hotspots.filter((hotspot) => hotspot.overspill >= 0.86).length;
  const straySeverity = Number.isFinite(dial.straySeverity)
    ? dial.straySeverity
    : computeDialStraySeverity(dial);
  const messThreshold = 0.31;
  const severityThreshold = 10.2;
  return (
    dial.mess > messThreshold
    || straySeverity > severityThreshold
    || visibleLargeSpills >= 3
    || visibleMediumSpills >= 5
    || (visibleSpills >= 3 && straySeverity > 5.8)
  );
}

function wipeHealthCostForDial(dial) {
  if (!dial) return 0;
  const visibleSpills = visibleSpillCount(dial, 0.45);
  const visibleLargeSpills = visibleSpillCount(dial, 1.12, 5.2);
  const straySeverity = Number.isFinite(dial.straySeverity)
    ? dial.straySeverity
    : computeDialStraySeverity(dial);
  const mess = Math.max(0, dial.mess || 0);

  const load =
    Math.min(1, visibleSpills / 10) * 0.42 +
    Math.min(1, visibleLargeSpills / 4) * 0.28 +
    Math.min(1, straySeverity / 13.5) * 0.2 +
    Math.min(1, mess / 0.5) * 0.1;

  return Math.min(3, Math.max(0.25, load * 3));
}

function correctionCount() {
  return paintState.dials.filter(dialNeedsCorrection).length;
}

function coverageHotspotsForDial(dial, limit = 8) {
  if (!dial) return [];
  const points = dialRenderPoints(dial);
  if (!points || points.length === 0) return [];
  ensureDialPaintLevel(dial);

  const candidates = [];
  for (let i = 0; i < points.length; i += 1) {
    const level = Math.max(0, Math.min(PAINT_POINT_COMPLETE, dial.paintLevel[i] || 0));
    const missing = PAINT_POINT_COVERAGE_THRESHOLD - level;
    if (missing < 0.08) continue;
    candidates.push({
      x: points[i].x,
      y: points[i].y,
      score: missing + (dial.paintedMask[i] ? 0 : 0.18),
      radius: 10 + missing * 18,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const hotspots = [];
  const minSpacing = paintState.zoomedDialIndex !== -1 ? 30 : 18;
  for (const candidate of candidates) {
    if (hotspots.every((existing) => Math.hypot(existing.x - candidate.x, existing.y - candidate.y) >= minSpacing)) {
      hotspots.push(candidate);
      if (hotspots.length >= limit) break;
    }
  }
  return hotspots;
}

function updateCheckNumeralButton() {
  if (!checkNumeralButton) return;
  const zoomedWatch = paintState.active && paintState.mode === "watch" && paintState.zoomedDialIndex !== -1;
  checkNumeralButton.classList.toggle("active", zoomedWatch && paintState.showCoverageAssist);
}

function canUseRestHandSupport() {
  return gameState.handRestUnlocked
    && gameState.currentDay >= 1
    && paintState.mode === "watch"
    && !paintState.tutorial;
}

function restHandAssistStrength() {
  if (!canUseRestHandSupport() || !paintState.active || paintState.zoomedDialIndex === -1 || !paintState.restHandOnSide) {
    return 0;
  }

  const severity = paintingDriftStrength();
  if (severity <= 0) return 0;
  return Math.min(0.85, 0.4 + severity * 0.45);
}

function watchShiftTimeAdvanceMultiplier() {
  const assist = restHandAssistStrength();
  if (assist <= 0) return 1;
  return 1 + assist * (0.35 + paintingDriftStrength() * 0.85);
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
  const handText = canUseRestHandSupport()
    ? ` Hand ${paintState.restHandOnSide ? "braced" : "free"}.`
    : "";
  const reliefRate = !paintState.tutorial && gameState.shiftActive ? familiarityHealthDiscountRate() : 0;
  const reliefText = reliefRate > 0 ? ` Bench relief ${Math.round(reliefRate * 100)}%.` : "";
  paintStats.textContent =
    `Mix quality ${mixPercent}%. Paid dials today ${gameState.dialsPaintedToday}. Corrections needed ${correctionNeeded}. Tool ${paintState.tool}. Brush ${brushState}.${currentDialText}${handText}${reliefText}`;
  mixPrompt.textContent = mixTextureFeedback();
  correctButton.classList.toggle("active", paintState.tool === "nail");
  if (restHandButton) {
    restHandButton.classList.toggle("hidden", !canUseRestHandSupport());
    restHandButton.classList.toggle("active", canUseRestHandSupport() && paintState.restHandOnSide);
  }
  updateCheckNumeralButton();
  syncStationButtonHighlights();
}

function spendHealth(amount) {
  if (paintState.tutorial) return;
  const reduction = familiarityHealthDiscountRate();
  const adjustedAmount = Math.max(0.05, amount * (1 - reduction));
  const previousHealth = gameState.hiddenStats.health;
  gameState.hiddenStats.health = Math.max(0, gameState.hiddenStats.health - adjustedAmount);
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

function toggleCheckNumeralGuide() {
  if (!paintState.active || paintState.mode !== "watch") return;
  const dial = activeDial();
  if (paintState.zoomedDialIndex === -1 || !dial) {
    paintPrompt.textContent = "Open a numeral first, then use Check numeral to see where it still needs another pass.";
    updatePaintStats();
    drawWatchMinigame();
    return;
  }
  if (dial.locked || dial.coverage >= 0.995) {
    paintState.showCoverageAssist = false;
    paintPrompt.textContent = dialNeedsCorrection(dial)
      ? "Coverage is there already. What remains is cleanup around the edge."
      : `Numeral ${dial.label} is already fully covered.`;
    updatePaintStats();
    drawWatchMinigame();
    return;
  }

  paintState.showCoverageAssist = !paintState.showCoverageAssist;
  if (paintState.showCoverageAssist) {
    const hotspots = coverageHotspotsForDial(dial, 7);
    paintPrompt.textContent = hotspots.length > 0
      ? "Check numeral marks the dimmer gaps that still need another pass of paint."
      : "This numeral is already carrying enough paint across the guide.";
  } else {
    paintPrompt.textContent = `The ${dial.label} fills the dark. Paint inside the faint guide while the brush still holds paint.`;
  }
  updatePaintStats();
  drawWatchMinigame();
}

function prepareNextWatch(message) {
  clearBenchWork();
  paintState.correcting = false;
  paintState.tool = "mix";
  paintState.showCoverageAssist = false;
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
  showWorkspaceMemoryBanner();
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
  const hitLimit = currentBrushPaintRadius() + (paintState.zoomedDialIndex === -1 ? 10 : 16);

  const dialSet = paintState.zoomedDialIndex === -1
    ? paintState.dials.filter((dial) => !dial.locked)
    : [activeDial()].filter((dial) => dial && !dial.locked);

  for (const dial of dialSet) {
    const renderPoints = dialRenderPoints(dial);
    for (let i = 0; i < renderPoints.length; i += 1) {
      const point = renderPoints[i];
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance > hitLimit) continue;
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
    playCompletionBell();
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

function currentBrushPaintRadius() {
  if (paintState.zoomedDialIndex === -1) {
    return Math.max(5, paintState.brushSize * 8);
  }
  return Math.max(5, paintState.brushSize * 28);
}

function drawDialPaint(dial, zoomed = false) {
  const points = dialRenderPoints(dial);
  const tone = paintTone();
  const lineWidth = zoomed ? 18 : 6.4;
  const dotRadius = zoomed ? 7.4 : 2.9;
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
  const mixQuality = Math.max(0, Math.min(1, paintState.mixQuality));
  const usesOpacityFalloff = mixQuality < 0.9995;
  const mixOpacity = usesOpacityFalloff ? (0.28 + mixQuality * 0.72) : 1;
  for (let i = 0; i < points.length; i += 1) {
    const pointLevel = Math.max(0, Math.min(PAINT_POINT_COMPLETE, levelSet[i] || 0));
    if (pointLevel <= 0) continue;
    const point = points[i];
    const opacity = usesOpacityFalloff
      ? Math.max(0.08, Math.min(1, (pointLevel / PAINT_POINT_COMPLETE) * mixOpacity))
      : 1;
    paintCtx.save();
    paintCtx.globalAlpha = opacity;
    paintCtx.beginPath();
    paintCtx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    paintCtx.fill();
    paintCtx.restore();
  }

  if (cloudGuide && dial.locked) {
    paintCtx.save();
    paintCtx.globalAlpha = zoomed ? 0.28 : 0.22;
    paintCtx.filter = zoomed ? "blur(0.9px)" : "blur(0.35px)";
    paintCtx.fillStyle = tone.fill;
    const sealRadius = dotRadius * (zoomed ? 0.96 : 0.82);
    for (let i = 0; i < points.length; i += 1) {
      if (!dial.paintedMask[i]) continue;
      const point = points[i];
      paintCtx.beginPath();
      paintCtx.arc(point.x, point.y, sealRadius, 0, Math.PI * 2);
      paintCtx.fill();
    }
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

function analyzeBrushFootprint(renderPoints, x, y, hitRadius) {
  if (!renderPoints || renderPoints.length === 0) {
    return { ratio: 1, outsideSamples: [] };
  }

  const zoomed = paintState.zoomedDialIndex !== -1;
  const spreadPenalty = Math.max(0, (paintState.brushSize - BRUSH_ROUGH_THRESHOLD) / Math.max(0.001, MAX_BRUSH_SIZE - BRUSH_ROUGH_THRESHOLD));
  const ringSampleCount = zoomed ? 22 : 18;
  const ringConfigs = zoomed
    ? [
      { factor: 0.56, weight: 0.8 },
      { factor: 0.76, weight: 1 },
      { factor: 0.92, weight: 1.45 },
      { factor: 1.04 + spreadPenalty * 0.08, weight: 1.95 + spreadPenalty * 0.4 },
      { factor: 1.16 + spreadPenalty * 0.14, weight: 2.45 + spreadPenalty * 0.8 },
    ]
    : [
      { factor: 0.6, weight: 0.8 },
      { factor: 0.8, weight: 1 },
      { factor: 0.96, weight: 1.35 },
      { factor: 1.05 + spreadPenalty * 0.06, weight: 1.75 + spreadPenalty * 0.35 },
      { factor: 1.12 + spreadPenalty * 0.1, weight: 2.1 + spreadPenalty * 0.6 },
    ];
  let outsideCount = 0;
  let sampleCount = 0;
  const outsideSamples = [];

  for (const ring of ringConfigs) {
    const ringRadius = hitRadius * ring.factor;
    const tolerance = Math.max(
      zoomed ? 2.4 : 1.35,
      (zoomed ? 5.2 : 2.45) + (1 - ring.factor) * (zoomed ? 7 : 2.8) - spreadPenalty * (zoomed ? 1.85 : 0.75)
    );
    for (let i = 0; i < ringSampleCount; i += 1) {
      const angle = (Math.PI * 2 * i) / ringSampleCount;
      const sampleX = x + Math.cos(angle) * ringRadius;
      const sampleY = y + Math.sin(angle) * ringRadius;
      const distanceToGuide = nearestGuideDistance(renderPoints, sampleX, sampleY);
      const overspill = distanceToGuide - tolerance;
      sampleCount += ring.weight;
      if (overspill <= 0) continue;
      outsideCount += ring.weight * (1 + Math.min(1.4, overspill * (zoomed ? 0.16 : 0.24)));
      if (ring.factor >= 0.9 || overspill >= (zoomed ? 1.2 : 0.7)) {
        outsideSamples.push({
          x: sampleX,
          y: sampleY,
          overspill,
          ringFactor: ring.factor,
        });
      }
    }
  }

  outsideSamples.sort((a, b) => b.overspill - a.overspill);
  const spacedSamples = [];
  const spacingThreshold = zoomed ? 16 : 6;
  for (const sample of outsideSamples) {
    const tooClose = spacedSamples.some((kept) => Math.hypot(kept.x - sample.x, kept.y - sample.y) < spacingThreshold);
    if (tooClose) continue;
    spacedSamples.push(sample);
    if (spacedSamples.length >= (zoomed ? 12 : 7)) break;
  }

  return {
    ratio: sampleCount === 0 ? 0 : Math.min(1, outsideCount / sampleCount),
    outsideSamples: spacedSamples,
  };
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

  const hitRadius = currentBrushPaintRadius();
  const spreadPenalty = Math.max(0, (paintState.brushSize - BRUSH_ROUGH_THRESHOLD) / Math.max(0.001, MAX_BRUSH_SIZE - BRUSH_ROUGH_THRESHOLD));
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

  const strictRadius = Math.max(4, hitRadius * (0.65 - spreadPenalty * 0.18));
  if (hit.distance > strictRadius) {
    offGuidePoints += 1;
  }
  const footprint = analyzeBrushFootprint(renderPoints, x, y, hitRadius);
  const overflowRatio = footprint.ratio;
  const overflowTrigger = Math.max(0.055, 0.15 - spreadPenalty * 0.062);
  if (overflowRatio > overflowTrigger || footprint.outsideSamples.length >= (paintState.zoomedDialIndex === -1 ? 3 : 4)) {
    const overflowSeverity = Math.max(0, (overflowRatio - overflowTrigger) / Math.max(0.001, 1 - overflowTrigger));
    offGuidePoints += Math.max(
      1,
      Math.round(
        overflowRatio * 4
        + overflowSeverity * 3
        + spreadPenalty * 2
        + footprint.outsideSamples.length * (paintState.zoomedDialIndex === -1 ? 0.45 : 0.72)
      )
    );
  }

  const centerFactor = Math.max(0.78, 1 - hit.distance / (paintState.zoomedDialIndex === -1 ? 52 : 84));
  if (paintedPoints > 0) {
    hit.dial.mess += 0.002 + (1 - paintState.mixQuality) * 0.012 + (1 - centerFactor) * 0.006;
  } else if (overlapPoints === 0) {
    hit.dial.mess += 0.008 + (1 - paintState.mixQuality) * 0.018;
  }
  if (spreadPenalty > 0 && paintedPoints > 0) {
    hit.dial.mess += (paintState.zoomedDialIndex === -1 ? 0.011 : 0.019) * spreadPenalty;
  }
  if (offGuidePoints > 0) {
    const spillSamples = footprint.outsideSamples.length > 0
      ? footprint.outsideSamples
      : [{ x, y, overspill: Math.max(1, overflowRatio * 10), ringFactor: 1 }];
    for (const sample of spillSamples) {
      const dirX = sample.x - x;
      const dirY = sample.y - y;
      const dirLength = Math.hypot(dirX, dirY) || 1;
      const push = (paintState.zoomedDialIndex === -1 ? 0.8 : 2.2) + sample.overspill * (paintState.zoomedDialIndex === -1 ? 0.2 : 0.55);
      const spillX = sample.x + (dirX / dirLength) * push;
      const spillY = sample.y + (dirY / dirLength) * push;
      const worldPoint = worldPointForDial(hit.dial, spillX, spillY);
      hit.dial.strayPoints.push({
        x: worldPoint.x,
        y: worldPoint.y,
        r: (paintState.zoomedDialIndex === -1 ? 1.4 : 2.8)
          + Math.min(paintState.zoomedDialIndex === -1 ? 1.6 : 3.6, sample.overspill * (paintState.zoomedDialIndex === -1 ? 0.28 : 0.58))
          + spreadPenalty * (paintState.zoomedDialIndex === -1 ? 0.2 : 0.85),
        a: Math.min(0.98, 0.72 + sample.overspill * 0.08),
      });
    }
    while (hit.dial.strayPoints.length > 96) hit.dial.strayPoints.shift();
    hit.dial.mess +=
      0.021 +
      overflowRatio * (0.096 + spreadPenalty * 0.082) +
      Math.min(0.16, spillSamples.length * 0.012) +
      spreadPenalty * 0.05 +
      (1 - paintState.mixQuality) * 0.022;
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

  gameState.hiddenStats.fingernailUses += 1;
  spendHealth(0.2);

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
  const healthCost = wipeHealthCostForDial(target);
  spendHealth(healthCost);
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
    ensureDialPaintLevel(dial);
    trimDialEdgeNoise(dial);
    recalculateDialCoverage(dial);
    dial.straySeverity = computeDialStraySeverity(dial);
    if (!dial.locked && dialCountsAsPainted(dial)) {
      smoothDialShapeOnLock(dial);
      recalculateDialCoverage(dial);
      dial.straySeverity = computeDialStraySeverity(dial);
      if (dialCountsAsPainted(dial)) {
        dial.locked = true;
        if (paintState.zoomedDialIndex === dialIndex) {
          paintPrompt.textContent = `Numeral ${dial.label} is complete and sealed.`;
        }
      }
    }
  }
  updateActiveDialIndex();
}

function updateAutoSubmit(dt) {
  if (!paintState.active || paintState.mode !== "watch") {
    paintState.autoSubmitTimer = -1;
    return;
  }

  if (paintState.tutorial) {
    paintState.autoSubmitTimer = -1;
    if (allDialsReady() && correctionCount() === 0) {
      closeTutorialMinigame(
        "The woman at the center bench steps back from your shoulder.",
        "\"Good. You know the process now. Clock in at the wall clock and begin your day.\"",
      );
    }
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
  const usedCorrections = paintState.dials.some((dial) => dial.corrected);
  const correctionFine = usedCorrections ? IGNORE_CORRECTION_FINE_CENTS : 0;
  gameState.watchesSubmittedToday += 1;
  if (correctionFine > 0) {
    gameState.dayPayDeductionsCents += correctionFine;
    gameState.dayEarningsCents -= correctionFine;
    gameState.totalEarningsCents -= correctionFine;
  }
  clearBenchWork();

  if (correctionFine > 0) {
    paintPrompt.textContent =
      `The watch is sent in. ${paidNow} dial${paidNow === 1 ? "" : "s"} counted, but the reworked edges cost you ${formatCurrency(correctionFine)} from the envelope.`;
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
  paintState.brushSize = Math.min(MAX_BRUSH_SIZE, paintState.brushSize + (0.001675 * minigameSpeedMultiplier()));
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
  const groceryTiming = currentGroceryTimingState();
  const checkoutActive = paintState.groceryTiming.checkoutActive;
  const cartTotal = groceryCartBaseTotalTenths();
  const projectedSavings = groceryCurrentSavingsTenths();

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
    const timingHere = groceryTiming && groceryTiming.rowIndex === i;

    paintCtx.fillStyle = timingHere
      ? "rgba(217, 245, 122, 0.14)"
      : affordable
        ? "rgba(255,255,255,0.08)"
        : "rgba(120,80,80,0.18)";
    paintCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    paintCtx.strokeStyle = timingHere
      ? "rgba(217, 245, 122, 0.56)"
      : affordable
        ? "rgba(255,255,255,0.18)"
        : "rgba(180,110,110,0.28)";
    paintCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    paintCtx.fillStyle = "#f5f5f5";
    paintCtx.fillText(`${item.label} (${item.unit})`, rect.x + 68, rect.y + rect.h / 2);
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
      const usable = enabled && !checkoutActive;
      paintCtx.fillStyle = usable ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)";
      paintCtx.fillRect(box.x, box.y, box.w, box.h);
      paintCtx.strokeStyle = usable ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
      paintCtx.strokeRect(box.x, box.y, box.w, box.h);
      paintCtx.fillStyle = usable ? "#f5f5f5" : "rgba(255,255,255,0.34)";
      paintCtx.fillText(symbol, box.x + box.w / 2, box.y + box.h / 2 + 1);
    }

    paintCtx.textAlign = "left";
  }

  const circle = groceryTimingCircle();
  paintCtx.save();
  paintCtx.fillStyle = "rgba(8, 8, 8, 0.54)";
  paintCtx.fillRect(26, 204, 244, 250);
  paintCtx.strokeStyle = "rgba(255,255,255,0.14)";
  paintCtx.strokeRect(26, 204, 244, 250);
  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.fillStyle = "rgba(255,255,255,0.9)";
  paintCtx.font = "22px Georgia";
  paintCtx.fillText(checkoutActive ? "CHECKOUT" : "BASKET", 148, 232);
  paintCtx.font = "14px Georgia";
  paintCtx.fillStyle = "rgba(255,255,255,0.8)";
  paintCtx.fillText(`Marked total: ${formatGroceryAmount(cartTotal)}`, 148, 266);
  if (checkoutActive) {
    paintCtx.fillText(groceryCheckoutStatusText(), 148, 292);
    if (paintState.groceryTiming.bestGrade) {
      paintCtx.fillText(`Projected savings: ${formatTenthsCents(projectedSavings)}`, 148, 318);
      paintCtx.fillText(`Pay after bargain: ${formatGroceryAmount(Math.max(0, cartTotal - projectedSavings))}`, 148, 344);
    } else {
      paintCtx.fillText("No bargain saved yet.", 148, 318);
      paintCtx.fillText("Pay now to accept the marked total.", 148, 344);
    }

    paintCtx.strokeStyle = "rgba(255,255,255,0.1)";
    paintCtx.lineWidth = 1.5;
    paintCtx.beginPath();
    paintCtx.arc(circle.x, circle.y, circle.maxRadius, 0, Math.PI * 2);
    paintCtx.stroke();
    paintCtx.strokeStyle = "rgba(217, 245, 122, 0.38)";
    paintCtx.setLineDash([4, 4]);
    paintCtx.beginPath();
    paintCtx.arc(circle.x, circle.y, circle.targetRadius, 0, Math.PI * 2);
    paintCtx.stroke();
    paintCtx.setLineDash([]);
    paintCtx.fillStyle = "rgba(255,255,255,0.25)";
    paintCtx.beginPath();
    paintCtx.arc(circle.x, circle.y, 2.4, 0, Math.PI * 2);
    paintCtx.fill();

    if (groceryTiming && groceryTiming.active) {
      paintCtx.strokeStyle = "rgba(246, 255, 197, 0.96)";
      paintCtx.lineWidth = 3;
      paintCtx.beginPath();
      paintCtx.arc(groceryTiming.x, groceryTiming.y, groceryTiming.outerRadius, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.strokeStyle = "rgba(255, 226, 146, 0.92)";
      paintCtx.lineWidth = 2;
      paintCtx.setLineDash([4, 3]);
      paintCtx.beginPath();
      paintCtx.arc(groceryTiming.x, groceryTiming.y, groceryTiming.targetRadius, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.setLineDash([]);
      paintCtx.fillStyle = "rgba(255,255,255,0.8)";
      paintCtx.fillText("hit the middle ring", 148, 416);
    } else {
      paintCtx.fillStyle = "rgba(255,255,255,0.76)";
      paintCtx.fillText("Best result sticks. You can try up to three times.", 148, 416);
    }
  } else {
    paintCtx.fillText("Build the basket first, then decide whether to bargain at checkout.", 148, 306);
    paintCtx.fillText("Removing items will not restore spent bargain attempts.", 148, 334);
  }
  paintCtx.restore();

  const finish = groceryFinishRect();
  const finishLabel = checkoutActive
    ? (groceryItemsPurchasedCount() > 0 ? "Pay now" : "Leave market")
    : (groceryItemsPurchasedCount() > 0 ? "Go to checkout" : "Leave market");
  paintCtx.fillStyle = "rgba(217, 245, 122, 0.16)";
  paintCtx.fillRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.strokeStyle = "rgba(217, 245, 122, 0.7)";
  paintCtx.strokeRect(finish.x, finish.y, finish.w, finish.h);
  paintCtx.textAlign = "center";
  paintCtx.fillStyle = "#f5f5f5";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText(finishLabel, finish.x + finish.w / 2, finish.y + finish.h / 2);

  if (checkoutActive) {
    const back = groceryBackRect();
    const bargain = groceryBargainRect();
    const canBargain = groceryItemsPurchasedCount() > 0 && paintState.groceryTiming.attemptsUsed < 3;
    const bargainLabel = canBargain
      ? (paintState.groceryTiming.attemptsUsed === 0 ? "Bargain (3 tries)" : `Bargain again (${3 - paintState.groceryTiming.attemptsUsed} left)`)
      : (paintState.groceryTiming.bestGrade ? `Best kept: ${bargainGradeLabel(paintState.groceryTiming.bestGrade)}` : "No bargains left");

    paintCtx.fillStyle = "rgba(255,255,255,0.1)";
    paintCtx.fillRect(back.x, back.y, back.w, back.h);
    paintCtx.strokeStyle = "rgba(255,255,255,0.34)";
    paintCtx.strokeRect(back.x, back.y, back.w, back.h);
    paintCtx.fillStyle = "#f5f5f5";
    paintCtx.fillText("Back to cart", back.x + back.w / 2, back.y + back.h / 2);

    paintCtx.fillStyle = canBargain ? "rgba(255, 231, 150, 0.16)" : "rgba(255,255,255,0.06)";
    paintCtx.fillRect(bargain.x, bargain.y, bargain.w, bargain.h);
    paintCtx.strokeStyle = canBargain ? "rgba(255, 231, 150, 0.62)" : "rgba(255,255,255,0.16)";
    paintCtx.strokeRect(bargain.x, bargain.y, bargain.w, bargain.h);
    paintCtx.fillStyle = canBargain ? "#fff2bf" : "rgba(255,255,255,0.52)";
    paintCtx.font = "16px Georgia";
    paintCtx.fillText(bargainLabel, bargain.x + bargain.w / 2, bargain.y + bargain.h / 2);
  }

  paintCtx.textAlign = "left";
  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.font = "18px Georgia";
  paintCtx.fillText(`Wallet: ${formatGroceryAmount(gameState.groceryFundsTenths)}`, 36, 74);
  paintCtx.font = "14px Georgia";
  if (groceryTiming && groceryTiming.active) {
    paintCtx.fillText(`Bargain attempt ${paintState.groceryTiming.attemptsUsed + 1} of 3`, 36, 102);
    paintCtx.fillText("Click when the pulsing ring crosses the middle guide.", 36, 128);
  } else if (checkoutActive) {
    paintCtx.fillText("Checkout is open. Choose whether to bargain again, pay now, or step back to the basket.", 36, 102);
    paintCtx.fillText(`Best saved result: ${bargainGradeLabel(paintState.groceryTiming.bestGrade) || "none yet"}.`, 36, 128);
  } else {
    paintCtx.fillText("Click + to add at the marked price. Bargaining happens later, when you choose checkout.", 36, 102);
    paintCtx.fillText("You only get three bargain attempts for the whole trip, even if you go back and change the basket.", 36, 128);
  }
  paintCtx.fillText(`Basket: ${groceryCartSummary()}`, 36, 154);
  drawTimingFeedback();

  drawImageCursor("mix");
}

function hideInfoCanvas() {
  if (!infoCanvas || !infoCtx) return;
  infoCanvas.classList.add("hidden");
  infoCtx.clearRect(0, 0, infoCanvas.width, infoCanvas.height);
}

function drawHemmingTimingWidget(timing) {
  hideInfoCanvas();
  if (!timing || !timing.active) return;

  const rect = hemmingTimingPopupRect();
  const w = rect.w;
  const h = rect.h;
  const cx = rect.x + w / 2;
  const cy = rect.y + h / 2 + 2;
  const radius = 48;

  paintCtx.save();
  paintCtx.fillStyle = "rgba(6, 8, 10, 0.94)";
  paintCtx.fillRect(rect.x, rect.y, w, h);
  paintCtx.strokeStyle = "rgba(255,255,255,0.18)";
  paintCtx.lineWidth = 2;
  paintCtx.strokeRect(rect.x + 1, rect.y + 1, w - 2, h - 2);

  paintCtx.textAlign = "center";
  paintCtx.textBaseline = "middle";
  paintCtx.fillStyle = "rgba(255,255,255,0.92)";
  paintCtx.font = "bold 13px Georgia";
  paintCtx.fillText("TIME STITCH", cx, rect.y + 22);

  paintCtx.strokeStyle = "rgba(255,255,255,0.24)";
  paintCtx.lineWidth = 7;
  paintCtx.beginPath();
  paintCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  paintCtx.stroke();

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
    paintCtx.arc(cx, cy, radius, timing.targetAngle - spread, timing.targetAngle + spread);
    paintCtx.stroke();
  }

  const markerX = cx + Math.cos(timing.angle) * radius;
  const markerY = cy + Math.sin(timing.angle) * radius;
  paintCtx.fillStyle = "rgba(255, 248, 212, 0.98)";
  paintCtx.beginPath();
  paintCtx.arc(markerX, markerY, 6.3, 0, Math.PI * 2);
  paintCtx.fill();

  paintCtx.fillStyle = "rgba(255,255,255,0.74)";
  paintCtx.font = "12px Georgia";
  paintCtx.fillText("click again", cx, rect.y + h - 20);
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
  paintCtx.fillText("HEMMING TABLE", HEMMING_LAYOUT.panel.x + 18, HEMMING_LAYOUT.panel.y + 30);

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
  paintCtx.fillText(hemmingAllFinished() ? "Finish hemming" : "Skip hemming", finish.x + finish.w / 2, finish.y + finish.h / 2);

  drawHemmingTimingWidget(timing);
  drawTimingFeedback();
}

function drawWatchMinigame() {
  minigameOverlay.classList.toggle("hemming-mode", paintState.mode === "hemming");
  paintCanvas.style.cursor = paintState.mode === "hemming" ? "pointer" : "none";
  if (paintState.mode !== "hemming") {
    hideInfoCanvas();
  }

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

  const previewRadius = paintState.tool === "nail" ? 14 : currentBrushPaintRadius();
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
    const correctionHotspots = correctionHotspotsForDial(dial, 7);
    paintCtx.save();
    paintCtx.setLineDash([7, 4]);
    for (const hotspot of correctionHotspots) {
      const markerRadius = Math.max(9, hotspot.r + 6 + hotspot.overspill * 2.1);
      paintCtx.strokeStyle = "rgba(255, 124, 124, 0.96)";
      paintCtx.lineWidth = 3;
      paintCtx.beginPath();
      paintCtx.arc(hotspot.x, hotspot.y, markerRadius, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.setLineDash([]);
      paintCtx.strokeStyle = "rgba(255, 204, 204, 0.92)";
      paintCtx.lineWidth = 1.6;
      paintCtx.beginPath();
      paintCtx.arc(hotspot.x, hotspot.y, markerRadius - 4, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.setLineDash([7, 4]);
    }
    paintCtx.restore();
  }

  if (paintState.showCoverageAssist) {
    const coverageHotspots = coverageHotspotsForDial(dial, 7);
    const pulse = 0.72 + ((Math.sin(performance.now() * 0.008) + 1) * 0.14);
    paintCtx.save();
    for (const hotspot of coverageHotspots) {
      const markerRadius = hotspot.radius;
      paintCtx.strokeStyle = `rgba(130, 220, 255, ${pulse})`;
      paintCtx.lineWidth = 3;
      paintCtx.beginPath();
      paintCtx.arc(hotspot.x, hotspot.y, markerRadius, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.fillStyle = "rgba(130, 220, 255, 0.14)";
      paintCtx.beginPath();
      paintCtx.arc(hotspot.x, hotspot.y, Math.max(5, markerRadius - 6), 0, Math.PI * 2);
      paintCtx.fill();
    }
    paintCtx.restore();
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

  const previewRadius = paintState.tool === "nail" ? 8 : currentBrushPaintRadius();
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
    paintCtx.textAlign = "center";
    paintCtx.textBaseline = "alphabetic";
    paintCtx.fillText("CLOSE", close.x + close.w / 2, close.y + close.h - 10);
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
  try {
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
  } catch (error) {
    console.warn("Hemming cursor preprocessing unavailable in this browser context; using raw cursor image.", error);
    cachedHemmingCursorImage = source;
  }
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

function updateFractureDrift(dt) {
  if (!paintState.active || paintState.mode !== "fracture") return;

  const speedScale = minigameSpeedMultiplier();
  if (speedScale <= 1) return;

  const now = performance.now() * 0.001;
  const driftStrength = (speedScale - 1) * 26;

  for (let i = 0; i < paintState.fracturePieces.length; i += 1) {
    const piece = paintState.fracturePieces[i];
    if (piece.placed || i === paintState.draggedPieceIndex) continue;
    const waveX = Math.sin(now * (1.9 + i * 0.12) + i * 0.7);
    const waveY = Math.cos(now * (2.15 + i * 0.09) + i * 0.41);
    piece.x = Math.max(0, Math.min(paintCanvas.width - piece.w, piece.x + waveX * driftStrength * dt));
    piece.y = Math.max(0, Math.min(paintCanvas.height - piece.h, piece.y + waveY * driftStrength * dt));
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

function eventClientPoint(event) {
  if (event.touches && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (event.changedTouches && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function pointerInsidePaintCanvas(event) {
  const rect = paintCanvas.getBoundingClientRect();
  const client = eventClientPoint(event);
  const rectWidth = rect.width || paintCanvas.width || 1;
  const rectHeight = rect.height || paintCanvas.height || 1;
  const x = ((client.x - rect.left) / rectWidth) * paintCanvas.width;
  const y = ((client.y - rect.top) / rectHeight) * paintCanvas.height;
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

  if (restHandAssistStrength() > 0) {
    return position;
  }

  const severity = Math.max(0, paintingDriftStrength() * (1 - restHandAssistStrength()));
  if (severity <= 0) return position;

  const now = performance.now();
  const speedScale = 1 + severity * (minigameSpeedMultiplier() - 1) + severity * 0.55;
  const t = now * speedScale;
  const idleElapsed = Math.max(0, now - paintState.lastPointerMoveAt);
  const idleFactor = Math.min(1, Math.max(0, idleElapsed - 110) / 650);
  const strokeBoost = paintState.isPainting && paintState.tool === "brush" ? 1.15 : 1;
  const shakeRadius = (1.8 + severity * 7.2) * strokeBoost;
  const idleRadius = (12 + severity * 44) * idleFactor;
  const driftX =
    Math.sin(t * 0.08 + paintState.watchIndex * 0.71) * shakeRadius * 0.62 +
    Math.sin(t * 0.16 + paintState.activeDialIndex * 1.11) * shakeRadius * 0.32 +
    Math.cos(t * 0.23 + paintState.watchIndex * 0.43) * shakeRadius * 0.18 +
    Math.sin(t * 0.012 + paintState.watchIndex * 0.34) * idleRadius * 0.92 +
    Math.cos(t * 0.019 + paintState.activeDialIndex * 0.58) * idleRadius * 0.46;
  const driftY =
    Math.cos(t * 0.09 + paintState.watchIndex * 0.39) * shakeRadius * 0.58 +
    Math.sin(t * 0.175 + paintState.activeDialIndex * 0.93) * shakeRadius * 0.28 +
    Math.cos(t * 0.21 + paintState.watchIndex * 0.27) * shakeRadius * 0.17 +
    Math.cos(t * 0.011 + paintState.watchIndex * 0.29) * idleRadius * 0.88 +
    Math.sin(t * 0.017 + paintState.activeDialIndex * 0.47) * idleRadius * 0.44;

  return {
    x: Math.max(0, Math.min(paintCanvas.width, position.x + driftX)),
    y: Math.max(0, Math.min(paintCanvas.height, position.y + driftY)),
  };
}

function bindPress(element, handler) {
  if (!element) return;
  let lastPressAt = -Infinity;
  const run = () => {
    const now = performance.now();
    if (now - lastPressAt < 120) return;
    lastPressAt = now;
    handler();
  };
  element.addEventListener("click", run);
  element.addEventListener("mouseup", run);
  element.addEventListener("pointerup", (event) => {
    if (typeof event.button === "number" && event.button > 0) return;
    run();
  });
  element.addEventListener("touchend", run);
}

bindPress(recapButton, () => {
  const continuation = recapState.continuation;
  hideShiftRecap();
  if (typeof continuation === "function") {
    continuation();
  }
});

bindPress(dialogPrevButton, () => {
  shiftDialogPage(-1);
});

bindPress(dialogNextButton, () => {
  shiftDialogPage(1);
});

bindPress(dialogButton, () => {
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

  if (gameState.dialogMode === "day-five-locked") {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    gameState.dayFiveCutsceneSeen = true;
    gameState.joinedWorkers = false;
    startShift(true);
    return;
  }

  if (gameState.dialogMode === "worker-talk-choice") {
    resolveWorkerConversationChoice(dialogButton.dataset.choiceId);
    return;
  }

  if (gameState.dialogMode === "worker-talk-result") {
    const context = workerConversationState?.context;
    if (context === "afterShift") {
      gameState.dialogMode = "post-shift-report";
      continueAfterDialog();
      return;
    }
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    workerConversationState = null;
    gameState.dialogMode = "";
    return;
  }
  continueAfterDialog();
});

bindPress(dialogAltButton, () => {
  if (gameState.dialogMode === "day-five-choice") {
    dialogOverlay.classList.add("hidden");
    resetDialogButtons();
    gameState.dayFiveCutsceneSeen = true;
    gameState.joinedWorkers = false;
    startShift(true);
    return;
  }

  if (gameState.dialogMode === "post-shift-report") {
    openAfterShiftConversation();
    return;
  }

  if (gameState.dialogMode === "worker-talk-choice") {
    resolveWorkerConversationChoice(dialogAltButton.dataset.choiceId);
    return;
  }
});

bindPress(dialogThirdButton, () => {
  if (gameState.dialogMode === "worker-talk-choice") {
    resolveWorkerConversationChoice(dialogThirdButton.dataset.choiceId);
  }
});

bindPress(correctButton, () => {
  switchToNailMode();
});

bindPress(lickButton, () => {
  gameState.hiddenStats.brushLicks += 1;
  spendHealth(0.5);
  const preservedPaintLoad = paintState.paintLoaded;
  paintState.tool = "brush";
  paintState.correcting = false;
  paintState.brushSize = DEFAULT_BRUSH_SIZE;
  paintState.paintLoaded = preservedPaintLoad;
  paintPrompt.textContent = "You mouth-point the brush before tracing the next strokes. The tip narrows back into working shape.";
  updatePaintStats();
  drawWatchMinigame();
});

bindPress(checkNumeralButton, () => {
  toggleCheckNumeralGuide();
});

bindPress(restHandButton, () => {
  if (!canUseRestHandSupport()) return;
  acknowledgeStationButtonHint("restHand");
  paintState.restHandOnSide = !paintState.restHandOnSide;
  paintPrompt.textContent = paintState.restHandOnSide
    ? "You brace the heel of your hand against the side. The line steadies, but the shift clock starts running faster."
    : "You lift your hand free again. The work slows back to its usual pace, and the shakiness returns with it.";
  updatePaintStats();
  drawWatchMinigame();
});

bindPress(mixResetButton, () => {
  resetMix();
  paintPrompt.textContent = "You empty the dish and start the mixture again from nothing.";
  updatePaintStats();
  drawWatchMinigame();
});

bindPress(infoCanvas, () => {
  if (!paintState.active || paintState.mode !== "hemming") return;
  if (!paintState.hemmingTiming.active) {
    paintPrompt.textContent = "Click a stitch dot to begin the next timing pass.";
    drawWatchMinigame();
    return;
  }
  resolveHemmingTiming();
  drawWatchMinigame();
});

bindPress(menuButton, () => {
  toggleMenu();
});

bindPress(closeMenuButton, () => {
  closeMenu();
});

bindPress(saveButton, () => {
  saveGameToLocal();
});

bindPress(loadButton, () => {
  loadGameFromLocal();
});

bindPress(deleteSaveButton, () => {
  deleteLocalSave();
});

bindPress(newWeekButton, () => {
  resetWeek();
  closeMenu();
  setMessage(
    "A fresh week begins.",
    "Clock in at the wall clock when you are ready to start again.",
  );
});

if (musicVolumeSlider) {
  musicVolumeSlider.addEventListener("input", () => {
    audioSettings.musicVolume = clampPercent(musicVolumeSlider.value, audioSettings.musicVolume);
    updateAudioControls();
    applyMusicVolume();
    saveAudioSettings();
  });
}

if (sfxVolumeSlider) {
  sfxVolumeSlider.addEventListener("input", () => {
    audioSettings.sfxVolume = clampPercent(sfxVolumeSlider.value, audioSettings.sfxVolume);
    updateAudioControls();
    applySfxVolume();
    saveAudioSettings();
  });
}

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

  if (paintState.isPainting && typeof event.buttons === "number" && event.buttons === 0) {
    paintState.isPainting = false;
  }

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

let lastPaintCanvasPressAt = -Infinity;
function handlePaintCanvasPress(event) {
  if (isMenuOpen()) return;
  const now = performance.now();
  if (now - lastPaintCanvasPressAt < 90) return;
  lastPaintCanvasPressAt = now;
  if (!paintState.active) return;

  const position = pointerInsidePaintCanvas(event);
  paintState.pointerX = position.x;
  paintState.pointerY = position.y;
  paintState.lastPointerMoveAt = performance.now();

  if (paintState.mode === "groceries") {
    const groceryTiming = currentGroceryTimingState();
    if (groceryTiming && groceryTiming.active) {
      const hitRadius = Math.max(groceryTiming.targetRadius + 8, groceryTiming.outerRadius + 6);
      if (Math.hypot(position.x - groceryTiming.x, position.y - groceryTiming.y) <= hitRadius) {
        resolveGroceryPurchase("click");
      } else {
        paintPrompt.textContent = "Keep your eye on the pulsing bargain ring and click when it crosses the middle guide.";
        updateGroceryStats();
      }
      drawWatchMinigame();
      return;
    }

    const finish = groceryFinishRect();
    if (position.x >= finish.x && position.x <= finish.x + finish.w && position.y >= finish.y && position.y <= finish.y + finish.h) {
      finishGroceriesTrip();
      return;
    }

    if (paintState.groceryTiming.checkoutActive) {
      const back = groceryBackRect();
      const bargain = groceryBargainRect();
      if (pointInsideRect(position.x, position.y, back)) {
        leaveGroceryCheckout();
        drawWatchMinigame();
        return;
      }
      if (pointInsideRect(position.x, position.y, bargain)) {
        beginGroceryBargain();
        drawWatchMinigame();
        return;
      }
      return;
    }

    const rowHit = groceryItemAt(position.x, position.y);
    if (rowHit) {
      const controls = groceryControlsRect(rowHit.index);
      if (pointInsideRect(position.x, position.y, controls.minus)) {
        removeGrocery(rowHit.item);
      } else if (pointInsideRect(position.x, position.y, controls.plus)) {
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
}

paintCanvas.addEventListener("mousedown", handlePaintCanvasPress);
paintCanvas.addEventListener("pointerdown", (event) => {
  if (typeof event.button === "number" && event.button > 0) return;
  if (typeof event.buttons === "number" && event.buttons === 0) return;
  handlePaintCanvasPress(event);
});
paintCanvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  handlePaintCanvasPress(event);
}, { passive: false });

function releasePaintOrDrag() {
  if (paintState.mode === "fracture") {
    endFractureDrag();
  }
  paintState.isPainting = false;
}

function primeCompletionBell() {
  ensureCompletionBellWidget();
}

const previousYouTubeIframeReady = window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady = () => {
  backgroundMusicState.apiReady = true;
  if (typeof previousYouTubeIframeReady === "function") {
    previousYouTubeIframeReady();
  }
  createBackgroundMusicPlayer();
};

if (bgMusic) {
  bgMusic.addEventListener("load", () => {
    if (backgroundMusicState.player) return;
    backgroundMusicState.ready = true;
    postBackgroundMusicCommand("mute");
    postBackgroundMusicCommand("playVideo");
    if (backgroundMusicState.pendingStart) {
      startBackgroundMusic(true);
    }
  });
}

window.addEventListener("mouseup", releasePaintOrDrag);
window.addEventListener("pointerup", releasePaintOrDrag);
window.addEventListener("pointercancel", releasePaintOrDrag);
window.addEventListener("blur", releasePaintOrDrag);
paintCanvas.addEventListener("touchend", releasePaintOrDrag);
paintCanvas.addEventListener("touchcancel", releasePaintOrDrag);
window.addEventListener("pointerdown", primeCompletionBell, { once: true });
window.addEventListener("keydown", primeCompletionBell, { once: true });
window.addEventListener("touchstart", primeCompletionBell, { once: true, passive: true });
window.addEventListener("pointerdown", primeBackgroundMusic, { once: true });
window.addEventListener("keydown", primeBackgroundMusic, { once: true });
window.addEventListener("touchstart", primeBackgroundMusic, { once: true, passive: true });

if (window.YT && typeof window.YT.Player === "function") {
  backgroundMusicState.apiReady = true;
  createBackgroundMusicPlayer();
}

document.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (!dialogOverlay.classList.contains("hidden") && event.code === "ArrowLeft") {
    event.preventDefault();
    shiftDialogPage(-1);
    return;
  }

  if (!dialogOverlay.classList.contains("hidden") && event.code === "ArrowRight") {
    event.preventDefault();
    shiftDialogPage(1);
    return;
  }

  if (event.code === "KeyM") {
    event.preventDefault();
    toggleMenu();
    return;
  }

  if (event.code === "Escape" && isMenuOpen()) {
    closeMenu();
    return;
  }

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

let lastRoomCanvasPressAt = -Infinity;
function handleRoomCanvasPress(event) {
  if (isMenuOpen()) return;
  const now = performance.now();
  if (now - lastRoomCanvasPressAt < 90) return;
  lastRoomCanvasPressAt = now;
  if (paintState.active || !dialogOverlay.classList.contains("hidden")) return;
  const rect = canvas.getBoundingClientRect();
  const client = eventClientPoint(event);
  const rectWidth = rect.width || canvas.width || 1;
  const rectHeight = rect.height || canvas.height || 1;
  roomState.cursorX = ((client.x - rect.left) / rectWidth) * WIDTH;
  roomState.cursorY = ((client.y - rect.top) / rectHeight) * HEIGHT;

  if (gameState.dayTransition && !titleCard.classList.contains("visible")) {
    gameState.dayTransition = false;
  }

  if (gameState.dayTransition) {
    fadeTitleCard();
    setMessage(
      "The workshop settles around you.",
      "Click the wall clock, the workers, or the workbench in the workshop photo.",
    );
    return;
  }

  const target = getTargetedInteractable();
  if (target) {
    target.item.interact();
  } else {
    setMessage(
      "Nothing useful there.",
      "Click the wall clock, a worker, or the workbench in the workshop photo.",
    );
  }
}

canvas.addEventListener("click", handleRoomCanvasPress);
canvas.addEventListener("pointerup", (event) => {
  if (typeof event.button === "number" && event.button > 0) return;
  handleRoomCanvasPress(event);
});
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  handleRoomCanvasPress(event);
}, { passive: false });

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const client = eventClientPoint(event);
  const rectWidth = rect.width || canvas.width || 1;
  const rectHeight = rect.height || canvas.height || 1;
  roomState.cursorX = ((client.x - rect.left) / rectWidth) * WIDTH;
  roomState.cursorY = ((client.y - rect.top) / rectHeight) * HEIGHT;
});

showTitleCard();
initializeAudioSettings();
selectedSaveSlotIndex = loadSelectedSaveSlotIndex();
ensureSaveSlotsMigrated();
updateHud();
drawWatchMinigame();
renderSaveSlotGrid();
updateMenuStatus();
requestAnimationFrame(frame);
