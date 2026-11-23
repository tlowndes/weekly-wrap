import { startOfDayMs } from "../../src/core/dates";
import { weekFor } from "../../src/core/week";
import { buildWrap } from "../../src/core/wrap";
import { WrapView } from "../../src/view";

// Sample week for the README screenshots: made-up tasks, the kind Flight Deck would log.
const at = (day: string) => startOfDayMs(day) + 12 * 3600000;
const quiet = location.hash === "#quiet";
const week = weekFor(quiet ? "2026-11-27" : "2026-11-20");

const tasks = quiet
	? ["- [x] Paid the council tax ✅ 2026-11-23", "- [x] Replied to Sam about Saturday ✅ 2026-11-25"]
	: [
			["2026-11-16", "Sorted the recycling"], ["2026-11-16", "Watered the plants"], ["2026-11-16", "Booked a haircut"],
			["2026-11-17", "Sent the design application"], ["2026-11-17", "Updated the portfolio case study"], ["2026-11-17", "Paid the gas bill"],
			["2026-11-17", "Emailed the landlord"], ["2026-11-17", "Cleared the inbox"],
			["2026-11-18", "Booked the boiler service"], ["2026-11-18", "Tidied the desk"], ["2026-11-18", "Ordered new bulbs"], ["2026-11-18", "Read a chapter"],
			["2026-11-19", "Finished the mock-ups"], ["2026-11-19", "Rang the GP about the prescription"], ["2026-11-19", "Cooked a proper dinner"],
			["2026-11-19", "Fixed the shelf"], ["2026-11-19", "Backed up the laptop"], ["2026-11-19", "Wrote the cover letter"],
			["2026-11-19", "Changed the bedding"], ["2026-11-19", "Took the bins out"],
			["2026-11-20", "Returned the parcel"], ["2026-11-20", "Planned next week"], ["2026-11-20", "Called Mum"],
		].map(([d, t]) => `- [x] ${t} ✅ ${d}`);

const notes = [
	{ path: "Tasks.md", ctime: at("2026-10-01"), mtime: at(week.to) },
	...Array.from({ length: quiet ? 2 : 27 }, (_, i) => ({ path: `Notes/n${i}.md`, ctime: at("2026-10-01"), mtime: at(week.days[i % 7]) })),
	...Array.from({ length: quiet ? 0 : 4 }, (_, i) => ({ path: `New/n${i}.md`, ctime: at(week.days[i]), mtime: at(week.days[i]) })),
];

async function main() {
	const wrap = await buildWrap(notes, async (p) => (p === "Tasks.md" ? tasks.join("\n") : ""), week);
	wrap.extras = quiet
		? { focus: { sessions: 1, minutes: 25, longest: { task: "CV", minutes: 25 } }, water: { goalDays: 2, goalMl: 2000 }, didI: 5, captures: 7 }
		: {
				focus: { sessions: 9, minutes: 400, longest: { task: "Portfolio", minutes: 75 } },
				habits: [{ name: "Stretch", days: 5 }, { name: "Walk 20 min", days: 4 }],
				water: { goalDays: 3, goalMl: 2000 },
				moodBest: "2026-11-19",
				didI: 14,
				applications: 4,
			};
	wrap.tone = quiet
		? { quiet: true, kind: "Rest weeks count too. Here's what still happened.", highlight: true }
		: { quiet: false, kind: null, highlight: true };
	const plugin = { buildAndSave: async () => wrap, lastWeek: () => week, markOpened: async () => {}, openNote: async () => {} };
	const view = new WrapView({}, plugin as never);
	await view.show(week);
	document.body.dataset.ready = "1";
}
main();
