import { options, speeds, badgeLabels, initialState, speedIndex, selectSpeed, priceFor, paymentFor } from './model.mjs';

const state = initialState();
const ids = ['app', 'page', 'loading', 'loading-label', 'loading-progress', 'retry', 'screen-scroll', 'topbar', 'compact-preview', 'product-scene', 'title-art', 'speed-title', 'speed-control', 'speed-range', 'days-pill', 'offer-section', 'payment-summary', 'main-cta', 'bottom-bar', 'intro-footer', 'overlay', 'sheet', 'sheet-title', 'sheet-body', 'sheet-footer', 'toast'];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const moneyFormatter = new Intl.NumberFormat('ru-RU');
const warmedImages = new Map();
const completedResources = new Set();
let activeSheet = null;
let draft = null;
let returnFocus = null;
let sheetGeneration = 0;
let toastTimer;
let shineTimer;
let booting = false;
let previousPrice = null;

function money(value) {
  return moneyFormatter.format(value) + ' ₽';
}

function badgeMarkup(kind, selected, label = badgeLabels[kind]) {
  const active = selected.has(kind);
  const accessibleLabel = badgeLabels[kind] + (active ? ' подключена' : ' не подключена');
  if (!active) {
    const widths = { sale: 84.7867, delivery: 125.785, quantity: 137.783 };
    return '<span class="badge is-inactive" data-kind="' + kind + '" aria-label="' + accessibleLabel + '"><img class="badge-outline" src="assets/badge-' + kind + '-off.svg" width="' + widths[kind] + '" height="21" alt=""><span class="badge-label" aria-hidden="true">' + label + '</span></span>';
  }
  const color = kind === 'sale' ? 'sale' : 'neutral';
  return '<span class="badge is-active" data-kind="' + kind + '" aria-label="' + accessibleLabel + '"><img class="badge-corner" src="assets/badge-' + color + '-left.svg" width="11" height="21" alt=""><span class="badge-label" aria-hidden="true">' + label + '</span><img class="badge-corner" src="assets/badge-' + color + '-right.svg" width="11" height="21" alt=""></span>';
}

function badgesMarkup(selected, compact = false) {
  const kinds = Object.keys(badgeLabels).filter(kind => !compact || selected.has(kind));
  return kinds.map((kind, index) => badgeMarkup(kind, selected, compact && index === 2 ? '+1' : badgeLabels[kind])).join('');
}

function priceMarkup(selected) {
  const price = priceFor(selected);
  return '<strong class="product-price">' + money(price.current) + '</strong>' + (price.discounted ? '<span class="product-old-price" aria-label="Старая цена ' + money(price.original) + '">' + money(price.original) + '<img src="assets/product-strike.svg" width="60.3293" height="13.2265" alt=""></span>' : '');
}

function optionMarkup(option, selected, scope = 'page') {
  return '<label class="option-row ' + (option.group === 'discounts' ? 'discount-option' : '') + '"><span class="option-icon" aria-hidden="true"><img class="option-icon-on" src="assets/' + option.id + '.png" width="20" height="20" alt=""></span><span class="option-copy"><span>' + option.name + '</span><span class="option-note">' + option.note + '</span></span>' + (option.price ? '<span class="option-price">' + money(option.price) + '</span>' : '') + '<input type="checkbox" data-option="' + option.id + '" data-scope="' + scope + '" aria-label="' + option.name + '" ' + (selected.has(option.id) ? 'checked' : '') + '><span class="check-art" aria-hidden="true"><img class="check-off" src="assets/check-off.svg" width="16" height="16" alt=""><img class="check-on" src="assets/check-on.svg" width="16" height="16" alt=""></span></label>';
}

function renderOptions() {
  for (const group of ['services', 'discounts']) {
    document.getElementById(group).innerHTML = options.filter(option => option.group === group && !option.settingsOnly).map(option => optionMarkup(option, state.selected)).join('');
  }
}

function shimmer() {
  clearTimeout(shineTimer);
  ui['title-art'].classList.remove('shine');
  if (reducedMotion.matches) return;
  requestAnimationFrame(() => requestAnimationFrame(() => ui['title-art'].classList.add('shine')));
}

