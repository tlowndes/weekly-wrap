import { App, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { localDay } from "./core/dates";
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
}

const DEFAULTS: WrapSettings = {
	folder: "Wraps",
	wrapDay: 5,
	ignore: "Templates",
	countUndated: false,
	taskFilter: "",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default class WeeklyWrapPlugin extends Plugin {
	settings: WrapSettings = { ...DEFAULTS };

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new WrapView(leaf, this));
		this.addRibbonIcon("calendar-check", "Open this week's wrap", () => this.openWrap(this.lastWeek()));
		this.addCommand({ id: "open-last-week", name: "Open the latest wrap", callback: () => this.openWrap(this.lastWeek()) });
		this.addCommand({
			id: "open-this-week",
			name: "Open this week so far",
			callback: () => this.openWrap(weekFor(localDay(Date.now()), this.settings.wrapDay, true)),
		});
		this.addSettingTab(new WrapSettingTab(this.app, this));
	}

	lastWeek(): Week {
		return weekFor(localDay(Date.now()), this.settings.wrapDay);
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
		const wrap = await buildWrap(
			notes,
			async (path) => {
				const f = vault.getAbstractFileByPath(path);
				if (!(f instanceof TFile)) throw new Error("gone");
				return vault.cachedRead(f);
			},
			week,
			{ ignore, countUndated: this.settings.countUndated, taskFilter: this.settings.taskFilter.trim() },
		);

		if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
		const path = this.notePath(week);
		const existing = vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await vault.process(existing, (text) => updateNote(text, wrap));
		else await vault.create(path, newNote(wrap));
		return wrap;
	}

	async loadSettings() {
		this.settings = { ...DEFAULTS, ...(await this.loadData()) };
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
	}
}
