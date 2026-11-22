/** Plain calendar dates as `YYYY-MM-DD` strings, worked out in UTC so time zones never shift a day. */
export type Day = string;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(s: string): boolean {
	if (!DAY_RE.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !isNaN(d.getTime()) && toDay(d) === s;
}

function toDate(day: Day): Date {
	return new Date(`${day}T00:00:00Z`);
}

function toDay(d: Date): Day {
	return d.toISOString().slice(0, 10);
}

export function addDays(day: Day, n: number): Day {
	const d = toDate(day);
	d.setUTCDate(d.getUTCDate() + n);
	return toDay(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: Day): number {
	return toDate(day).getUTCDay();
}

/** The local calendar day of [ms] (a file time or `Date.now()`). */
export function localDay(ms: number): Day {
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight at the start of [day], in ms. */
export function startOfDayMs(day: Day): number {
	const [y, m, d] = day.split("-").map(Number);
	return new Date(y, m - 1, d).getTime();
}

/** ISO week label of [day], like `2026-W47`. */
export function isoWeek(day: Day): string {
	const d = toDate(day);
	const dow = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dow);
	const year = d.getUTCFullYear();
	const jan1 = Date.UTC(year, 0, 1);
	const week = Math.ceil(((d.getTime() - jan1) / 86400000 + 1) / 7);
	return `${year}-W${String(week).padStart(2, "0")}`;
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const shortDay = (day: Day) => SHORT[weekday(day)];
export const longDay = (day: Day) => LONG[weekday(day)];

/** "Sat 14 to Fri 20 November", or with both months when the week spans two. */
export function rangeLabel(from: Day, to: Day): string {
	const [, fm, fd] = from.split("-").map(Number);
	const [, tm, td] = to.split("-").map(Number);
	const start = fm === tm ? `${shortDay(from)} ${fd}` : `${shortDay(from)} ${fd} ${MONTHS[fm - 1]}`;
	return `${start} to ${shortDay(to)} ${td} ${MONTHS[tm - 1]}`;
}
