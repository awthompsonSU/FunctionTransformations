'use strict';

const byId = id => document.getElementById(id);
const storageKey = 'function-transformations-v1';
const letters = ['A', 'B', 'C', 'D'];
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short'
});
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let session;
let problem;
let stage;
const inspectPoints = byId('inspectPoints');
let activePoint;

function freshSession(name) {
  return {
    name,
    scores: Object.fromEntries(skills.map(({ key }) => [key, { right: 0, total: 0 }]))
  };
}

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (typeof saved?.name !== 'string' || !saved.name.trim()) return;
    const restored = freshSession(saved.name.trim().slice(0, 80));
    for (const { key } of skills) {
      const score = saved.scores?.[key];
      if (Number.isSafeInteger(score?.total) && Number.isSafeInteger(score.right)
          && score.right >= 0 && score.total >= score.right) {
        restored.scores[key] = score;
      }
    }
    return restored;
  } catch {
    // Practice remains available when storage is blocked.
  }
}

function saveSession() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // The active session remains available in memory.
  }
}

function accuracy({ right, total }) {
  return total ? Math.round(100 * right / total) + '%' : '—';
}

function stamp(date) {
  return dateFormat.format(date) + ' (' + timeZone + ')';
}

function updateTimestamp(date = new Date()) {
  const time = byId('timestamp');
  time.dateTime = date.toISOString();
  time.textContent = stamp(date);
}

function renderScores() {
  byId('progressName').textContent = session.name;
  byId('scores').replaceChildren(...skills.map(({ key, label }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    const score = session.scores[key];
    for (const value of [score.right, score.total, accuracy(score)]) {
      const cell = row.insertCell();
      cell.className = 'num';
      cell.textContent = value;
    }
    return row;
  }));
  updateTimestamp();
}

function record(key, correct) {
  session.scores[key].total += 1;
  session.scores[key].right += Number(correct);
}

function feedback(message, correct) {
  const status = byId('feedback');
  status.className = 'feedback' + (message ? (correct ? ' good' : ' bad') : '');
  status.textContent = message;
}

function drawGraph(graph) {
  const canvas = document.createElement('canvas');
  const width = 320;
  const height = 256;
  const unit = 14;
  const centerX = width / 2;
  const centerY = height / 2;
  const left = centerX - 10 * unit;
  const top = centerY - 8 * unit;
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.strokeStyle = '#dfe4ea';
  for (let x = -10; x <= 10; x += 1) {
    line(centerX + x * unit, top, centerX + x * unit, height - top);
  }
  for (let y = -8; y <= 8; y += 1) {
    line(left, centerY - y * unit, width - left, centerY - y * unit);
  }
  ctx.strokeStyle = '#4a515c';
  ctx.lineWidth = 1.3;
  line(left, centerY, width - left, centerY);
  line(centerX, top, centerX, height - top);
  ctx.fillStyle = '#343b46';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  for (const x of [-8, -4, 4, 8]) ctx.fillText(x, centerX + x * unit, centerY + 15);
  ctx.textAlign = 'right';
  for (const y of [-8, -4, 4, 8]) ctx.fillText(y, centerX - 4, centerY - y * unit - 3);
  ctx.fillText('x', width - 6, centerY - 4);
  ctx.fillText('y', centerX + 13, top - 4);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, 20 * unit, 16 * unit);
  ctx.clip();
  ctx.beginPath();
  ctx.strokeStyle = '#a62d2c';
  ctx.lineWidth = 2.7;
  ctx.lineJoin = 'round';
  const points = [];
  let previousX;
  for (let i = 0; i <= 1200; i += 1) {
    const x = (i - 600) / 60;
    const y = evaluate(graph, x);
    if (!Number.isFinite(y)) {
      previousX = undefined;
      continue;
    }
    const method = previousX === undefined || crossesPole(graph, previousX, x) ? 'moveTo' : 'lineTo';
    const pixelX = centerX + x * unit;
    const pixelY = centerY - y * unit;
    ctx[method](pixelX, pixelY);
    if (Math.abs(y) <= 8) {
      points.push({ x, y, left: pixelX / width, top: pixelY / height });
    }
    previousX = x;
  }
  ctx.stroke();
  ctx.restore();

  canvas.setAttribute('aria-hidden', 'true');
  return { canvas, points };
}

function nearestPoint(points, bounds, clientX, clientY) {
  let nearest;
  let bestDistance = 16 ** 2;
  for (const point of points) {
    const dx = point.left * bounds.width - (clientX - bounds.left);
    const dy = point.top * bounds.height - (clientY - bounds.top);
    const distance = dx ** 2 + dy ** 2;
    if (distance < bestDistance) {
      nearest = point;
      bestDistance = distance;
    }
  }
  return nearest;
}

