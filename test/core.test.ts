import { describe, expect, it } from "vitest";
import { cards } from "../src/core/cards";
import { isoWeek, rangeLabel, startOfDayMs } from "../src/core/dates";
import { END, newNote, shortVersion, START, updateNote } from "../src/core/note";
import { cleanText, doneIn } from "../src/core/tasks";
import { nextWeek, previousWeek, weekFor } from "../src/core/week";
import { buildWrap, ignored, NoteInfo } from "../src/core/wrap";

describe("weeks", () => {
	it("ends on the wrap day itself on a Friday", () => {
		const w = weekFor("2026-11-20");
		expect([w.from, w.to, w.label]).toEqual(["2026-11-14", "2026-11-20", "2026-W47"]);
		expect(w.days).toHaveLength(7);
	});
	it("shows last Friday's week mid-week, or this week so far when asked", () => {
		expect(weekFor("2026-11-24").to).toBe("2026-11-20");
		expect(weekFor("2026-11-24", 5, true).to).toBe("2026-11-27");
	});
	it("honours another wrap day", () => {
		expect(weekFor("2026-11-24", 0).to).toBe("2026-11-22");
	});
	it("steps back and forward", () => {
		const w = weekFor("2026-11-20");
		expect(previousWeek(w).to).toBe("2026-11-13");
		expect(nextWeek(w).to).toBe("2026-11-27");
	});
	it("labels ISO weeks across the new year", () => {
		expect(isoWeek("2027-01-01")).toBe("2026-W53");
		expect(isoWeek("2026-01-02")).toBe("2026-W01");
	});
	it("writes friendly ranges", () => {
		expect(rangeLabel("2026-11-14", "2026-11-20")).toBe("Sat 14 to Fri 20 November");
		expect(rangeLabel("2026-10-31", "2026-11-06")).toBe("Sat 31 October to Fri 6 November");
	});
});

describe("ticked tasks", () => {
	const lines = [
		"---",
		"- [x] in frontmatter ✅ 2026-11-18",
		"---",
		"- [x] Sent the Monzo application #task ⏫ ✅ 2026-11-17",
		"- [ ] Not done yet ✅ 2026-11-17",
		"* [X] Booked the boiler service 📅 2026-11-19 ✅ 2026-11-18 ^abc",
		"```",
		"- [x] in a code block ✅ 2026-11-18",
		"```",
		"- [x] Too early ✅ 2026-11-01",
		"- [x] No date at all",
		"  1. [x] Nested numbered #task ✅ 2026-11-20",
	];
	it("keeps done-dated ticks in the week, outside frontmatter and code", () => {
		const got = doneIn(lines, "a.md", "2026-11-14", "2026-11-20");
		expect(got.map((t) => [t.text, t.done])).toEqual([
			["Sent the Monzo application", "2026-11-17"],
			["Booked the boiler service", "2026-11-18"],
			["Nested numbered", "2026-11-20"],
		]);
	});
	it("counts undated ticks on the fallback day only when asked", () => {
		const got = doneIn(lines, "a.md", "2026-11-14", "2026-11-20", { fallback: "2026-11-19" });
		expect(got.map((t) => t.text)).toContain("No date at all");
	});
	it("applies a tag filter as a whole tag", () => {
		const got = doneIn(lines, "a.md", "2026-11-14", "2026-11-20", { filter: "#task" });
		expect(got.map((t) => t.text)).toEqual(["Sent the Monzo application", "Nested numbered"]);
		expect(doneIn(["- [x] a #tasky ✅ 2026-11-15"], "a.md", "2026-11-14", "2026-11-20", { filter: "#task" })).toEqual([]);
	});
	it("cleans Tasks plugin fields and dataview fields", () => {
		expect(cleanText("Pay rent 🔁 every month 📅 2026-11-01 [due:: soon] #bills")).toBe("Pay rent");
	});
});

