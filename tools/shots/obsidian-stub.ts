// A tiny stand-in for the obsidian module, just enough to draw the card view in a plain browser for README screenshots.
type Opts = { cls?: string; text?: string; href?: string };

function make(this: HTMLElement, tag: string, o: Opts = {}): HTMLElement {
	const el = document.createElement(tag);
	if (o.cls) el.className = o.cls;
	if (o.text) el.textContent = o.text;
	if (o.href) el.setAttribute("href", o.href);
	this.appendChild(el);
	return el;
}

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
proto.createEl = make;
proto.createDiv = function (this: HTMLElement, o?: Opts) {
	return make.call(this, "div", o);
};
proto.empty = function (this: HTMLElement) {
	this.replaceChildren();
};
proto.addClass = function (this: HTMLElement, c: string) {
	this.classList.add(c);
};

export class ItemView {
	contentEl: HTMLElement;
	constructor(public leaf: unknown) {
		this.contentEl = document.getElementById("root")!;
	}
	async setState() {}
}
export type WorkspaceLeaf = unknown;
