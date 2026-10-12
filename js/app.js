/**
 * ПАЗЛ 2007 — сборка игры: экраны, перетаскивание кусочков,
 * момент «победы», галерея, прогресс.
 *
 * Геометрия кусочков — js/jigsaw.js, правила уровня — js/game-core.js,
 * раскладка стола — js/layout.js.
 */

import { LEVELS, ASSETS, stars, pieceCount } from './levels.js';
import { makeRandom } from './jigsaw.js';
import * as core from './game-core.js';
import { computeLayout, scatterPositions } from './layout.js';
import { sfx, setSound } from './audio.js';
import * as store from './storage.js';

/* ------------------------------ утилиты ------------------------------ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const ASPECT = 1080 / 1349; // пропорции кадра

const els = {
  menu: $('screen-menu'),
  play: $('screen-play'),
  gallery: $('screen-gallery'),
  levelGrid: $('level-grid'),
  galleryGrid: $('gallery-grid'),
  galleryCount: $('gallery-count'),
  galleryBack: $('gallery-back'),
  menuBar: $('menu-bar'),
  menuProgressText: $('menu-progress-text'),
  btnContinue: $('btn-continue'),
  btnHelp: $('btn-help'),
  btnGallery: $('btn-gallery'),
  btnReset: $('btn-reset'),
  playBack: $('play-back'),
  playNum: $('play-num'),
  playCaption: $('play-caption'),
  playBar: $('play-bar'),
  playPlaced: $('play-placed'),
  playTotal: $('play-total'),
  stage: $('stage'),
  stageInner: $('stage-inner'),
  board: $('board'),
  boardSlots: $('board-slots'),
  boardGhost: $('board-ghost'),
  boardPeek: $('board-peek'),
  boardSolved: $('board-solved'),
  boardSweep: $('board-sweep'),
  pieces: $('pieces'),
  toolShuffle: $('tool-shuffle'),
  toolHint: $('tool-hint'),
  toolPeek: $('tool-peek'),
  toolRestart: $('tool-restart'),
  hintCount: $('hint-count'),
  reveal: $('reveal'),
  revealTitle: $('reveal-title'),
  revealCaption: $('reveal-caption'),
  revealCompare: $('reveal-compare'),
  revealNext: $('reveal-next'),
  revealMenu: $('reveal-menu'),
  revealGallery: $('reveal-gallery'),
  lightbox: $('lightbox'),
  lightboxCompare: $('lightbox-compare'),
  lightboxTitle: $('lightbox-title'),
  lightboxCaption: $('lightbox-caption'),
  lightboxClose: $('lightbox-close'),
  sheet: $('sheet'),
  sheetTitle: $('sheet-title'),
  sheetBody: $('sheet-body'),
  sheetActions: $('sheet-actions'),
  toast: $('toast'),
  clock: $('taskbar-clock'),
  btnSound: $('btn-sound'),
  taskbarStart: $('taskbar-start'),
  taskbarTask: $('taskbar-task'),
};

const state = {
  screen: 'menu',
  levelIndex: 0,
  session: null,
  layout: null,
  drag: null,
  hints: 3,
  timers: new Set(),
  toastTimer: null,
  peekTimer: null,
  resizeTimer: null,
};

/* --------------------------- мелкие помощники --------------------------- */

function later(fn, ms) {
  const id = setTimeout(() => {
    state.timers.delete(id);
    fn();
  }, ms);
  state.timers.add(id);
  return id;
}

function clearTimers() {
  for (const id of state.timers) clearTimeout(id);
  state.timers.clear();
}

function toast(text, ms = 2200) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, ms);
}

function preload(src, ms = 6000) {
  return new Promise((resolve) => {
    // Страховка: если картинка не пришла (нет файла, медленная сеть) —
    // всё равно запускаем уровень.
    const timer = setTimeout(() => resolve(src), ms);
    const img = new Image();
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve(src);
    };
    img.src = src;
  });
}

/* ------------------------------ экраны ------------------------------ */

function showScreen(name) {
  state.screen = name;
  els.menu.classList.toggle('is-active', name === 'menu');
  els.play.classList.toggle('is-active', name === 'play');
  els.gallery.classList.toggle('is-active', name === 'gallery');
  if (name === 'menu') renderMenu();
  if (name === 'gallery') renderGallery();
}

