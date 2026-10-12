/**
 * Проверка игры без браузера (jsdom).
 *
 * Запуск:
 *    npm install --no-save jsdom
 *    node tools/smoke-test.mjs
 *
 * Что проверяем:
 *   1. модули импортируются и приложение стартует, меню строит 11 карточек;
 *   2. уровень запускается, кусочки создаются, их столько, сколько нужно;
 *   3. перетаскивание и «примагничивание» работают: кадр можно собрать целиком;
 *   4. после сборки открывается окно с аниме-кадром, прогресс сохраняется.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.error('Нужен jsdom:  npm install --no-save jsdom');
  process.exit(2);
}

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });

// Отдаём модулям приложения окружение jsdom.
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.HTMLImageElement = dom.window.HTMLImageElement;
global.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
// Картинки в jsdom не грузятся — подсовываем мгновенный «успех».
global.Image = class {
  set src(value) {
    this._src = value;
    setTimeout(() => this.onload && this.onload(), 0);
  }
  get src() {
    return this._src;
  }
};
dom.window.Image = global.Image;

const failures = [];
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}`);
  if (!cond) failures.push(label);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await import(resolve(root, 'js/app.js'));
const app = global.window.__puzzle2007;
const $ = (id) => document.getElementById(id);

console.log('\n1. Меню');
ok(!!app, 'приложение стартовало и отдало отладочный хендл');
ok($('level-grid').children.length === 11, 'в меню 11 карточек-уровней');
ok($('screen-menu').classList.contains('is-active'), 'открыт экран меню');
ok($('menu-progress-text').textContent.includes('0 из 11'), 'прогресс начинается с нуля');

console.log('\n2. Запуск уровня');
$('btn-continue').click();
await wait(120);
const session = app.state.session;
ok(app.state.screen === 'play', 'перешли на экран игры');
ok(!!session, 'сессия уровня создана');
ok(session.pieces.length === 12, `в первом кадре 12 кусочков (получено ${session.pieces?.length})`);
ok($('pieces').children.length === 12, 'все кусочки выложены на стол');
ok($('play-total').textContent === '/12', 'счётчик показывает 12');

console.log('\n3. Перетаскивание и сборка');
const piece = session.pieces[0];
ok(!piece.placed, 'кусочек ещё не на месте');
const stage = $('stage-inner');
const ev = (type, x, y) =>
  stage.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

// В реальной игре кусочек под курсором всплывает наверх; в тесте делаем это явно,
// иначе можно схватить сосед из «кучи» — он лежит выше.
app.core.bringToFront(session, piece);
ev('pointerdown', piece.x + 4, piece.y + 4);
ok(Boolean(app.state.drag), 'кусочек взят');
ok(app.state.drag?.piece === piece, 'взят именно тот кусочек, за который потянули');
ev('pointermove', piece.x + 90, piece.y + 90);
ok(piece.x !== piece.home.x, 'кусочек двигается за курсором');
ev('pointermove', piece.home.x + 2, piece.home.y + 2);
ev('pointerup', piece.home.x + 2, piece.home.y + 2);
ok(piece.placed, 'кусочек щёлкнул на своё место');
ok($('play-placed').textContent === '1', 'счётчик обновился');

// Собираем кадр целиком.
for (const p of session.pieces) {
  if (p.placed) continue;
  app.core.bringToFront(session, p);
  ev('pointerdown', p.x + 4, p.y + 4);
  if (app.state.drag?.piece === p) {
    ev('pointermove', p.home.x, p.home.y);
    ev('pointerup', p.home.x, p.home.y);
  }
}
ok(session.placed === 12, `кадр собран целиком (${session.placed}/12)`);
ok(session.complete === true, 'сессия помечена собранной');

console.log('\n4. Победа и прогресс');
await wait(3000);
ok($('board-solved').classList.contains('is-on'), 'аниме-кадр проявился на доске');
ok($('reveal').hidden === false, 'открылось окно «кадр собран»');
ok(Boolean($('reveal-compare').querySelector('.compare__after')), 'в окне есть ползунок фото/аниме');
ok($('reveal-caption').textContent.includes('собрано за'), 'показано время сборки');
ok(app.store.solvedCount() === 1, 'прогресс сохранён в localStorage');
ok(app.store.isSolved(0) === true, 'первый кадр отмечен собранным');

console.log('\n5. Галерея и следующий уровень');
$('reveal-gallery').click();
ok(app.state.screen === 'gallery', 'галерея открылась');
ok($('gallery-count').textContent === '1 / 11', 'в галерее один кадр');
ok($('gallery-grid').children[0].className.includes('card__solved'), 'кадр 01 отмечен собранным');
$('gallery-back').click();
await wait(30);
$('level-grid').children[1].click();
await wait(120);
ok(app.state.levelIndex === 1, 'второй уровень запускается после первого');
ok(app.state.session.pieces.length === 16, 'во втором кадре 16 кусочков');

console.log(failures.length ? `\n✗ провалено проверок: ${failures.length}` : '\n✓ все проверки пройдены');
process.exit(failures.length ? 1 : 0);
