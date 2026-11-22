import { addDays, Day, startOfDayMs } from "./dates";
import { KIND_LINES } from "./strings";
import { doneIn } from "./tasks";
import { ignored, NoteInfo, WrapOptions } from "./wrap";
import { Week } from "./week";

/** How many weeks back the usual is worked out over. */
export const HISTORY_WEEKS = 4;
/** Below this usual, a week is never called lighter: too little to compare. */
export const MIN_USUAL = 4;

/** Ticks in each of the [HISTORY_WEEKS] weeks before [week], oldest first. Reads only notes changed since then. */
export async function history(
	notes: NoteInfo[],
	read: (path: string) => Promise<string>,
	week: Week,
	opts: WrapOptions,
): Promise<number[]> {
	const from = addDays(week.from, -7 * HISTORY_WEEKS);
	const to = addDays(week.from, -1);
	const since = startOfDayMs(from);
	const counts = new Array<number>(HISTORY_WEEKS).fill(0);
	for (const n of notes) {
		if (n.mtime < since || ignored(n.path, opts.ignore)) continue;
		let text: string;
		try {
			text = await read(n.path);
		} catch {
			continue;
		}
		for (const t of doneIn(text.split("\n"), n.path, from, to, { filter: opts.taskFilter })) {
			counts[weekIndex(from, t.done)]++;
		}
	}
	return counts;
}

function weekIndex(from: Day, day: Day): number {
	const days = Math.round((startOfDayMs(day) - startOfDayMs(from)) / 86400000);
	return Math.min(HISTORY_WEEKS - 1, Math.max(0, Math.floor(days / 7)));
}

/** A lighter week: under half the usual, and the usual is big enough to mean something. */
export function isQuiet(ticks: number, past: number[]): boolean {
	if (!past.length) return false;
	const usual = past.reduce((a, b) => a + b, 0) / past.length;
	return usual >= MIN_USUAL && ticks < usual / 2;
}

/** One kind line for the week, the same one each time that week is shown. */
export function kindLine(week: Week, lines: string[] = KIND_LINES): string {
	const list = lines.map((l) => l.trim()).filter(Boolean);
	const pool = list.length ? list : KIND_LINES;
	return pool[Number(week.label.slice(6)) % pool.length];
}