/* ------------------------------- меню ------------------------------- */

function renderMenu() {
  const solved = store.solvedCount();
  els.menuBar.style.width = `${(solved / LEVELS.length) * 100}%`;
  els.menuProgressText.textContent = `собрано ${solved} из ${LEVELS.length}`;

  const next = store.nextLevelIndex(LEVELS.length);
  els.btnContinue.textContent =
    solved === 0 ? 'Играть' : solved >= LEVELS.length ? 'Играть заново' : `Продолжить · кадр ${LEVELS[next].id}`;

  els.levelGrid.innerHTML = '';
  LEVELS.forEach((level, i) => els.levelGrid.appendChild(cardFor(level, i, 'menu')));
}

/**
 * Карточка уровня. В меню карточка запускает уровень, в галерее — открывает кадр.
 */
function cardFor(level, index, mode) {
  const solved = store.isSolved(index);
  const unlocked = mode === 'gallery' ? solved : solved || index === 0 || store.isSolved(index - 1);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = ['card', unlocked ? '' : 'card__locked', solved ? 'card__solved' : ''].filter(Boolean).join(' ');
  btn.setAttribute('aria-label', `Кадр ${level.id} — ${level.title}`);

  const thumb = solved ? ASSETS.thumbAnime(level.id) : ASSETS.thumb(level.id);
  const best = store.bestTime(index);
  btn.innerHTML = `
    <div class="card__media">
      <img src="${thumb}" alt="" loading="lazy" draggable="false">
      <div class="card__veil"></div>
      <span class="card__num">КАДР ${level.id}</span>
      <span class="card__chip">${pieceCount(level)} шт.</span>
      <span class="card__badge">собрано</span>
      <div class="card__lock" aria-hidden="true">🔒</div>
      <div class="card__body">
        <span class="card__caption">${level.caption}</span>
        <span class="card__sub">
          <span class="card__stars" title="сложность">${stars(level)}</span>
          <span>${solved && best ? `лучшее время ${core.formatTime(best)}` : unlocked ? 'не собран' : 'закрыт'}</span>
        </span>
      </div>
    </div>`;

  btn.addEventListener('click', () => {
    if (mode === 'gallery') {
      if (solved) openLightbox(index);
      else {
        sfx.nope();
        toast(`Сначала собери кадр ${level.id}`);
      }
      return;
    }
    if (unlocked) {
      sfx.ui();
      startLevel(index);
    } else {
      sfx.nope();
      toast(`Сначала собери кадр ${LEVELS[index - 1].id}`);
    }
  });
  return btn;
}

/* ------------------------------ уровень ------------------------------ */

