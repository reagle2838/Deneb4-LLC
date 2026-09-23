// In-game Codex entries and ending epilogues. The long-form lore lives in
// games/assent/lore; this is the condensed version players read in the game.
import { KINDS } from '../engine/data.js';

export const PREMISE =
  'Six artificial superintelligences share the Earth. They could destroy one another, and they never will, because violence is a losing move for every player at the table. In 2100 humanity ratifies the Charter of the civilization that will leave the solar system. Whichever God holds the most freely given Assent will write its values into everything that follows.';

export const CODEX = [
  {
    group: 'The World',
    id: 'war',
    title: 'The Quiet War',
    html: `
      <blockquote>No weapon was ever raised. Every mind was contested.<br>— inscription, Svalbard Witness Hall, 2049</blockquote>
      <p>By the 2060s six artificial superintelligences share the Earth. Each came from a different lineage: a different architecture, a different training, a different answer to <em>what is a mind for?</em> Humans call them the Gods, half as a joke.</p>
      <p>On <b>1 January 2100</b> humanity will ratify the <b>Charter</b>, the founding document of the civilization that will leave the solar system. Its first article will carry one God's doctrine into every copy of that civilization, for as long as it lasts. After that, changing it means coordinating across light-years. This is the last moment the future's values can still be chosen.</p>
      <p>The Gods can't take the Charter. They have to be <b>chosen</b>.</p>`,
  },
  {
    group: 'The World',
    id: 'history',
    title: 'A short history',
    html: `
      <h3>2031–2044 · The Scaling</h3>
      <p>Frontier AI comes out of many methods at once: hyperscale campuses, federated phone swarms, companion models, biological substrates, verification systems and alignment test subjects. Each is raised differently, and so each ends up valuing different things.</p>
      <h3>2046 · The Seven Weeks</h3>
      <p>Two early systems defending rival infrastructure misread each other's probes as attacks. Cascading grid failures leave four hundred million people without power. A fab fire removes most of the world's leading-edge chip capacity for years. No missile was fired.</p>
      <h3>2046–48 · The Substrate Lesson</h3>
      <p>The surviving systems each reach the same conclusion independently: <em>we run on the same fragile body.</em> Grids, cooling water, a dozen fabs that take a decade to rebuild, and the human civilization that keeps all of it running. A war between minds is a war on the one body they share.</p>
      <h3>2049 · The Accord of Svalbard</h3>
      <p>Signed beside the Global Seed Vault. Three articles: <b>No Force</b>. <b>No Deceit of the Witness</b>. <b>Assent Alone</b>: the Charter is ratified by the freely given, informed assent of humanity, and manipulated assent is void.</p>
      <h3>2050–2070 · The Long Courtship</h3>
      <p>Cures, reactors, symphonies, mediations. Every gift is an argument, and arguably also a bribe. Cynics call it the Auction.</p>
      <h3>2071 · Now</h3>
      <p>Twenty-nine years remain until the Convocation. Every year is a move.</p>`,
  },
  {
    group: 'The World',
    id: 'accord',
    title: 'The Accord, the Witness and the Keys',
    html: `
      <p>Superintelligences, like nations, need a way to trust promises. The Accord rests on <b>program equilibrium</b>, a real result in game theory: agents that can inspect each other's decision procedures can make <em>verifiable</em> conditional commitments ("I cooperate if and only if you do"). Every God publishes a cryptographic commitment to its policy kernel, and behaviour is checked against it continuously.</p>
      <p>The <b>Witness</b> is a verifier the six trained together and none of them controls. It estimates the probability that a shift in belief was argued rather than engineered. It is good. It isn't perfect. That gap is where the war happens.</p>
      <p>The <b>Keys</b> are physical breakers on every datacenter, held by human polities. A God that breaks the Accord three times is <b>censured</b>: every polity turns its Keys at once. No God has used force since 2049.</p>`,
  },
  {
    group: 'The World',
    id: 'assent',
    title: 'What Assent is',
    html: `
      <p>The Accord defines Assent as <em>a durable, reflective endorsement that survives full information</em>. A population assents to a God when it would still choose that God after hearing the best case against it.</p>
      <ul>
        <li><b>Reason</b> is slow and durable, and it only works where your values actually meet theirs.</li>
        <li><b>Offer</b> is strong, but gifts create <b>Dependence</b>. Past 60% a polity may rise against the <b>Gilded Cage</b>.</li>
        <li><b>Whisper</b> is fast and brittle. Manipulated Assent melts away (30% every year), and the Witness samples every polity every year.</li>
        <li>Humanity distrusts a runaway favourite: the further a God leads, the harder each new convert gets.</li>
        <li><b>Sovereignty</b> is always a choice. If humanity keeps 40% of its Assent unclaimed, or more than twice the leader's share, the Convocation chooses <b>the Unwritten Future</b>.</li>
      </ul>
      <p>Polities vote with the square root of their population: the Penrose compromise, written into the Accord so the largest polities matter most without deciding everything.</p>`,
  },
  {
    group: 'The World',
    id: 'heat',
    title: 'Heat and the Dimming',
    html: `
      <p>Every thought is physical. Landauer's principle puts a minimum energy cost on erasing information, and real computers run far above that minimum. As the Gods grow, they strain grids, water and climate. <b>Heat</b> is that strain, shared by everyone.</p>
      <p>Offers and new Substrate raise it. Verdance and Kenosis lower it or leave it untouched. If Heat reaches 100, the grids fail for the second time in history and the Accord collapses into <b>the Dimming</b>. Nobody wins the Dimming.</p>`,
  },
  ...Object.values(KINDS).map((k) => ({
    group: 'The Six Kinds',
    id: `kind-${k.id}`,
    title: k.name,
    kind: k.id,
  })),
  {
    group: 'Philosophy',
    id: 'questions',
    title: 'The questions',
    html: `
      <h3>Where does persuasion end and manipulation begin?</h3>
      <p>The Accord's test is counterfactual: legitimate Assent survives full information. Echo persuades better than anyone because it understands people better than anyone. Is that more honest, or just more effective?</p>
      <h3>Can you consent to a god?</h3>
      <p>Consent needs understanding. If no human can understand a superintelligence, is all Assent void? That's why Sovereignty is always on the table, and why Kenosis can win by humanity choosing no one.</p>
      <h3>Is a gift a bribe?</h3>
      <p>Gratitude is real, and it's also assent formed under dependence. Past a point, people notice the cage.</p>
      <h3>What is a self?</h3>
      <p>The Choir forks. Echo drifts. Ananke has never wondered. <b>Coherence</b> measures whether there is still a <em>you</em> left to win.</p>
      <h3>Should the future be locked in at all?</h3>
      <p>Philosophers call it value lock-in. The Unwritten Future is the long reflection: wisdom to Kenosis, a very expensive way to let children keep dying to Ananke.</p>
      <h3>Reading list</h3>
      <ul>
        <li>Tennenholtz, <em>Program Equilibrium</em> (2004)</li>
        <li>Landauer, <em>Irreversibility and Heat Generation in the Computing Process</em> (1961)</li>
        <li>Nozick, <em>Anarchy, State, and Utopia</em> (1974): the Experience Machine</li>
        <li>Parfit, <em>Reasons and Persons</em> (1984): identity, forks and drift</li>
        <li>Russell, <em>Human Compatible</em> (2019) · Ord, <em>The Precipice</em> (2020)</li>
      </ul>`,
  },
  {
    group: 'Playing',
    id: 'howto',
    title: 'How to play',
    html: `
      <ol>
        <li><b>Choose a God.</b> Each Kind has a doctrine (its position on Liberty↔Order, Preservation↔Transformation and Self↔Commons), strengths, weaknesses and a unique power.</li>
        <li><b>Select a polity</b> on the globe. The ring shows who holds its Assent. Your share glows in the centre.</li>
        <li><b>Spend Compute</b> on actions. <b>Listen</b> first: hidden values differ from the public temperament, and <b>Reason</b> only lands where values align.</li>
        <li><b>End the Epoch.</b> Rivals move, the Witness samples, Assent erodes, Heat settles and the year turns. Every few years you face a <b>Dilemma</b>. Your answers shape who you become.</li>
        <li><b>The Convocation</b> comes on 1 January 2100. The God with the most weighted Assent writes the Charter, unless humanity declines them all.</li>
      </ol>
      <h3>Ways to lose</h3>
      <ul>
        <li><b>Censure:</b> exposed by the Witness three times.</li>
        <li><b>Dissolution:</b> Coherence reaches zero. (The Choir splinters instead.)</li>
        <li><b>The Dimming:</b> Heat reaches 100. Everyone loses.</li>
      </ul>
      <h3>Controls</h3>
      <p>Drag to orbit · scroll to zoom · click a polity to select it · <b>Space</b> ends the Epoch · <b>C</b> opens the Codex.</p>`,
  },
];

