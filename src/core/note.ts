import { longDay, rangeLabel, shortDay } from "./dates";
import { Wrap } from "./wrap";

/** The saved note's generated part sits between these, so re-running a week never touches the user's words. */
export const START = "%% weekly-wrap:start %%";
export const END = "%% weekly-wrap:end %%";
const KEEP_HEADING = "## Worth keeping";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** The one-line summary: "23 tasks ticked and 31 notes touched. Thursday was your big day." */
export function shortVersion(w: Wrap): string {
	const bits: string[] = [];
	if (w.tasks.length) bits.push(`${plural(w.tasks.length, "task")} ticked`);
	const touched = w.notesEdited + w.notesCreated;
	if (touched) bits.push(`${plural(touched, "note")} touched`);
	if (!bits.length) return "A blank page this week, and that's allowed.";
	let s = bits.join(" and ") + ".";
	if (w.best && w.tasks.length > 1) s += ` ${longDay(w.best.day)} was your big day.`;
	return s;
}

/** The generated body: frontmatter is written separately so the user can add their own properties. */
export function generated(w: Wrap): string {
	const lines: string[] = [];
	lines.push("# What you actually did", "", rangeLabel(w.week.from, w.week.to), "");
	lines.push("> [!success] The short version", `> ${shortVersion(w)}`, "");

	if (w.tasks.length) {
		lines.push("## Done", "");
		for (const d of w.perDay) {
			const today = w.tasks.filter((t) => t.done === d.day);
			if (!today.length) continue;
			lines.push(`### ${longDay(d.day)}`);
			for (const t of today) lines.push(`- ${t.text} · [[${t.path.replace(/\.md$/, "")}|${noteName(t.path)}]]`);
			lines.push("");
		}
	}

	lines.push("## Day by day", "", "| Day | Tasks |", "| --- | --- |");
	for (const d of w.perDay) {
		const star = w.best && d.day === w.best.day && w.tasks.length > 1 ? " ★" : "";
		lines.push(`| ${shortDay(d.day)} ${Number(d.day.slice(8))}${star} | ${d.tasks} |`);
	}
	lines.push("");

	const made: string[] = [];
	if (w.notesCreated) made.push(`${plural(w.notesCreated, "new note")}`);
	if (w.notesEdited) made.push(`${plural(w.notesEdited, "note")} edited`);
	if (made.length) lines.push("## Also counted", "", `- Made: ${made.join(", ")}.`, "");

	return lines.join("\n").trimEnd();
}

function noteName(path: string): string {
	return path.split("/").pop()!.replace(/\.md$/, "");
}

export function frontmatter(w: Wrap): string {
	return ["---", `week: ${w.week.label}`, `from: ${w.week.from}`, `to: ${w.week.to}`, "tags:", "  - wrap", "---"].join("\n");
}

/** A whole new wrap note. */
export function newNote(w: Wrap): string {
	return [frontmatter(w), "", START, generated(w), END, "", KEEP_HEADING, "", ""].join("\n");
}

/**
 * [existing] with its generated part swapped for this wrap's. Anything outside the markers (frontmatter
 * the user added to, "Worth keeping", their own notes) stays as it was. No markers: the wrap goes on top.
 */
export function updateNote(existing: string, w: Wrap): string {
	const s = existing.indexOf(START);
	const e = existing.indexOf(END);
	if (s >= 0 && e > s) return existing.slice(0, s) + START + "\n" + generated(w) + "\n" + existing.slice(e);
	return newNote(w).trimEnd() + "\n\n" + existing;
}