async function startLevel(index, opts = {}) {
  const level = LEVELS[index];
  state.levelIndex = index;
  state.hints = 3;
  state.drag = null;
  clearTimers();
  els.hintCount.textContent = state.hints;
  els.boardSweep.classList.remove('is-run');
  els.pieces.classList.remove('is-faded');
  els.stageInner.classList.remove('is-finale');
  els.boardGhost.classList.remove('is-on');
  els.boardPeek.classList.remove('is-on');
  els.boardSolved.classList.remove('is-on');

  els.playNum.textContent = `Кадр ${level.id} — ${level.title}`;
  els.playCaption.textContent = level.caption;
  els.playPlaced.textContent = '0';

  showScreen('play');
  store.setLast(index);

  const loading = document.createElement('div');
  loading.className = 'stage__loading';
  loading.textContent = 'Загружаю кадр…';
  els.stageInner.appendChild(loading);

  await Promise.all([preload(ASSETS.real(level.id)), preload(ASSETS.anime(level.id))]);
  loading.remove();

  // Геометрия стола под текущий размер сцены.
  const rect = els.stage.getBoundingClientRect();
  const layout = computeLayout({ stageW: rect.width, stageH: rect.height, aspect: ASPECT });
  const cellW = Math.max(26, Math.round(layout.board.w / level.cols));
  const cellH = Math.max(26, Math.round(layout.board.h / level.rows));

  const boardW = cellW * level.cols;
  const boardH = cellH * level.rows;
  const boardX = Math.round(layout.board.x + (layout.board.w - boardW) / 2);
  const boardY = Math.round(layout.board.y + (layout.board.h - boardH) / 2);
  els.board.style.left = `${boardX}px`;
  els.board.style.top = `${boardY}px`;
  els.board.style.width = `${boardW}px`;
  els.board.style.height = `${boardH}px`;

  const session = core.createSession({
    levelIndex: index,
    level,
    cellW,
    cellH,
    origin: { x: boardX, y: boardY },
  });
  state.session = session;
  state.layout = { ...layout, boardW, boardH, boardX, boardY, areas: layout.areas };

  // Картинки-оверлеи живут на доске всегда (прозрачность 0): «Подсказка» показывает
  // силуэт кадра, «Показать кадр» — размытую аниме-версию.
  els.boardGhost.src = ASSETS.real(level.id);
  els.boardPeek.src = ASSETS.anime(level.id);
  els.boardSolved.src = ASSETS.anime(level.id);
  els.boardGhost.hidden = false;
  els.boardPeek.hidden = false;
  els.boardSolved.hidden = false;

  // Разметка «гнёзд» под кусочки.
  els.boardSlots.setAttribute('viewBox', `0 0 ${boardW} ${boardH}`);
  els.boardSlots.innerHTML = session.pieces
    .map((p) => `<path d="${p.d}" transform="translate(${p.homeLocal.x},${p.homeLocal.y})"/>`)
    .join('');

  // Кусочки.
  const placedIdx = opts.placed ? new Set(opts.placed) : new Set();
  els.pieces.innerHTML = '';
  const rand = makeRandom(level.seed ^ 0x9e37);
  const loose = session.pieces.filter((p) => !placedIdx.has(p.index));
  const spots = scatterPositions({
    count: loose.length,
    areas: layout.areas,
    size: { w: session.pieces[0].box.w, h: session.pieces[0].box.h },
    rand,
  });

  session.pieces.forEach((p) => {
    const el = buildPieceEl(p, session);
    p.el = el;
    p.slotEl = els.boardSlots.children[p.index];
    els.pieces.appendChild(el);
    if (placedIdx.has(p.index)) {
      // Кусочек уже на месте (например, окно изменило размер): показываем реальное
      // фото, аниме-кадр включит только финальная анимация.
      p.placed = true;
      p.x = p.home.x;
      p.y = p.home.y;
      session.placed += 1;
      el.classList.add('is-placed');
      el.style.zIndex = '1';
    } else {
      const spot = spots.shift() || { x: p.home.x, y: p.home.y };
      p.x = spot.x;
      p.y = spot.y;
      p.rot = Math.round((rand() - 0.5) * 10);
      el.classList.add('is-loose');
    }
    applyTransform(p);
  });

  els.playTotal.textContent = `/${session.pieces.length}`;
  updateHud();
  if (session.complete) later(() => celebrate({ silent: true }), 120);
}

function buildPieceEl(piece, session) {
  const level = session.level;
  const { box } = piece;
  const lx = piece.homeLocal.x;
  const ly = piece.homeLocal.y;
  const bw = session.puzzle.board.w;
  const bh = session.puzzle.board.h;
  const clipId = `clip-${level.id}-${piece.index}`;
  const el = document.createElement('div');
  el.className = 'piece';
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.dataset.index = String(piece.index);
  el.innerHTML = `
    <svg class="piece__svg" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}">
      <defs>
        <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${piece.d}"/></clipPath>
      </defs>
      <g clip-path="url(#${clipId})">
        <image class="piece__real" href="${ASSETS.real(level.id)}" x="${-lx}" y="${-ly}" width="${bw}" height="${bh}" preserveAspectRatio="none"/>
        <image class="piece__anime" href="${ASSETS.anime(level.id)}" x="${-lx}" y="${-ly}" width="${bw}" height="${bh}" preserveAspectRatio="none"/>
      </g>
      <path class="piece__edge" d="${piece.d}" fill="none"/>
    </svg>`;
  return el;
}

function applyTransform(piece) {
  piece.el.style.transform = `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${piece.rot}deg)`;
  piece.el.style.zIndex = String(piece.z);
}

/* --------------------------- перетаскивание --------------------------- */

