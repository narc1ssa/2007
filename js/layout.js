/**
 * Раскладка стола: где стоит доска и в каких областях рассыпаны кусочки.
 * Всё считается в пикселях «сцены» (stage), без обращения к DOM.
 */

const MARGIN = 14;

/**
 * Подбирает положение доски и свободные области под лоток с кусочками.
 *
 * @param {{stageW:number, stageH:number, aspect:number}} p
 *        aspect = ширина / высота кадра (у наших кадров ≈ 0.8)
 * @returns {{board:{x:number,y:number,w:number,h:number}, areas:Array<{x:number,y:number,w:number,h:number}>}}
 */
export function computeLayout({ stageW, stageH, aspect }) {
  const W = Math.max(320, Math.round(stageW));
  const H = Math.max(320, Math.round(stageH));

  const candidates = [trySides(W, H, aspect), tryBottom(W, H, aspect), tryStack(W, H, aspect)].filter(Boolean);
  let best = null;
  for (const c of candidates) {
    const tray = c.areas.reduce((s, a) => s + a.w * a.h, 0);
    const board = c.board.w * c.board.h;
    // Доска важнее, но и лоток должен быть просторным.
    const score = board + tray * 0.55;
    if (!best || score > best.score) best = { ...c, score };
  }
  if (!best) {
    // крайний случай — крошечный экран
    const h = Math.min(H - 2 * MARGIN, (W - 2 * MARGIN) / aspect);
    const w = h * aspect;
    return {
      board: { x: (W - w) / 2, y: MARGIN, w, h },
      areas: [{ x: MARGIN, y: MARGIN + h + MARGIN, w: W - 2 * MARGIN, h: Math.max(60, H - h - 3 * MARGIN) }],
    };
  }
  return { board: best.board, areas: best.areas };
}

/** Доска по центру, кусочки — в двух колонках по бокам. */
function trySides(W, H, aspect) {
  let h = H - 2 * MARGIN;
  let w = h * aspect;
  const maxW = W * 0.56;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  if (w < 190) return null;
  w = Math.round(w);
  h = Math.round(h);
  const x = Math.round((W - w) / 2);
  const y = Math.round((H - h) / 2);
  const leftW = x - 2 * MARGIN;
  const rightW = W - (x + w) - 2 * MARGIN;
  if (leftW < 104 || rightW < 104) return null;
  return {
    board: { x, y, w, h },
    areas: [
      { x: MARGIN, y: MARGIN, w: leftW, h: H - 2 * MARGIN },
      { x: x + w + MARGIN, y: MARGIN, w: rightW, h: H - 2 * MARGIN },
    ],
  };
}

/** Доска сверху, кусочки — полосой снизу. */
function tryBottom(W, H, aspect) {
  const hCap = (H - 2 * MARGIN) * 0.66;
  let h = hCap;
  let w = h * aspect;
  const wCap = W - 2 * MARGIN;
  if (w > wCap) {
    w = wCap;
    h = w / aspect;
  }
  if (w < 190) return null;
  w = Math.round(w);
  h = Math.round(h);
  const x = Math.round((W - w) / 2);
  const y = MARGIN;
  const areaY = y + h + MARGIN;
  const areaH = H - areaY - MARGIN;
  if (areaH < 88) return null;
  return {
    board: { x, y, w, h },
    areas: [{ x: MARGIN, y: areaY, w: W - 2 * MARGIN, h: areaH }],
  };
}

/** Совсем узкий экран: маленькая доска сверху и большая полоса снизу. */
function tryStack(W, H, aspect) {
  const wCap = W - 2 * MARGIN;
  let h = (H - 2 * MARGIN) * 0.5;
  let w = h * aspect;
  if (w > wCap) {
    w = wCap;
    h = w / aspect;
  }
  if (w < 150) return null;
  w = Math.round(w);
  h = Math.round(h);
  const x = Math.round((W - w) / 2);
  const y = MARGIN;
  const areaY = y + h + MARGIN;
  const areaH = H - areaY - MARGIN;
  if (areaH < 110) return null;
  return {
    board: { x, y, w, h },
    areas: [{ x: MARGIN, y: areaY, w: W - 2 * MARGIN, h: areaH }],
  };
}

/**
 * Раскидывает кусочки по свободным областям.
 *
 * @param {object} p
 * @param {number} p.count — сколько кусочков
 * @param {Array<{x:number,y:number,w:number,h:number}>} p.areas
 * @param {{w:number,h:number}} p.size — размер бокса кусочка
 * @param {() => number} p.rand — источник случайности
 * @param {number} [p.jitter] — доля разброса внутри ячейки
 * @returns {Array<{x:number,y:number}>} — левый верхний угол бокса кусочка
 */
export function scatterPositions({ count, areas, size, rand, jitter = 0.34 }) {
  const usable = areas.filter((a) => a.w > 30 && a.h > 30);
  if (!usable.length || count <= 0) return [];
  const totalArea = usable.reduce((s, a) => s + a.w * a.h, 0);

  // Сколько кусочков в каждую область — пропорционально площади.
  const quota = usable.map((a) => Math.max(1, Math.round((count * (a.w * a.h)) / totalArea)));
  let diff = count - quota.reduce((s, q) => s + q, 0);
  let i = 0;
  while (diff !== 0 && i < 1000) {
    const idx = Math.abs(diff) > usable.length ? (i % usable.length) : (i % usable.length);
    quota[idx] += diff > 0 ? 1 : -1;
    diff = count - quota.reduce((s, q) => s + q, 0);
    i++;
  }

  const out = [];
  usable.forEach((area, ai) => {
    const n = Math.max(0, Math.min(count - out.length, quota[ai]));
    out.push(...pointsInArea(area, n, size, rand, jitter));
  });
  // если из-за округления остались лишние — доложим в самую большую область
  while (out.length < count) {
    const big = usable.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    out.push(...pointsInArea(big, 1, size, rand, jitter));
  }
  return out.slice(0, count);
}

function pointsInArea(area, n, size, rand, jitter) {
  if (n <= 0) return [];
  const cell = Math.sqrt((area.w * area.h) / n);
  const cols = Math.max(1, Math.min(n, Math.round(area.w / cell)));
  const rows = Math.ceil(n / cols);
  const cw = area.w / cols;
  const ch = area.h / rows;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cx = area.x + c * cw + cw / 2;
    const cy = area.y + r * ch + ch / 2;
    const jx = (rand() - 0.5) * Math.max(0, cw - size.w * 0.5) * (jitter * 2);
    const jy = (rand() - 0.5) * Math.max(0, ch - size.h * 0.5) * (jitter * 2);
    let x = cx + jx - size.w / 2;
    let y = cy + jy - size.h / 2;
    // Кусочек всегда целиком внутри своей области: лоток уже отодвинут от краёв
    // сцены, поэтому ничего не уезжает за экран. Если область меньше кусочка —
    // центрируем его в этой области.
    x = area.w > size.w ? Math.min(Math.max(x, area.x), area.x + area.w - size.w) : area.x + (area.w - size.w) / 2;
    y = area.h > size.h ? Math.min(Math.max(y, area.y), area.y + area.h - size.h) : area.y + (area.h - size.h) / 2;
    pts.push({ x: Math.round(x), y: Math.round(y) });
  }
  // перемешиваем, чтобы кусочки не легли «по порядку»
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts;
}