function render() {
  const index = speedIndex(state.selected);
  const speed = speeds[index];
  const payment = paymentFor(state.selected);
  const price = priceFor(state.selected);
  ui.app.dataset.speed = speed.id;
  ui.app.style.setProperty('--progress', (index / 3 * 100) + '%');
  ui['speed-range'].value = index;
  ui['speed-range'].setAttribute('aria-valuetext', speed.name + (speed.days ? ', до ' + speed.days + (speed.days === 21 ? ' дня' : ' дней') : ''));
  ui['days-pill'].hidden = speed.days === null;
  ui['days-pill'].textContent = speed.days ? 'до ' + speed.days + (speed.days === 21 ? ' дня*' : ' дней*') : '';
  document.querySelectorAll('.speed-dots i').forEach((dot, position) => dot.classList.toggle('is-active', position <= index));
  document.querySelectorAll('button[data-speed]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.speed) === index));
  document.querySelectorAll('[data-scope="page"]').forEach(input => { input.checked = state.selected.has(input.dataset.option); });
  document.querySelectorAll('[data-product-price]').forEach(element => {
    element.innerHTML = priceMarkup(state.selected);
    if (previousPrice !== null && previousPrice !== price.current && !reducedMotion.matches) element.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 250 });
  });
  document.querySelectorAll('[data-badges]').forEach(element => { element.innerHTML = badgesMarkup(state.selected, element.dataset.badges === 'compact'); });
  ui['payment-summary'].textContent = payment.amount ? money(payment.amount) + ' за ' + payment.description : 'Платные услуги не выбраны';
  ui['main-cta'].textContent = payment.amount ? 'Оплатить и подключить' : 'Подключить скидки';
  if (!payment.amount && !['sale', 'delivery', 'quantity'].some(id => state.selected.has(id))) ui['main-cta'].textContent = 'Готово';
  ui['bottom-bar'].hidden = !state.expanded;
  ui['intro-footer'].hidden = state.expanded;
  const titlePath = 'assets/title-' + (state.expanded ? 'accelerate' : 'intro') + '.png';
  if (ui['speed-title'].getAttribute('src') !== titlePath) {
    ui['speed-title'].src = titlePath;
    ui['speed-title'].alt = state.expanded ? 'Ускорить продажу' : 'Продать быстрее';
    shimmer();
  }
  previousPrice = price.current;
}

function expand() {
  if (state.expanded) return;
  state.expanded = true;
  render();
}

function chooseSpeed(index) {
  state.selected = selectSpeed(index);
  expand();
  render();
}

function updateHeader() {
  const compact = ui['product-scene'].getBoundingClientRect().bottom <= ui['screen-scroll'].getBoundingClientRect().top + 10;
  ui.topbar.classList.toggle('is-compact', compact);
  ui['compact-preview'].hidden = !compact;
}

function showToast(text) {
  clearTimeout(toastTimer);
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2800);
}

function primary(label, action) {
  return '<button class="primary-button" data-action="' + action + '">' + label + '</button>';
}

function showSheet(type, title, content, footer = '') {
  sheetGeneration += 1;
  activeSheet = type;
  returnFocus = document.activeElement;
  ui['sheet-title'].textContent = title;
  ui['sheet-body'].innerHTML = content;
  ui['sheet-footer'].innerHTML = footer;
  ui.overlay.hidden = false;
  ui.page.inert = true;
  ui['sheet-body'].scrollTop = 0;
  ui.sheet.focus({ preventScroll: true });
}

async function closeSheet() {
  if (ui.overlay.hidden || activeSheet === null) return;
  const generation = ++sheetGeneration;
  activeSheet = null;
  if (!reducedMotion.matches) {
    const motion = ui.sheet.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)' });
    await motion.finished.catch(() => {});
  }
  if (generation !== sheetGeneration) return;
  ui.overlay.hidden = true;
  ui.page.inert = false;
  draft = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function openSettings(group) {
  expand();
  draft = new Set(state.selected);
  const content = options.filter(option => option.group === group).map(option => '<div class="sheet-service">' + optionMarkup(option, draft, 'draft') + '</div>').join('');
  showSheet(group, group === 'services' ? 'Специальные возможности' : 'Скидки и акции', content, primary('Сохранить', 'apply-draft'));
}

function openPreview() {
  showSheet('preview', 'Предпросмотр объявления', '<img class="preview-photo" src="assets/product-preview.png" width="432" height="432" alt="Серебристый жилет Prada"><div class="preview-details"><div class="product-prices" data-product-price>' + priceMarkup(state.selected) + '</div><h3 class="preview-name">Жилет архивный Prada 2010</h3><div class="badges" data-badges="full">' + badgesMarkup(state.selected) + '</div><p class="preview-disclaimer">Вид объявления может отличаться. Бейджи показывают подключённые скидки.</p></div>', primary('Готово', 'close'));
}

function openShare() {
  showSheet('share', 'Поделиться прототипом', '<p>Скопируйте ссылку, чтобы показать этот сценарий.</p><input class="link-box" id="share-link" type="text" readonly aria-label="Ссылка на прототип">', primary('Скопировать ссылку', 'copy-link'));
  document.getElementById('share-link').value = location.href.split('#')[0];
}

