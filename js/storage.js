/**
 * Прогресс и настройки в localStorage.
 * Если хранилище недоступно (приватный режим, file://), игра просто
 * работает без сохранения — все функции молча деградируют.
 */

const KEY = 'puzzle2007.save.v1';

const empty = () => ({ solved: {}, times: {}, last: 0, sound: true });

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function getSave() {
  return read();
}

export function isSolved(index) {
  return Boolean(read().solved[index]);
}

export function solvedCount() {
  return Object.keys(read().solved).length;
}

export function markSolved(index, seconds) {
  const s = read();
  s.solved[index] = true;
  const prev = s.times[index];
  if (!prev || seconds < prev) s.times[index] = seconds;
  s.last = index;
  write();
}

/** Записывает, на каком уровне остановился игрок. */
export function setLast(index) {
  const s = read();
  s.last = index;
  write();
}

export function bestTime(index) {
  return read().times[index] ?? null;
}

export function resetProgress() {
  const s = read();
  cache = { ...empty(), sound: s.sound };
  write();
}

export function soundOn() {
  return read().sound !== false;
}

export function setSound(on) {
  const s = read();
  s.sound = Boolean(on);
  write();
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  cache = null;
}

/** Первый непройденный уровень — «продолжить игру». */
export function nextLevelIndex(total) {
  const s = read();
  for (let i = 0; i < total; i++) if (!s.solved[i]) return i;
  return total - 1;
}
