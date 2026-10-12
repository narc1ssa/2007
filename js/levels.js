/**
 * Уровни игры: 11 кадров зимы 2007 года.
 *
 * Каждому уровню соответствует пара файлов:
 *   real/<id>.jpg  — реальное фото (его и собираем)
 *   anime/<id>.png — аниме-версия (награда за собранный пазл)
 *
 * cols x rows — на сколько кусочков бьётся кадр.
 * seed — фиксирует разводку замков, чтобы уровень всегда собирался одинаково.
 */

export const ASSETS = {
  real: (id) => `assets/opt/real/${id}.webp`,
  anime: (id) => `assets/opt/anime/${id}.webp`,
  thumb: (id) => `assets/opt/thumb/${id}.webp`,
  thumbAnime: (id) => `assets/opt/thumb/${id}-anime.webp`,
  raw: {
    real: (id) => `real/${id}.jpg`,
    anime: (id) => `anime/${id}.png`,
  },
};

export const LEVELS = [
  { id: '01', title: 'Ночь', cols: 3, rows: 4, seed: 2007, caption: 'Общага, ночь. Монитор светится, за окном — город.' },
  { id: '02', title: 'Утро', cols: 4, rows: 4, seed: 2117, caption: 'То же окно, но свет уже серый и ровный — утро.' },
  { id: '03', title: 'Урок', cols: 4, rows: 5, seed: 2227, caption: 'Аудитория: доска, парты и тетрадь с конспектом.' },
  { id: '04', title: 'Вода', cols: 5, rows: 5, seed: 2337, caption: 'Ванная: вода, зеркало, кафель и полотенце.' },
  { id: '05', title: 'Онлайн', cols: 5, rows: 6, seed: 2447, caption: 'Стол с компьютером: открыта какая-то страница из 2007-го.' },
  { id: '06', title: 'Пролёт', cols: 6, rows: 6, seed: 2557, caption: 'Тёмный лестничный пролёт, стены выкрашены зелёным.' },
  { id: '07', title: 'Бульвар', cols: 6, rows: 7, seed: 2667, caption: 'Зимний бульвар: памятник, фонари, снег на ветках.' },
  { id: '08', title: 'Двор', cols: 6, rows: 8, seed: 2777, caption: 'Улица после снегопада — сугробы, машины, провода.' },
  { id: '09', title: 'Кухня', cols: 7, rows: 8, seed: 2887, caption: 'Кухня: телевизор на холодильнике, чай и печенье.' },
  { id: '10', title: 'Обед', cols: 7, rows: 9, seed: 2997, caption: 'Домашний стол: салаты, хлеб, чай и телевизор.' },
  { id: '11', title: 'Перемена', cols: 8, rows: 9, seed: 3107, caption: 'Коридор с кабинетами — перемена между занятиями.' },
];

/** Звёзды сложности по числу кусочков. */
export function difficulty(level) {
  const n = level.cols * level.rows;
  if (n <= 16) return 1;
  if (n <= 24) return 2;
  if (n <= 36) return 3;
  if (n <= 48) return 4;
  return 5;
}

export function stars(level) {
  return '★'.repeat(difficulty(level)) + '☆'.repeat(5 - difficulty(level));
}

export function pieceCount(level) {
  return level.cols * level.rows;
}

export function levelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}
