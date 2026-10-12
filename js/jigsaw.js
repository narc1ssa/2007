/**
 * Геометрия джигсав-пазла.
 *
 * Модуль чисто вычислительный: он не знает ничего про DOM.
 * Из описания сетки (cols x rows) он строит для каждого кусочка
 * SVG-путь замкнутой фигуры с "замками" (выступами/впадинами).
 *
 * Система координат кусочка — "бокс" размера
 *   (cellW + 2*pad) x (cellH + 2*pad),
 * внутри которого сама клетка картинки занимает прямоугольник
 *   [pad, pad] .. [pad + cellW, pad + cellH].
 * Именно поэтому фон кусочка выставляется как
 *   background-position: -(col*cellW - pad) -(row*cellH - pad).
 */

/** Глубина замка относительно длины стороны. */
const TAB_DEPTH = 0.2;
/** Насколько далеко выступают контрольные точки замка по нормали. */
const BORDER = TAB_DEPTH;

/**
 * Детерминированный ГПСЧ (xorshift32), чтобы один и тот же уровень
 * всегда собирался в один и тот же пазл.
 */
export function makeRandom(seed = 1) {
  let s = (seed | 0) || 1;
  return function random() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Случайная разводка замков.
 * @returns {{v: number[][], h: number[][], depth: number[][]}}
 *   v[row][col] — замок на вертикальной границе между (row,col) и (row,col+1)
 *                (+1 — выступ вправо, -1 — вправо впадина)
 *   h[row][col] — замок на горизонтальной границе между (row,col) и (row+1,col)
 *                (+1 — выступ вниз, -1 — вниз впадина)
 *   depth[row][col] — множитель глубины для вертикального замка
 *   depth[row][col] для горизонтальных замков хранится в depthH
 */
export function makeTabs(cols, rows, seed = 1) {
  const rand = makeRandom(seed);
  const v = [];
  const h = [];
  const vDepth = [];
  const hDepth = [];
  for (let r = 0; r < rows; r++) {
    v[r] = [];
    h[r] = [];
    vDepth[r] = [];
    hDepth[r] = [];
    for (let c = 0; c < cols; c++) {
      v[r][c] = c === cols - 1 ? 0 : (rand() < 0.5 ? 1 : -1);
      h[r][c] = r === rows - 1 ? 0 : (rand() < 0.5 ? 1 : -1);
      vDepth[r][c] = 0.88 + rand() * 0.24;
      hDepth[r][c] = 0.88 + rand() * 0.24;
    }
  }
  return { v, h, vDepth, hDepth };
}

/**
 * Кривая одного "замка" в нормированных координатах: t — вдоль стороны
 * (0..1), u — по нормали (положительное значение — наружу от кусочка),
 * в единицах глубины замка.
 */
function tabCommands() {
  return [
    { op: 'L', p: [0.36, 0] },
    { op: 'C', p1: [0.44, 0.0], p2: [0.355, 0.22], p: [0.38, 0.47] },
    { op: 'C', p1: [0.4, 0.78], p2: [0.6, 0.78], p: [0.62, 0.47] },
    { op: 'C', p1: [0.645, 0.22], p2: [0.56, 0.0], p: [0.64, 0.0] },
    { op: 'L', p: [1, 0] },
  ];
}

/**
 * Путь одной стороны кусочка.
 *
 * @param {{x:number,y:number}} origin — начало стороны в координатах бокса
 * @param {[number,number]} dir — единичный вектор вдоль стороны (в пикселях на t=1)
 * @param {[number,number]} perp — единичный вектор нормали (в пикселях на u=1)
 * @param {number} length — длина стороны в пикселях
 * @param {number} sign — +1 выступ наружу, -1 впадина, 0 — ровный край
 * @param {number} depth — глубина замка в пикселях
 */
function edgeCommands(origin, dir, perp, length, sign, depth) {
  const map = (t, u) => [
    origin.x + dir[0] * t * length + perp[0] * u * sign * depth,
    origin.y + dir[1] * t * length + perp[1] * u * sign * depth,
  ];
  if (!sign) {
    return [{ op: 'L', p: map(1, 0) }];
  }
  return tabCommands().map((cmd) => {
    if (cmd.op === 'L') return { op: 'L', p: map(cmd.p[0], cmd.p[1]) };
    return {
      op: 'C',
      p1: map(cmd.p1[0], cmd.p1[1]),
      p2: map(cmd.p2[0], cmd.p2[1]),
      p: map(cmd.p[0], cmd.p[1]),
    };
  });
}

/**
 * Возвращает описание одного кусочка.
 *
 * @param {{col:number,row:number,cols:number,rows:number,cellW:number,cellH:number}} cell
 * @param {ReturnType<typeof makeTabs>} tabs
 */
export function pieceGeometry({ col, row, cols, rows, cellW, cellH }, tabs) {
  const pad = Math.ceil(Math.max(cellW, cellH) * (TAB_DEPTH + 0.03));
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + cellW;
  const y1 = pad + cellH;

  const vTab = (r, c) => (c < 0 || c >= cols - 1 || r < 0 || r >= rows ? 0 : tabs.v[r][c]);
  const hTab = (r, c) => (r < 0 || r >= rows - 1 || c < 0 || c >= cols ? 0 : tabs.h[r][c]);

  // Для кусочка наружу смотрит выступ только тогда, когда соседняя
  // сторона границы "занята" вогнутостью соседа.
  const top = -hTab(row - 1, col);
  const right = vTab(row, col);
  const bottom = hTab(row, col);
  const left = -vTab(row, col - 1);

  const topDepth = cellH * TAB_DEPTH * (tabs.hDepth[row - 1]?.[col] ?? 1);
  const bottomDepth = cellH * TAB_DEPTH * (tabs.hDepth[row]?.[col] ?? 1);
  const leftDepth = cellW * TAB_DEPTH * (tabs.vDepth[row]?.[col - 1] ?? 1);
  const rightDepth = cellW * TAB_DEPTH * (tabs.vDepth[row]?.[col] ?? 1);

  // Обход контура по часовой стрелке; для каждой стороны задаём истинную
  // внешнюю нормаль, чтобы знак замка означал одно и то же на всех кромках:
  // +1 — выступ наружу, -1 — впадина внутрь.
  const commands = [
    { op: 'M', p: [x0, y0] },
    ...edgeCommands({ x: x0, y: y0 }, [1, 0], [0, -1], cellW, top, topDepth),
    ...edgeCommands({ x: x1, y: y0 }, [0, 1], [1, 0], cellH, right, rightDepth),
    ...edgeCommands({ x: x1, y: y1 }, [-1, 0], [0, 1], cellW, bottom, bottomDepth),
    ...edgeCommands({ x: x0, y: y1 }, [0, -1], [-1, 0], cellH, left, leftDepth),
    { op: 'Z' },
  ];

  return {
    commands,
    box: { w: cellW + pad * 2, h: cellH + pad * 2 },
    pad,
    /** Куда попадает левый верхний угол клетки относительно бокса. */
    offset: { x: pad, y: pad },
    /** Границы фигуры в координатах бокса (для статичного расчёта пересечений). */
    bounds: { x0, y0, x1, y1 },
  };
}

const n = (v) => (Math.round(v * 100) / 100).toString();

/** Сериализация команд в атрибут `d` для SVG. */
export function toPathD(commands) {
  return commands
    .map((cmd) => {
      if (cmd.op === 'M') return `M${n(cmd.p[0])} ${n(cmd.p[1])}`;
      if (cmd.op === 'L') return `L${n(cmd.p[0])} ${n(cmd.p[1])}`;
      if (cmd.op === 'C') {
        return `C${n(cmd.p1[0])} ${n(cmd.p1[1])} ${n(cmd.p2[0])} ${n(cmd.p2[1])} ${n(cmd.p[0])} ${n(cmd.p[1])}`;
      }
      return 'Z';
    })
    .join(' ');
}

/**
 * Раскладывает кубическую кривую Безье в ломаную (для проверки геометрии
 * и для расчёта попадания пальцем).
 */
export function flatten(commands, steps = 24) {
  const points = [];
  let cur = [0, 0];
  for (const cmd of commands) {
    if (cmd.op === 'M') {
      cur = cmd.p.slice();
      points.push(cur.slice());
    } else if (cmd.op === 'L') {
      cur = cmd.p.slice();
      points.push(cur.slice());
    } else if (cmd.op === 'C') {
      const [x0, y0] = cur;
      const [cx1, cy1] = cmd.p1;
      const [cx2, cy2] = cmd.p2;
      const [x1, y1] = cmd.p;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const a = mt * mt * mt;
        const b = 3 * mt * mt * t;
        const c = 3 * mt * t * t;
        const d = t * t * t;
        points.push([
          a * x0 + b * cx1 + c * cx2 + d * x1,
          a * y0 + b * cy1 + c * cy2 + d * y1,
        ]);
      }
      cur = [x1, y1];
    }
  }
  return points;
}

/** Полный набор кусочков уровня: пути, боксы и правильные позиции. */
export function buildPuzzle({ cols, rows, cellW, cellH, seed = 1 }) {
  const tabs = makeTabs(cols, rows, seed);
  const pieces = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const geo = pieceGeometry({ col, row, cols, rows, cellW, cellH }, tabs);
      pieces.push({
        col,
        row,
        index: row * cols + col,
        d: toPathD(geo.commands),
        commands: geo.commands,
        pad: geo.pad,
        box: geo.box,
        // Левый верхний угол бокса кусочка, когда он стоит на своём месте.
        home: { x: col * cellW - geo.pad, y: row * cellH - geo.pad },
      });
    }
  }
  return {
    cols,
    rows,
    cellW,
    cellH,
    seed,
    tabs,
    tabDepth: TAB_DEPTH,
    board: { w: cols * cellW, h: rows * cellH },
    pieces,
  };
}

export const JIGSAW_CONST = { TAB_DEPTH, BORDER };
