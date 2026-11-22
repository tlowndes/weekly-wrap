import { longDay, rangeLabel, shortDay } from "./dates";
import { Wrap } from "./wrap";

export interface Stat {
	value: string;
	label: string;
}

export interface DayCell {
	day: string;
	/** "Mon". */
	name: string;
	/** "3 tasks". */
	detail: string;
	/** 0 (nothing) to 4 (the best day): how strong its bar is drawn. */
	level: number;
	best: boolean;
}

export interface Cards {
	/** "WEEK 47 · 14–20 NOV" style kicker, written plainly. */
	kicker: string;
	headline: string;
	range: string;
	stats: Stat[];
	days: DayCell[];
	/** Up to [top] task names for "Proud of", newest first, and how many more there are. */
	proud: string[];
	more: number;
	highlight: { title: string; body: string } | null;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** Everything the card view shows, worked out from a wrap so the view only draws it. */
export function cards(w: Wrap, top = 3): Cards {
	const n = w.tasks.length;
	const touched = w.notesEdited + w.notesCreated;
	const headline =
		n > 0 ? `You got ${plural(n, "thing")} done` : touched > 0 ? `You touched ${plural(touched, "note")}` : "A quiet one";

	const stats: Stat[] = [
		{ value: String(n), label: n === 1 ? "task ticked" : "tasks ticked" },
		{ value: String(touched), label: touched === 1 ? "note touched" : "notes touched" },
		{ value: String(w.notesCreated), label: w.notesCreated === 1 ? "new note" : "new notes" },
	];

	const max = Math.max(0, ...w.perDay.map((d) => d.tasks));
	const bestShown = w.best !== null && n > 1;
	const days = w.perDay.map((d) => ({
		day: d.day,
		name: shortDay(d.day),
		detail: plural(d.tasks, "task"),
		level: max === 0 || d.tasks === 0 ? 0 : Math.max(1, Math.round((d.tasks / max) * 4)),
		best: bestShown && d.day === w.best!.day,
	}));

	const newest = [...w.tasks].reverse();
	const proud = newest.slice(0, top).map((t) => t.text);

	const highlight = bestShown
		? {
				title: `${longDay(w.best!.day)} was your big one`,
				body: `${plural(w.best!.tasks, "task")} ticked, the most of any day this week.`,
			}
		: null;

	return {
		kicker: `Week ${Number(w.week.label.slice(6))}`,
		headline,
		range: rangeLabel(w.week.from, w.week.to),
		stats,
		days,
		proud,
		more: Math.max(0, n - proud.length),
		highlight,
	};
}
