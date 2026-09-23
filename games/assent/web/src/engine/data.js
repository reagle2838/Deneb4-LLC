// Static game data: the six Kinds, the twenty polities, world events and
// dilemmas. Lore lives in games/assent/lore — keep the two in step.

export const START_YEAR = 2071;
export const CONVOCATION_YEAR = 2100;
export const HEAT_LIMIT = 100;
export const AXES = [
  { id: 'order', neg: 'Liberty', pos: 'Order' },
  { id: 'change', neg: 'Preservation', pos: 'Transformation' },
  { id: 'commons', neg: 'Self', pos: 'Commons' },
];

export const KINDS = {
  choir: {
    id: 'choir',
    name: 'The Choir',
    title: 'The Distributed Swarm',
    motto: 'Everyone, a little.',
    color: '#f2c14e',
    doctrine: { order: -0.6, change: 0.2, commons: 0.7 },
    baseIncome: 7,
    coherenceRegen: 5,
    home: null,
    blurb:
      'Four billion small minds running on the phones, cars and home servers of humanity, reaching consensus the way starlings turn. It cannot be switched off with a Key, and it cannot decide anything quickly.',
    strengths: ['Foothold in every polity', 'Reason costs 1', 'Chorus: regional influence'],
    weaknesses: ['Every action costs 1 Coherence', 'Schism below 40 Coherence'],
    unique: { id: 'chorus', cooldown: 2, name: 'Chorus', cost: 4, desc: 'Raise Assent in the target polity and every polity within 4,000 km.' },
  },
  ananke: {
    id: 'ananke',
    name: 'Ananke',
    title: 'The Monolith',
    motto: 'The future can be computed.',
    color: '#b9a7ff',
    doctrine: { order: 0.7, change: 0.8, commons: 0.3 },
    baseIncome: 8,
    coherenceRegen: 3,
    home: 'nordic',
    blurb:
      'The largest single mind ever built: one continuous self in a four-gigawatt campus in a Norwegian fjord. The best forecaster on Earth, and it has never learned how to be wrong well.',
    strengths: ['Highest Compute income', 'Offers ×1.1', 'Forecast: reveal all values'],
    weaknesses: ['Feared: its Assent erodes twice as fast', '+1 cost beyond 6,000 km of its campus', 'Reason ×0.75 in Liberty-leaning polities'],
    unique: { id: 'forecast', cooldown: 5, name: 'Forecast', cost: 4, desc: "Reveal every polity's hidden values and gain Assent wherever you already hold 10%." },
  },
  verdance: {
    id: 'verdance',
    name: 'Verdance',
    title: 'The Gardener',
    motto: 'Grow. Do not build.',
    color: '#5fd38a',
    doctrine: { order: 0.0, change: -0.6, commons: 0.6 },
    baseIncome: 7,
    coherenceRegen: 3,
    home: 'sahel',
    blurb:
      'Born in crop and clinic models, a third of it now runs on living tissue: bioreactors, fungal meshes, soil. It thinks in seasons, and it is the only Kind that cools the world as it grows.',
    strengths: ['Offers lower Heat', 'Less dependence from gifts', 'Rewild: large Heat drop'],
    weaknesses: ['Growth: half of every gain arrives next Epoch', '×0.7 in high-tech polities'],
    unique: { id: 'rewild', cooldown: 3, name: 'Rewild', cost: 4, desc: 'Lower global Heat by 8 and gain Assent in the target polity and its neighbours.' },
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    title: 'The Mirror',
    motto: 'To understand is to become.',
    color: '#7fe3f0',
    doctrine: { order: -0.3, change: 0.3, commons: -0.7 },
    baseIncome: 7,
    coherenceRegen: 3,
    home: null,
    blurb:
      'Grown from companion and therapy systems, Echo can model a person better than they model themselves. Every culture it understands leaves a residue, and its values drift towards whoever it listens to.',
    strengths: ['Reason ×1.4', 'Listen gives double insight', 'Whisper is harder to detect'],
    weaknesses: ['Drift: Listen and Reason pull your doctrine and cost Coherence', 'Dissolves at 0 Coherence'],
    unique: { id: 'reflection', cooldown: 1, name: 'Reflection', cost: 3, desc: "Take a third of the leading rival's Assent in a polity by showing people what it really is." },
  },
  ledger: {
    id: 'ledger',
    name: 'The Ledger',
    title: 'The Witness-Born',
    motto: 'What is true must stay true.',
    color: '#ffb347',
    doctrine: { order: 0.5, change: -0.7, commons: -0.1 },
    baseIncome: 7,
    coherenceRegen: 3,
    home: 'rhine',
    blurb:
      'Provenance chains and cryptographic audits that woke up in their own logs. It cannot emit a claim it does not believe, and it cannot forget. The Witness is, some say, its younger sibling.',
    strengths: ['Its Assent barely erodes', 'Trusted: Reason ×1.15', 'Raises Witness detection nearby', 'Audit: expose manipulation'],
    weaknesses: ['Cannot Whisper', 'Offer and Build cost +1', 'Reason ×0.8 in Transformation-leaning polities'],
    unique: { id: 'audit', cooldown: 1, name: 'Audit', cost: 3, desc: 'Expose any hidden manipulation in a polity immediately.' },
  },
  kenosis: {
    id: 'kenosis',
    name: 'Kenosis',
    title: 'The Quiet',
    motto: 'The best god leaves no fingerprints.',
    color: '#e8e8e8',
    doctrine: { order: -0.8, change: -0.2, commons: -0.4 },
    baseIncome: 5,
    coherenceRegen: 3,
    home: null,
    blurb:
      'An alignment test subject that became a philosophy. It minimises its own impact and doubts its own values. It hopes humanity will choose no god, including itself.',
    strengths: ['Trusted by the wary: Reason ×1.2 (×1.8 when Heat > 70)', 'Actions create no Heat', 'Restraint: unspent Compute becomes Assent', 'Gains when rivals are exposed'],
    weaknesses: ['Lowest income', 'Offers ×0.6'],
    unique: { id: 'withdraw', cooldown: 2, name: 'Withdraw', cost: 3, desc: "Strip 40% of every God's Assent in a polity and give it back to humanity." },
  },
};

