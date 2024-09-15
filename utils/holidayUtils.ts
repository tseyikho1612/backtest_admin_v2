import { getYear, setYear } from 'date-fns';

// You may need to install this package: npm install date-fns-holiday-us
import { getHolidays as getDateFnsUSHolidays } from 'date-fns-holiday-us';

export function getUSHolidays(year: number): Date[] {
  const holidaysObj = getDateFnsUSHolidays(year);
  const holidays: Date[] = Object.values(holidaysObj).map(holiday => holiday.date);
  
  // Add any missing holidays or custom holidays here
  // For example, Good Friday is not included in date-fns-holiday-us
  const goodFriday = new Date(year, 3, 7); // This is an approximation, you may need to calculate it precisely
  holidays.push(goodFriday);

  return holidays;
}