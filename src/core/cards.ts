import { longDay, rangeLabel, shortDay } from "./dates";
import { Wrap } from "./wrap";
import { alsoCounted, careLines, hours, plural } from "./words";
import { TEXT } from "./strings";

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
	/** "Looked after yourself" lines from Flight Deck's habits, water and Did I?. Empty = no card. */
	care: string[];
	/** A lighter week: the kind line goes on top and the small stuff comes before the task list. */
	quiet: boolean;
	kind: string | null;
	/** On a lighter week, the small stuff in words (focus, care, captures, notes made). */
	smallStuff: string[];
	highlight: { title: string; body: string } | null;
}


/** Everything the card view shows, worked out from a wrap so the view only draws it. */
export function cards(w: Wrap, top = 3): Cards {
	const n = w.tasks.length;
	const touched = w.notesEdited + w.notesCreated;
	const quiet = w.tone.quiet;
	const headline = quiet
		? TEXT.lighterWeek
		: n > 0
			? `You got ${plural(n, "thing")} done`
			: touched > 0
				? `You touched ${plural(touched, "note")}`
				: TEXT.quietHeadline;

	const x = w.extras;
	const stats: Stat[] = [{ value: String(n), label: n === 1 ? "task ticked" : "tasks ticked" }];
	if (x.focus) stats.push({ value: hours(x.focus.minutes), label: "of focus" });
	stats.push({ value: String(touched), label: touched === 1 ? "note touched" : "notes touched" });
	if (x.applications) stats.push({ value: String(x.applications), label: x.applications === 1 ? "application" : "applications" });
	else if (stats.length < 4) stats.push({ value: String(w.notesCreated), label: w.notesCreated === 1 ? "new note" : "new notes" });

	const max = Math.max(0, ...w.perDay.map((d) => d.tasks));
	const bestShown = w.tone.highlight && w.best !== null && n > 1;
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
				body:
					`${plural(w.best!.tasks, "task")} ticked, the most of any day this week.` +
					(x.moodBest === w.best!.day ? TEXT.moodToo : ""),
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
		care: careLines(x),
		quiet,
		kind: quiet ? w.tone.kind : null,
		smallStuff: quiet ? smallStuff(w) : [],
		highlight,
	};
}

function smallStuff(w: Wrap): string[] {
	const out = alsoCounted(w.extras).filter((l) => !l.startsWith("Looked after yourself"));
	if (w.notesEdited) out.push(`You changed ${plural(w.notesEdited, "note")}.`);
	if (w.notesCreated) out.push(`You started ${plural(w.notesCreated, "new note")}.`);
	return out;
}