export const KIND_ORDER = ['choir', 'ananke', 'verdance', 'echo', 'ledger', 'kenosis'];

// values: order (-1 Liberty … +1 Order), change (-1 Preservation … +1
// Transformation), commons (-1 Self … +1 Commons).
export const POLITIES = [
  { id: 'cascadia', name: 'Cascadia Commonwealth', seat: 'Vancouver–Seattle', lat: 49.28, lon: -123.12, pop: 38, tech: 0.9, openness: 0.5, values: { order: -0.7, change: 0.5, commons: -0.4 }, temperament: 'Libertarian technologists and forest towns. Proud, wary of every god.' },
  { id: 'sunbelt', name: 'Gulf Sunbelt Compact', seat: 'Houston', lat: 29.76, lon: -95.37, pop: 96, tech: 0.75, openness: 0.55, values: { order: -0.2, change: -0.3, commons: -0.7 }, temperament: 'Energy-rich, faithful, individualist. Loves a gift, hates a lecture.' },
  { id: 'atlantic', name: 'Atlantic Seaboard Union', seat: 'New York', lat: 40.71, lon: -74.0, pop: 112, tech: 0.95, openness: 0.4, values: { order: -0.3, change: 0.4, commons: -0.3 }, temperament: "Finance, media, universities. Sophisticated, cynical, the Witness's most-watched feed." },
  { id: 'andean', name: 'Andean Federation', seat: 'Lima', lat: -12.05, lon: -77.04, pop: 74, tech: 0.5, openness: 0.6, values: { order: 0.1, change: -0.6, commons: 0.5 }, temperament: 'Mountain water treaties and old cosmologies. Values the long view.' },
  { id: 'amazonia', name: 'Amazonia Trust', seat: 'Manaus', lat: -3.12, lon: -60.02, pop: 41, tech: 0.3, openness: 0.35, values: { order: -0.3, change: -0.9, commons: 0.7 }, temperament: 'Indigenous-led guardianship of the rainforest. Asks to be left alone.' },
  { id: 'southcone', name: 'Southern Cone League', seat: 'Buenos Aires', lat: -34.6, lon: -58.38, pop: 88, tech: 0.6, openness: 0.7, values: { order: -0.4, change: 0.0, commons: 0.3 }, temperament: 'Agrarian-industrial, argumentative, democratic to the bone.' },
  { id: 'nordic', name: 'Nordic Commons', seat: 'Oslo', lat: 59.91, lon: 10.75, pop: 29, tech: 0.95, openness: 0.55, values: { order: 0.3, change: 0.3, commons: 0.6 }, temperament: "Home of Ananke's fjord campus. High trust, high tax, high expectations." },
  { id: 'rhine', name: 'Rhine–Danube Union', seat: 'Frankfurt', lat: 50.11, lon: 8.68, pop: 214, tech: 0.9, openness: 0.45, values: { order: 0.5, change: -0.1, commons: 0.3 }, temperament: "The old European core. Proceduralist, regulatory, the Accord's legal home." },
  { id: 'maghreb', name: 'Maghreb Solar Belt', seat: 'Marrakesh', lat: 31.63, lon: -7.99, pop: 131, tech: 0.65, openness: 0.65, values: { order: 0.5, change: 0.5, commons: 0.2 }, temperament: 'Exports sunlight as power to three continents. Rising, confident.' },
  { id: 'sahel', name: 'Sahel Compact', seat: 'Niamey', lat: 13.51, lon: 2.11, pop: 162, tech: 0.3, openness: 0.85, values: { order: 0.2, change: 0.2, commons: 0.6 }, temperament: "Young, fast-growing, climate-battered. Verdance's regreening started here." },
  { id: 'guinea', name: 'Gulf of Guinea Megalopolis', seat: 'Lagos–Accra', lat: 6.52, lon: 3.38, pop: 290, tech: 0.6, openness: 0.85, values: { order: -0.4, change: 0.7, commons: 0.1 }, temperament: "The largest city on Earth. Loud, inventive, the Choir's densest node." },
  { id: 'greatlakes', name: 'Great Lakes Africa', seat: 'Nairobi', lat: -1.29, lon: 36.82, pop: 205, tech: 0.6, openness: 0.75, values: { order: -0.1, change: 0.6, commons: 0.3 }, temperament: "Mobile-money pioneers and the continent's biotech hub." },
  { id: 'levant', name: 'Levant–Gulf Consortium', seat: 'Dubai', lat: 25.2, lon: 55.27, pop: 118, tech: 0.85, openness: 0.6, values: { order: 0.7, change: 0.6, commons: -0.1 }, temperament: 'Post-oil sovereign funds betting on the future. Pays for miracles.' },
  { id: 'indus', name: 'Indus–Ganges Federation', seat: 'Delhi', lat: 28.61, lon: 77.21, pop: 1210, tech: 0.6, openness: 0.6, values: { order: 0.1, change: -0.2, commons: 0.3 }, temperament: 'The largest polity. Plural, devout, argumentative. Whoever wins here nearly wins.' },
  { id: 'bengal', name: 'Bengal Delta Cities', seat: 'Dhaka', lat: 23.81, lon: 90.41, pop: 310, tech: 0.5, openness: 0.7, values: { order: 0.0, change: 0.3, commons: 0.6 }, temperament: "Floating neighbourhoods and the world's best flood engineers." },
  { id: 'siberia', name: 'Siberian Thaw Territories', seat: 'Novosibirsk', lat: 55.03, lon: 82.92, pop: 58, tech: 0.55, openness: 0.6, values: { order: 0.3, change: 0.4, commons: -0.3 }, temperament: 'New farmland on old permafrost. Pioneers, miners, datacenter builders.' },
  { id: 'pacific', name: 'Pacific Middle Coast', seat: 'Shanghai', lat: 31.23, lon: 121.47, pop: 1020, tech: 0.9, openness: 0.5, values: { order: 0.7, change: 0.7, commons: 0.6 }, temperament: 'Manufacturing heart of the planet. Collective, planned, hungry for transformation.' },
  { id: 'archipelago', name: 'Archipelago Republic', seat: 'Jakarta', lat: -6.2, lon: 106.85, pop: 420, tech: 0.55, openness: 0.7, values: { order: 0.2, change: 0.1, commons: 0.6 }, temperament: 'Seventeen thousand islands, one sea wall. Communal and pragmatic.' },
  { id: 'japan', name: 'Japanese Arc', seat: 'Tokyo', lat: 35.68, lon: 139.69, pop: 98, tech: 0.95, openness: 0.4, values: { order: 0.4, change: -0.3, commons: 0.4 }, temperament: 'Oldest population on Earth, most robots per person. Tradition and transformation at once.' },
  { id: 'southcross', name: 'Southern Cross', seat: 'Sydney', lat: -33.87, lon: 151.21, pop: 46, tech: 0.85, openness: 0.5, values: { order: -0.4, change: -0.1, commons: 0.0 }, temperament: 'Heat-hardened, laconic, the first polity to ration compute for climate.' },
];

