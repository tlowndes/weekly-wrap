import { Extras } from "./sources";

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** "45m", "2h", "6h 40m". */
export function hours(min: number): string {
	if (min < 60) return `${min}m`;
	return min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** Habit, water and Did I? lines for "Looked after yourself". Only what happened; never what didn't. */
export function careLines(x: Extras): string[] {
	const out: string[] = [];
	for (const h of (x.habits ?? []).slice(0, 3)) out.push(`${h.name} on ${plural(h.days, "day")}`);
	if (x.water) out.push(`Water goal hit ${x.water.goalDays === 1 ? "once" : `${x.water.goalDays} times`}`);
	if (x.didI) out.push(`${plural(x.didI, "Did I? check")}, so you didn't have to wonder`);
	return out;
}

/** The saved note's "Also counted" lines from Flight Deck. */
export function alsoCounted(x: Extras): string[] {
	const out: string[] = [];
	if (x.focus) {
		let s = `Focus: ${plural(x.focus.sessions, "session")}, ${hours(x.focus.minutes)}.`;
		if (x.focus.longest && x.focus.sessions > 1) s += ` Longest was ${hours(x.focus.longest.minutes)} on ${x.focus.longest.task}.`;
		out.push(s);
	}
	const care = careLines(x);
	if (care.length) out.push(`Looked after yourself: ${care.map((c, i) => (i ? c.charAt(0).toLowerCase() + c.slice(1) : c)).join(", ")}.`);
	if (x.applications) out.push(`Job hunt: ${plural(x.applications, "application")} sent.`);
	if (x.captures) out.push(`Captured: ${plural(x.captures, "new inbox note")}, so nothing got lost.`);
	return out;
}
