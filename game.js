'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#26a69a'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    }
  },
  neon: {
    colors: [null, '#00fff5', '#ffe600', '#dd00ff', '#00ff6a', '#ff2d55', '#4d9fff', '#ff8c00', '#00ffb2'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  },
  pastel: {
    colors: [null, '#b2eaf2', '#fff3b0', '#e8c7f5', '#c5e8c6', '#f7c5c5', '#c8dff7', '#ffd9b0', '#a8ded9'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      const px = x * size + 1;
      const py = y * size + 1;
      const w = size - 2;
      const h = size - 2;
      const r = Math.min(5, w / 2, h / 2);
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(px, py, w, h, r);
      } else {
        ctx.moveTo(px + r, py);
        ctx.lineTo(px + w - r, py);
        ctx.arcTo(px + w, py, px + w, py + r, r);
        ctx.lineTo(px + w, py + h - r);
        ctx.arcTo(px + w, py + h, px + w - r, py + h, r);
        ctx.lineTo(px + r, py + h);
        ctx.arcTo(px, py + h, px, py + h - r, r);
        ctx.lineTo(px, py + r);
        ctx.arcTo(px, py, px + r, py, r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  pixelart: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#26a69a'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // Pixel grid pattern overlay
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const dotSize = Math.max(2, Math.floor(size / 6));
      const step = Math.floor(size / 3);
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const px = x * size + 2 + dc * step;
          const py = y * size + 2 + dr * step;
          ctx.fillRect(px, py, dotSize, dotSize);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
};

let activeSkin = localStorage.getItem('tetris-skin') || 'retro';

function applyNeonBackground(enable) {
  const canvases = [canvas, nextCanvas, holdCanvas];
  if (enable) {
    canvases.forEach(c => c.style.background = '#000000');
  } else {
    canvases.forEach(c => c.style.background = '');
  }
}

function setSkin(skinName) {
  if (!SKINS[skinName]) return;
  activeSkin = skinName;
  localStorage.setItem('tetris-skin', skinName);
  applyNeonBackground(skinName === 'neon');
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('skin-btn-active', btn.dataset.skin === skinName);
  });
  if (current) {
    draw();
    drawNext();
    drawHold();
  }
}

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tortuga (anillo hueco)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelDisplay = document.getElementById('start-level-display');
const levelDecBtn = document.getElementById('level-dec');
const levelIncBtn = document.getElementById('level-inc');

const START_LEVEL_KEY = 'tetris-start-level';
const MIN_LEVEL = 1;
const MAX_LEVEL = 15;

const nameEntryEl = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const recordsSection = document.getElementById('records-section');
const recordsBody = document.getElementById('records-body');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');

let board, current, next, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, scoreSaved;

// ---- Records helpers ----

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem('tetris-records')) || [];
  } catch (_) {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem('tetris-records', JSON.stringify(records));
}

function getBestCombo() {
  return parseInt(localStorage.getItem('tetris-best-combo'), 10) || 0;
}

function getMaxLines() {
  return parseInt(localStorage.getItem('tetris-max-lines'), 10) || 0;
}

function isTopFive(currentScore) {
  const records = getRecords();
  return records.length < 5 || currentScore > records[records.length - 1].score;
}

function insertRecord(name, currentScore, currentLines, currentCombo) {
  const records = getRecords();
  records.push({ name: name.trim() || 'Anónimo', score: currentScore, lines: currentLines, combo: currentCombo });
  records.sort((a, b) => b.score - a.score);
  if (records.length > 5) records.length = 5;
  saveRecords(records);
}

function updateHistoricalBests(currentMaxCombo, currentLines) {
  if (currentMaxCombo > getBestCombo()) {
    localStorage.setItem('tetris-best-combo', currentMaxCombo);
  }
  if (currentLines > getMaxLines()) {
    localStorage.setItem('tetris-max-lines', currentLines);
  }
}