function formatPoint({ x, y }) {
  return '(' + Number(x.toFixed(2)) + ', ' + Number(y.toFixed(2)) + ')';
}

function clearPoint() {
  if (activePoint) activePoint.marker.hidden = true;
  activePoint = undefined;
  byId('pointStatus').textContent = '';
}

function finishQuestion(correct, message, selected, correctIndex) {
  stage = 'finished';
  clearPoint();
  inspectPoints.disabled = true;
  byId('pointHelp').hidden = true;
  const buttons = [...byId('choices').children];
  buttons.forEach(button => { button.disabled = true; });
  buttons[correctIndex].classList.add('correct');
  if (!correct) selected.classList.add('incorrect');
  feedback(message, correct);
  byId('next').hidden = false;
  byId('next').focus();
}

function answerFamily(family, button) {
  if (stage !== 'family') return;
  const correct = family === problem.target.family;
  record('family', correct);
  saveSession();
  renderScores();
  if (correct) {
    showGraphs();
    return;
  }
  const answer = problem.target.family;
  finishQuestion(false, 'The parent function was ' + answer.expression('x') + '.',
    button, problem.parents.indexOf(answer));
}

function answerGraph(graph, button) {
  if (stage !== 'graph') return;
  const correct = graph === problem.target;
  const correctIndex = problem.graphs.indexOf(problem.target);
  const missed = graphSkills.find(({ key }) => graph[key] !== problem.target[key]);
  for (const { key } of problem.assessed) {
    record(key, graph[key] === problem.target[key]);
  }
  saveSession();
  renderScores();
  const message = correct ? 'Correct! Graph ' + letters[correctIndex] + ' matches the equation.'
    : 'Graph ' + letters[correctIndex] + ' is correct. Compare the '
      + missed.label.toLowerCase() + ' with the graph you chose.';
  finishQuestion(correct, message, button, correctIndex);
}

function showGraphs() {
  stage = 'graph';
  clearPoint();
  byId('question').textContent = 'Which graph matches the equation?';
  byId('graphHelp').hidden = false;
  byId('choices').replaceChildren(...problem.graphs.map((graph, i) =>
    graphButton(graph, i, button => answerGraph(graph, button))
  ));
  feedback('Correct parent function. Now match its transformed graph.', true);
  byId('question').focus();
}

