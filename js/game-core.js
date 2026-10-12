/**
 * Игровая логика уровня: состояние кусочков, попадание пальцем,
 * примагничивание к месту. Чистые функции — их можно проверять в Node.
 */

import { buildPuzzle } from './jigsaw.js';

/**
 * @param {{levelIndex:number, level:object, cellW:number, cellH:number,
 *          origin?:{x:number,y:number}}} p
 *        origin — где на сцене стоит левый верхний угол доски;
 *        home считается уже с учётом origin, homeLocal — в координатах доски.
 */
export function createSession({ levelIndex, level, cellW, cellH, origin = { x: 0, y: 0 } }) {
  const puzzle = buildPuzzle({ cols: level.cols, rows: level.rows, cellW, cellH, seed: level.seed });
  const pieces = puzzle.pieces.map((p) => ({
    ...p,
    homeLocal: { x: p.home.x, y: p.home.y },
    home: { x: p.home.x + origin.x, y: p.home.y + origin.y },
    x: p.home.x + origin.x,
    y: p.home.y + origin.y,
    rot: 0,
    placed: false,
    z: p.index,
  }));
  return {
    levelIndex,
    level,
    puzzle,
    pieces,
    placed: 0,
    complete: false,
    startedAt: null,
    finishedAt: null,
    zTop: pieces.length,
  };
}

/** Кусочек под точкой (берём самый верхний слой). */
export function pieceAt(session, x, y) {
  let best = null;
  for (const p of session.pieces) {
    if (p.placed) continue;
    if (x < p.x || y < p.y || x > p.x + p.box.w || y > p.y + p.box.h) continue;
    if (!best || p.z > best.z) best = p;
  }
  return best;
}

export function setPiecePosition(piece, x, y) {
  piece.x = Math.round(x);
  piece.y = Math.round(y);
}

export function bringToFront(session, piece) {
  piece.z = ++session.zTop;
  return piece.z;
}

/** Насколько близко нужно поднести кусочек, чтобы он «щёлкнул» на место. */
export function snapTolerance(session) {
  return Math.max(11, Math.min(session.puzzle.cellW, session.puzzle.cellH) * 0.38);
}

export function distanceToHome(piece) {
  return Math.hypot(piece.home.x - piece.x, piece.home.y - piece.y);
}

/** Пытается поставить кусочек на место. @returns {boolean} */
export function trySnap(session, piece) {
  if (piece.placed) return false;
  if (distanceToHome(piece) > snapTolerance(session)) return false;
  piece.x = piece.home.x;
  piece.y = piece.home.y;
  piece.rot = 0;
  piece.placed = true;
  session.placed += 1;
  if (session.placed >= session.pieces.length) session.complete = true;
  return true;
}

/** Мгновенно доставить все кусочки (отладка, кнопка «сдаться»). */
export function placeAll(session) {
  const rest = session.pieces.filter((p) => !p.placed);
  for (const p of rest) {
    p.x = p.home.x;
    p.y = p.home.y;
    p.rot = 0;
    p.placed = true;
    session.placed += 1;
  }
  session.complete = session.placed >= session.pieces.length;
  return rest;
}

export function startTimer(session) {
  if (!session.startedAt) session.startedAt = Date.now();
  return session.startedAt;
}

/** Останавливает таймер и возвращает время в секундах. */
export function finish(session) {
  if (!session.startedAt) startTimer(session);
  session.finishedAt = Date.now();
  return Math.max(1, Math.round((session.finishedAt - session.startedAt) / 1000));
}

export function formatTime(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