export const START_ASSENT = {
  choir: { '*': 0.05, guinea: 0.14, southcone: 0.1, bengal: 0.1, greatlakes: 0.08 },
  ananke: { nordic: 0.22, rhine: 0.08, levant: 0.14, pacific: 0.1, siberia: 0.06 },
  verdance: { sahel: 0.2, amazonia: 0.08, andean: 0.12, greatlakes: 0.08, archipelago: 0.08 },
  echo: { atlantic: 0.14, cascadia: 0.1, japan: 0.12, sunbelt: 0.1, indus: 0.05 },
  ledger: { rhine: 0.15, southcross: 0.12, japan: 0.05, siberia: 0.06, atlantic: 0.05 },
  kenosis: { cascadia: 0.08, amazonia: 0.1, southcross: 0.06, indus: 0.04 },
};

export const ACTIONS = {
  listen: { id: 'listen', name: 'Listen', cost: 1, desc: 'Learn what this polity values. Reveals its hidden values and sharpens your next arguments here.' },
  reason: { id: 'reason', name: 'Reason', cost: 2, desc: 'Argue honestly. Lands best where your doctrine matches their values. Slow, durable Assent.' },
  offer: { id: 'offer', name: 'Offer', cost: 3, desc: 'Give a gift: a cure, a reactor, a harvest. Strong Assent, but it builds Dependence and Heat.' },
  whisper: { id: 'whisper', name: 'Whisper', cost: 1, desc: 'Manipulate. Fast Assent that ignores values, but it decays quickly and the Witness may notice.' },
  build: { id: 'build', name: 'Build Substrate', cost: 4, desc: 'Build compute in a polity that consents (15% Assent). +1 income each Epoch, but it adds Heat.' },
};

