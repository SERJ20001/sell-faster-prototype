export const options = [
  { id: 'promotion', name: 'Продвижение', note: '7 дней', price: 56, group: 'services' },
  { id: 'xl', name: 'XL размер объявления', note: '7 дней', price: 88, group: 'services' },
  { id: 'highlight', name: 'Выделение цены', note: '7 дней', price: 100, group: 'services' },
  { id: 'sale', name: 'Хватамба · Скидка 20%', note: 'до 12 апреля', group: 'discounts' },
  { id: 'delivery', name: 'Скидка на доставку', note: '· 100 ₽', group: 'discounts' },
  { id: 'quantity', name: 'Скидка за количество', note: '10% от 3 любых товаров', group: 'discounts', settingsOnly: true }
];

export const speeds = [
  { id: 'ordinary', name: 'Обычно', days: null, options: [] },
  { id: 'steady', name: 'Бодро', days: 21, options: ['promotion', 'delivery'] },
  { id: 'fast', name: 'Быстро', days: 14, options: ['promotion', 'sale', 'delivery'] },
  { id: 'super', name: 'Super', days: 9, options: ['promotion', 'xl', 'sale', 'delivery'] }
];

export const badgeLabels = { sale: 'Распродажа', delivery: 'Скидка на доставку', quantity: 'Скидка за количество' };

export function initialState() {
  return { selected: selectSpeed(1), autopublish: false, expanded: false };
}

export function speedIndex(selected) {
  const count = options.filter(option => !option.settingsOnly && selected.has(option.id)).length;
  return count === 0 ? 0 : Math.min(3, Math.max(1, count - 1));
}

export function selectSpeed(index) {
  return new Set(speeds[index].options);
}

export function priceFor(selected) {
  return { original: 6000, current: selected.has('sale') ? 4800 : 6000, discounted: selected.has('sale') };
}

export function paymentFor(selected) {
  const services = options.filter(option => option.price && selected.has(option.id));
  const labels = { promotion: 'продвижение', xl: 'XL размер', highlight: 'выделение цены' };
  const names = services.map(option => labels[option.id]);
  const description = names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names.at(-1)}` : names[0] ?? '';
  return { amount: services.reduce((total, option) => total + option.price, 0), description };
}
