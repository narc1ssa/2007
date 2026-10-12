/**
 * Оффлайн-превью стола: рисует через ImageMagick кадр «в процессе сборки»
 * — доска с пустыми гнёздами и разложенные кусочки.
 *
 * Запуск:  node tools/preview-compose.mjs [номер уровня] [ширина] [высота] [solved]
 *   solved — рисует финал: все кусочки на местах, уже с аниме-картинкой
 *            (так выглядит доска в конце анимации «проявки»).
 * Результат:  preview/level-NN-<ширина>x<высота>[-solved].png
 *
 * Это инструмент разработки: он повторяет ту же математику, что и игра
 * (js/jigsaw.js + js/layout.js), и помогает увидеть раскладку без браузера.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { flatten, buildPuzzle } from '../js/jigsaw.js';
import { computeLayout, scatterPositions } from '../js/layout.js';
import { makeRandom } from '../js/jigsaw.js';
import { LEVELS, ASSETS } from '../js/levels.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'preview');
mkdirSync(out, { recursive: true });

const levelNo = Number(process.argv[2] || 1);
const viewW = Number(process.argv[3] || 1280);
const viewH = Number(process.argv[4] || 800);
const chrome = 116;
const stageW = viewW;
const stageH = viewH - chrome;
const ASPECT = 1080 / 1349;

const level = LEVELS[levelNo - 1] || LEVELS[0];
const { board: boardRect, areas } = computeLayout({ stageW, stageH, aspect: ASPECT });

const cellW = Math.max(26, Math.round(boardRect.w / level.cols));
const cellH = Math.max(26, Math.round(boardRect.h / level.rows));
const boardW = cellW * level.cols;
const boardH = cellH * level.rows;
const boardX = Math.round(boardRect.x + (boardRect.w - boardW) / 2);
const boardY = Math.round(boardRect.y + (boardRect.h - boardH) / 2);

const puzzle = buildPuzzle({ cols: level.cols, rows: level.rows, cellW, cellH, seed: level.seed });
const pad = puzzle.pieces[0].pad;
const size = { w: puzzle.pieces[0].box.w, h: puzzle.pieces[0].box.h };
const rand = makeRandom(level.seed ^ 0x9e37);
const spots = scatterPositions({ count: puzzle.pieces.length, areas, size, rand });

const poly = (p, dx = 0, dy = 0) =>
  flatten(p.commands, 16)
    .map(([x, y]) => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`)
    .join(' ');

/* --- фон стола --- */
const frame = resolve(out, '_bg.png');
const draw = [
  '-size', `${stageW}x${stageH}`, 'xc:#0b101c',
  '-fill', '#101728', '-draw', `rectangle 0,0 ${stageW},${Math.round(stageH * 0.5)}`,
  // доска
  '-fill', '#05090f', '-stroke', '#2a3c60', '-strokewidth', '1',
  '-draw', `roundrectangle ${boardX},${boardY} ${boardX + boardW},${boardY + boardH} 4,4`,
];
// гнёзда под кусочки
for (const p of puzzle.pieces) {
  draw.push('-fill', '#0a1navy'.replace('#0a1navy', '#0a1220'), '-stroke', '#26385a', '-strokewidth', '1',
    '-draw', `polygon ${poly(p, p.home.x + boardX, p.home.y + boardY)}`);
}
execFileSync('convert', [...draw, frame]);

/* --- фото, нарезанное с запасом на замки --- */
const solved = process.argv[5] === 'solved';
const src = resolve(root, solved ? ASSETS.raw.anime(level.id) : ASSETS.raw.real(level.id));
const padded = resolve(out, '_padded.png');
execFileSync('convert', [
  src, '-resize', `${boardW}x${boardH}!`, '-bordercolor', 'black', '-border', String(pad), padded,
]);

/* --- кусочки: в финале — на своих местах, иначе — раскиданные по столу --- */
const table = frame;
puzzle.pieces.forEach((p, i) => {
  const spot = solved
    ? { x: p.home.x + boardX, y: p.home.y + boardY }
    : spots[i] || { x: p.home.x + boardX, y: p.home.y + boardY };
  const cropX = p.col * cellW;
  const cropY = p.row * cellH;
  const crop = resolve(out, `_c${i}.png`);
  const mask = resolve(out, `_m${i}.png`);
  const shadow = resolve(out, `_s${i}.png`);
  execFileSync('convert', [padded, '-crop', `${size.w}x${size.h}+${cropX}+${cropY}`, '+repage', crop]);
  execFileSync('convert', ['-size', `${size.w}x${size.h}`, 'xc:black', '-fill', 'white', '-stroke', 'none', '-draw', `polygon ${poly(p)}`, mask]);
  execFileSync('convert', [crop, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', shadow]);
  execFileSync('convert', [table, shadow, '-geometry', `+${Math.round(spot.x)}+${Math.round(spot.y)}`, '-composite', table]);
});

const target = resolve(out, `level-${level.id}-${viewW}x${viewH}${solved ? "-solved" : ""}.png`);
execFileSync('convert', [table, target]);
rmSync(frame);
for (const f of ['_padded.png']) rmSync(resolve(out, f), { force: true });
execFileSync('bash', ['-c', `rm -f ${out}/_*.png`]);

console.log(`готово: ${target.replace(root + '/', '')}`);
console.log(`кадр ${level.id} «${level.title}», ${level.cols}x${level.rows} = ${level.cols * level.rows} кусочков, клетка ${cellW}x${cellH}, доска ${boardW}x${boardH} @ ${boardX},${boardY}`);
