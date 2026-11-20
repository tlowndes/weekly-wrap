import { Day } from "./dates";
import { previousWeek, weekFor, Week } from "./week";

export interface NudgeState {
	/** Label of the last week whose wrap was opened (`2026-W47`). */
	lastOpened: string;
	/** Label of the last week a notice was shown for, so it shows once per week. */
	lastNudged: string;
}

export const EMPTY_NUDGE: NudgeState = { lastOpened: "", lastNudged: "" };

/**
 * The latest week whose wrap is due at [today] and [hour] (0–23): the week ending on the most recent wrap day,
 * once [fromHour] on that day has passed. Before then on the wrap day, it's the week before.
 */
export function dueWeek(today: Day, hour: number, wrapDay: number, fromHour: number): Week {
	const w = weekFor(today, wrapDay);
	return today === w.to && hour < fromHour ? previousWeek(w) : w;
}

export interface NudgeCheck {
	week: Week;
	/** Show the "Your week's wrapped" notice now. */
	notice: boolean;
	/** Keep a dot on the ribbon icon: the due wrap hasn't been opened. */
	dot: boolean;
}

/**
 * What to show for the due week. The notice shows once per week; the dot stays until that week's wrap is opened.
 * A missed wrap day simply nudges on the next check, until the following wrap day takes over.
 * [installed] is the day the plugin first ran: weeks that ended before it are never nudged.
 */
export function check(
	state: NudgeState,
	today: Day,
	hour: number,
	opts: { wrapDay: number; fromHour: number; enabled: boolean; installed: Day },
): NudgeCheck {
	const week = dueWeek(today, hour, opts.wrapDay, opts.fromHour);
	const fresh = week.to >= opts.installed;
	const unopened = fresh && state.lastOpened !== week.label;
	return {
		week,
		notice: opts.enabled && unopened && state.lastNudged !== week.label,
		dot: opts.enabled && unopened,
	};
}