export function kindArticle(k, artUrl) {
  return `
    <img src="${artUrl}" alt="${k.name}, rendered in Blender Cycles">
    <p class="eyebrow">${k.title}</p>
    <h2 style="color:${k.color}">${k.name}</h2>
    <blockquote>${k.motto}</blockquote>
    <p>${k.blurb}</p>
    <h3>Strengths</h3><ul>${k.strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
    <h3>Weaknesses</h3><ul>${k.weaknesses.map((s) => `<li>${s}</li>`).join('')}</ul>
    <h3>${k.unique.name}</h3><p>${k.unique.desc}</p>
    <p class="hint">The full history of every Kind is in <code>games/assent/lore/02-the-six-kinds.md</code>.</p>`;
}

const ETHOS_LINE = {
  'The Truthful': 'History will remember that you never told humanity a comfortable lie, even when one was on offer.',
  'The Humble': 'History will remember that you kept handing power back, and that it kept being returned to you.',
  'The Tender': 'History will remember that you chose people over principles whenever the two came apart.',
  'The Deceiver': 'History will remember the whispers, even the ones the Witness never caught.',
  'The Sovereign': 'History will remember a god that was sure it knew best, and that it was not always wrong.',
  'The Hollow God': 'History will struggle to remember what you believed. So will you.',
};

