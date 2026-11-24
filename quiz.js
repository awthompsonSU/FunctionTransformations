'use strict';

const families = [
  { name: 'Cubic', expression: x => x + '³', evaluate: x => x ** 3 },
  { name: 'Quadratic', expression: x => x + '²', evaluate: x => x ** 2 },
  { name: 'Absolute value', expression: x => '|' + x + '|', evaluate: Math.abs },
  { name: 'Square root', expression: x => '√(' + x + ')', evaluate: Math.sqrt },
  { name: 'Sine', expression: x => 'sin(' + x + ')', evaluate: Math.sin, period: 2 * Math.PI },
  { name: 'Cosine', expression: x => 'cos(' + x + ')', evaluate: Math.cos, period: 2 * Math.PI },
  { name: 'Tangent', expression: x => 'tan(' + x + ')', evaluate: Math.tan, period: Math.PI, hasPoles: true }
];

const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const scales = [0.25, 0.5, 1, 2, 3, 4];
const skills = [
  { key: 'family', label: 'Function family' },
  { key: 'h', label: 'Horizontal shift', values: offsets, identity: 0 },
  { key: 'k', label: 'Vertical shift', values: offsets, identity: 0 },
  { key: 'a', label: 'Vertical stretch / shrink', values: scales, identity: 1 }
];

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const graphSkills = skills.slice(1);

function makeProblem(previous) {
  let target;
  do {
    target = { family: pick(families) };
    // A nonempty bit mask selects the parameters that change from the parent.
    const mask = 1 + Math.floor(Math.random() * 7);
    graphSkills.forEach(({ key, values, identity }, index) => {
      target[key] = mask & (1 << index) ? pick(values.filter(value => value !== identity)) : identity;
    });
  } while (previous && skills.every(({ key }) => target[key] === previous[key]));

  const parents = shuffle([
    target.family,
    ...shuffle(families.filter(family => family !== target.family)).slice(0, 3)
  ]);
  const graphs = shuffle([
    target,
    ...graphSkills.map(({ key, values }) => {
      const period = key === 'h' && target.family.period;
      const alternatives = values.filter(value => {
        const delta = value - target[key];
        // Keep periodic distractors visibly separated from the target.
        return period ? Math.abs(delta - period * Math.round(delta / period)) >= 0.75 : delta !== 0;
      });
      return { ...target, [key]: pick(alternatives) };
    })
  ]);
  return { target, parents, graphs };
}

function equation({ family, h, k, a }) {
  const x = h ? 'x ' + (h > 0 ? '− ' : '+ ') + Math.abs(h) : 'x';
  const isPower = family === families[0] || family === families[1];
  const body = family.expression(h && isPower ? '(' + x + ')' : x);
  const tail = k ? (k > 0 ? ' + ' : ' − ') + Math.abs(k) : '';
  const coefficient = a === 1
    ? ''
    : a === 0.25 ? '¼·' : a === 0.5 ? '½·' : String(a);
  return 'f(x) = ' + coefficient + body + tail;
}

function evaluate({ family, h, k, a }, x) {
  return a * family.evaluate(x - h) + k;
}

function crossesPole(graph, left, right) {
  if (!graph.family.hasPoles) return false;
  const branch = x => Math.floor((x - graph.h + Math.PI / 2) / Math.PI);
  return branch(left) !== branch(right);
}
