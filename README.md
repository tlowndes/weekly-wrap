# Weekly Wrap

Every Friday, a page of what you actually did this week. Built for the "I did nothing" feeling.

Weekly Wrap reads your vault and writes a note listing what you got done: tasks you ticked, notes you made and edited, and your best day. It only looks back, and it only counts what went right.

## What it counts

- **Ticked tasks** with a Tasks plugin done date (`✅ 2026-11-20`), anywhere in your vault.
- **Notes** you created or edited that week.

### Flight Deck extras

If your vault has [Flight Deck](https://github.com/tlowndes/ObsidianCapture)'s notes, or notes written the same way, the wrap adds:

- **Focus**: sessions and time from `99 - Meta/Focus log.md` (`- 2026-11-20 14:05 · Task · 45 min`).
- **Habits, water and mood**: from the `## Log` table in `99 - Meta/Habits.md`.
- **Did I? checks**: from the daily notes in `99 - Meta/Did I/`.
- **Job applications**: notes in `02 - Area/Work/Job Hunt/Applications` with an `applied:` date.
- **Captures**: new notes in `01 - Inbox`.

Each path can be changed or switched off in settings, and anything not found is simply left out.

## Use it

- Click the calendar tick icon in the ribbon, or run **Weekly Wrap: Open the latest wrap**. Your week opens as cards: a headline, your counts, a day-by-day strip, what you're proud of and your best day.
- **Last week** and **Next week** step through earlier wraps. **Open this week so far** shows the week in progress.
- Each wrap you open is also saved as a note, `Wraps/2026-W47.md`, so the record stays in your vault. **Open note** takes you there. Write anything you like under **Worth keeping**: re-running the week updates the counts and leaves your words alone.

## The Friday nudge

From 3 pm on your wrap day, a small notice says your week's wrapped, with **Have a look** and **Later**. Nothing opens by itself. Until you open it, a dot sits on the ribbon icon. Missed Friday? It nudges the next time you open Obsidian.

## Settings

| Setting | Default |
| --- | --- |
| Wrap day | Friday |
| Friday nudge | On |
| Nudge from | 15:00 |
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
