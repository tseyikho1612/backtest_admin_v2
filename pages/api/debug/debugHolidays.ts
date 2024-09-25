import { NextApiRequest, NextApiResponse } from 'next';
import { getUSHolidays } from '../../../utils/holidayUtils';
import { isHoliday } from '../../../utils/dateUtils';

// http://localhost:3000/api/debugHolidays 
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const year = 2023;
  const holidays = getUSHolidays(year);

  const formattedHolidays = holidays.map(date => {
    return {
      date: date.toISOString().split('T')[0],
      isHoliday: isHoliday(date)
    };
  });

  res.status(200).json({
    year,
    holidays: formattedHolidays
  });
}