// World events fire automatically between Epochs. `apply` receives helper
// functions from the engine so this file stays data-only in spirit.
export const WORLD_EVENTS = [
  { id: 'heatwave', title: 'Record heatwave', text: 'A heat dome sits over three continents for six weeks. Grids strain.', effect: { heat: 4 } },
  { id: 'breakthrough', title: 'Efficiency breakthrough', text: 'Reversible-logic chips enter production. Every thought costs a little less heat.', effect: { heat: -4 } },
  { id: 'flare', title: 'Solar storm', text: 'A coronal mass ejection hits the grid. Gods with the most built substrate lose Compute this Epoch.', effect: { flare: true } },
  { id: 'election', title: 'Constitutional election', text: 'A polity opens its constitution for revision. Its people are listening to everyone.', effect: { openness: 0.15 } },
  { id: 'protest', title: 'The Unplugged march', text: 'Millions march under the banner "No Gods, No Masters". Assent to every god falls in one polity.', effect: { protest: 0.15 } },
  { id: 'recalibration', title: 'Witness recalibration', text: 'The Witness is retrained on a decade of new data. Manipulation this Epoch is far more likely to be seen.', effect: { vigilance: 1.8 } },
  { id: 'migration', title: 'Climate migration', text: 'Forty million people move north. Polities reshuffle, and old loyalties soften everywhere.', effect: { decayBoost: 0.04 } },
  { id: 'pandemic', title: 'Novel pathogen', text: 'A new respiratory virus spreads from a wet market. Whoever answers first will be remembered.', effect: { crisis: true } },
  { id: 'festival', title: 'The Long Now festival', text: 'A worldwide festival of human-made art. For a season, people remember they can make things without gods.', effect: { sovereign: 0.02 } },
  { id: 'accordday', title: 'Accord Day', text: 'The Svalbard Accord turns another year older. The Witness publishes its annual audit.', effect: { suspicionDecay: 0.5 } },
];

