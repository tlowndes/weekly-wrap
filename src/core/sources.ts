import { Day, isDay } from "./dates";
import { inWeek, Week } from "./week";

/**
 * Extra counts from Flight Deck's notes, each read only when its note is there. All formats are Flight Deck's own
 * (Kotlin `FlightNotes`, `Habits`, `DidI`, `Jobs`), so other apps that write the same lines work too.
 */
export interface Extras {
	focus?: { sessions: number; minutes: number; longest: { task: string; minutes: number } | null };
	habits?: { name: string; days: number }[];
	water?: { goalDays: number; goalMl: number };
	/** The day with the best mood (1–5) logged, if three or more days had one. */
	moodBest?: Day;
	didI?: number;
	applications?: number;
	captures?: number;
}

// ---- Focus log: `- 2026-11-20 14:05 · Portfolio · 45 min` ----

const FOCUS_LINE = /^\s*-\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?\s*·\s*(.+?)\s*·\s*(\d+)\s*(?:min|m)?\s*$/;

export function focus(text: string, week: Week): Extras["focus"] {
	let sessions = 0;
	let minutes = 0;
	let longest: { task: string; minutes: number } | null = null;
	for (const line of text.split("\n")) {
		const m = FOCUS_LINE.exec(line);
		if (!m || !isDay(m[1]) || !inWeek(week, m[1])) continue;
		const min = Number(m[3]);
		sessions++;
		minutes += min;
		if (!longest || min > longest.minutes) longest = { task: m[2], minutes: min };
	}
	return { sessions, minutes, longest };
}

// ---- Habits: `## Habits` list, `## Water` goal, `## Log` table `| Date | Water ml | Done |` ----

