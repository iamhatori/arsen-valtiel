const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

test('1. Внутренние ссылки и существование разделов', () => {
  const hrefMatches = [...html.matchAll(/href="(#[a-zA-Z0-9_-]+)"/g)].map(m => m[1]);
  assert.ok(hrefMatches.length > 0, 'Должны быть внутренние ссылки');

  const uniqueAnchors = [...new Set(hrefMatches)];
  for (const anchor of uniqueAnchors) {
    const id = anchor.slice(1);
    const hasId = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    assert.ok(hasId, `Раздел с id="${id}" должен существовать для якоря ${anchor}`);
  }
});

test('2. Разрешённые внешние адреса и безопасность rel="noopener noreferrer"', () => {
  const allowedDomains = ['t.me', 'youtube.com', 'x.com', 'jsdelivr.net', 'unpkg.com', 'googleapis.com', 'gstatic.com', 'website-files.com', 'cloudfront.net'];
  const anchorTagRegex = /<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi;
  let match;

  while ((match = anchorTagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const url = match[1];
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const isAllowed = allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
    assert.ok(isAllowed, `Внешний адрес ${url} должен быть из разрешённых доменов`);

    if (fullTag.includes('target="_blank"')) {
      assert.ok(
        fullTag.includes('rel="noopener noreferrer"'),
        `Ссылка ${url} с target="_blank" обязана иметь rel="noopener noreferrer"`
      );
    }
  }
});

test('3. Выбор восьми кейсов и наличие видеофайлов', () => {
  for (let i = 0; i < 8; i++) {
    assert.ok(html.includes(`data-index="${i}"`), `Кейс с data-index="${i}" должен существовать`);
    const fullVideo = path.join(rootDir, `assets/case-${i + 1}.mp4`);
    const previewVideo = path.join(rootDir, `assets/case-${i + 1}-preview.mp4`);
    assert.ok(fs.existsSync(fullVideo), `Видеофайл ${fullVideo} должен существовать`);
    assert.ok(fs.existsSync(previewVideo), `Превью-файл ${previewVideo} должен существовать`);
  }

  // Проверка кейса Matvey Forgeon (кейс 5) — нейтрализация AI
  assert.ok(!html.includes('Matvey Forgeon — YouTube AI'), 'В кейсе 5 не должно быть YouTube AI');
  assert.ok(!html.includes('YOUTUBE / AI'), 'Формат кейса 5 не должен содержать AI');
  assert.ok(!html.includes('горизонтальный ролик про AI'), 'Описание кейса 5 не должно содержать упоминание про AI');
  assert.ok(html.includes('Matvey Forgeon'), 'Кейс Matvey Forgeon должен быть сохранён');
});

test('4. Доступные имена кнопок', () => {
  const buttonRegex = /<button\b([^>]*)>(.*?)<\/button>/gis;
  let match;
  let count = 0;

  while ((match = buttonRegex.exec(html)) !== null) {
    count++;
    const attrs = match[1];
    const content = match[2].trim();
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(attrs);
    const hasVisibleText = content.replace(/<[^>]*>/g, '').trim().length > 0;
    assert.ok(
      hasAriaLabel || hasVisibleText,
      `Кнопка #${count} (${attrs.slice(0, 40)}) должна иметь aria-label или видимый текст`
    );
  }
  assert.ok(count > 0, 'На странице должны быть интерактивные кнопки');
});

test('5. Подключение обработчиков и структура модального плеера', () => {
  assert.ok(html.includes('id="caseCinemaModal"'), 'Элемент caseCinemaModal должен существовать');
  assert.ok(html.includes('id="cinemaModalVideo"'), 'Элемент cinemaModalVideo должен существовать');
  assert.ok(html.includes('id="cinemaModalTitle"'), 'Элемент cinemaModalTitle должен существовать');
  assert.ok(html.includes('id="cinemaModalTag"'), 'Элемент cinemaModalTag должен существовать');
  assert.ok(html.includes('data-cinema-close'), 'Кнопки закрытия с data-cinema-close должны присутствовать');

  // Видео в модальном окне должно иметь нативные controls
  assert.ok(/<video\s+[^>]*id="cinemaModalVideo"[^>]*controls/i.test(html), 'cinemaModalVideo должен иметь атрибут controls');

  // Проверка отсутствия кастомных ИИ-контролов
  assert.ok(!html.includes('id="cinemaScrubberTrack"'), 'Кастомный скраббер должен быть удален');
  assert.ok(!html.includes('id="cinemaCenterPlayBtn"'), 'Центральная кнопка плей должна быть удалена');
});

test('6. Закрытие модального плеера и корректное подключение кастомного курсора', () => {
  // Закрытие по кнопке и по Escape реализовано в скрипте
  assert.ok(html.includes('closeCinemaModal'), 'Функция closeCinemaModal должна быть объявлена');
  assert.ok(html.includes("e.key === 'Escape'"), 'Обработчик закрытия по клавише Escape должен быть подключен');

  // Кастомный курсор MouseFollower подключен и инициализируется
  assert.ok(html.includes('mouse-follower.min.css'), 'Стили mouse-follower должны быть подключены');
  assert.ok(html.includes('mouse-follower.min.js'), 'Библиотека mouse-follower должна быть подключена');
  assert.ok(html.includes('.mf-cursor'), 'CSS-классы .mf-cursor должны быть объявлены');
  assert.ok(html.includes('function initCursor()'), 'Функция initCursor должна быть объявлена');
  assert.ok(html.includes('window.cursorInstance = new MouseFollower'), 'MouseFollower должен инициализироваться');
});

test('7. Проверка графика удержания (retention chart) — завершение кривой до точки 78% (544, 74)', () => {
  // SVG путь curveArsen должен доходить до x=544, y=74
  const curveArsenMatch = html.match(/id="curveArsen"[^>]*d="([^"]+)"/);
  assert.ok(curveArsenMatch, 'Элемент curveArsen с атрибутом d должен существовать');
  assert.ok(curveArsenMatch[1].includes('544 74'), 'Кривая curveArsen должна завершаться в координатах 544 74');

  // Градиентная заливка chartAreaFill также должна закрывать область до x=544
  const areaFillMatch = html.match(/id="chartAreaFill"[^>]*d="([^"]+)"/);
  assert.ok(areaFillMatch, 'Элемент chartAreaFill с атрибутом d должен существовать');
  assert.ok(areaFillMatch[1].includes('544 74'), 'Область chartAreaFill должна доходить до 544 74');

  // В анимации завершение должно снимать dasharray для гарантированной отрисовки линии до конца
  assert.ok(html.includes("curveArsen.style.strokeDasharray = 'none'"), 'При завершении анимации strokeDasharray curveArsen должен сбрасываться в none');
  assert.ok(html.includes("curveArsen.style.strokeDashoffset = '0'"), 'При завершении анимации strokeDashoffset curveArsen должен сбрасываться в 0');
});

