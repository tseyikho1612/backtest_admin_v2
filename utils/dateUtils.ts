// 美國公共假期列表 (包含 2023 和 2024 年的主要假期)
const US_HOLIDAYS = [
  // 2023 年假期
  '2023-01-02', '2023-01-16', '2023-02-20', '2023-04-07', '2023-05-29',
  '2023-07-04', '2023-09-04', '2023-11-23', '2023-12-25',
  // 2024 年假期
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27',
  '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25'
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

export function isTradingDate(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // 週末不是交易日

  const dateString = date.toISOString().split('T')[0];
  return !US_HOLIDAYS.includes(dateString); // 不是美國假期
}