import { isWeekend as dateFnsIsWeekend, isDate, getYear, setYear, getDay } from 'date-fns';
import { toZonedTime} from 'date-fns-tz';

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

function isDateInDST(date: Date): boolean {
  const year = date.getFullYear();
  
  // Find the second Sunday in March
  let marchSecondSunday = new Date(year, 2, 1);
  while (getDay(marchSecondSunday) !== 0) {
    marchSecondSunday.setDate(marchSecondSunday.getDate() + 1);
  }
  marchSecondSunday.setDate(marchSecondSunday.getDate() + 7);
  
  // Find the first Sunday in November
  let novemberFirstSunday = new Date(year, 10, 1);
  while (getDay(novemberFirstSunday) !== 0) {
    novemberFirstSunday.setDate(novemberFirstSunday.getDate() + 1);
  }
  
  // DST starts at 2:00 AM on the second Sunday in March
  const dstStart = new Date(year, 2, marchSecondSunday.getDate(), 2, 0, 0);
  // DST ends at 2:00 AM on the first Sunday in November
  const dstEnd = new Date(year, 10, novemberFirstSunday.getDate(), 2, 0, 0);
  
  return date >= dstStart && date < dstEnd;
}

export function getTradingHours(date: Date): { start: Date; end: Date; isDST: boolean } {
  const nyDate = toZonedTime(date, 'America/New_York');
  const isDST = isDateInDST(nyDate);

  const hkDate = toZonedTime(date, HK_TIMEZONE);
  const year = hkDate.getFullYear();
  const month = hkDate.getMonth();
  const day = hkDate.getDate();

  let startHour = isDST ? 21 : 22;
  let endHour = isDST ? 4 : 5;

  const start = new Date(Date.UTC(year, month, day, startHour - 8, 30)); // Convert HKT to UTC
  const end = new Date(Date.UTC(year, month, day + 1, endHour - 8, 0)); // Convert HKT to UTC

  return { start, end, isDST };
}

export function isWithinTradingHours(date: Date): boolean {
  const { start, end } = getTradingHours(date);
  return date >= start && date <= end;
}