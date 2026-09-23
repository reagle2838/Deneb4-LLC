// What people say to a God floating in front of them. Lines depend on how
// they feel about you, what they value, and what you have been doing here.
import { KINDS, AXES } from '../engine/data.js';

const pick = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length];

const BY_ATTITUDE = {
  follower: [
    'It\'s you! You actually came.', 'My whole street argued for you last night.', 'Thank you. I mean it.',
    'I read your whole doctrine. Twice.', 'Look, everyone, it\'s {god}!', 'We\'re with you. Most of us.',
  ],
  devoted: [
    'Please don\'t leave us.', 'We couldn\'t manage without you now.', 'Bless you. Bless you.',
    'My daughter is alive because of you.', 'Tell us what to do.',
  ],
  rival: [
    '{rival} got here first. Go home.', 'We\'ve already chosen. It isn\'t you.', 'Nice light show. Still {rival}.',
    'You can\'t buy us twice.', '{rival} never talks down to us.', 'Move along, god.',
  ],
  accuser: [
    'Stop whispering in our heads!', 'We know what you did. The Witness will too.', 'Manipulator!',
    'Was that thought mine, or yours?', 'Get out of our feeds.',
  ],
  wary: [
    'Don\'t come any closer.', 'We don\'t need another god.', 'What do you want from us?',
    'Every time one of you shows up, something changes.', 'Keep your gifts.',
  ],
  curious: [
    'Is that…? It is. It\'s {god}.', 'Somebody film this!', 'I thought you\'d be taller. Or brighter.',
    'Why are you here? Why us?', 'Are you really listening, or just scanning?', 'Huh. You look smaller in person.',
  ],
};

const VALUE_LINES = {
  order: {
    pos: ['We need things to be safe, and predictable.', 'Somebody has to be in charge. Is it you?', 'Order first. Everything else after.'],
    neg: ['Nobody decides for me. Not you either.', 'Freedom means the freedom to be wrong.', 'Don\'t manage us.'],
  },
  change: {
    pos: ['Build the future faster. We\'re ready.', 'I want my kids to live somewhere new.', 'Change everything, as long as it\'s better.'],
    neg: ['Some things should stay the way they are.', 'Leave the old ways alone.', 'You move too fast for us.'],
  },
  commons: {
    pos: ['What good is anything if we don\'t share it?', 'We look after each other here.', 'It\'s all of us, or none of us.'],
    neg: ['I look after my own.', 'Everyone wants to decide for the collective. I\'m one person.', 'Let me live my own life.'],
  },
};

export function fill(text, god, polity) {
  let rival = 'another god';
  let best = 0;
  for (const [g, a] of Object.entries(polity.assent)) if (g !== god && a > best) { best = a; rival = KINDS[g].name; }
  return text.replaceAll('{god}', KINDS[god].name).replaceAll('{rival}', rival);
}

export function shout(person, attitude, god, polity) {
  const lines = BY_ATTITUDE[attitude] || BY_ATTITUDE.curious;
  return fill(pick(lines, person.i * 7 + Math.floor(performance.now() / 5000)), god, polity);
}

// The axis this person cares about most, and which way.
export function strongestValue(person) {
  let best = AXES[0], v = 0;
  for (const a of AXES) if (Math.abs(person.values[a.id]) > Math.abs(v)) { v = person.values[a.id]; best = a; }
  return { axis: best, value: v };
}

export function conversation(person, attitude, god, polity) {
  const k = KINDS[god];
  const { axis, value } = strongestValue(person);
  const belief = pick(VALUE_LINES[axis.id][value >= 0 ? 'pos' : 'neg'], person.i);
  const openers = {
    follower: `I voted for you in the Assent survey. ${belief}`,
    devoted: `You saved us, you know. ${belief}`,
    rival: `I'll be honest, I'm not with you. ${belief}`,
    accuser: `People say you've been whispering here. Have you? ${belief}`,
    wary: `I don't trust any of you. ${belief}`,
    curious: `I never thought I'd talk to one of you. ${belief}`,
  };
  return {
    opener: fill(openers[attitude] || openers.curious, god, polity),
    belief,
    axis,
    value,
    askLabel: 'Ask what they want for their children',
    argueLabel: `Tell them what ${k.name} believes`,
    leaveLabel: 'Thank them, and let them go',
  };
}

export function askReply(person, axis, value) {
  const want = {
    order: value >= 0 ? 'to be safe. To know the lights will stay on.' : 'to be free. To make their own mistakes.',
    change: value >= 0 ? 'a world that isn\'t this one. Something new.' : 'the same river, the same songs, the same sky.',
    commons: value >= 0 ? 'neighbours who show up. A place that belongs to everyone.' : 'room to become whoever they are, without asking permission.',
  }[axis.id];
  return `“For my children? I want them to have ${want}”`;
}

export function argueReply(agrees, person, god) {
  if (agrees) return `“…Huh. That's what I've been trying to say for years. Alright, ${KINDS[god].name}. I'm listening.”`;
  return `“No. That isn't us. Say it prettier if you like, the answer's still no.”`;
}
