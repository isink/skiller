export type RadarCalendarDay = {
  key: string;
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  isPadding: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
};

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const pad = (value: number) => String(value).padStart(2, "0");

function monthParts(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && month >= 1 && month <= 12 ? { year, month } : null;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** A date-only key, matching the database's discovered_at date column. */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = monthParts(value.slice(0, 7));
  const day = Number(value.slice(8));
  return !!parts && day >= 1 && day <= daysInMonth(parts.year, parts.month);
}

/** Do not use toISOString: its UTC date can differ from the user's local day. */
export function getLocalDateKey(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1 || date.getFullYear() > 9999) return "";
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDate(year: number, month: number, day: number): Date {
  // Noon keeps ordinary daylight-saving transitions away from calendar arithmetic.
  // setFullYear also avoids the Date constructor's special treatment of years 0–99.
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, month - 1, day);
  return date;
}

function presentDay(date: Date, selectedDate: string, today: string): RadarCalendarDay {
  const key = getLocalDateKey(date);
  return {
    key,
    date: key,
    dayLabel: String(date.getDate()),
    weekdayLabel: key === today ? "今天" : WEEKDAYS[date.getDay()],
    isPadding: false,
    isToday: key === today,
    isSelected: key === selectedDate,
    isDisabled: key > today,
  };
}

/** Seven recent days, oldest first, ending at the supplied local today. */
export function buildRecentDays(today: string, selectedDate: string): RadarCalendarDay[] {
  if (!isDateKey(today)) return [];
  const parts = monthParts(today.slice(0, 7))!;
  const date = localDate(parts.year, parts.month, Number(today.slice(8)));
  date.setDate(date.getDate() - 6);
  const days: RadarCalendarDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    days.push(presentDay(date, selectedDate, today));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/** Monday-first month grid. Padding cells and future dates cannot be selected. */
export function buildMonthDays(month: string, selectedDate: string, today: string): RadarCalendarDay[] {
  const parts = monthParts(month);
  if (!parts || !isDateKey(today)) return [];
  const firstDate = localDate(parts.year, parts.month, 1);
  const padding = (firstDate.getDay() + 6) % 7;
  const monthDays = daysInMonth(parts.year, parts.month);
  const cellCount = Math.ceil((padding + monthDays) / 7) * 7;
  const days: RadarCalendarDay[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const day = index - padding + 1;
    if (day < 1 || day > monthDays) {
      days.push({
        key: `${month}-padding-${index}`,
        date: "",
        dayLabel: "",
        weekdayLabel: "",
        isPadding: true,
        isToday: false,
        isSelected: false,
        isDisabled: true,
      });
    } else {
      days.push(presentDay(localDate(parts.year, parts.month, day), selectedDate, today));
    }
  }
  return days;
}

export function shiftMonth(month: string, delta: number): string {
  const parts = monthParts(month);
  if (!parts || !Number.isFinite(delta)) return "";
  const next = (parts.year - 1) * 12 + parts.month - 1 + Math.trunc(delta);
  if (next < 0 || next >= 9999 * 12) return month;
  return `${String(Math.floor(next / 12) + 1).padStart(4, "0")}-${pad((next % 12) + 1)}`;
}
