import { ItemView, WorkspaceLeaf } from "obsidian";
import { cards } from "./core/cards";
import { nextWeek, previousWeek, weekEnding, Week } from "./core/week";
import { Wrap } from "./core/wrap";
import type WeeklyWrapPlugin from "./main";

export const VIEW_TYPE = "weekly-wrap-view";

interface ViewState {
	to?: string;
}

/** The card view: this week at a glance, with buttons for the weeks either side and the saved note. */
export class WrapView extends ItemView {
	private week: Week | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: WeeklyWrapPlugin) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getDisplayText() {
		return this.week ? `Wrap ${this.week.label}` : "Weekly Wrap";
	}

	getIcon() {
		return "calendar-check";
	}

	getState(): Record<string, unknown> {
		return { to: this.week?.to };
	}

	async setState(state: ViewState, result: Parameters<ItemView["setState"]>[1]) {
		if (state?.to) await this.show(weekEnding(state.to));
		return super.setState(state, result);
	}

	async onOpen() {
		if (!this.week) await this.show(this.plugin.lastWeek());
	}

	/** Builds and saves [week]'s wrap, then draws it. */
	async show(week: Week) {
		this.week = week;
		this.contentEl.empty();
		this.contentEl.createDiv({ cls: "ww-loading", text: "Wrapping your week…" });
		try {
			const wrap = await this.plugin.buildAndSave(week);
			this.draw(wrap);
		} catch (e) {
			console.error("Weekly Wrap", e);
			this.contentEl.empty();
			this.contentEl.createDiv({ cls: "ww-loading", text: "Couldn't build this week. Details are in the developer console." });
		}
		// The tab title follows the week shown.
		(this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
	}

	private draw(w: Wrap) {
		const c = cards(w);
		const root = this.contentEl;
		root.empty();
		root.addClass("ww-root");
		const page = root.createDiv({ cls: "ww-page" });

		const head = page.createDiv({ cls: "ww-head" });
		const titles = head.createDiv({ cls: "ww-titles" });
		titles.createDiv({ cls: "ww-kicker", text: `${c.kicker} · ${c.range}` });
		titles.createEl("h1", { cls: "ww-headline", text: c.headline });

		const nav = head.createDiv({ cls: "ww-nav" });
		this.button(nav, "‹ Last week", "ww-btn", () => this.show(previousWeek(w.week)));
		const isLatest = w.week.to >= this.plugin.lastWeek().to;
		const next = this.button(nav, "Next week ›", "ww-btn", () => this.show(nextWeek(w.week)));
		if (isLatest) next.disabled = true;
		this.button(nav, "Open note", "ww-btn mod-cta", () => this.plugin.openNote(w.week));

		const stats = page.createDiv({ cls: "ww-stats" });
		for (const s of c.stats) {
			const card = stats.createDiv({ cls: "ww-card ww-stat" });
			card.createDiv({ cls: "ww-stat-value", text: s.value });
			card.createDiv({ cls: "ww-stat-label", text: s.label });
		}

		const strip = page.createDiv({ cls: "ww-card" });
		strip.createDiv({ cls: "ww-card-title", text: "Your week, day by day" });
		const days = strip.createDiv({ cls: "ww-days" });
		for (const d of c.days) {
			const cell = days.createDiv({ cls: "ww-day" + (d.best ? " is-best" : "") });
			cell.createDiv({ cls: "ww-day-name", text: d.best ? `${d.name} ★` : d.name });
			cell.createDiv({ cls: `ww-bar ww-level-${d.level}` });
			cell.createDiv({ cls: "ww-day-detail", text: d.detail });
		}

		if (c.proud.length) {
			const proud = page.createDiv({ cls: "ww-card" });
			proud.createDiv({ cls: "ww-card-title", text: "Proud of" });
			const list = proud.createEl("ul", { cls: "ww-list" });
			for (const t of c.proud) list.createEl("li", { text: t });
			if (c.more > 0) {
				const all = proud.createEl("a", { cls: "ww-more", text: `See all ${w.tasks.length}`, href: "#" });
				all.addEventListener("click", (e) => {
					e.preventDefault();
					list.empty();
					for (const t of [...w.tasks].reverse()) list.createEl("li", { text: t.text });
					all.remove();
				});
			}
		}

		if (c.highlight) {
			const hi = page.createDiv({ cls: "ww-card ww-highlight" });
			hi.createDiv({ cls: "ww-card-title", text: c.highlight.title });
			hi.createDiv({ text: c.highlight.body });
		}
	}

	private button(parent: HTMLElement, text: string, cls: string, onClick: () => void): HTMLButtonElement {
		const b = parent.createEl("button", { cls, text });
		b.addEventListener("click", onClick);
		return b;
	}
}
