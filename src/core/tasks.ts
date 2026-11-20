import { Day, isDay } from "./dates";

/** A task ticked in the week: its cleaned text, the day it was done and the note it lives in. */
export interface DoneTask {
	text: string;
	done: Day;
	path: string;
}

const TICKED = /^\s*(?:[-*+]|\d+[.)])\s+\[[xX]\]\s+(.*)$/;
const DONE_DATE = /✅\s*(\d{4}-\d{2}-\d{2})/;

/** Tasks plugin date and field markers, stripped from the shown text. */
const FIELDS = /\s*(?:✅|📅|⏳|🛫|➕|❌|🔁|🆔|⛔|🏁)\s*[^✅📅⏳🛫➕❌🔁🆔⛔🏁#]*/gu;
const PRIORITY = /\s*[🔺⏫🔼🔽⏬]/gu;
const DATAVIEW_FIELD = /\s*\[[\w-]+::[^\]]*\]/g;
const TAGS = /(^|\s)#[\w/-]+/g;
const BLOCK_ID = /\s\^[\w-]+$/;

/** The task's words, without dates, priorities, inline fields, tags or block ids. */
export function cleanText(body: string): string {
	const out = body
		.replace(FIELDS, " ")
		.replace(PRIORITY, " ")
		.replace(DATAVIEW_FIELD, " ")
		.replace(TAGS, "$1")
		.replace(BLOCK_ID, "")
		.replace(/\s+/g, " ")
		.trim();
	return out || body.trim();
}

/**
 * Ticked task lines in [lines] done between [from] and [to] inclusive, skipping frontmatter and code blocks.
 * The done day is the Tasks plugin's `✅ YYYY-MM-DD`. A tick with no date counts on [fallback] (the note's edit
 * day) when given, and is skipped otherwise. [filter] keeps only lines that contain it, like a `#task` global filter.
 */
export function doneIn(
	lines: string[],
	path: string,
	from: Day,
	to: Day,
	opts: { fallback?: Day; filter?: string } = {},
): DoneTask[] {
	const out: DoneTask[] = [];
	let i = 0;
	if (lines[0]?.trim() === "---") {
		const end = lines.findIndex((l, j) => j > 0 && l.trim() === "---");
		if (end > 0) i = end + 1;
	}
	let fence = false;
	for (; i < lines.length; i++) {
		const line = lines[i];
		const t = line.trimStart();
		if (t.startsWith("```") || t.startsWith("~~~")) {
			fence = !fence;
			continue;
		}
		if (fence) continue;
		const m = TICKED.exec(line);
		if (!m) continue;
		const body = m[1];
		if (opts.filter && !hasFilter(body, opts.filter)) continue;
		const dated = DONE_DATE.exec(body)?.[1];
		const done = dated && isDay(dated) ? dated : opts.fallback;
		if (!done || done < from || done > to) continue;
		out.push({ text: cleanText(body), done, path });
	}
	return out;
}

function hasFilter(body: string, filter: string): boolean {
	if (!filter.startsWith("#")) return body.includes(filter);
	const esc = filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|\\s)${esc}(/|\\s|$)`).test(body);
}