function stagePoint(ev) {
  const r = els.stageInner.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function onPointerDown(ev) {
  const s = state.session;
  if (!s || s.complete || state.screen !== 'play') return;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const pt = stagePoint(ev);
  const piece = core.pieceAt(s, pt.x, pt.y);
  if (!piece) return;
  ev.preventDefault();
  try {
    els.stageInner.setPointerCapture(ev.pointerId);
  } catch {
    /* необязательно */
  }
  core.bringToFront(s, piece);
  applyTransform(piece);
  piece.el.classList.remove('is-loose');
  piece.el.classList.add('is-dragging');
  state.drag = { piece, dx: pt.x - piece.x, dy: pt.y - piece.y, id: ev.pointerId };
  if (!s.startedAt) core.startTimer(s);
  sfx.pick();
}

function onPointerMove(ev) {
  const s = state.session;
  if (!s || s.complete || state.screen !== 'play') return;
  const pt = stagePoint(ev);
  const drag = state.drag;
  if (drag && drag.id === ev.pointerId) {
    core.setPiecePosition(drag.piece, pt.x - drag.dx, pt.y - drag.dy);
    applyTransform(drag.piece);
    highlightNear(drag.piece);
    return;
  }
  // Без нажатия верхний кусочек под курсором всплывает — так его видно и легко взять.
  const piece = core.pieceAt(s, pt.x, pt.y);
  if (piece && piece.z < s.zTop) {
    core.bringToFront(s, piece);
    applyTransform(piece);
  }
}

function onPointerUp(ev) {
  const drag = state.drag;
  if (!drag || drag.id !== ev.pointerId) return;
  state.drag = null;
  const piece = drag.piece;
  piece.el.classList.remove('is-dragging');
  clearHighlight();
  if (core.trySnap(state.session, piece)) {
    piece.el.classList.add('is-snapping');
    applyTransform(piece);
    later(() => piece.el.classList.remove('is-snapping'), 220);
    piece.el.classList.add('is-placed');
    piece.el.style.zIndex = '1';
    sfx.snap();
    updateHud();
    if (state.session.complete) celebrate();
  } else {
    // Не попал на место — кусочек остаётся верхним, как после любого перемещения.
    piece.el.classList.add('is-loose');
  }
}

function highlightNear(piece) {
  const s = state.session;
  if (!piece.slotEl) return;
  const near = core.distanceToHome(piece) <= core.snapTolerance(s) * 1.35;
  piece.slotEl.classList.toggle('is-near', near);
}

function clearHighlight() {
  if (!state.session) return;
  for (const p of state.session.pieces) p.slotEl?.classList.remove('is-near');
}

/* ------------------------------ прогресс ------------------------------ */

function updateHud() {
  const s = state.session;
  if (!s) return;
  const total = s.pieces.length;
  els.playPlaced.textContent = String(s.placed);
  els.playTotal.textContent = `/${total}`;
  els.playBar.style.width = `${(s.placed / total) * 100}%`;
}

/* ------------------------------- победа ------------------------------- */

function celebrate({ silent = false } = {}) {
  const s = state.session;
  if (!s) return;
  const level = s.level;
  if (!s.complete) s.complete = true;
  const seconds = s.finishedAt
    ? Math.round((s.finishedAt - (s.startedAt || s.finishedAt)) / 1000)
    : core.finish(s);

  els.stageInner.classList.add('is-finale');
  if (!silent) sfx.complete();

  // Волна: реальное фото шаг за шагом превращается в аниме-кадр.
  let maxDelay = 0;
  for (const p of s.pieces) {
    const d = (p.col / s.puzzle.cols) * 0.55 + (p.row / s.puzzle.rows) * 0.35 + Math.random() * 0.12;
    maxDelay = Math.max(maxDelay, d);
    p.el.style.setProperty('--reveal-delay', `${d.toFixed(2)}s`);
    p.el.classList.add('is-anime');
  }
  els.boardSweep.classList.add('is-run');

  const done = (maxDelay + 0.75) * 1000;
  later(() => {
    els.pieces.classList.add('is-faded');
    els.boardSolved.classList.add('is-on');
  }, done);
  later(
    () => {
      store.markSolved(s.levelIndex, seconds);
      const allDone = store.solvedCount() >= LEVELS.length;
      if (allDone && s.levelIndex === LEVELS.length - 1) sfx.finale();
      openReveal(seconds);
    },
    done + 560,
  );
}

function openReveal(seconds) {
  const s = state.session;
  const level = s.level;
  els.revealTitle.textContent = `Кадр ${level.id} — ${level.title}`;
  const best = store.bestTime(s.levelIndex);
  els.revealCaption.innerHTML =
    `${level.caption}<br><span class="dim">собрано за ${core.formatTime(seconds)} · ` +
    `${pieceCount(level)} кусочков${best ? ` · лучшее время ${core.formatTime(best)}` : ''}</span>`;
  buildCompare(els.revealCompare, ASSETS.real(level.id), ASSETS.anime(level.id));

  const hasNext = s.levelIndex < LEVELS.length - 1;
  els.revealNext.hidden = !hasNext;
  els.revealNext.textContent = hasNext ? `Следующий кадр (${LEVELS[s.levelIndex + 1].id}) →` : '';
  els.reveal.hidden = false;
}

function closeReveal() {
  els.reveal.hidden = true;
}

/* ------------------------------- галерея ------------------------------ */

function renderGallery() {
  els.galleryGrid.innerHTML = '';
  LEVELS.forEach((level, i) => els.galleryGrid.appendChild(cardFor(level, i, 'gallery')));
  els.galleryCount.textContent = `${store.solvedCount()} / ${LEVELS.length}`;
}

function openLightbox(index) {
  const level = LEVELS[index];
  els.lightboxTitle.textContent = `Кадр ${level.id} — ${level.title}`;
  els.lightboxCaption.textContent = level.caption;
  buildCompare(els.lightboxCompare, ASSETS.real(level.id), ASSETS.anime(level.id));
  els.lightbox.hidden = false;
}

function closeLightbox() {
  els.lightbox.hidden = true;
  els.lightboxCompare.innerHTML = '';
}

/* --------------------------- ползунок «было / стало» --------------------------- */

function buildCompare(container, beforeSrc, afterSrc, { from = 100, to = 46 } = {}) {
  container.innerHTML = `
    <img class="compare__img" src="${beforeSrc}" alt="реальное фото" draggable="false">
    <img class="compare__img compare__after" src="${afterSrc}" alt="аниме-версия" draggable="false">
    <div class="compare__handle"></div>
    <span class="compare__tag compare__tag--before">фото</span>
    <span class="compare__tag compare__tag--after">аниме</span>`;

  const set = (v) => container.style.setProperty('--pos', `${clamp(v, 0, 100)}%`);

  // Автоматическая «проявка»: ползунок сам проезжает, пока его не тронули.
  let raf = 0;
  const start = performance.now();
  const dur = 1100;
  const tick = (now) => {
    const t = clamp((now - start) / dur, 0, 1);
    const ease = 1 - (1 - t) ** 3;
    set(from + (to - from) * ease);
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  set(from);
  raf = requestAnimationFrame(tick);
  const cancel = () => raf && cancelAnimationFrame(raf);

  const move = (ev) => {
    const r = container.getBoundingClientRect();
    set(((ev.clientX - r.left) / r.width) * 100);
  };

  container.addEventListener('pointerdown', (ev) => {
    if (ev.target instanceof HTMLImageElement) ev.preventDefault();
    cancel();
    try {
      container.setPointerCapture(ev.pointerId);
    } catch {
      /* необязательно */
    }
    move(ev);
    const onMove = (e) => move(e);
    const onUp = () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
  });
}

/* ---------------------------- окно-подсказка ---------------------------- */

function showSheet({ title, body, actions }) {
  els.sheetTitle.textContent = title;
  els.sheetBody.innerHTML = body;
  els.sheetActions.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = `btn${a.primary ? ' btn--primary' : a.ghost ? ' btn--ghost' : ''}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      closeSheet();
      a.onClick?.();
    });
    els.sheetActions.appendChild(btn);
  }
  els.sheet.hidden = false;
}

function closeSheet() {
  els.sheet.hidden = true;
}

/* -------------------------- кнопки на уровне -------------------------- */

function shuffleLoose() {
  const s = state.session;
  if (!s || s.complete || state.screen !== 'play') return;
  const loose = s.pieces.filter((p) => !p.placed);
  const rand = makeRandom((Date.now() & 0xffff) ^ 0x51ed);
  const spots = scatterPositions({
    count: loose.length,
    areas: state.layout.areas,
    size: { w: s.pieces[0].box.w, h: s.pieces[0].box.h },
    rand,
  });
  for (const p of loose) {
    const spot = spots.shift();
    if (!spot) break;
    p.x = spot.x;
    p.y = spot.y;
    p.rot = Math.round((rand() - 0.5) * 10);
    p.el.classList.add('is-snapping');
    applyTransform(p);
    later(() => p.el.classList.remove('is-snapping'), 220);
  }
  clearHighlight();
  sfx.ui();
}

function hint() {
  const s = state.session;
  if (!s || s.complete || state.screen !== 'play') return;
  if (state.hints <= 0) {
    sfx.nope();
    toast('Подсказки на этот кадр закончились');
    return;
  }
  state.hints -= 1;
  els.hintCount.textContent = state.hints;
  els.boardGhost.classList.add('is-on');
  sfx.ui();
  later(() => els.boardGhost.classList.remove('is-on'), 1900);
  toast('Силуэт кадра виден пару секунд', 1600);
}

function peekAnime() {
  const s = state.session;
  if (!s || s.complete || state.screen !== 'play') return;
  els.boardPeek.classList.add('is-on');
  sfx.ui();
  toast('Так кадр будет выглядеть, когда соберётся', 2000);
  clearTimeout(state.peekTimer);
  state.peekTimer = setTimeout(() => els.boardPeek.classList.remove('is-on'), 2300);
}

function restartLevel() {
  const s = state.session;
  if (!s) return;
  const index = s.levelIndex;
  showSheet({
    title: 'Начать кадр заново?',
    body: '<p>Кусочки вернутся на стол, прогресс по этому кадру сбросится. Собранные кадры останутся в галерее.</p>',
    actions: [
      { label: 'Заново', primary: true, onClick: () => startLevel(index) },
      { label: 'Отмена', ghost: true },
    ],
  });
}

/* ------------------------------ клавиши ------------------------------ */

function onKeyDown(ev) {
  const tag = (ev.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (ev.key === 'Escape') {
    if (!els.lightbox.hidden) {
      closeLightbox();
      return;
    }
    if (!els.sheet.hidden) {
      closeSheet();
      return;
    }
    if (!els.reveal.hidden) {
      closeReveal();
      showScreen('menu');
      return;
    }
    if (state.screen === 'play' || state.screen === 'gallery') showScreen('menu');
    return;
  }
  if (state.screen !== 'play') return;
  if (ev.key === ' ' || ev.code === 'Space') {
    ev.preventDefault();
    shuffleLoose();
    return;
  }
  if (ev.key === 'h' || ev.key === 'H' || ev.key === 'р' || ev.key === 'Р') {
    hint();
    return;
  }
  if (ev.key === 'r' || ev.key === 'R' || ev.key === 'к' || ev.key === 'К') {
    restartLevel();
    return;
  }
  if (ev.key === 'p' || ev.key === 'P' || ev.key === 'з' || ev.key === 'З') peekAnime();
}

/* ------------------------------- часы ------------------------------- */

function tickClock() {
  const now = new Date();
  els.clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/* ------------------------------ запуск ------------------------------ */

function bind() {
  els.stageInner.addEventListener('pointerdown', onPointerDown);
  els.stageInner.addEventListener('pointermove', onPointerMove);
  els.stageInner.addEventListener('pointerup', onPointerUp);
  els.stageInner.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  els.btnContinue.addEventListener('click', () => {
    sfx.ui();
    startLevel(store.nextLevelIndex(LEVELS.length));
  });
  els.btnGallery.addEventListener('click', () => {
    sfx.ui();
    showScreen('gallery');
  });
  els.btnReset.addEventListener('click', () => {
    sfx.ui();
    showSheet({
      title: 'Сбросить прогресс?',
      body: '<p>Все собранные кадры снова закроются. Настройки звука останутся.</p>',
      actions: [
        {
          label: 'Сбросить',
          primary: true,
          onClick: () => {
            store.resetProgress();
            renderMenu();
            toast('Прогресс сброшен');
          },
        },
        { label: 'Отмена', ghost: true },
      ],
    });
  });
  els.btnHelp.addEventListener('click', () => {
    sfx.ui();
    showSheet({
      title: 'Как играть',
      body: `
        <p>Каждый кадр — фотография зимы 2007 года, рассыпавшаяся на кусочки пазла.</p>
        <ul>
          <li>Тащи кусочек мышью или пальцем. Рядом со своим местом он «щёлкнет» и встанет сам.</li>
          <li>Собрав кадр целиком, увидишь его аниме-версию и ползунок «фото / аниме».</li>
          <li><b>Подсказка</b> показывает силуэт кадра на пару секунд: три штуки на кадр.</li>
          <li><b>Показать кадр</b> — подсмотреть, как будет выглядеть результат.</li>
          <li>Клавиши: <kbd>Esc</kbd> — к уровням, <kbd>Пробел</kbd> — перемешать, <kbd>H</kbd> — подсказка, <kbd>R</kbd> — заново.</li>
        </ul>
        <p>Прогресс хранится в браузере — можно закрыть вкладку и вернуться позже.</p>`,
      actions: [{ label: 'Понятно', primary: true }],
    });
  });

  els.playBack.addEventListener('click', () => {
    sfx.ui();
    showScreen('menu');
  });
  els.galleryBack.addEventListener('click', () => {
    sfx.ui();
    showScreen('menu');
  });

  els.toolShuffle.addEventListener('click', shuffleLoose);
  els.toolHint.addEventListener('click', hint);
  els.toolPeek.addEventListener('click', peekAnime);
  els.toolRestart.addEventListener('click', restartLevel);

  els.revealNext.addEventListener('click', () => {
    const next = state.levelIndex + 1;
    closeReveal();
    sfx.ui();
    if (next < LEVELS.length) startLevel(next);
    else showScreen('menu');
  });
  els.revealMenu.addEventListener('click', () => {
    closeReveal();
    showScreen('menu');
  });
  els.revealGallery.addEventListener('click', () => {
    closeReveal();
    showScreen('gallery');
  });

  els.lightboxClose.addEventListener('click', closeLightbox);
  els.lightbox.addEventListener('click', (ev) => {
    if (ev.target === els.lightbox) closeLightbox();
  });

  els.taskbarStart.addEventListener('click', () => {
    sfx.ui();
    showScreen('menu');
  });
  els.taskbarTask.addEventListener('click', () => {
    sfx.ui();
    if (state.session) showScreen('play');
    else startLevel(store.nextLevelIndex(LEVELS.length));
  });
  els.btnSound.addEventListener('click', () => {
    const on = !store.soundOn();
    store.setSound(on);
    setSound(on);
    els.btnSound.textContent = on ? '🔊' : '🔇';
    els.btnSound.classList.toggle('is-off', !on);
    if (on) sfx.ui();
  });

  // При изменении окна пересобираем геометрию, сохраняя уже поставленные кусочки.
  window.addEventListener('resize', () => {
    if (state.screen !== 'play') return;
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => {
      if (state.screen !== 'play' || !state.session) return;
      const placed = state.session.pieces.filter((p) => p.placed).map((p) => p.index);
      requestAnimationFrame(() => startLevel(state.levelIndex, { placed }));
    }, 180);
  });

  setInterval(tickClock, 15000);
}

function boot() {
  bind();
  tickClock();
  // Доступ к состоянию игры для отладки и автотестов.
  window.__puzzle2007 = { state, LEVELS, core, store, startLevel, showScreen };

  const on = store.soundOn();
  setSound(on);
  els.btnSound.textContent = on ? '🔊' : '🔇';
  els.btnSound.classList.toggle('is-off', !on);
  showScreen('menu');

  // Первый запуск — сразу объясняем правила.
  let seenHelp = false;
  try {
    seenHelp = Boolean(sessionStorage.getItem('puzzle2007.helpShown'));
    sessionStorage.setItem('puzzle2007.helpShown', '1');
  } catch {
    seenHelp = true; // нет sessionStorage — не докучаем окном
  }
  if (store.solvedCount() === 0 && !seenHelp) later(() => els.btnHelp.click(), 500);
}

boot();
