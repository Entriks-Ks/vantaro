export const STATUS_META = {
  paid: { tone: 'ok', color: '#37cdc0' },
  pending: { tone: 'warn', color: '#f0c36a' },
  failed: { tone: 'danger', color: '#ff755a' },
  refunded: { tone: 'muted', color: '#8ea0b8' },
};
export const STATUS_IDS = Object.keys(STATUS_META);
export const TYPE_COLORS = ['#37cdc0', '#7eb6ff', '#f0c36a', '#ff8b73', '#b89cff', '#9ad67a', '#56d3c4'];

export function amountOf(payment) {
  return Number(payment.netCents || payment.grossCents) || 0;
}

export function timeOf(payment) {
  const time = new Date(payment.paidAt || payment.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfMonth(time) {
  const date = new Date(startOfDay(time));
  date.setDate(1);
  return date.getTime();
}

export function addMonths(time, count) {
  const date = new Date(time);
  date.setMonth(date.getMonth() + count);
  return date.getTime();
}

export function smoothPath(points) {
  if (!points.length) return '';
  return points.reduce((path, [x, y], index) => {
    if (index === 0) return `M ${x} ${y}`;
    const [px, py] = points[index - 1];
    const mid = (x - px) / 2;
    return `${path} C ${px + mid} ${py}, ${x - mid} ${y}, ${x} ${y}`;
  }, '');
}

export function niceMax(value) {
  if (value <= 0) return 10_000;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}
