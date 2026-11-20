# Weekly Wrap

Every Friday, a page of what you actually did this week. Built for the "I did nothing" feeling.

Weekly Wrap reads your vault and writes a note listing what you got done: tasks you ticked, notes you made and edited, and your best day. It only looks back, and it only counts what went right.

## What it counts

- **Ticked tasks** with a Tasks plugin done date (`✅ 2026-11-20`), anywhere in your vault.
- **Notes** you created or edited that week.

More is on the way: a card view, a Friday nudge, and extra sections for Focus logs, habits and mood.

## Use it

- Click the calendar tick icon in the ribbon, or run **Weekly Wrap: Open the latest wrap**.
- **Open this week so far** shows the week in progress.
- Each wrap is saved as `Wraps/2026-W47.md`. Write anything you like under **Worth keeping**: re-running the week updates the counts and leaves your words alone.

## Settings

| Setting | Default |
| --- | --- |
| Wrap day | Friday |
| Wrap folder | `Wraps` |
| Folders to leave out | `Templates` |
| Task filter | blank (every tick counts) |
| Count ticks without a done date | Off |

Everything stays in your vault. Weekly Wrap makes no network calls.

## Develop

```
npm install
npm test        # unit tests for the counting and the note
npm run build   # main.js for .obsidian/plugins/weekly-wrap/
```
