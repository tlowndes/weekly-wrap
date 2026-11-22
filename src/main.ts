import { App, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { localDay } from "./core/dates";
import { check, dueWeek, EMPTY_NUDGE, NudgeState } from "./core/nudge";
import { FLIGHT_DECK, gatherExtras, Sources } from "./core/sources";
import { newNote, updateNote } from "./core/note";
import { weekFor, Week } from "./core/week";
import { buildWrap, NoteInfo, Wrap } from "./core/wrap";
import { VIEW_TYPE, WrapView } from "./view";

interface WrapSettings {
	folder: string;
	wrapDay: number;
	ignore: string;
	countUndated: boolean;
	taskFilter: string;
	nudge: boolean;
	nudgeHour: number;
	/** Day the plugin first ran: older weeks are never nudged. */
	installed: string;
	nudgeState: NudgeState;
	sources: Sources;
}

const DEFAULTS: WrapSettings = {
	folder: "Wraps",
	wrapDay: 5,
	ignore: "Templates",
	countUndated: false,
	taskFilter: "",
	nudge: true,
	nudgeHour: 15,
	installed: "",
	nudgeState: { ...EMPTY_NUDGE },
	sources: FLIGHT_DECK,
};

/** How often the nudge is re-checked while Obsidian stays open, so it appears when the time passes. */
const CHECK_EVERY_MS = 10 * 60 * 1000;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default class WeeklyWrapPlugin extends Plugin {
	settings: WrapSettings = { ...DEFAULTS };
	private ribbon: HTMLElement | null = null;
	private notice: Notice | null = null;

	async onload() {
		await this.loadSettings();
		if (!this.settings.installed) {
			this.settings.installed = localDay(Date.now());
			await this.saveSettings();
		}
		this.registerView(VIEW_TYPE, (leaf) => new WrapView(leaf, this));
		this.ribbon = this.addRibbonIcon("calendar-check", "Open this week's wrap", () => this.openWrap(this.lastWeek()));
		this.ribbon.addClass("ww-ribbon");
		this.addCommand({ id: "open-last-week", name: "Open the latest wrap", callback: () => this.openWrap(this.lastWeek()) });
		this.addCommand({
			id: "open-this-week",
			name: "Open this week so far",
			callback: () => this.openWrap(weekFor(localDay(Date.now()), this.settings.wrapDay, true)),
		});
		this.addSettingTab(new WrapSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => this.checkNudge());
		this.registerInterval(window.setInterval(() => this.checkNudge(), CHECK_EVERY_MS));
	}

	onunload() {
		this.notice?.hide();
	}

	/** The latest finished week: on the wrap day it switches over at the nudge time. */
	lastWeek(): Week {
		const now = new Date();
		return dueWeek(localDay(now.getTime()), now.getHours(), this.settings.wrapDay, this.settings.nudgeHour);
	}

	/** Shows the "Your week's wrapped" notice when a new wrap is due, and keeps the ribbon dot in step. */
	checkNudge() {
		const s = this.settings;
		const now = new Date();
		const c = check(s.nudgeState, localDay(now.getTime()), now.getHours(), {
			wrapDay: s.wrapDay,
			fromHour: s.nudgeHour,
			enabled: s.nudge,
			installed: s.installed,
		});
		this.ribbon?.toggleClass("ww-has-wrap", c.dot);
		if (!c.notice || this.notice) return;
		s.nudgeState = { ...s.nudgeState, lastNudged: c.week.label };
		void this.saveSettings();
		this.showNotice(c.week);
	}

	private showNotice(week: Week) {
		const frag = createFragment((f) => {
			const box = f.createDiv({ cls: "ww-notice" });
			box.createDiv({ cls: "ww-notice-title", text: "Your week's wrapped" });
			box.createDiv({ text: "Have a look at what you got done." });
			const row = box.createDiv({ cls: "ww-notice-actions" });
			const look = row.createEl("button", { cls: "mod-cta", text: "Have a look" });
			const later = row.createEl("button", { text: "Later" });
			look.addEventListener("click", (e) => {
				e.stopPropagation();
				this.dismissNotice();
				void this.openWrap(week);
			});
			later.addEventListener("click", (e) => {
				e.stopPropagation();
				this.dismissNotice();
			});
		});
		this.notice = new Notice(frag, 0);
	}

	private dismissNotice() {
		this.notice?.hide();
		this.notice = null;
	}

	/** Called when a week is shown: opening the due week clears the dot and any notice. */
	async markOpened(week: Week) {
		if (week.label !== this.lastWeek().label || this.settings.nudgeState.lastOpened === week.label) return;
		this.settings.nudgeState = { lastOpened: week.label, lastNudged: week.label };
		await this.saveSettings();
		this.dismissNotice();
		this.checkNudge();
	}

	private folder(): string {
		return normalizePath(this.settings.folder || DEFAULTS.folder);
	}

	notePath(week: Week): string {
		return normalizePath(`${this.folder()}/${week.label}.md`);
	}

	/** Shows [week] in the card view, reusing an open Weekly Wrap tab if there is one. */
	async openWrap(week: Week) {
		const { workspace } = this.app;
		const leaf = workspace.getLeavesOfType(VIEW_TYPE)[0] ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { to: week.to } });
		workspace.revealLeaf(leaf);
	}

	/** Opens [week]'s saved note, building it first if it isn't there yet. */
	async openNote(week: Week) {
		try {
			let file = this.app.vault.getAbstractFileByPath(this.notePath(week));
			if (!(file instanceof TFile)) {
				await this.buildAndSave(week);
				file = this.app.vault.getAbstractFileByPath(this.notePath(week));
			}
			if (file instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(file);
		} catch (e) {
			console.error("Weekly Wrap", e);
			new Notice("Weekly Wrap couldn't open this week's note. Details are in the developer console.");
		}
	}

	/** Builds [week]'s wrap and saves it as a note, keeping anything the user wrote. */
	async buildAndSave(week: Week): Promise<Wrap> {
		const vault = this.app.vault;
		const folder = this.folder();
		const ignore = [folder, ...this.settings.ignore.split(",").map((s) => s.trim()).filter(Boolean)];
		const notes: NoteInfo[] = vault.getMarkdownFiles().map((f) => ({ path: f.path, ctime: f.stat.ctime, mtime: f.stat.mtime }));
		const read = async (path: string) => {
			const f = vault.getAbstractFileByPath(path);
			if (!(f instanceof TFile)) throw new Error("gone");
			return vault.cachedRead(f);
		};
		const wrap = await buildWrap(
			notes,
			read,
			week,
			{ ignore, countUndated: this.settings.countUndated, taskFilter: this.settings.taskFilter.trim() },
		);
		wrap.extras = await gatherExtras({ notes, read }, week, this.settings.sources, localDay);

		if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
		const path = this.notePath(week);
		const existing = vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await vault.process(existing, (text) => updateNote(text, wrap));
		else await vault.create(path, newNote(wrap));
		return wrap;
	}

	async loadSettings() {
		const data = (await this.loadData()) ?? {};
		const sources = { ...FLIGHT_DECK } as Sources;
		for (const k of Object.keys(FLIGHT_DECK) as (keyof Sources)[]) sources[k] = { ...FLIGHT_DECK[k], ...(data.sources?.[k] ?? {}) };
		this.settings = { ...DEFAULTS, ...data, nudgeState: { ...EMPTY_NUDGE, ...(data.nudgeState ?? {}) }, sources };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WrapSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: WeeklyWrapPlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		containerEl.empty();

		new Setting(containerEl)
			.setName("Wrap day")
			.setDesc("The last day of your week. The wrap covers the 7 days up to and including it.")
			.addDropdown((d) => {
				DAYS.forEach((name, i) => d.addOption(String(i), name));
				d.setValue(String(s.wrapDay)).onChange(async (v) => {
					s.wrapDay = Number(v);
					await save();
				});
			});

		new Setting(containerEl)
			.setName("Friday nudge")
			.setDesc("A small notice when your wrap is ready. Nothing opens by itself.")
			.addToggle((t) =>
				t.setValue(s.nudge).onChange(async (v) => {
					s.nudge = v;
					await save();
					this.plugin.checkNudge();
				}),
			);

		new Setting(containerEl)
			.setName("Nudge from")
			.setDesc("The time on your wrap day when the wrap is ready.")
			.addDropdown((d) => {
				for (let h = 6; h <= 22; h++) d.addOption(String(h), `${String(h).padStart(2, "0")}:00`);
				d.setValue(String(s.nudgeHour)).onChange(async (v) => {
					s.nudgeHour = Number(v);
					await save();
					this.plugin.checkNudge();
				});
			});

		new Setting(containerEl)
			.setName("Wrap folder")
			.setDesc("Where each week's note is saved, named like 2026-W47.")
			.addText((t) =>
				t.setPlaceholder(DEFAULTS.folder).setValue(s.folder).onChange(async (v) => {
					s.folder = v.trim();
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Folders to leave out")
			.setDesc("Comma separated. Ticks and edits in these folders aren't counted.")
			.addText((t) =>
				t.setPlaceholder("Templates, Archive").setValue(s.ignore).onChange(async (v) => {
					s.ignore = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Task filter")
			.setDesc("Only count ticked tasks containing this, such as #task. Leave blank to count every tick.")
			.addText((t) =>
				t.setPlaceholder("#task").setValue(s.taskFilter).onChange(async (v) => {
					s.taskFilter = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Count ticks without a done date")
			.setDesc("Counts a tick with no ✅ date on the day its note was last edited. Can over-count if you edit old notes.")
			.addToggle((t) =>
				t.setValue(s.countUndated).onChange(async (v) => {
					s.countUndated = v;
					await save();
				}),
			);

		new Setting(containerEl).setName("Flight Deck sources").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Extra counts read from Flight Deck's notes, or any notes written the same way. Each one is skipped when its note or folder isn't there.",
		});
		const labels: Record<keyof Sources, [string, string]> = {
			focus: ["Focus log", "Note of focus sessions"],
			habits: ["Habits and mood", "Note with the habits log"],
			didI: ["Did I? checks", "Folder of daily Did I? notes"],
			jobs: ["Job applications", "Folder of application notes with an applied date"],
			captures: ["Captures", "Inbox folder: new notes here count as captures"],
		};
		for (const key of Object.keys(labels) as (keyof Sources)[]) {
			const src = s.sources[key];
			const [name, what] = labels[key];
			const found = () => (this.app.vault.getAbstractFileByPath(normalizePath(src.path)) ? "found" : "not found");
			const setting = new Setting(containerEl).setName(name).setDesc(`${what}. ${found()}.`);
			setting.addText((t) =>
				t.setValue(src.path).onChange(async (v) => {
					src.path = v.trim();
					setting.setDesc(`${what}. ${found()}.`);
					await save();
				}),
			);
			setting.addToggle((t) =>
				t.setValue(src.on).onChange(async (v) => {
					src.on = v;
					await save();
				}),
			);
		}
	}
}
