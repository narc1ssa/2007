/**
 * Проверка геометрии пазла без браузера.
 *
 * Запуск:  node tools/geometry-check.mjs
 *
 * Скрипт прогоняет тот же модуль js/jigsaw.js, что и игра, и собирает
 * картинки-контрольки через ImageMagick (без SVG-делегата, только -draw):
 *   1) контуры всех кусочков — видно, стыкуются ли замки;
 *   2) реальное фото, нарезанное по этим контурам и собранное обратно —
 *      видно, совпадает ли фон кусочка с его местом на доске.
 *
 * Результаты кладутся в checks/ (это инструмент отладки, не часть игры).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPuzzle, flatten } from '../js/jigsaw.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'checks');
mkdirSync(out, { recursive: true });

const cols = 4;
const rows = 5;
const cellW = 216;
const cellH = 216;
const half = 2; // упрощение кривых: чем меньше, тем быстрее
const seed = 2007;
const puzzle = buildPuzzle({ cols, rows, cellW, cellH, seed });

const poly = (piece, translateX = 0, translateY = 0) =>
  flatten(piece.commands, 18)
    .map(([x, y]) => `${(x + translateX).toFixed(1)},${(y + translateY).toFixed(1)}`)
    .join(' ');

/* ---------- 1. Контуры кусочков ---------- */
const pad = puzzle.pieces[0].pad;
const w = puzzle.board.w + 2 * pad;
const h = puzzle.board.h + 2 * pad;
const drawArgs = [];
writeFileSync(resolve(out, 'geometry-grid.svg'), buildPreviewSvg());
for (const p of puzzle.pieces) {
  drawArgs.push('-fill', (p.row + p.col) % 2 ? '#2f6f8f' : '#1d4f6b', '-stroke', '#9fe8ff', '-strokewidth', '0.9', '-draw',
    `polygon ${poly(p, p.col * cellW, p.row * cellH)}`);
}
execFileSync('convert', ['-size', `${w}x${h}`, 'xc:#101018', ...drawArgs, resolve(out, 'geometry-grid.png')]);

/* ---------- 2. Фото, собранное из кусочков ---------- */
const padded = resolve(out, '_padded.png');
execFileSync('convert', [
  resolve(root, 'real/01.jpg'),
  '-resize', `${puzzle.board.w}x${puzzle.board.h}!`,
  '-bordercolor', 'black', '-border', String(pad),
  padded,
]);

const board = resolve(out, '_board.png');
execFileSync('convert', ['-size', `${w}x${h}`, 'xc:black', board]);

puzzle.pieces.forEach((p, i) => {
  const x = p.col * cellW;
  const y = p.row * cellH;
  const crop = resolve(out, `_crop${i}.png`);
  const mask = resolve(out, `_mask${i}.png`);
  const piece = resolve(out, `_piece${i}.png`);
  execFileSync('convert', [padded, '-crop', `${p.box.w}x${p.box.h}+${x}+${y}`, '+repage', crop]);
  execFileSync('convert', [
    '-size', `${p.box.w}x${p.box.h}`, 'xc:black',
    '-fill', 'white', '-stroke', 'none',
    '-draw', `polygon ${poly(p)}`,
    mask,
  ]);
  execFileSync('convert', [crop, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', piece]);
  execFileSync('convert', [board, piece, '-geometry', `+${x}+${y}`, '-composite', board]);
});

execFileSync('convert', [board, resolve(out, 'geometry-assembled.png')]);
execFileSync('rm', ['-f', `${out}/_crop0.png`]);
execFileSync('bash', ['-c', `rm -f ${out}/_*.png`]);

console.log('готово: checks/geometry-grid.png и checks/geometry-assembled.png');
console.log(`кусочков: ${puzzle.pieces.length}, бокс: ${puzzle.pieces[0].box.w}x${puzzle.pieces[0].box.h}, pad: ${pad}`);

function buildPreviewSvg() {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="#101018"/>`,
  ];
  for (const p of puzzle.pieces) {
    parts.push(
      `<polygon points="${poly(p)}" fill="none" stroke="#9fe8ff" stroke-width="1" transform="translate(${p.col * cellW},${p.row * cellH})"/>`,
    );
  }
  parts.push('</svg>');
  return parts.join('\n');
}