function graphButton(graph, index, select) {
  const label = 'Graph ' + letters[index];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-quiet choice graph-choice';
  button.textContent = label;

  const { canvas, points } = drawGraph(graph);
  const integerPoints = points.filter(point => Number.isInteger(point.x));
  const frame = document.createElement('span');
  frame.className = 'point-frame';
  const marker = document.createElement('span');
  marker.className = 'point-marker';
  marker.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.append(canvas, marker);

  const description = document.createElement('span');
  description.className = 'visually-hidden';
  description.textContent = '. Visible points at integer x values, rounded as needed: '
    + integerPoints.map(formatPoint).join(', ');
  button.append(frame, description);

  function showPoint(point) {
    clearPoint();
    marker.style.left = point.left * 100 + '%';
    marker.style.top = point.top * 100 + '%';
    marker.hidden = false;
    activePoint = { marker, point };
    byId('pointStatus').textContent = label + ' · ' + formatPoint(point);
  }

  function stepPoint(direction) {
    const current = activePoint?.marker === marker ? activePoint.point : undefined;
    const ordered = direction > 0 ? integerPoints : [...integerPoints].reverse();
    const point = ordered.find(sample => !current || direction * (sample.x - current.x) > 0);
    if (point) showPoint(point);
  }

  button.addEventListener('click', event => {
    if (!inspectPoints.checked) {
      select(button);
      return;
    }
    if (event.detail === 0) {
      stepPoint(1);
      return;
    }
    if (event.target !== canvas) return;
    const point = nearestPoint(points, canvas.getBoundingClientRect(), event.clientX, event.clientY);
    if (point) {
      showPoint(point);
    } else {
      clearPoint();
      byId('pointStatus').textContent = 'Click closer to the curve on ' + label + '.';
    }
  });
  button.addEventListener('keydown', event => {
    if (!inspectPoints.checked || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    stepPoint(event.key === 'ArrowLeft' ? -1 : 1);
  });
  return button;
}

function newProblem() {
  const number = problem ? problem.number + 1 : session.scores.family.total + 1;
  problem = { ...makeProblem(problem?.target), number };
  stage = 'family';
  clearPoint();
  inspectPoints.disabled = false;
  byId('pointHelp').hidden = !inspectPoints.checked;
  byId('question').textContent = 'Which graph shows the parent function?';
  byId('problemNumber').textContent = 'Problem ' + number;
  byId('equation').textContent = equation(problem.target);
  byId('graphHelp').hidden = false;
  byId('next').hidden = true;
  feedback('');
  byId('choices').replaceChildren(...problem.parents.map((family, i) =>
    graphButton({ family, h: 0, k: 0, a: 1, reflected: false }, i,
      button => answerFamily(family, button))
  ));
  byId('question').focus();
}

function start(saved) {
  session = saved;
  inspectPoints.checked = false;
  problem = undefined;
  byId('displayName').textContent = session.name;
  byId('startPanel').hidden = true;
  byId('gameArea').hidden = false;
  byId('reportStatus').textContent = '';
  byId('downloadProgressBtn').disabled = false;
  renderScores();
  newProblem();
}

function downloadProgress() {
  const snapshot = session;
  const date = new Date();
  updateTimestamp(date);
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  const noteY = 219 + skills.length * 41;
  const reportHeight = noteY + 60;
  canvas.height = reportHeight * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 750, reportHeight);
  ctx.fillStyle = '#782b1b';
  ctx.fillRect(0, 0, 750, 76);
  ctx.fillStyle = '#fec81e';
  ctx.fillRect(0, 76, 750, 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px system-ui';
  ctx.fillText('Function Transformations', 28, 48);
  ctx.fillStyle = '#242733';
  ctx.font = 'bold 20px system-ui';
  ctx.fillText(snapshot.name, 28, 115, 694);
  ctx.font = '15px system-ui';
  ctx.fillText('As of ' + stamp(date), 28, 140, 694);

  ctx.fillStyle = '#fbf1ee';
  ctx.fillRect(20, 155, 710, 36);
  ctx.fillStyle = '#542015';
  ctx.font = 'bold 15px system-ui';
  ctx.fillText('Skill', 28, 179);
  ctx.textAlign = 'right';
  ctx.fillText('Right', 504, 179);
  ctx.fillText('Answered', 606, 179);
  ctx.fillText('Accuracy', 721, 179);

  skills.forEach(({ key, label }, index) => {
    const y = 219 + index * 41;
    const score = snapshot.scores[key];
    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = '#242733';
    ctx.textAlign = 'left';
    ctx.fillText(label, 28, y);
    ctx.font = '16px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(score.right, 504, y);
    ctx.fillText(score.total, 606, y);
    ctx.fillText(accuracy(score), 721, y);
    ctx.fillStyle = '#e3e6ea';
    ctx.fillRect(20, y + 12, 710, 1);
  });

  ctx.textAlign = 'left';
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#586372';
  ctx.fillText('Each graph answer scores the skills tested by its choices.', 28, noteY + 14);
  ctx.fillText('Browser-generated practice report.', 28, noteY + 34);

  byId('downloadProgressBtn').disabled = true;
  canvas.toBlob(blob => {
    if (session !== snapshot) return;
    byId('downloadProgressBtn').disabled = false;
    if (!blob || blob.type !== 'image/jpeg') {
      byId('reportStatus').textContent = 'Could not create the JPEG. Please try again.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const name = snapshot.name.replace(/[^\p{L}\p{N}-]+/gu, '_').slice(0, 60);
    link.href = url;
    link.download = 'FunctionTransformations_' + name + '_' + date.toISOString().replace(/[:.]/g, '-') + '.jpg';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    byId('reportStatus').textContent = 'Progress JPEG download started.';
  }, 'image/jpeg', 0.92);
}

const nameInput = byId('studentName');
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
byId('startForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.setCustomValidity('Please enter your name.');
    nameInput.reportValidity();
    return;
  }
  start(freshSession(name));
  saveSession();
});
inspectPoints.addEventListener('change', () => {
  clearPoint();
  byId('pointHelp').hidden = !inspectPoints.checked;
});
byId('next').addEventListener('click', newProblem);
byId('downloadProgressBtn').addEventListener('click', downloadProgress);
byId('newStudent').addEventListener('click', () => {
  if (!window.confirm('Clear the current student name and scores? Download a progress image first if you need the results.')) return;
  session = undefined;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Storage may be unavailable.
  }
  byId('gameArea').hidden = true;
  byId('startPanel').hidden = false;
  nameInput.value = '';
  nameInput.focus();
});

const saved = loadSession();
if (saved) start(saved);