describe("building a wrap", () => {
	const week = weekFor("2026-11-20");
	const at = (day: string, hour = 12) => startOfDayMs(day) + hour * 3600000;
	const notes: NoteInfo[] = [
		{ path: "01 - Inbox/Quick Task.md", ctime: at("2026-10-01"), mtime: at("2026-11-19") },
		{ path: "Projects/New idea.md", ctime: at("2026-11-16"), mtime: at("2026-11-16") },
		{ path: "Old.md", ctime: at("2026-01-01"), mtime: at("2026-02-01") },
		{ path: "Templates/Task.md", ctime: at("2026-11-15"), mtime: at("2026-11-15") },
		{ path: ".trash/x.md", ctime: at("2026-11-15"), mtime: at("2026-11-15") },
	];
	const texts: Record<string, string> = {
		"01 - Inbox/Quick Task.md": "- [x] Rang the GP ✅ 2026-11-19\n- [x] Paid council tax ✅ 2026-11-19\n- [x] Booked boiler ✅ 2026-11-16",
		"Projects/New idea.md": "# New idea",
		"Old.md": "- [x] Should never be read ✅ 2026-11-19",
		"Templates/Task.md": "- [x] Template tick ✅ 2026-11-15",
	};
	const read = async (p: string) => texts[p];

	it("counts ticks, best day and notes touched, skipping ignored folders and stale notes", async () => {
		const w = await buildWrap(notes, read, week, { ignore: ["Templates"], countUndated: false, taskFilter: "" });
		expect(w.tasks.map((t) => t.text)).toEqual(["Booked boiler", "Paid council tax", "Rang the GP"]);
		expect(w.best).toEqual({ day: "2026-11-19", tasks: 2 });
		expect(w.notesCreated).toBe(1);
		expect(w.notesEdited).toBe(1);
		expect(shortVersion(w)).toBe("3 tasks ticked and 2 notes touched. Thursday was your big day.");
	});

	it("treats dot-folders and folder prefixes carefully", () => {
		expect(ignored(".trash/x.md", [])).toBe(true);
		expect(ignored("Templates/a.md", ["Templates/"])).toBe(true);
		expect(ignored("Templates old/a.md", ["Templates"])).toBe(false);
	});

	it("has a kind line for an empty week", async () => {
		const w = await buildWrap([], read, week);
		expect(shortVersion(w)).toBe("A blank page this week, and that's allowed.");
		expect(newNote(w)).not.toContain("## Done");
	});

	it("saves a note and keeps the user's words when re-run", async () => {
		const w = await buildWrap(notes, read, week, { ignore: ["Templates"], countUndated: false, taskFilter: "" });
		const first = newNote(w);
		expect(first).toContain("week: 2026-W47");
		expect(first).toContain("### Thursday\n- Paid council tax · [[01 - Inbox/Quick Task|Quick Task]]");
		expect(first).toContain("| Thu 19 ★ | 2 |");
		const edited = first.replace("## Worth keeping\n", "## Worth keeping\nI rang the GP at last.\n");
		const again = updateNote(edited, { ...w, tasks: w.tasks.slice(0, 1) });
		expect(again).toContain("I rang the GP at last.");
		expect(again).toContain("1 task ticked");
		expect(again.split(START)).toHaveLength(2);
		expect(again.split(END)).toHaveLength(2);
	});
});

describe("card view", () => {
	const week = weekFor("2026-11-20");
	const at = (day: string) => startOfDayMs(day) + 12 * 3600000;
	const notes: NoteInfo[] = [{ path: "Tasks.md", ctime: at("2026-10-01"), mtime: at("2026-11-20") }];
	const text = [
		"- [x] One ✅ 2026-11-16",
		"- [x] Two ✅ 2026-11-19",
		"- [x] Three ✅ 2026-11-19",
		"- [x] Four ✅ 2026-11-19",
		"- [x] Five ✅ 2026-11-20",
	].join("\n");

	it("turns a wrap into a headline, stats, a day strip and a highlight", async () => {
		const w = await buildWrap(notes, async () => text, week);
		const c = cards(w);
		expect(c.kicker).toBe("Week 47");
		expect(c.headline).toBe("You got 5 things done");
		expect(c.stats.map((s) => s.value)).toEqual(["5", "1", "0"]);
		expect(c.days.map((d) => d.level)).toEqual([0, 0, 1, 0, 0, 4, 1]);
		expect(c.days.find((d) => d.best)?.name).toBe("Thu");
		expect(c.proud).toHaveLength(3);
		expect(c.proud[0]).toBe("Five");
		expect(c.more).toBe(2);
		expect(c.highlight?.title).toBe("Thursday was your big one");
	});

	it("stays gentle with nothing ticked", async () => {
		const c = cards(await buildWrap([], async () => "", week));
		expect(c.headline).toBe("A quiet one");
		expect(c.highlight).toBeNull();
		expect(c.days.every((d) => d.level === 0)).toBe(true);
	});
});
