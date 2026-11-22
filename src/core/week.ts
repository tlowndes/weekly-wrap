import { addDays, Day, isoWeek, weekday } from "./dates";

/** The 7 days a wrap covers: [from] to [to] inclusive, [to] being the wrap day. */
export interface Week {
	from: Day;
	to: Day;
	/** ISO week of [to], like `2026-W47`: the saved note's name. */
	label: string;
	days: Day[];
}

/**
 * The week ending on the most recent [wrapDay] (0 = Sunday … 6 = Saturday, Friday = 5) on or before [today].
 * On a Friday that's today; on a Tuesday it's last Friday, so a mid-week peek shows the last finished week.
 * Pass `current` to get the week ending on the next wrap day instead (this week so far).
 */
export function weekFor(today: Day, wrapDay = 5, current = false): Week {
	const back = (weekday(today) - wrapDay + 7) % 7;
	let to = addDays(today, -back);
	if (current && back !== 0) to = addDays(to, 7);
	return weekEnding(to);
}

export function weekEnding(to: Day): Week {
	const from = addDays(to, -6);
	const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
	return { from, to, label: isoWeek(to), days };
}

export const previousWeek = (w: Week) => weekEnding(addDays(w.to, -7));
export const nextWeek = (w: Week) => weekEnding(addDays(w.to, 7));

export const inWeek = (w: Week, day: Day) => day >= w.from && day <= w.to;
