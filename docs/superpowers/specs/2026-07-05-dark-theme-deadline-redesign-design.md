# Dark Theme + Deadline Tracking Redesign

**Date:** 2026-07-05
**Status:** Approved

## Context

The Post-Meeting Progress app currently uses a light theme and a single `dataEntrega` field per task that doubles as both "target date" and "completion trigger" (filling it in immediately marks the task `Concluído`). This makes it impossible to know whether a task is overdue. The user wants:

1. A dark theme inspired by a reference dashboard (HorizonHub), keeping the existing top-tab navigation structure.
2. A real deadline field decoupled from completion, so overdue tasks can be tracked.
3. Filter dropdowns in the Tarefas tab labeled Status / Responsável / Prioridade.
4. KPIs for tasks currently overdue and average delay (both real-time and historical).

## 1. Data Model

Each task gains two date fields, replacing the old single-purpose `dataEntrega`:

- `deadline` (string, `YYYY-MM-DD` or `''`) — target date, set at creation or edited inline. Does not affect status by itself.
- `dataEntregue` (string, `YYYY-MM-DD` or `''`) — the real date the task was delivered/executed. Setting this is the only way to mark a task done.

`status` is no longer stored — it's derived on every render:

```
if (dataEntregue) → 'Concluído'
else if (deadline && deadline < today) → 'Atrasada'
else → 'Em Progresso'
```

**Migration:** on load, any task in localStorage with the legacy `dataEntrega` field (and no `deadline`/`dataEntregue`) is migrated once: `dataEntregue = dataEntrega` (since the old behavior meant "filled = done"), `deadline = ''`. The legacy field is dropped after migration. This runs transparently in the load step; no user action needed.

## 2. KPIs (Tarefas tab)

Two rows of cards:

**Row 1 (existing, unchanged):** Total, Em Progresso, Concluídas, Alta Prioridade.

**Row 2 (new):**
- **Atrasadas** — count of tasks currently in `Atrasada` status (real-time).
- **Média de atraso (atual)** — average of `today - deadline` in days, over tasks currently `Atrasada`. Shows `—` if there are none.
- **Média de atraso (histórico)** — average of `max(0, dataEntregue - deadline)` in days, over all `Concluído` tasks that have a `deadline` set. Tasks delivered on time or early count as 0. Shows `—` if no concluded task has a deadline.

## 3. Filters

Each filter `<select>` gets a visible label above it: **Status**, **Responsável**, **Prioridade**. The Status filter gains an `Atrasada` option alongside `Todos / Em Progresso / Atrasada / Concluído`.

## 4. Dark Theme

Navigation structure (top tabs) is unchanged — this is a palette reskin, not a structural redesign. New palette, applied consistently across all 4 tabs, modals, inputs, and the table:

| Token | Value | Usage |
|---|---|---|
| Background | `#0B0E14` | Page background |
| Surface | `#12161F` | Cards, table, modals |
| Border | `#1F2430` | Card/input/table borders |
| Text primary | `#E8EAED` | Headings, body text |
| Text secondary | `#8B93A1` | Labels, muted text |
| Accent | `#FF9500` (unchanged) | CTAs, active tab, highlights |

Status/priority badges (red/green/skyblue, unchanged hues) switch from `/10` to `/15` opacity fills to stay legible on the dark surface. Header keeps a dark navy-to-black tone consistent with the rest of the palette rather than the current bright navy block.

## Out of Scope

- No sidebar navigation (evaluated, explicitly rejected by user — keep tabs).
- No light/dark toggle — dark replaces light as the only theme.
- No changes to the Claude extraction pipeline, PDF export logic, or localStorage keys beyond the task migration described above.