function renderRecordsTable(highlightScore) {
  const records = getRecords();
  recordsBody.innerHTML = '';

  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (highlightScore !== undefined && r.score === highlightScore) {
      tr.classList.add('record-highlight');
    }
    tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${r.score.toLocaleString()}</td><td>${r.lines}</td><td>${r.combo}</td>`;
    recordsBody.appendChild(tr);
  });

  const bestCombo = getBestCombo();
  const maxLinesVal = getMaxLines();
  recordsStats.innerHTML =
    `<span>Mejor combo: <strong>${bestCombo}</strong></span>` +
    `<span>Máx. líneas: <strong>${maxLinesVal}</strong></span>`;

  recordsSection.classList.remove('hidden');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Board ----

function getStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  return (saved >= MIN_LEVEL && saved <= MAX_LEVEL) ? saved : MIN_LEVEL;
}

function setStartLevel(val) {
  const clamped = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, val));
  localStorage.setItem(START_LEVEL_KEY, clamped);
  startLevelDisplay.textContent = clamped;
}

function updateStartLevelDisplay() {
  startLevelDisplay.textContent = getStartLevel();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * 8) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    // combo bonus: extra 50 * combo * level per consecutive clear
    if (combo > 1) score += 50 * combo * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function holdPiece() {
  if (!canHold) return;
  if (hold === null) {
    hold = current.type;
    current = next;
    next = randomPiece();
    drawNext();
  } else {
    const swap = hold;
    hold = current.type;
    current = makePiece(swap);
  }
  canHold = false;
  if (collide(current.shape, current.x, current.y)) { endGame(); return; }
  drawHold();
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  canHold = true;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[activeSkin].drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const NB = 30;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (hold !== null) {
    const shape = PIECES[hold];
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(holdCtx, offX + c, offY + r, shape[r][c], NB);
  }
  holdCanvas.classList.toggle('hold-locked', !canHold);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  // Update historical bests
  updateHistoricalBests(maxCombo, lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} | Líneas: ${lines} | Combo: ${maxCombo}`;

  scoreSaved = false;

  // Hide name entry by default
  nameEntryEl.classList.add('hidden');
  playerNameInput.value = '';

  if (isTopFive(score)) {
    nameEntryEl.classList.remove('hidden');
    playerNameInput.focus();
  }
  // Render table without highlight (name not yet saved)
  renderRecordsTable();

  overlay.classList.remove('hidden');
}

function openPauseMenu() {
  if (gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  updateStartLevelDisplay();
  pauseControls.classList.add('hidden');
  toggleControlsBtn.textContent = 'Ver controles';
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  loop(lastTime);
}

function saveCurrentScore() {
  if (scoreSaved) return;
  scoreSaved = true;
  const name = playerNameInput.value.trim() || 'Anónimo';
  insertRecord(name, score, lines, maxCombo);
  nameEntryEl.classList.add('hidden');
  renderRecordsTable(score);
}

saveScoreBtn.addEventListener('click', saveCurrentScore);

playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem('tetris-records');
  localStorage.removeItem('tetris-best-combo');
  localStorage.removeItem('tetris-max-lines');
  renderRecordsTable();
});

function togglePause() {
  if (gameOver) return;
  if (paused) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  hold = null;
  canHold = true;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  scoreSaved = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  drawHold();
  nameEntryEl.classList.add('hidden');
  recordsSection.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!gameOver) e.preventDefault();
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  // If name entry is pending and score not yet saved, auto-save as anonymous
  if (!scoreSaved && !nameEntryEl.classList.contains('hidden')) {
    saveCurrentScore();
  }
  init();
});

resumeBtn.addEventListener('click', closePauseMenu);

pauseRestartBtn.addEventListener('click', init);

toggleControlsBtn.addEventListener('click', () => {
  const hidden = pauseControls.classList.toggle('hidden');
  toggleControlsBtn.textContent = hidden ? 'Ver controles' : 'Ocultar controles';
});

levelDecBtn.addEventListener('click', () => {
  setStartLevel(getStartLevel() - 1);
});

levelIncBtn.addEventListener('click', () => {
  setStartLevel(getStartLevel() + 1);
});

const themeToggle = document.getElementById('theme-toggle');

(function loadTheme() {
  if (localStorage.getItem('tetris-theme') === 'light') {
    document.documentElement.classList.add('light-theme');
    themeToggle.checked = true;
  }
})();

(function loadSkin() {
  applyNeonBackground(activeSkin === 'neon');
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('skin-btn-active', btn.dataset.skin === activeSkin);
  });
})();

themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.documentElement.classList.add('light-theme');
    localStorage.setItem('tetris-theme', 'light');
  } else {
    document.documentElement.classList.remove('light-theme');
    localStorage.setItem('tetris-theme', 'dark');
  }
});

init();