const actions = {
  services: () => openSettings('services'),
  discounts: () => openSettings('discounts'),
  preview: openPreview,
  share: openShare,
  leave: openPreview,
  confirm: () => showToast('Готово'),
  close: closeSheet,
  start: () => {
    expand();
    const target = document.querySelector('.speed-section');
    ui['screen-scroll'].scrollTo({ top: ui['screen-scroll'].scrollTop + target.getBoundingClientRect().top - ui['screen-scroll'].getBoundingClientRect().top - 16, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  },
  'scroll-top': () => ui['screen-scroll'].scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' }),
  'apply-draft': async () => {
    state.selected = new Set(draft);
    render();
    await closeSheet();
  },
  'copy-link': async () => {
    const input = document.getElementById('share-link');
    try {
      await navigator.clipboard.writeText(input.value);
      showToast('Ссылка скопирована');
    } catch {
      input.focus();
      input.select();
      showToast('Выделили ссылку — её можно скопировать');
    }
  }
};

document.addEventListener('click', event => {
  const speedButton = event.target.closest('button[data-speed]');
  if (speedButton) chooseSpeed(Number(speedButton.dataset.speed));
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) actions[button.dataset.action]?.();
});

ui['speed-range'].addEventListener('input', event => chooseSpeed(Number(event.target.value)));

document.addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.option) {
    const selected = input.dataset.scope === 'draft' ? draft : state.selected;
    if (!selected) return;
    if (input.checked) selected.add(input.dataset.option);
    else selected.delete(input.dataset.option);
    if (input.dataset.scope === 'page') {
      expand();
      render();
    }
  }
  if (input.id === 'autopublish') state.autopublish = input.checked;
});

ui['screen-scroll'].addEventListener('scroll', () => {
  if (ui['screen-scroll'].scrollTop > 24) expand();
  updateHeader();
}, { passive: true });

document.getElementById('close-sheet').addEventListener('click', closeSheet);
document.getElementById('scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', event => {
  if (ui.overlay.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSheet();
  }
  if (event.key === 'Tab') {
    const focusable = [...ui.sheet.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ui.sheet)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});

document.getElementById('restart').addEventListener('click', async () => {
  await closeSheet();
  Object.assign(state, initialState());
  document.getElementById('autopublish').checked = false;
  ui['screen-scroll'].scrollTo({ top: 0, behavior: 'instant' });
  updateHeader();
  render();
});

function loadImage(path) {
  if (warmedImages.has(path)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('Timeout: ' + path)), 15000);
    image.onload = async () => {
      try {
        await image.decode();
        warmedImages.set(path, image);
        clearTimeout(timer);
        resolve();
      } catch (error) { clearTimeout(timer); reject(error); }
    };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Image unavailable: ' + path)); };
    image.src = path;
  });
}

async function boot() {
  if (booting) return;
  booting = true;
  ui.retry.hidden = true;
  ui['loading-label'].textContent = 'Собираем всё для быстрой продажи';
  const extraImages = ['title-intro.png', 'title-accelerate.png', 'product-preview.png', 'product-strike.svg', 'check-on.svg', 'check-off.svg', ...Object.keys(badgeLabels).map(kind => 'badge-' + kind + '-off.svg'), ...['sale', 'neutral'].flatMap(color => ['badge-' + color + '-left.svg', 'badge-' + color + '-right.svg'])];
  const imagePaths = [...new Set([...document.querySelectorAll('img')].map(image => image.getAttribute('src')).concat(options.map(option => 'assets/' + option.id + '.png'), extraImages.map(name => 'assets/' + name)))];
  const tasks = imagePaths.map(path => ({ key: path, run: () => loadImage(path) }));
  tasks.push({ key: 'fonts', run: async () => {
    const fonts = await Promise.all([document.fonts.load('400 13px UserAvito'), document.fonts.load('700 32px UserAvito')]);
    if (fonts.some(font => font.length === 0)) throw new Error('Font unavailable');
    await document.fonts.ready;
  } });
  ui['loading-progress'].max = tasks.length;
  try {
    await Promise.all(tasks.map(async task => {
      if (!completedResources.has(task.key)) await task.run();
      completedResources.add(task.key);
      ui['loading-progress'].value = completedResources.size;
    }));
    renderOptions();
    render();
    await new Promise(requestAnimationFrame);
    ui.loading.hidden = true;
    ui.page.inert = false;
    ui.page.setAttribute('aria-busy', 'false');
    ui.app.classList.add('is-ready');
    shineTimer = setTimeout(shimmer, 1100);
  } catch {
    ui['loading-label'].textContent = 'Не получилось загрузить все детали. Проверьте соединение и попробуйте ещё раз.';
    ui.retry.hidden = false;
  } finally { booting = false; }
}

ui.retry.addEventListener('click', boot);
boot();