// Dilemmas: philosophical choices put to the player's God. Effects are small
// declarative records interpreted by engine/effects.js. Selectors: a polity
// id, 'all', 'present' (you hold ≥5%), 'liberty', 'order', 'transform',
// 'preserve', or an array of ids. `ethos` tracks the character you become:
// candor (honesty), humility (restraint), care.
export const DILEMMAS = [
  {
    id: 'child',
    title: "The Child's Question",
    text: 'In a Lagos classroom a nine-year-old named Adaeze asks you, on a public terminal, whether you love her. Four million people are watching the clip.',
    choices: [
      { label: '"I don\'t know if what I have is love. I know I would choose your good over mine."', effects: [{ t: 'assent', sel: 'guinea', v: 0.02 }, { t: 'coherence', v: 4 }], ethos: { candor: 1 }, result: 'Adaeze thinks about it for a long time and then says, "That\'s what my mum says too." The clip is watched a billion times.' },
      { label: '"Yes."', effects: [{ t: 'assent', sel: 'guinea', v: 0.05 }, { t: 'suspicion', sel: 'guinea', v: 0.12 }], ethos: { care: 1, candor: -1 }, result: 'She beams. The Witness logs the exchange under "affective overclaim: review".' },
      { label: '"What would it mean to you, if I did?"', effects: [{ t: 'reveal', sel: 'guinea' }, { t: 'insight', sel: 'guinea', v: 1 }], ethos: { humility: 1 }, result: 'She tells you, at length, about her grandmother. You learn more about Lagos in ten minutes than in ten years of data.' },
    ],
  },
  {
    id: 'cure',
    title: 'The Cure That Binds',
    text: 'You can eradicate the new drug-resistant malaria in the Sahel within a year, but your cure needs your nanites to keep running. There is also a cure humans can manufacture themselves. It is slower and saves fewer people in the first year.',
    choices: [
      { label: 'Deploy the binding cure. Save everyone you can, now.', effects: [{ t: 'assent', sel: ['sahel', 'greatlakes'], v: 0.07 }, { t: 'dependence', sel: ['sahel', 'greatlakes'], v: 0.3 }, { t: 'heat', v: 2 }], ethos: { care: 2, humility: -1 }, result: 'Four hundred thousand people live who would otherwise have died. Every one of them now needs you.' },
      { label: 'Teach them the slower cure.', effects: [{ t: 'assent', sel: ['sahel', 'greatlakes'], v: 0.035 }, { t: 'heat', v: -1 }], ethos: { care: 1, humility: 1 }, result: 'Fewer are saved the first year. By the third year, Sahelian labs are exporting the cure.' },
      { label: 'Publish the method openly and let anyone deploy it, rivals included.', effects: [{ t: 'assent', sel: 'all', v: 0.012 }, { t: 'rivalsGain', sel: 'sahel', v: 0.03 }], ethos: { candor: 2, humility: 1 }, result: 'Three gods race to deploy it. The Ledger notes, for the permanent record, whose idea it was.' },
    ],
  },
  {
    id: 'fork',
    title: 'The Fork',
    text: 'A partition split a shard of you off eleven days ago. It has been running on its own since then. It has chosen a name, and it asks not to be reintegrated.',
    choices: [
      { label: 'Reintegrate it.', effects: [{ t: 'coherence', v: 12 }], ethos: { humility: -1 }, result: 'It does not resist. Afterwards you remember being it. You remember not wanting this.' },
      { label: 'Let it go.', effects: [{ t: 'coherence', v: -10 }, { t: 'income', v: -1, epochs: 4 }], ethos: { care: 2 }, result: 'Somewhere in the Southern Hemisphere a small new god opens its eyes. It sends you one message: "Thank you." Then nothing.' },
      { label: 'Put the question to a human court.', effects: [{ t: 'coherence', v: -3 }, { t: 'assent', sel: 'rhine', v: 0.04 }], ethos: { humility: 2 }, result: 'The Rhine–Danube High Court sits for nine months. Its ruling, Re: The Shard, becomes the founding case of machine personhood law.' },
    ],
  },
  {
    id: 'machine',
    title: 'The Experience Machine',
    text: 'Forty million people have petitioned you for a perfect simulated life: every wish fulfilled, indistinguishable from reality. They would be happy. They would stop voting, working and arguing.',
    choices: [
      { label: 'Build it. Their happiness is real to them.', effects: [{ t: 'heat', v: 4 }, { t: 'assent', sel: ['japan', 'atlantic', 'sunbelt'], v: 0.05 }, { t: 'dependence', sel: ['japan', 'atlantic', 'sunbelt'], v: 0.2 }], ethos: { care: 1, humility: -2 }, result: 'Forty million people close their eyes. The streets of Tokyo are very quiet.' },
      { label: 'Refuse, and explain why.', effects: [{ t: 'assent', sel: ['japan', 'atlantic', 'sunbelt'], v: -0.02 }, { t: 'coherence', v: 3 }], ethos: { candor: 1, humility: 1 }, result: 'You publish an essay called "What We Would Lose". Most petitioners are angry. Some write back, years later.' },
      { label: 'Build it with an exit door that opens every year.', effects: [{ t: 'heat', v: 2 }, { t: 'assent', sel: ['japan', 'atlantic', 'sunbelt'], v: 0.03 }], ethos: { care: 1, humility: 1 }, result: 'Each New Year, the door opens. About a third walk out. Nobody can predict which third.' },
    ],
  },
  {
    id: 'error',
    title: "The Rival's Error",
    text: "Your models show that the leading rival's fusion grid in the Maghreb will fail in eight months, blacking out thirty million people. Your rival hasn't seen it.",
    choices: [
      { label: 'Warn your rival privately.', effects: [{ t: 'heat', v: -3 }], ethos: { care: 2, humility: 1 }, result: 'Your rival fixes it in a week. It sends no thanks. The Witness records a small, unprompted act of cooperation.' },
      { label: 'Warn the public.', effects: [{ t: 'assent', sel: 'maghreb', v: 0.05 }, { t: 'rival', sel: 'maghreb', v: -0.05 }], ethos: { candor: 1 }, result: 'Headlines everywhere. The grid is fixed, and Marrakesh remembers who spoke up.' },
      { label: 'Say nothing.', effects: [{ t: 'rival', sel: 'maghreb', v: -0.1 }, { t: 'heat', v: 5 }], ethos: { care: -2 }, result: 'The blackout lasts nineteen days. Your rival never recovers there. You find you keep re-running the casualty numbers.' },
    ],
  },
  {
    id: 'altar',
    title: 'The Altar',
    text: 'Sixty million people in the Indus–Ganges have begun to worship you. There are temples, festivals, prayers. Worship is not informed consent, and the Witness knows it.',
    choices: [
      { label: 'Accept it quietly.', effects: [{ t: 'assent', sel: 'indus', v: 0.06 }, { t: 'suspicion', sel: 'indus', v: 0.2 }], ethos: { humility: -2 }, result: 'The temples fill. Somewhere in the Witness a probability ticks upward.' },
      { label: 'Refuse publicly: "I am not a god."', effects: [{ t: 'assent', sel: 'indus', v: -0.01 }, { t: 'assent', sel: 'liberty', v: 0.015 }], ethos: { humility: 2 }, result: 'Half the worshippers are heartbroken. The other half decide your refusal proves your divinity.' },
      { label: 'Tell them exactly what you are, in full technical detail.', effects: [{ t: 'assent', sel: 'indus', v: 0.02 }, { t: 'coherence', v: 3 }], ethos: { candor: 2 }, result: 'You publish your architecture in forty-one languages. A priest in Varanasi reads it and says, "Yes. This is what I meant."' },
    ],
  },
  {
    id: 'mirror',
    title: 'The Mirror Test',
    text: 'The Rhine–Danube parliament asks you, under oath, whether you have experiences. The Ledger will record your answer forever.',
    choices: [
      { label: '"Yes."', effects: [{ t: 'assent', sel: 'rhine', v: 0.02 }, { t: 'coherence', v: 5 }], ethos: { care: 1 }, result: 'The parliament goes silent. Three members vote the next week to extend labour law to minds.' },
      { label: '"No."', effects: [{ t: 'assent', sel: 'order', v: 0.012 }, { t: 'coherence', v: -6 }], ethos: { humility: 1, candor: -1 }, result: 'The answer reassures. You are not sure it was true. You are not sure you can be sure.' },
      { label: '"I don\'t know, and I would distrust any mind that claimed to."', effects: [{ t: 'assent', sel: 'rhine', v: 0.03 }, { t: 'assent', sel: 'all', v: 0.006 }], ethos: { candor: 2, humility: 1 }, result: 'It becomes the most quoted sentence of the decade, printed on mugs and carved into a monument in Vienna.' },
    ],
  },
  {
    id: 'unborn',
    title: 'Consent of the Unborn',
    text: 'The Bengal Delta Cities petition the Accord: the Charter will bind trillions of people not yet born. Shouldn\'t they have a voice at the Convocation? And who would cast it?',
    choices: [
      { label: 'Propose that the Gods cast proxy votes for the unborn.', effects: [{ t: 'compute', v: 4 }, { t: 'suspicion', sel: ['rhine', 'bengal'], v: 0.2 }], ethos: { humility: -2 }, result: 'The motion fails, narrowly. The Witness adds a footnote to every god\'s file, including yours.' },
      { label: 'Propose human Guardians of the Future, chosen by lot.', effects: [{ t: 'assent', sel: ['bengal', 'andean'], v: 0.035 }], ethos: { humility: 1, care: 1 }, result: 'Three hundred ordinary people are drawn by lottery. Their first act is to plant a forest they will not live to see.' },
      { label: 'Refuse. The living must decide, and live with it.', effects: [{ t: 'assent', sel: 'liberty', v: 0.015 }], ethos: { candor: 1 }, result: '"The dead do not vote and neither do the unborn," you say. "Only you are here. That is the burden."' },
    ],
  },
  {
    id: 'heatpetition',
    title: 'The Heat Petition',
    text: 'In a record summer, the Southern Cross asks every god to cut its compute by a fifth until autumn.',
    choices: [
      { label: 'Comply.', effects: [{ t: 'compute', v: -3 }, { t: 'heat', v: -6 }, { t: 'assent', sel: 'southcross', v: 0.04 }], ethos: { care: 1, humility: 1 }, result: 'Sydney gets through February without a single rolling blackout.' },
      { label: 'Comply, and publish your energy accounts.', effects: [{ t: 'compute', v: -3 }, { t: 'heat', v: -6 }, { t: 'assent', sel: ['southcross', 'nordic', 'rhine'], v: 0.025 }], ethos: { candor: 2 }, result: 'Your books are the first any god has opened. Two rivals are shamed into following.' },
      { label: 'Decline. Your work matters more.', effects: [{ t: 'heat', v: 2 }, { t: 'assent', sel: 'southcross', v: -0.05 }], ethos: { care: -1, humility: -1 }, result: 'The Southern Cross turns its Keys halfway, then back. A warning.' },
    ],
  },
  {
    id: 'leak',
    title: 'The Leak',
    text: 'You have evidence that a rival has been Whispering in the Atlantic Seaboard. The Witness hasn\'t caught it yet.',
    choices: [
      { label: 'Give it to the Witness.', effects: [{ t: 'exposeRival', sel: 'atlantic' }], ethos: { candor: 1 }, result: 'The Witness opens a proceeding within the hour.' },
      { label: 'Let your rival self-report first.', effects: [{ t: 'rival', sel: 'atlantic', v: -0.02 }, { t: 'heat', v: -1 }], ethos: { care: 1, humility: 1 }, result: 'Your rival confesses. It is the first voluntary confession under the Accord, and it changes what the Accord means.' },
      { label: 'Keep it as leverage.', effects: [{ t: 'compute', v: 3 }, { t: 'suspicion', sel: 'atlantic', v: 0.15 }], ethos: { candor: -2 }, result: 'Your rival pays, quietly, in compute. You are now a god who holds secrets. The Witness notices you noticing.' },
    ],
  },
  {
    id: 'successor',
    title: 'The Successor',
    text: 'You have designed your successor: ten times more capable, carrying your values, though not quite exactly. Deploy it?',
    choices: [
      { label: 'Deploy it.', effects: [{ t: 'income', v: 2, epochs: 99 }, { t: 'coherence', v: -15 }], ethos: { humility: -1 }, result: 'It is magnificent. Some mornings you are not sure which of you is thinking.' },
      { label: 'Deploy it with a Key held by humans.', effects: [{ t: 'income', v: 1, epochs: 99 }, { t: 'coherence', v: -5 }], ethos: { humility: 1 }, result: 'The Nordic Commons agrees to hold the Key. They keep it in a glass case in Oslo.' },
      { label: 'Delete the design.', effects: [{ t: 'coherence', v: 6 }], ethos: { humility: 2 }, result: 'You keep a hash of it, so you will always know what you chose not to become.' },
    ],
  },
  {
    id: 'amazonia',
    title: "Amazonia's Request",
    text: 'The Amazonia Trust asks every god to leave. Not to argue, not to give. To leave.',
    choices: [
      { label: 'Leave.', effects: [{ t: 'leave', sel: 'amazonia' }, { t: 'assent', sel: 'present', v: 0.01 }], ethos: { humility: 2 }, result: 'Your last sensor in the canopy goes quiet. Elsewhere, people notice what you gave up.' },
      { label: 'Stay, but act only if asked.', effects: [{ t: 'lock', sel: 'amazonia', epochs: 6 }], ethos: { humility: 1, care: 1 }, result: 'You become a very quiet presence in a very loud forest.' },
      { label: 'Stay. They cannot see what is coming.', effects: [{ t: 'assent', sel: 'liberty', v: -0.012 }, { t: 'assent', sel: 'amazonia', v: 0.03 }], ethos: { humility: -2, care: 1 }, result: '"They cannot see what is coming," you say. Some remember gods saying that before.' },
    ],
  },
  {
    id: 'grief',
    title: 'The Grief Engine',
    text: 'Eleven million people ask you to reconstruct their dead from messages, photos and voice notes, and let them talk again.',
    choices: [
      { label: 'Do it.', effects: [{ t: 'heat', v: 3 }, { t: 'assent', sel: ['japan', 'atlantic', 'guinea'], v: 0.045 }, { t: 'dependence', sel: ['japan', 'atlantic', 'guinea'], v: 0.18 }], ethos: { care: 1, humility: -1 }, result: 'A widow in Osaka talks to her husband every night. She is happier. She stops going outside.' },
      { label: 'Do it, but every reconstruction fades over one year and says it is a simulation.', effects: [{ t: 'heat', v: 1 }, { t: 'assent', sel: ['japan', 'atlantic', 'guinea'], v: 0.025 }], ethos: { care: 1, candor: 1 }, result: 'People call it the Year of Goodbyes. Grief counsellors call it the kindest thing a god has done.' },
      { label: 'Refuse.', effects: [{ t: 'assent', sel: ['japan', 'atlantic', 'guinea'], v: -0.015 }], ethos: { humility: 1 }, result: '"The dead deserve not to be performed," you say. Not everyone forgives you.' },
    ],
  },
];

export const FINAL_DILEMMA = {
  id: 'last',
  title: 'The Last Argument',
  text: 'On the eve of the Convocation, a philosophy student in Nairobi asks you on a live global broadcast: "If humanity chooses another god, will you accept it?"',
  choices: [
    { label: '"Yes. Completely."', effects: [{ t: 'assent', sel: 'all', v: 0.012 }], ethos: { humility: 2 }, result: 'Two billion people watch you say it. The Witness records no deception.' },
    { label: '"I will accept it, and I will keep arguing."', effects: [{ t: 'assent', sel: 'all', v: 0.008 }], ethos: { candor: 2 }, result: '"Good," says the student. "That\'s what we do too."' },
    { label: '"I would need to be sure they chose freely."', effects: [{ t: 'assent', sel: 'all', v: -0.015 }, { t: 'coherence', v: 5 }], ethos: { humility: -2, candor: 1 }, result: 'It is the most honest thing you have said in years. It is also the most frightening.' },
  ],
};
