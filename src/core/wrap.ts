import { Day, localDay, startOfDayMs } from "./dates";
import type { Extras } from "./sources";
import { doneIn, DoneTask } from "./tasks";
import { inWeek, Week } from "./week";

/** A note as the wrap sees it: no Obsidian types, so it can be tested on its own. */
export interface NoteInfo {
	path: string;
	ctime: number;
	mtime: number;
}

export interface WrapOptions {
	/** Folders (vault paths) left out of every count, such as templates and the wrap folder itself. */
	ignore: string[];
	/** Count ticks with no ✅ date on the note's edit day. Off by default: it can over-count. */
	countUndated: boolean;
	/** Only count ticked lines containing this, like the Tasks plugin's global filter (`#task`). Empty = all. */
	taskFilter: string;
}

export const DEFAULT_WRAP_OPTIONS: WrapOptions = { ignore: [], countUndated: false, taskFilter: "" };

export interface DayCount {
	day: Day;
	tasks: number;
}

export interface Wrap {
	week: Week;
	tasks: DoneTask[];
	perDay: DayCount[];
	/** The day with the most ticks, when one day clearly stands out. */
	best: DayCount | null;
	notesEdited: number;
	notesCreated: number;
	/** Flight Deck counts, filled in by `gatherExtras` when its notes are there. */
	extras: Extras;
	/** How the week is worded: a lighter week leads with a kind line and the small stuff. */
	tone: Tone;
}

export interface Tone {
	quiet: boolean;
	/** The kind line shown on a lighter week, when that's switched on. */
	kind: string | null;
	/** Show the best-day line. */
	highlight: boolean;
}

export const PLAIN_TONE: Tone = { quiet: false, kind: null, highlight: true };

export function ignored(path: string, ignore: string[]): boolean {
	if (path.split("/").some((p) => p.startsWith("."))) return true;
	return ignore.some((f) => {
		const dir = f.replace(/\/+$/, "");
		return dir !== "" && (path === dir || path.startsWith(dir + "/"));
	});
}

/** Notes worth reading for [week]: changed on or after its first day (ticking a task edits the note). */
export function candidates(notes: NoteInfo[], week: Week, opts: WrapOptions): NoteInfo[] {
	const since = startOfDayMs(week.from);
	return notes.filter((n) => n.mtime >= since && !ignored(n.path, opts.ignore));
}

/**
 * Builds the wrap from the [notes] list and a [read] of each candidate's text.
 * Only notes changed since the week began are read.
 */
export async function buildWrap(
	notes: NoteInfo[],
	read: (path: string) => Promise<string>,
	week: Week,
	opts: WrapOptions = DEFAULT_WRAP_OPTIONS,
): Promise<Wrap> {
	const tasks: DoneTask[] = [];
	for (const n of candidates(notes, week, opts)) {
		let text: string;
		try {
			text = await read(n.path);
		} catch {
			continue;
		}
		const fallback = opts.countUndated ? localDay(n.mtime) : undefined;
		tasks.push(...doneIn(text.split("\n"), n.path, week.from, week.to, { fallback, filter: opts.taskFilter }));
	}
	tasks.sort((a, b) => (a.done === b.done ? a.text.localeCompare(b.text) : a.done < b.done ? -1 : 1));

	let notesEdited = 0;
	let notesCreated = 0;
	for (const n of notes) {
		if (ignored(n.path, opts.ignore)) continue;
		const created = inWeek(week, localDay(n.ctime));
		if (created) notesCreated++;
		else if (inWeek(week, localDay(n.mtime))) notesEdited++;
	}

	const perDay = week.days.map((day) => ({ day, tasks: tasks.filter((t) => t.done === day).length }));
	const top = perDay.reduce<DayCount | null>((b, d) => (d.tasks > (b?.tasks ?? 0) ? d : b), null);
	// A best day has to stand out: at least 2 ticks and no other day level with it.
	const best = top && top.tasks >= 2 && perDay.filter((d) => d.tasks === top.tasks).length === 1 ? top : null;
	return { week, tasks, perDay, best, notesEdited, notesCreated, extras: {}, tone: { ...PLAIN_TONE } };
}
