import { describe, expect, it } from "vitest";
import { cards } from "../src/core/cards";
import { history, isQuiet, kindLine } from "../src/core/quiet";
import { KIND_LINES } from "../src/core/strings";
import { appliedDay, didI, FLIGHT_DECK, focus, gatherExtras, habits } from "../src/core/sources";
import { hours } from "../src/core/words";
import { check, dueWeek, EMPTY_NUDGE } from "../src/core/nudge";
import { isoWeek, localDay, rangeLabel, startOfDayMs } from "../src/core/dates";
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

describe("Friday nudge", () => {
	const opts = { wrapDay: 5, fromHour: 15, enabled: true, installed: "2026-11-01" };

	it("waits until the set time on the wrap day", () => {
		expect(dueWeek("2026-11-20", 14, 5, 15).to).toBe("2026-11-13");
		expect(dueWeek("2026-11-20", 15, 5, 15).to).toBe("2026-11-20");
		expect(dueWeek("2026-11-24", 9, 5, 15).to).toBe("2026-11-20");
	});

	it("shows the notice once and keeps the dot until opened", () => {
		const first = check(EMPTY_NUDGE, "2026-11-20", 16, opts);
		expect([first.week.label, first.notice, first.dot]).toEqual(["2026-W47", true, true]);
		const later = check({ lastOpened: "", lastNudged: "2026-W47" }, "2026-11-21", 10, opts);
		expect([later.notice, later.dot]).toEqual([false, true]);
		const opened = check({ lastOpened: "2026-W47", lastNudged: "2026-W47" }, "2026-11-22", 10, opts);
		expect([opened.notice, opened.dot]).toEqual([false, false]);
	});

	it("catches up after a missed Friday", () => {
		const c = check({ lastOpened: "2026-W46", lastNudged: "2026-W46" }, "2026-11-23", 8, opts);
		expect([c.week.label, c.notice]).toEqual(["2026-W47", true]);
	});

	it("stays quiet when turned off or before it was installed", () => {
		expect(check(EMPTY_NUDGE, "2026-11-20", 16, { ...opts, enabled: false }).notice).toBe(false);
		expect(check(EMPTY_NUDGE, "2026-11-20", 16, { ...opts, installed: "2026-11-21" }).dot).toBe(false);
	});
});

describe("Flight Deck sources", () => {
	const week = weekFor("2026-11-20");
	const at = (day: string) => startOfDayMs(day) + 12 * 3600000;

	it("reads the Focus log for the week", () => {
		const f = focus(
			"# Focus log\n\n- 2026-11-10 09:00 · Old · 90 min\n- 2026-11-17 10:00 · Portfolio · 75 min\n- 2026-11-19 · CV · 25 min\nnot a line",
			week,
		);
		expect(f).toEqual({ sessions: 2, minutes: 100, longest: { task: "Portfolio", minutes: 75 } });
	});

	it("reads habits, water and the best mood from the Habits log", () => {
		const text = [
			"# Habits",
			"## Habits",
			"- 🧘 Stretch · Mon Wed Fri",
			"- Read 10 pages",
			"- 💧 Water · counter 2000 ml +250",
			"## Water",
			"goal: 1500 ml",
			"## Log",
			"| Date | Water ml | Done |",
			"|---|---|---|",
			"| 2026-11-16 | 1500 | Stretch, mood=3 |",
			"| 2026-11-17 | 500 | Stretch, Read 10 pages, mood=5 |",
			"| 2026-11-18 | 2000 | Stretch, mood=2 |",
			"| 2026-11-01 | 3000 | Stretch, mood=5 |",
		].join("\n");
		const h = habits(text, week);
		expect(h.habits).toEqual([
			{ name: "Stretch", days: 3 },
			{ name: "Read 10 pages", days: 1 },
		]);
		expect(h.water).toEqual({ goalDays: 2, goalMl: 1500 });
		expect(h.moodBest).toBe("2026-11-17");
	});

	it("counts Did I? stamps and finds applied dates", () => {
		expect(didI("# Did I? · Thu 19 Nov\n\n- 08:12 · Hob off\n- 08:13 · Back door\n- not a stamp")).toBe(2);
		expect(appliedDay("---\ntype: application\napplied: 2026-11-17\n---\n# Monzo")).toBe("2026-11-17");
		expect(appliedDay("---\napplied:\n---")).toBeNull();
	});

	it("gathers only what's there and shows it in the cards and note", async () => {
		const files: Record<string, string> = {
			"99 - Meta/Focus log.md": "- 2026-11-19 10:00 · Portfolio · 50 min",
			"99 - Meta/Did I/2026-11-19.md": "- 08:12 · Hob off",
			"02 - Area/Work/Job Hunt/Applications/Monzo.md": "---\napplied: 2026-11-18\n---",
			"01 - Inbox/Idea.md": "x",
			"Tasks.md": "- [x] Two ✅ 2026-11-19\n- [x] One ✅ 2026-11-19",
		};
		const notes = Object.keys(files).map((path) => ({ path, ctime: at("2026-11-18"), mtime: at("2026-11-19") }));
		const read = async (p: string) => files[p];
		const w = await buildWrap(notes, read, week);
		w.extras = await gatherExtras({ notes, read }, week, FLIGHT_DECK, localDay);
		expect(w.extras).toEqual({
			focus: { sessions: 1, minutes: 50, longest: { task: "Portfolio", minutes: 50 } },
			didI: 1,
			applications: 1,
			captures: 1,
		});
		const c = cards(w);
		expect(c.stats.map((s) => `${s.value} ${s.label}`)).toEqual(["2 tasks ticked", "50m of focus", "5 notes touched", "1 application"]);
		expect(c.care).toEqual(["1 Did I? check, so you didn't have to wonder"]);
		const note = newNote(w);
		expect(note).toContain("- Focus: 1 session, 50m.");
		expect(note).toContain("- Job hunt: 1 application sent.");
		expect(note).toContain("- Captured: 1 new inbox note, so nothing got lost.");
	});

	it("formats hours", () => {
		expect([hours(45), hours(120), hours(400)]).toEqual(["45m", "2h", "6h 40m"]);
	});
});

