// Worker dialogue tables, profiles, and sprite/palette data.
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
const WORKER_NAMES = {
  "worker-1": "Agnes",
  "worker-2": "Ruth",
  "worker-3": "Clara",
  "worker-4": "Evelyn",
  "worker-5": "Mae",
  "worker-6": "Lillian",
  "worker-7": "Nora",
  "worker-8": "Pearl",
  "worker-9": "Vi",
};
const WORKER_NAME_REVEAL_DAY = {
  "worker-1": 1,
  "worker-2": 2,
  "worker-3": 0,
  "worker-4": 2,
  "worker-5": 3,
  "worker-6": 4,
  "worker-7": 3,
  "worker-8": 1,
  "worker-9": 0,
};
const WORKER_AFTER_SHIFT_DIALOGUE = {
  "worker-1": {
    work:
      "Agnes admits she counts the curve out under her breath before every turn. \"If I let the room decide the pace, the room wins,\" she says. Another woman nearby murmurs that the room always thinks it can win.",
    wry:
      "Agnes huffs a tired laugh and says a joke is at least something the manager cannot dock from the envelope.",
    home:
      "Agnes says her pay goes straight into her mother's hands before she ever thinks of keeping any for herself. She smooths a thumb over the heel of her palm as if she is already counting what tonight's coins need to cover.",
  },
  "worker-2": {
    work:
      "Ruth tells you the manager notices overflow before he notices effort. \"That is why I mind the inside edge first,\" she says. \"He cannot tell a steady hand from a frightened one, but he can count a ruined dial.\"",
    wry:
      "Ruth takes the remark about the manager's tally book as an invitation. She says if he could tax silence by the ounce, he would, and for a moment the bitterness almost sounds companionable.",
    home:
      "Ruth huffs out something almost like a laugh. She says her younger brother keeps asking whether the shine comes off in the wash. \"I tell him it had better,\" she says, as though stubbornness might make it true.",
  },
  "worker-3": {
    work:
      "Clara tips her head. \"Half of it is nerve,\" she says. \"The other half is pretending the manager isn't standing over your shoulder measuring the time in your spine.\" When another girl snorts, Clara only smiles wider.",
    wry:
      "Clara answers with one of her own and, for the first time all day, lets it stay in the air. She says laughter is only useful if it arrives before the silence does.",
    home:
      "Clara's voice softens. She says she keeps up the teasing because if she stops, the whole day starts sounding heavier than it ought to. \"I can manage tired,\" she says. \"Quiet is what gets me.\"",
  },
  "worker-4": {
    work:
      "Evelyn answers as if she has been waiting for someone to ask it properly. She says the mixture should drag just enough to obey. \"If it glides, it lies,\" she tells you. \"And if it lies, the numeral will show it by morning.\"",
    wry:
      "Evelyn's mouth finally softens. She says the only thing sharper than the powder is the way these rooms teach a girl to laugh without opening her lips.",
    home:
      "Evelyn says her father watches the pay envelope before he ever asks how her shift went. She does not sound bitter, only resigned, and adds that good money makes it easier for people to call bad work a blessing.",
  },
  "worker-5": {
    work:
      "Mae keeps her eyes lowered, but this time she answers at length. She says most ruined faces come from panic after the first bad stroke, not the stroke itself. \"Girls drown the second pass trying to fix the first,\" she says quietly.",
    wry:
      "Mae gives a small, surprised smile and admits she forgets conversation can be gentle when it is not coming from across a dinner table full of chores.",
    home:
      "Mae admits she still does mending after her shift because there is always somebody's sleeve or hem waiting on the chair. She says it so softly that it feels less like conversation and more like a confession.",
  },
  "worker-6": {
    work:
      "Lillian says the lamp changes everything. Under a bright one, a girl can almost believe the work wants to cooperate. Under a bad one, every numeral turns mean. \"You learn which bench forgives you,\" she says, \"and which one never will.\"",
    wry:
      "Lillian answers the joke with a weary kind of wit. She says if the lamps had any decency, they'd follow everyone home and finish the housework too.",
    home:
      "Lillian says the quiet at home can be worse than the factory noise because it leaves too much room to replay the day. She says it plainly, as though naming it is the only kindness left.",
  },
  "worker-7": {
    work:
      "Nora tells you the trick is not speed but recovery. \"Everyone misses a line,\" she says. \"The girls who last are the ones who lose less time to hating themselves for it.\" The bluntness lands harder than comfort and somehow helps more.",
    wry:
      "Nora meets your dry tone easily. She says black humor is the only sort the factory hasn't figured out how to dock from the pay envelope.",
    home:
      "Nora says she mostly wants a washbasin and ten minutes where nobody asks anything of her. Then she glances aside and admits that once she gets there, she still ends up helping with supper, because that is how these nights go.",
  },
  "worker-8": {
    work:
      "Pearl says the paint always tells on the person mixing it. Thin paint betrays impatience, heavy paint betrays fear. \"A good face looks calm even when the girl painting it wasn't,\" she says. There is pride in that, and a little grief too.",
    wry:
      "Pearl lets the joke sit a moment before laughing under her breath. She says she prefers that kind of talk because it lets a girl tell the truth about the room without sounding ungrateful for the pay.",
    home:
      "Pearl says the younger children still think the shine on her cuffs is pretty. She lets that thought hang there for a moment, then says children will admire anything if it catches the light.",
  },
  "worker-9": {
    work:
      "Vi hesitates before answering, then says the line gets easier once you stop trying to rescue every wobble at once. \"Settle the inside edge first,\" she says. \"The rest will either follow it or tell you where it wants correcting.\"",
    wry:
      "Vi startles at the joke, then answers with one of her own so quiet you nearly miss it. By the time she's done smiling, the room has already asked for her seriousness back.",
    home:
      "Vi says she keeps an extra rag in her pocket because she hates walking through the front door still carrying the day's dust on her cuffs. \"As if five minutes changes anything,\" she adds, almost embarrassed by the habit.",
  },
};
const WORKER_SHIFT_CHOICE_DIALOGUE = {
  "worker-1": {
    work:
      "Agnes says a tray stays even if you break the face into turns instead of trying to own it all at once. She still counts the curve under her breath while she talks.",
    wry:
      "Agnes almost smiles. \"Mine do,\" she says. \"That's when I know I stayed too late.\"",
    personal:
      "Agnes says she survives by cutting the shift into little promises: one curve, one stroke, one face at a time.",
  },
  "worker-2": {
    work:
      "Ruth says the inside edges come first. \"If those hold, the rest can still be corrected before the tray leaves the bench,\" she tells you.",
    wry:
      "Ruth lets out a dry snort. \"He'd miscount both,\" she says.",
    personal:
      "Ruth answers \"Fine\" too fast, then amends it: \"Quick. I know how to be quick. That's different.\"",
  },
  "worker-3": {
    work:
      "Clara flicks her brush through the air as though sketching an eleven. \"Set the one first,\" she says. \"Then make the second digit answer it instead of racing it.\"",
    wry:
      "Clara grins. \"Good,\" she says. \"I was starting to think they'd hired me a saint.\"",
    personal:
      "Clara shrugs, then admits the joking keeps her from hearing how heavy the room sounds when nobody talks.",
  },
  "worker-4": {
    work:
      "Evelyn says a dial gets its weight from the mix before it gets it from the stroke. \"If the paint drags properly, the numeral almost teaches your hand what to do.\"",
    wry:
      "Evelyn actually laughs once. \"That depends which bowl you've got,\" she says.",
    personal:
      "Evelyn says routine is doing most of the work now. \"If I stop to notice too much, the whole thing turns strange.\"",
  },
  "worker-5": {
    work:
      "Mae murmurs that the second pass belongs only to the places you nearly got right. \"If you attack the whole face again, you only make it fight you.\"",
    wry:
      "Mae looks startled, then lets out the smallest breath of laughter. \"Careful,\" she says. \"If I smile, my line goes crooked.\"",
    personal:
      "Mae admits she saves her patience for the tray because there's none left by the time she gets home.",
  },
  "worker-6": {
    work:
      "Lillian says the turn on a six goes cleaner if you let the brush fall through it instead of forcing the curve. \"Push it, and the face starts pushing back.\"",
    wry:
      "Lillian gives you a tired smile. \"Only until the light changes,\" she says.",
    personal:
      "Lillian says the worst part is pretending the day's strain is ordinary long enough that everyone else believes it too.",
  },
  "worker-7": {
    work:
      "Nora says the first bad stroke matters less than the moment after it. \"Recover quickly and the manager thinks you meant it,\" she says.",
    wry:
      "Nora catches the joke and answers in kind. \"If I start laughing at this room, I may never stop,\" she says, which sounds truer than funny.",
    personal:
      "Nora says she prefers tasks to feelings. After a beat she adds, \"The trouble is tasks follow you home.\"",
  },
  "worker-8": {
    work:
      "Pearl says bright paint comes from patience at the dish and a light hand at the face. \"Pressing harder only makes a lie look thicker.\"",
    wry:
      "Pearl gives you a sideways look and a quiet, dark laugh. \"There's the spirit,\" she says.",
    personal:
      "Pearl says she keeps trying to leave the day at the washbasin and keeps failing by the front door.",
  },
  "worker-9": {
    work:
      "Vi says a wavering line settles if you use less paint on the inside edge and let the stroke land before you judge it. She demonstrates the motion with two careful fingers in the air.",
    wry:
      "Vi smiles anyway. \"Don't give management ideas,\" she says.",
    personal:
      "Vi admits she has started planning around the room's bad habits so carefully that she notices herself doing it even at home.",
  },
};
const WORKER_DIALOGUE_TOPICS = {
  "worker-1": {
    bench: "your first tray",
    detail: "counting the curve under your breath",
    joke: "numerals marching home in your sleep",
    tell: "that tight look in your shoulders",
    home: "who gets your pay envelope first",
  },
  "worker-2": {
    bench: "those inside edges",
    detail: "keeping the ones and tens light",
    joke: "the manager taxing the air in here",
    tell: "how hard you're driving your hands",
    home: "what your brother says about the glow on your cuffs",
  },
  "worker-3": {
    bench: "a tray when you're half teasing it",
    detail: "pulling the second digit on the elevens",
    joke: "this row mistaking you for a saint",
    tell: "whatever the joking is covering up today",
    home: "whether the room feels worse once it goes quiet",
  },
  "worker-4": {
    bench: "a dial that still needs weight",
    detail: "getting the mixture to drag instead of glide",
    joke: "paint being easier company than management",
    tell: "how much of this you're leaving to routine",
    home: "what people hear when they call this work a blessing",
  },
  "worker-5": {
    bench: "a face when you're trying not to waste a stroke",
    detail: "saving the second pass after a mistake",
    joke: "smiling without sending the line crooked",
    tell: "how thin your patience is running",
    home: "the mending waiting for you after the bell",
  },
  "worker-6": {
    bench: "a face under the kinder lamp",
    detail: "letting the sixes turn without forcing them",
    joke: "the lamps following us home to finish the chores",
    tell: "how badly this room is getting on your nerves",
    home: "whether home feels any quieter than this room",
  },
  "worker-7": {
    bench: "a tray when the manager starts prowling",
    detail: "recovering after a bad first stroke",
    joke: "earning enough to mock this place properly",
    tell: "what you do with all this once the bell goes",
    home: "how much work is still waiting when you get in",
  },
  "worker-8": {
    bench: "a bowl that wants to turn thin",
    detail: "keeping the paint bright without pressing too hard",
    joke: "the paint outlasting the tally sheets",
    tell: "what you try to wash off before you get home",
    home: "what the younger children make of the shine on your cuffs",
  },
  "worker-9": {
    bench: "a face when the line starts to wobble",
    detail: "using less paint on the inside edge",
    joke: "working by moonlight next",
    tell: "how much of your day goes into compensating for this room",
    home: "why you still scrub your cuffs before reaching the house",
  },
};
const WORKER_CONVERSATION_TEMPLATES = {
  shift: {
    work: [
      "How do you keep {bench} that even?",
      "When {detail} starts slipping, what do you fix first?",
      "What tells you {bench} is going wrong?",
      "When the paint starts fighting you, what saves the face?",
      "When the room speeds up, what do you refuse to rush?",
      "If I copied one habit from you, should it be {detail}?",
      "If I only remember one rule for {bench}, what should it be?",
    ],
    wry: [
      "Too early for a joke about {joke}?",
      "If they paid extra for {joke}, would any of us be rich?",
      "Do you laugh about {joke} during the shift, or only after the bell?",
      "When does {joke} stop sounding funny and start sounding true?",
      "Should I hear {joke} as a joke, or as a warning?",
      "If we make it through the week, do we earn the right to joke about {joke}?",
      "When {joke} comes to mind, do you laugh or just sigh?",
    ],
    personal: [
      "You always hide {tell} that well?",
      "How are you managing {tell} today?",
      "Want to tell me the truth about {tell}, or should I leave it?",
      "Has {tell} been getting harder to ignore?",
      "When did {tell} become part of the routine?",
      "Do you ever get to set {tell} down once the bell goes?",
      "What do you tell yourself when {tell} starts getting to you?",
    ],
  },
  afterShift: {
    work: [
      "What part of {bench} are you still replaying?",
      "Did {detail} behave any better once the manager stopped circling?",
      "Was there any point today when {bench} finally felt easy?",
      "What part of the bench wore you out the most today?",
      "If tomorrow starts badly, what would you fix first on {bench}?",
      "Do you trust your hand more than the paint when {detail} goes wrong?",
      "After a week like this, what even counts as good work on {bench}?",
    ],
    wry: [
      "Does {joke} stay funny once you're outside, or only in the room?",
      "If {joke} were printed on the tally sheet, would management notice us at last?",
      "Is it bad that {joke} is the funniest part of the day to me?",
      "Do you ever think {joke} is the room trying to be clever?",
      "At this point, is {joke} still a joke, or just the truth wearing a grin?",
      "If we had any strength left, would {joke} still make us laugh?",
      "By now, does {joke} land as humor or prophecy?",
    ],
    home: [
      "Who gets to {home} before you even sit down?",
      "What does the house sound like once {home} starts waiting on you?",
      "Do you think about {home} all shift, or only after the bell?",
      "Has {home} gotten easier to answer, or harder?",
      "When you walk in carrying the whole week on you, does {home} come before anyone asks how you are?",
      "Does {home} make it easier to keep showing up, or harder to stop?",
      "After a week like this, what do you hide first when {home} is waiting by the door?",
    ],
  },
};
const FAMILIAR_WORKERS_REQUIRED = 3;
const SHIFT_CONVERSATION_DAY_FRAMES = [
  "On this first day,",
  "With Tuesday already settling into the room,",
  "By midweek,",
  "Under Thursday's lamps,",
  "Late in the week,",
  "With Saturday fatigue on everyone,",
  "At the week's thin edge,",
];
const AFTER_SHIFT_CONVERSATION_DAY_FRAMES = [
  "After Monday's bell,",
  "After Tuesday's tally,",
  "Once Wednesday finally lets go,",
  "With Thursday behind her,",
  "Once Friday's ache catches up,",
  "At the end of Saturday's long shift,",
  "After the last bell of the week,",
];

const WORKER_MEMORY_BASE_LINES = {
  "worker-1": "Count the curve instead of trying to conquer it all at once.",
  "worker-2": "Mind the inside edges first and let the rest answer to them.",
  "worker-3": "Set the first digit cleanly and make the second follow it.",
  "worker-4": "Let the paint drag just enough to tell the truth.",
  "worker-5": "Save the second pass for the places that nearly worked.",
  "worker-6": "Let the curve fall through your hand instead of forcing it.",
  "worker-7": "Recover quickly after the first bad stroke and keep moving.",
  "worker-8": "Patience at the dish buys a steadier hand at the face.",
  "worker-9": "Settle the inside edge first and let the rest show you what it needs.",
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
