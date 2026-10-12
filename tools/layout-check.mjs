/**
 * Проверка раскладки стола без браузера.
 *
 * Запуск:  node tools/layout-check.mjs
 *
 * Для разных размеров окна считает, где встанет доска и где разложатся кусочки,
 * и рисует ASCII-карту:  B — доска, o — кусочек, . — свободное место.
 */
import { computeLayout, scatterPositions } from '../js/layout.js';
import { makeRandom } from '../js/jigsaw.js';
import { LEVELS } from '../js/levels.js';

const ASPECT = 1080 / 1349;
const CHROME = 116; // верхняя панель + нижние кнопки + панель задач

const viewports = [
  [1920, 1080], [1600, 900], [1440, 900], [1366, 768],
  [1280, 800], [1100, 700], [1024, 768], [900, 600],
  [820, 1180], [768, 1024], [414, 896], [360, 640],
];

const problems = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
  return cond;
};

function draw(stageW, stageH, board, spots, cols = 46) {
  const rows = Math.max(8, Math.round((cols * stageH) / stageW / 2.1));
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const put = (x, y, ch) => {
    const cx = Math.round((x / stageW) * (cols - 1));
    const cy = Math.round((y / stageH) * (rows - 1));
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy][cx] = ch;
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = (x / (cols - 1)) * stageW;
      const py = (y / (rows - 1)) * stageH;
      if (px >= board.x && px <= board.x + board.w && py >= board.y && py <= board.y + board.h) grid[y][x] = 'B';
    }
  }
  for (const s of spots) put(s.x, s.y, 'o');
  return grid.map((r) => r.join('')).join('\n');
}

console.log('раскладка для разных оконных размеров\n');
for (const [w, h] of viewports) {
  const stageW = w;
  const stageH = Math.max(240, h - CHROME);
  const { board, areas } = computeLayout({ stageW, stageH, aspect: ASPECT });

  let label = `${w}x${h}`;
  if (!check(board.x >= 0 && board.y >= 0 && board.x + board.w <= stageW + 0.5 && board.y + board.h <= stageH + 0.5,
    `${label}: доска вылезает за сцену`)) {
    // всё равно печатаем карту, чтобы видеть, что не так
  }
  for (const a of areas) {
    check(a.x >= -1 && a.y >= -1 && a.x + a.w <= stageW + 1 && a.y + a.h <= stageH + 1, `${label}: лоток вылезает за сцену`);
    const overlapX = Math.min(a.x + a.w, board.x + board.w) - Math.max(a.x, board.x);
    const overlapY = Math.min(a.y + a.h, board.y + board.h) - Math.max(a.y, board.y);
    check(!(overlapX > 2 && overlapY > 2), `${label}: лоток пересекается с доской`);
  }

  // Кусочки самого большого уровня.
  const level = LEVELS[LEVELS.length - 1];
  const cellW = Math.max(26, Math.round(board.w / level.cols));
  const cellH = Math.max(26, Math.round(board.h / level.rows));
  const pad = Math.ceil(Math.max(cellW, cellH) * 0.23);
  const size = { w: cellW + pad * 2, h: cellH + pad * 2 };
  const n = level.cols * level.rows;
  const spots = scatterPositions({ count: n, areas, size, rand: makeRandom(2007) });

  check(spots.length === n, `${label}: разложено не все кусочки (${spots.length}/${n})`);
  check(cellW >= 26 && cellH >= 26, `${label}: слишком мелкие кусочки (${cellW}x${cellH})`);
  const outside = spots.filter((s) => s.x < -1 || s.y < -1 || s.x + size.w > stageW + 1 || s.y + size.h > stageH + 1);
  check(outside.length === 0, `${label}: ${outside.length} кусочков вне сцены`);

  // площадь лотка на кусочек
  const trayArea = areas.reduce((s, a) => s + a.w * a.h, 0);
  console.log(`\n${label}  доска ${Math.round(board.w)}x${Math.round(board.h)} (${level.cols}x${level.rows} по ${cellW}x${cellH})`);
  console.log(`  лоток: ${areas.map((a) => `${Math.round(a.w)}x${Math.round(a.h)}`).join(' + ')} = ${Math.round(trayArea / 1000)} тыс. px², на кусочек ${Math.round(trayArea / n)} px²`);
  console.log(draw(stageW, stageH, board, spots, 46));
}

console.log(problems.length ? `\n✗ замечаний: ${problems.length}\n` + problems.map((p) => '  - ' + p).join('\n') : '\n✓ раскладка везде корректная');
process.exit(problems.length ? 1 : 0);
