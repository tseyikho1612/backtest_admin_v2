// 美國公共假期列表 (簡化版,實際使用時應該包含更多假期)
const US_HOLIDAYS = [
  '2023-01-02', '2023-01-16', '2023-02-20', '2023-04-07', '2023-05-29',
  '2023-07-04', '2023-09-04', '2023-11-23', '2023-12-25'
];

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(date: Date): boolean {
  const dateString = date.toISOString().split('T')[0];
  return US_HOLIDAYS.includes(dateString);
}

export function getPreviousTradingDate(date: Date = new Date()): Date {
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);

  while (isWeekend(previousDate) || isHoliday(previousDate)) {
    previousDate.setDate(previousDate.getDate() - 1);
  }

  return previousDate;
}