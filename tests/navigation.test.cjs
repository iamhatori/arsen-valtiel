const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
const attributes = (source) => Object.fromEntries(
  [...source.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? true])
);
const textOf = (source) => source.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

test('все внутренние ссылки ведут на существующие разделы главной', () => {
  const internalLinks = anchors
    .map(([, rawAttributes, content]) => ({ ...attributes(rawAttributes), text: textOf(content) }))
    .filter((link) => typeof link.href === 'string' && link.href.startsWith('#'));

  assert.ok(internalLinks.length > 0, 'ожидались внутренние ссылки навигации');
  for (const link of internalLinks) {
    assert.ok(ids.has(link.href.slice(1)), `ссылка «${link.text}» ведёт на отсутствующий раздел ${link.href}`);
  }
});

test('ссылки связи и соцсетей ведут только на согласованные аккаунты монтажёра', () => {
  const expectedDestinations = new Set([
    'https://t.me/ArsenValtiel',
    'https://t.me/declineda',
    'https://www.youtube.com/@ArsenValtiel',
    'https://x.com/hypestgg/status/2102435387486638473',
  ]);
  const externalLinks = anchors
    .map(([, rawAttributes]) => attributes(rawAttributes))
    .filter((link) => typeof link.href === 'string' && /^https?:\/\//.test(link.href));

  assert.ok(externalLinks.length > 0, 'ожидались внешние контакты');
  for (const link of externalLinks) {
    assert.ok(expectedDestinations.has(link.href), `неожиданное внешнее направление: ${link.href}`);
    if (link.target === '_blank') {
      assert.match(String(link.rel || ''), /noopener/, `для новой вкладки не задан noopener: ${link.href}`);
    }
  }
});

test('каждый кейс доступен кнопкой выбора и использует локальные видеофайлы', () => {
  const caseSection = html.match(/<section[^>]*id="cases"[\s\S]*?<\/section>/)?.[0];
  assert.ok(caseSection, 'секция кейсов не найдена');
  const rows = [...caseSection.matchAll(/<article class="noir_case_row[^>]*data-index="(\d+)"[\s\S]*?<\/article>/g)];
  assert.equal(rows.length, 8, 'ожидаются все восемь кейсов');

  for (const match of rows) {
    const index = match[1];
    const row = match[0];
    const selectable = [...row.matchAll(/<button\b([^>]*)>/gi)].some(([, source]) => {
      const button = attributes(source);
      return String(button.class || '').split(/\s+/).includes('case_select') && button['aria-controls'] === 'casesNoirScreen';
    });
    assert.ok(selectable, `у кейса ${index} нет работающей кнопки выбора`);
    const sources = [...row.matchAll(/(?:src|data-full-src)="([^"]+\.mp4)"/g)].map((match) => match[1]);
    assert.ok(sources.length >= 2, `у кейса ${index} отсутствуют превью или полное видео`);
    for (const source of sources) {
      assert.ok(!path.isAbsolute(source), `видео кейса ${index} должно быть локальным: ${source}`);
      assert.ok(fs.existsSync(path.join(root, source)), `видео кейса ${index} не найдено: ${source}`);
    }
  }
});

test('кнопки управления имеют тип и доступные подписи', () => {
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  assert.ok(buttons.length > 0, 'кнопки не найдены');
  for (const [, rawAttributes, content] of buttons) {
    const button = attributes(rawAttributes);
    assert.equal(button.type, 'button', `кнопке «${textOf(content)}» не задан type="button"`);
    assert.ok(button['aria-label'] || textOf(content), 'обнаружена кнопка без доступного имени');
  }
});

test('кейсы открывают полное видео кликом, а модальное окно закрывается штатно', () => {
  assert.match(html, /video\.addEventListener\(['"]click['"]/, 'клик по превью не открывает полное видео');
  assert.match(html, /modal\.querySelectorAll\('\[data-cinema-close\]'\)\.forEach/, 'закрытие по кнопке или фону не подключено');
  assert.match(html, /if \(modal\.classList\.contains\('is-open'\) && event\.key === 'Escape'\)/, 'закрытие клавишей Escape не подключено');
  assert.match(html, /<video id="cinemaModalVideo" controls playsinline/, 'в полной версии не включены нативные контролы');
  assert.doesNotMatch(html, /class="media_controls"|data-video-toggle|data-video-mute/, 'кастомные контролы превью остались в разметке');
  assert.match(html, /!desktop\.matches\) return/, 'превью может запускаться автоматически на мобильном');
});

test('модальное видео имеет обработчики закрытия', () => {
  const modal = html.slice(html.indexOf('id="caseCinemaModal"'));
  assert.notEqual(modal, html, 'модальное окно просмотра кейса не найдено');
  assert.match(modal, /id="cinemaModalVideo"/, 'в модальном окне не найден video элемент');
  assert.match(modal, /data-cinema-close/, 'в модальном окне нет действия закрытия');
  assert.match(html, /addEventListener\(['"]keydown['"][\s\S]*?e\.key === ['"]Escape['"]/, 'закрытие окна клавишей Escape не подключено');
});
