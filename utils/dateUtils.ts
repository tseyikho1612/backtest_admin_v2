import { isWeekend as dateFnsIsWeekend, isDate } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getYear, setYear } from 'date-fns';

// Import the getUSHolidays function (we'll create this in a moment)
import { getUSHolidays } from './holidayUtils';

const HK_TIMEZONE = 'Asia/Hong_Kong';

export function isWeekend(date: Date): boolean {
  return dateFnsIsWeekend(toZonedTime(date, HK_TIMEZONE));
}

export function isHoliday(date: Date): boolean {
  const hkDate = toZonedTime(date, HK_TIMEZONE);
  const year = getYear(hkDate);
  const holidays = getUSHolidays(year);
  
  return holidays.some(holiday => 
    holiday.getFullYear() === hkDate.getFullYear() &&
    holiday.getMonth() === hkDate.getMonth() &&
    holiday.getDate() === hkDate.getDate()
  );
}

export function getPreviousTradingDate(date: Date = new Date()): Date {
  let previousDate = toZonedTime(date, HK_TIMEZONE);
  previousDate.setDate(previousDate.getDate() - 1);

  while (isWeekend(previousDate) || isHoliday(previousDate)) {
    previousDate.setDate(previousDate.getDate() - 1);
  }

  return previousDate;
}

export function isTradingDate(date: Date): boolean {
  const hkDate = toZonedTime(date, HK_TIMEZONE);
  return !isWeekend(hkDate) && !isHoliday(hkDate);
}