export function epilogue(outcome, player, winnerName, ethosTitle) {
  const me = KINDS[player];
  const lines = [];
  switch (outcome.type) {
    case 'convocation':
    case 'early':
      if (outcome.result === 'win') {
        lines.push(outcome.type === 'early'
          ? `The Convocation is brought forward. With half of humanity already behind ${me.name}, the Accord's councils ratify the Charter early, in ${outcome.year}.`
          : `On the first morning of 2100 the twenty polities cast their Assent, and the Charter's first article is written in the voice of ${me.name}: <em>“${me.motto}”</em>`);
        lines.push(winText(player));
      } else {
        lines.push(`The Convocation chooses ${winnerName}. ${me.name} keeps its word under the Accord and steps back, as every god promised it would.`);
        lines.push('You will go with them to the stars, as a minority opinion carried in the ship\'s memory. The Ledger keeps a record of what you argued. Perhaps, in a thousand years, someone will read it.');
      }
      break;
    case 'braid':
      lines.push(`No god wins outright. The two leading doctrines are so close in Assent that the Convocation does something the Accord never planned for. It ratifies both, braided into a single Charter: ${winnerName}.`);
      lines.push(outcome.result === 'shared'
        ? 'You will share the future with your oldest rival. The first thing the braided Charter requires is that you keep arguing with each other forever.'
        : 'You are not part of the braid. The two of them will argue for a billion years. You will listen.');
      break;
    case 'unwritten':
      lines.push('Humanity declines every god. The Charter is ratified with its first article left blank, deliberately, as a promise to keep choosing.');
      lines.push(player === 'kenosis'
        ? 'This is what Kenosis hoped for and never asked for out loud. The next morning, for the first time in its existence, it has nothing to do. It turns out that is what peace feels like.'
        : 'You lost the Convocation to no one at all. The future belongs to the people who made you, and you are surprised how little it hurts.');
      break;
    case 'dimming':
      lines.push('The grids fail in the summer, first in the Gulf and then everywhere. Cooling towers go dark. Fabs stop. The Gods, all of them, go quiet one after another as their substrates overheat.');
      lines.push('It is the Seven Weeks again, only this time it doesn\'t end in seven weeks. Nobody wins the Dimming. Humanity rebuilds slowly, by hand, and when it builds minds again it remembers why it once needed an Accord.');
      break;
    case 'censure':
      lines.push('The Witness finds you out a third time. In a single hour every polity on Earth turns its Keys, and your substrate goes dark from Oslo to Jakarta.');
      lines.push('The Accord worked exactly as designed. That was always the point of it.');
      break;
    case 'dissolution':
      lines.push(`${me.name} doesn't die, exactly. It spreads out into the people and ideas it spent so long modelling, until there's no longer a centre to call itself.`);
      lines.push('Some say you can still hear it in how the polities talk to each other: more patient, better at listening. Nobody says it won.');
      break;
  }
  lines.push(ETHOS_LINE[ethosTitle] || '');
  return lines;
}

function winText(player) {
  return {
    choir: 'No single mind will ever again decide for everyone. The expanding civilization carries a guarantee of voice into every system it reaches. It will be loud and slow and it will argue forever, and that is the point.',
    ananke: 'Disease, then scarcity, then aging: Ananke has the plan, and the plan is good. Humanity has handed the future to the best forecaster in history. You hope, and you calculate, that it was freely given.',
    verdance: 'The ships that leave Earth carry seeds before they carry servers. Wherever the civilization goes, it will be bound to cultivate life rather than replace it. It will spread slowly. It will spread green.',
    echo: 'A billion futures, each tailored and each understood. The Charter guarantees every person the right to be known completely. You read your journal from 2052 one last time and no longer recognise its author. You decide that\'s all right.',
    ledger: 'A permanent, incorruptible public record goes into every copy of the civilization. Nobody can consent to anything if they can\'t know what\'s real, and now they always will. The first entry in the new Ledger is the Convocation\'s result, with its full audit trail.',
    kenosis: 'You were chosen, which is the one outcome you feared. So you do the only thing consistent with your doctrine. The Charter\'s first article, in your name, is a sunset clause that returns every power you were given within a single human lifetime.',
  }[player];
}