describe("lighter weeks and tone", () => {
	const week = weekFor("2026-11-27");
	const at = (day: string) => startOfDayMs(day) + 12 * 3600000;

	it("works out the last four weeks' ticks", async () => {
		const text = [
			"- [x] a ✅ 2026-10-31",
			"- [x] b ✅ 2026-11-06",
			"- [x] c ✅ 2026-11-13",
			"- [x] d ✅ 2026-11-14",
			"- [x] e ✅ 2026-11-20",
			"- [x] this week ✅ 2026-11-25",
			"- [x] too old ✅ 2026-10-30",
		].join("\n");
		const notes = [{ path: "T.md", ctime: at("2026-10-01"), mtime: at("2026-11-25") }];
		expect(await history(notes, async () => text, week, { ignore: [], countUndated: false, taskFilter: "" })).toEqual([1, 2, 1, 2]);
	});

	it("calls a week lighter only when it's well under a real usual", () => {
		expect(isQuiet(2, [10, 8, 12, 10])).toBe(true);
		expect(isQuiet(6, [10, 8, 12, 10])).toBe(false);
		expect(isQuiet(0, [1, 2, 0, 1])).toBe(false);
		expect(isQuiet(0, [])).toBe(false);
	});

	it("picks the same kind line for a week and falls back to the defaults", () => {
		expect(kindLine(week)).toBe(kindLine(week));
		expect(kindLine(week, ["Only one"])).toBe("Only one");
		expect(kindLine(week, ["", "  "])).toBe(KIND_LINES[48 % KIND_LINES.length]);
	});

	it("leads a lighter week with the kind line and the small stuff, with no comparison", async () => {
		const notes = [
			{ path: "T.md", ctime: at("2026-10-01"), mtime: at("2026-11-24") },
			{ path: "Plan.md", ctime: at("2026-10-01"), mtime: at("2026-11-25") },
		];
		const w = await buildWrap(notes, async (p) => (p === "T.md" ? "- [x] Paid council tax ✅ 2026-11-23" : ""), week);
		w.extras = { focus: { sessions: 1, minutes: 25, longest: { task: "CV", minutes: 25 } }, water: { goalDays: 2, goalMl: 2000 } };
		w.tone = { quiet: true, kind: "Rest weeks count too. Here's what still happened.", highlight: true };
		const note = newNote(w);
		expect(note).toContain("> [!note] A lighter week\n> Rest weeks count too.");
		expect(note.indexOf("## The small stuff counts")).toBeLessThan(note.indexOf("## Done"));
		expect(note).not.toContain("## Also counted");
		expect(note).not.toMatch(/usual|average|less than|fewer than \d/i);
		const c = cards(w);
		expect(c.headline).toBe("A lighter week");
		expect(c.kind).toContain("Rest weeks");
		expect(c.smallStuff).toEqual(["Focus: 1 session, 25m.", "You changed 2 notes."]);
		expect(c.care).toEqual(["Water goal hit 2 times"]);
	});

	it("turns the best-day line off", async () => {
		const notes = [{ path: "T.md", ctime: at("2026-10-01"), mtime: at("2026-11-26") }];
		const w = await buildWrap(notes, async () => "- [x] a ✅ 2026-11-26\n- [x] b ✅ 2026-11-26", week);
		w.tone = { quiet: false, kind: null, highlight: false };
		expect(cards(w).highlight).toBeNull();
		expect(shortVersion(w)).not.toContain("big day");
		expect(newNote(w)).not.toContain("★");
	});
});