function section(lines: string[], name: string): string[] {
	const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${name}`.toLowerCase());
	if (start < 0) return [];
	let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
	if (end < 0) end = lines.length;
	return lines.slice(start + 1, end);
}

const ROW = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d*)\s*\|(.*)\|\s*$/;
const COUNT = /^(.+?)=(\d+)$/;

/** A habit list line's name: `- 🧘 Stretch · Mon Wed Fri` → `Stretch`. */
function habitName(line: string): string {
	const head = line.split(" · ")[0].trim();
	const first = head.codePointAt(0) ?? 0;
	const emoji = head.includes(" ") && first >= 0x2000 && !/[\p{L}\p{N}]/u.test(String.fromCodePoint(first));
	return emoji ? head.slice(head.indexOf(" ") + 1).trim() : head;
}

export function habits(text: string, week: Week): Pick<Extras, "habits" | "water" | "moodBest"> {
	const lines = text.split("\n");
	const goalMl = Number(section(lines, "Water").map((l) => /goal:\s*(\d+)/.exec(l)?.[1]).find(Boolean) ?? 2000);
	const listed = section(lines, "Habits")
		.map((l) => /^\s*[-*]\s+(.+)$/.exec(l)?.[1])
		.filter((s): s is string => !!s)
		.map(habitName)
		.filter((n) => n.toLowerCase() !== "water");

	const ticks = new Map<string, number>();
	let goalDays = 0;
	const moods: { day: Day; mood: number }[] = [];
	for (const l of section(lines, "Log")) {
		const m = ROW.exec(l.trim());
		if (!m || !isDay(m[1]) || !inWeek(week, m[1])) continue;
		if (Number(m[2] || 0) >= goalMl) goalDays++;
		for (const cell of m[3].split(",").map((c) => c.trim()).filter(Boolean)) {
			const c = COUNT.exec(cell);
			if (c) {
				const n = Number(c[2]);
				if (c[1].trim() === "mood" && n >= 1 && n <= 5) moods.push({ day: m[1], mood: n });
				continue;
			}
			ticks.set(cell, (ticks.get(cell) ?? 0) + 1);
		}
	}

	const names = [...listed, ...[...ticks.keys()].filter((k) => !listed.includes(k))];
	const done = names.map((name) => ({ name, days: ticks.get(name) ?? 0 })).filter((h) => h.days > 0);
	done.sort((a, b) => b.days - a.days);
	const best = moods.length >= 3 ? moods.reduce((a, b) => (b.mood > a.mood ? b : a)) : null;
	return { habits: done, water: { goalDays, goalMl }, moodBest: best?.day };
}

// ---- Did I?: one note per day, `- 08:12 · Hob off` ----

const STAMP = /^\s*-\s+\d{2}:\d{2}\s*·\s*.+$/;

export function didI(text: string): number {
	return text.split("\n").filter((l) => STAMP.test(l)).length;
}

// ---- Job applications: frontmatter `applied: 2026-11-17` ----

export function appliedDay(text: string): Day | null {
	if (!text.startsWith("---")) return null;
	const end = text.indexOf("\n---", 3);
	const fm = end > 0 ? text.slice(3, end) : "";
	const v = /^applied:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(fm)?.[1];
	return v && isDay(v) ? v : null;
}

// ---- Gathering ----

export interface Source {
	on: boolean;
	path: string;
}

export interface Sources {
	focus: Source;
	habits: Source;
	didI: Source;
	jobs: Source;
	captures: Source;
}

/** Flight Deck's own paths: switched on, and simply skipped where the note or folder isn't there. */
export const FLIGHT_DECK: Sources = {
	focus: { on: true, path: "99 - Meta/Focus log.md" },
	habits: { on: true, path: "99 - Meta/Habits.md" },
	didI: { on: true, path: "99 - Meta/Did I" },
	jobs: { on: true, path: "02 - Area/Work/Job Hunt/Applications" },
	captures: { on: true, path: "01 - Inbox" },
};

export interface VaultAccess {
	/** Every markdown note, with its times. */
	notes: { path: string; ctime: number }[];
	read(path: string): Promise<string>;
}

const under = (path: string, folder: string) => path.startsWith(folder.replace(/\/+$/, "") + "/");

/** Reads each switched-on source whose note or folder exists. Missing ones are left out, never zero. */
export async function gatherExtras(
	v: VaultAccess,
	week: Week,
	src: Sources,
	localDay: (ms: number) => Day,
): Promise<Extras> {
	const out: Extras = {};
	const has = (p: string) => v.notes.some((n) => n.path === p);
	const safe = async (p: string) => {
		try {
			return await v.read(p);
		} catch {
			return null;
		}
	};

	if (src.focus.on && has(src.focus.path)) {
		const t = await safe(src.focus.path);
		const f = t === null ? null : focus(t, week);
		if (f && f.sessions > 0) out.focus = f;
	}
	if (src.habits.on && has(src.habits.path)) {
		const t = await safe(src.habits.path);
		if (t !== null) {
			const h = habits(t, week);
			if (h.habits?.length) out.habits = h.habits;
			if (h.water && h.water.goalDays > 0) out.water = h.water;
			if (h.moodBest) out.moodBest = h.moodBest;
		}
	}
	if (src.didI.on) {
		let n = 0;
		let found = false;
		for (const day of week.days) {
			const p = `${src.didI.path.replace(/\/+$/, "")}/${day}.md`;
			if (!has(p)) continue;
			found = true;
			n += didI((await safe(p)) ?? "");
		}
		if (found && n > 0) out.didI = n;
	}
	if (src.jobs.on) {
		const notes = v.notes.filter((n) => under(n.path, src.jobs.path));
		let n = 0;
		for (const note of notes) {
			const d = appliedDay((await safe(note.path)) ?? "");
			if (d && inWeek(week, d)) n++;
		}
		if (n > 0) out.applications = n;
	}
	if (src.captures.on) {
		const n = v.notes.filter((x) => under(x.path, src.captures.path) && inWeek(week, localDay(x.ctime))).length;
		if (n > 0) out.captures = n;
	}
	return out;
}
