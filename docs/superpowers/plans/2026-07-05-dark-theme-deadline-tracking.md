# Dark Theme + Deadline Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deadline/delivery-date tracking with derived task status, overdue KPIs, labeled filters, and a full dark theme reskin to the Post-Meeting Progress app, per the approved spec at `docs/superpowers/specs/2026-07-05-dark-theme-deadline-redesign-design.md`.

**Architecture:** Extract pure, unit-testable logic (status derivation, legacy-data migration, overdue metrics) into two new modules under `lib/`. Wire that logic into the existing single-file `pages/index.js` component (no structural refactor — the file stays one component per current codebase convention). Apply the dark palette as a final, isolated reskin pass across the same file once the functional changes are in place.

**Tech Stack:** Next.js 14 (pages router), React 18, Tailwind CSS 3, Vitest (new — for the pure logic modules only).

## Global Constraints

- Keep the existing top-tab navigation structure — no sidebar (per spec, explicitly rejected).
- Dark theme fully replaces the light theme — no light/dark toggle.
- No changes to the Claude extraction pipeline (`pages/api/process-transcription.ts`), PDF export structure, or localStorage keys, beyond the one-time task field migration described in Task 3.
- Dark palette tokens (exact values, added as Tailwind colors): `canvas #0B0E14` (page bg), `panel #12161F` (cards/surfaces), `edge #1F2430` (borders), `ink #E8EAED` (primary text), `muted #8B93A1` (secondary text). Existing brand colors (`navy`, `orange #FF9500`, `skyblue`, `green`, `red`) are unchanged.
- Status/priority badges move from `/10` to `/15` background opacity in the dark pass.
- Pure logic (status derivation, migration, metrics math) gets Vitest unit tests — this is new functionality, not a light restyle. UI wiring and the visual reskin are verified by `npm run build` (compiles clean) plus manual browser verification (no jsdom/RTL setup is introduced — it would be disproportionate to the size of this change).

---

### Task 1: Status derivation + legacy migration (`lib/taskStatus.js`)

**Files:**
- Create: `lib/taskStatus.js`
- Create: `lib/taskStatus.test.js`
- Create: `vitest.config.js`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Produces: `daysBetween(fromDateStr, toDateStr) -> number`, `deriveStatus(task, todayStr) -> 'Concluído' | 'Atrasada' | 'Em Progresso'`, `migrateLegacyTask(task) -> task`. `task` shape consumed: `{ deadline?: string, dataEntregue?: string, dataEntrega?: string, status?: string, ...rest }`. Date strings are `YYYY-MM-DD`.
- Consumed by: Task 2 (`daysBetween`, `deriveStatus`) and Task 3 (`deriveStatus`, `migrateLegacyTask` wired into `pages/index.js`).

- [ ] **Step 1: Add Vitest to the project**

Edit `package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
```

Add to `"devDependencies"`:

```json
    "vitest": "^1.6.0",
```

Run: `npm install`
Expected: install completes with no errors.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Write the failing tests**

Create `lib/taskStatus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { daysBetween, deriveStatus, migrateLegacyTask } from './taskStatus';

describe('daysBetween', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetween('2026-07-05', '2026-07-05')).toBe(0);
  });

  it('returns positive days when "to" is after "from"', () => {
    expect(daysBetween('2026-07-01', '2026-07-05')).toBe(4);
  });

  it('returns negative days when "to" is before "from"', () => {
    expect(daysBetween('2026-07-05', '2026-07-01')).toBe(-4);
  });
});

describe('deriveStatus', () => {
  it('returns Concluído when dataEntregue is set, regardless of deadline', () => {
    const task = { deadline: '2026-01-01', dataEntregue: '2026-07-05' };
    expect(deriveStatus(task, '2026-07-10')).toBe('Concluído');
  });

  it('returns Atrasada when deadline is before today and not delivered', () => {
    const task = { deadline: '2026-07-01', dataEntregue: '' };
    expect(deriveStatus(task, '2026-07-05')).toBe('Atrasada');
  });

  it('returns Em Progresso when deadline is today', () => {
    const task = { deadline: '2026-07-05', dataEntregue: '' };
    expect(deriveStatus(task, '2026-07-05')).toBe('Em Progresso');
  });

  it('returns Em Progresso when deadline is in the future', () => {
    const task = { deadline: '2026-07-10', dataEntregue: '' };
    expect(deriveStatus(task, '2026-07-05')).toBe('Em Progresso');
  });

  it('returns Em Progresso when there is no deadline', () => {
    const task = { deadline: '', dataEntregue: '' };
    expect(deriveStatus(task, '2026-07-05')).toBe('Em Progresso');
  });
});

describe('migrateLegacyTask', () => {
  it('converts a legacy completed task (dataEntrega filled) into dataEntregue', () => {
    const legacy = { id: '1', descricao: 'x', dataEntrega: '2026-06-01', status: 'Concluído' };
    expect(migrateLegacyTask(legacy)).toEqual({
      id: '1',
      descricao: 'x',
      deadline: '',
      dataEntregue: '2026-06-01',
    });
  });

  it('converts a legacy in-progress task (dataEntrega empty) into empty dataEntregue', () => {
    const legacy = { id: '2', descricao: 'y', dataEntrega: '', status: 'Em Progresso' };
    expect(migrateLegacyTask(legacy)).toEqual({
      id: '2',
      descricao: 'y',
      deadline: '',
      dataEntregue: '',
    });
  });

  it('leaves an already-migrated task unchanged', () => {
    const modern = { id: '3', descricao: 'z', deadline: '2026-08-01', dataEntregue: '' };
    expect(migrateLegacyTask(modern)).toEqual(modern);
  });
});
```

- [ ] **Step 4: Run tests, verify they fail**

Run: `npx vitest run lib/taskStatus.test.js`
Expected: FAIL — `Cannot find module './taskStatus'`.

- [ ] **Step 5: Implement `lib/taskStatus.js`**

```js
export function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(`${fromDateStr}T00:00:00`);
  const to = new Date(`${toDateStr}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to - from) / msPerDay);
}

export function deriveStatus(task, today) {
  if (task.dataEntregue) return 'Concluído';
  if (task.deadline && task.deadline < today) return 'Atrasada';
  return 'Em Progresso';
}

export function migrateLegacyTask(task) {
  if (task.deadline !== undefined || task.dataEntregue !== undefined) {
    return task;
  }
  const { dataEntrega, status, ...rest } = task;
  return {
    ...rest,
    deadline: '',
    dataEntregue: dataEntrega || '',
  };
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run lib/taskStatus.test.js`
Expected: PASS — 8 tests passing.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js lib/taskStatus.js lib/taskStatus.test.js
git commit -m "feat: add task status derivation and legacy migration logic"
```

---

### Task 2: Overdue metrics (`lib/taskMetrics.js`)

**Files:**
- Create: `lib/taskMetrics.js`
- Create: `lib/taskMetrics.test.js`

**Interfaces:**
- Consumes: `daysBetween`, `deriveStatus` from `lib/taskStatus.js` (Task 1).
- Produces: `countOverdue(tasks, todayStr) -> number`, `avgCurrentDelay(tasks, todayStr) -> number | null`, `avgHistoricalDelay(tasks) -> number | null`. Consumed by Task 4 (`pages/index.js` KPI wiring).

- [ ] **Step 1: Write the failing tests**

Create `lib/taskMetrics.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { countOverdue, avgCurrentDelay, avgHistoricalDelay } from './taskMetrics';

const today = '2026-07-05';

describe('countOverdue', () => {
  it('counts only tasks that are currently overdue', () => {
    const tasks = [
      { deadline: '2026-07-01', dataEntregue: '' },
      { deadline: '2026-07-10', dataEntregue: '' },
      { deadline: '2026-06-01', dataEntregue: '2026-06-20' },
    ];
    expect(countOverdue(tasks, today)).toBe(1);
  });

  it('returns 0 when there are no tasks', () => {
    expect(countOverdue([], today)).toBe(0);
  });
});

describe('avgCurrentDelay', () => {
  it('averages days late across currently overdue tasks', () => {
    const tasks = [
      { deadline: '2026-07-01', dataEntregue: '' },
      { deadline: '2026-06-29', dataEntregue: '' },
    ];
    expect(avgCurrentDelay(tasks, today)).toBe(5);
  });

  it('returns null when there are no overdue tasks', () => {
    const tasks = [{ deadline: '2026-07-10', dataEntregue: '' }];
    expect(avgCurrentDelay(tasks, today)).toBeNull();
  });
});

describe('avgHistoricalDelay', () => {
  it('averages delivery delay across completed tasks with a deadline, counting on-time as 0', () => {
    const tasks = [
      { deadline: '2026-06-01', dataEntregue: '2026-06-05' },
      { deadline: '2026-06-01', dataEntregue: '2026-05-30' },
    ];
    expect(avgHistoricalDelay(tasks)).toBe(2);
  });

  it('ignores completed tasks with no deadline set', () => {
    const tasks = [{ deadline: '', dataEntregue: '2026-06-05' }];
    expect(avgHistoricalDelay(tasks)).toBeNull();
  });

  it('returns null when there are no completed tasks with a deadline', () => {
    expect(avgHistoricalDelay([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/taskMetrics.test.js`
Expected: FAIL — `Cannot find module './taskMetrics'`.

- [ ] **Step 3: Implement `lib/taskMetrics.js`**

```js
import { daysBetween, deriveStatus } from './taskStatus';

export function countOverdue(tasks, today) {
  return tasks.filter((t) => deriveStatus(t, today) === 'Atrasada').length;
}

export function avgCurrentDelay(tasks, today) {
  const overdue = tasks.filter((t) => deriveStatus(t, today) === 'Atrasada');
  if (overdue.length === 0) return null;
  const total = overdue.reduce((sum, t) => sum + daysBetween(t.deadline, today), 0);
  return total / overdue.length;
}

export function avgHistoricalDelay(tasks) {
  const eligible = tasks.filter((t) => t.dataEntregue && t.deadline);
  if (eligible.length === 0) return null;
  const total = eligible.reduce(
    (sum, t) => sum + Math.max(0, daysBetween(t.deadline, t.dataEntregue)),
    0
  );
  return total / eligible.length;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/taskMetrics.test.js`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/taskMetrics.js lib/taskMetrics.test.js
git commit -m "feat: add overdue task metrics"
```

---

### Task 3: Wire deadline/dataEntregue into the task data model

**Files:**
- Modify: `pages/index.js`

**Interfaces:**
- Consumes: `deriveStatus`, `migrateLegacyTask` from `lib/taskStatus.js`.
- Produces: task objects shaped `{ id, descricao, responsavel, prioridade, deadline, dataEntregue, dataReuniao, horaReuniao }` (no more stored `status` or `dataEntrega`). A `today` string (`YYYY-MM-DD`) available in the component body, consumed by Task 4.

- [ ] **Step 1: Import the new lib functions**

Find (`pages/index.js` line 1-3):

```js
import { useEffect, useState } from 'react';
import { Trash2, Plus, X, Download } from 'lucide-react';
import jsPDF from 'jspdf';
```

Replace with:

```js
import { useEffect, useState } from 'react';
import { Trash2, Plus, X, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { deriveStatus, migrateLegacyTask } from '../lib/taskStatus';
```

- [ ] **Step 2: Add a `statusBadgeClass` helper next to `priorityBadgeClass`**

Find:

```js
function priorityBadgeClass(p) {
  if (p === 'Alta') return 'bg-red/10 text-red';
  if (p === 'Baixa') return 'bg-green/10 text-green';
  return 'bg-orange/10 text-orange';
}
```

Replace with:

```js
function priorityBadgeClass(p) {
  if (p === 'Alta') return 'bg-red/10 text-red';
  if (p === 'Baixa') return 'bg-green/10 text-green';
  return 'bg-orange/10 text-orange';
}

function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/10 text-green';
  if (status === 'Atrasada') return 'bg-red/10 text-red';
  return 'bg-skyblue/10 text-skyblue';
}
```

- [ ] **Step 3: Migrate legacy tasks on load**

Find:

```js
  useEffect(() => {
    setTasks(loadFromStorage('tasks', []));
    setCombinados(loadFromStorage('combinados', []));
    setInsights(loadFromStorage('insights', []));
    setHydrated(true);
  }, []);
```

Replace with:

```js
  useEffect(() => {
    setTasks(loadFromStorage('tasks', []).map(migrateLegacyTask));
    setCombinados(loadFromStorage('combinados', []));
    setInsights(loadFromStorage('insights', []));
    setHydrated(true);
  }, []);
```

- [ ] **Step 4: Replace `dataEntrega` with `deadline` in the new-task form state**

Find:

```js
  const [newTask, setNewTask] = useState({
    descricao: '',
    responsavel: '',
    prioridade: 'Média',
    dataEntrega: '',
  });
```

Replace with:

```js
  const [newTask, setNewTask] = useState({
    descricao: '',
    responsavel: '',
    prioridade: 'Média',
    deadline: '',
  });
```

- [ ] **Step 5: Stop storing `status`/`dataEntrega` when tasks are created from a processed transcription**

Find:

```js
    const newTasks = previewData.tarefas.map((t) => ({
      id: uid(),
      descricao: t.descricao,
      responsavel: t.responsavel,
      prioridade: t.prioridade,
      dataEntrega: '',
      status: 'Em Progresso',
      ...meta,
    }));
```

Replace with:

```js
    const newTasks = previewData.tarefas.map((t) => ({
      id: uid(),
      descricao: t.descricao,
      responsavel: t.responsavel,
      prioridade: t.prioridade,
      deadline: '',
      dataEntregue: '',
      ...meta,
    }));
```

- [ ] **Step 6: Replace the single `updateTaskDeadline` with two separate updaters**

Find:

```js
  function updateTaskDeadline(id, date) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, dataEntrega: date, status: date ? 'Concluído' : 'Em Progresso' } : t
      )
    );
  }
```

Replace with:

```js
  function updateTaskDeadlineField(id, date) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deadline: date } : t)));
  }

  function updateTaskDataEntregue(id, date) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, dataEntregue: date } : t)));
  }
```

- [ ] **Step 7: Update manual task creation**

Find:

```js
  function handleCreateTask() {
    if (!newTask.descricao || newTask.descricao.trim().length === 0) {
      alert('Descrição é obrigatória');
      return;
    }
    const now = new Date();
    const task = {
      id: uid(),
      descricao: newTask.descricao.trim(),
      responsavel: newTask.responsavel.trim() || 'Não especificado',
      prioridade: newTask.prioridade,
      dataEntrega: newTask.dataEntrega,
      status: newTask.dataEntrega ? 'Concluído' : 'Em Progresso',
      dataReuniao: now.toLocaleDateString('pt-BR'),
      horaReuniao: now.toTimeString().slice(0, 5),
    };
    setTasks((prev) => [...prev, task]);
    setNewTask({ descricao: '', responsavel: '', prioridade: 'Média', dataEntrega: '' });
    setShowCreateModal(false);
  }
```

Replace with:

```js
  function handleCreateTask() {
    if (!newTask.descricao || newTask.descricao.trim().length === 0) {
      alert('Descrição é obrigatória');
      return;
    }
    const now = new Date();
    const task = {
      id: uid(),
      descricao: newTask.descricao.trim(),
      responsavel: newTask.responsavel.trim() || 'Não especificado',
      prioridade: newTask.prioridade,
      deadline: newTask.deadline,
      dataEntregue: '',
      dataReuniao: now.toLocaleDateString('pt-BR'),
      horaReuniao: now.toTimeString().slice(0, 5),
    };
    setTasks((prev) => [...prev, task]);
    setNewTask({ descricao: '', responsavel: '', prioridade: 'Média', deadline: '' });
    setShowCreateModal(false);
  }
```

- [ ] **Step 8: Add a `today` constant and use derived status in filtering/KPIs**

Find:

```js
  const responsaveis = Array.from(new Set(tasks.map((t) => t.responsavel))).filter(Boolean);

  const filteredTasks = tasks.filter((t) => {
    if (filters.status !== 'Todos' && t.status !== filters.status) return false;
    if (filters.responsavel !== 'Todos' && t.responsavel !== filters.responsavel) return false;
    if (filters.prioridade !== 'Todos' && t.prioridade !== filters.prioridade) return false;
    if (filters.search && !t.descricao.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const kpis = {
    total: tasks.length,
    concluidas: tasks.filter((t) => t.status === 'Concluído').length,
    emProgresso: tasks.filter((t) => t.status === 'Em Progresso').length,
    altaPrioridade: tasks.filter((t) => t.prioridade === 'Alta').length,
  };
```

Replace with:

```js
  const today = new Date().toISOString().slice(0, 10);

  const responsaveis = Array.from(new Set(tasks.map((t) => t.responsavel))).filter(Boolean);

  const filteredTasks = tasks.filter((t) => {
    const status = deriveStatus(t, today);
    if (filters.status !== 'Todos' && status !== filters.status) return false;
    if (filters.responsavel !== 'Todos' && t.responsavel !== filters.responsavel) return false;
    if (filters.prioridade !== 'Todos' && t.prioridade !== filters.prioridade) return false;
    if (filters.search && !t.descricao.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const kpis = {
    total: tasks.length,
    concluidas: tasks.filter((t) => deriveStatus(t, today) === 'Concluído').length,
    emProgresso: tasks.filter((t) => deriveStatus(t, today) === 'Em Progresso').length,
    altaPrioridade: tasks.filter((t) => t.prioridade === 'Alta').length,
  };
```

- [ ] **Step 9: Use derived status in the PDF export**

Find:

```js
      doc.text(
        `Responsável: ${t.responsavel} | Prioridade: ${t.prioridade} | Status: ${t.status}`,
        18,
        y
      );
```

Replace with:

```js
      doc.text(
        `Responsável: ${t.responsavel} | Prioridade: ${t.prioridade} | Status: ${deriveStatus(t, today)}`,
        18,
        y
      );
```

- [ ] **Step 10: Add the "Atrasada" option to the status filter**

Find:

```js
            <option>Todos</option>
            <option>Em Progresso</option>
            <option>Concluído</option>
          </select>
          <select
            value={filters.responsavel}
```

Replace with:

```js
            <option>Todos</option>
            <option>Em Progresso</option>
            <option>Atrasada</option>
            <option>Concluído</option>
          </select>
          <select
            value={filters.responsavel}
```

- [ ] **Step 11: Split the table's "Entrega" column into "Deadline" and "Data Entregue"**

Find:

```jsx
              <tr className="text-left text-navy border-b border-gray-200">
                <th className="p-3">Descrição</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Entrega</th>
                <th className="p-3"></th>
              </tr>
```

Replace with:

```jsx
              <tr className="text-left text-navy border-b border-gray-200">
                <th className="p-3">Descrição</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Data Entregue</th>
                <th className="p-3"></th>
              </tr>
```

- [ ] **Step 12: Use derived status in the status badge cell**

Find:

```jsx
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        t.status === 'Concluído' ? 'bg-green/10 text-green' : 'bg-skyblue/10 text-skyblue'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <label className="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
                      Entrega:
                      <input
                        type="date"
                        value={t.dataEntrega || ''}
                        onChange={(e) => updateTaskDeadline(t.id, e.target.value)}
                        className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    </label>
                  </td>
```

Replace with:

```jsx
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                        deriveStatus(t, today)
                      )}`}
                    >
                      {deriveStatus(t, today)}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.deadline || ''}
                      onChange={(e) => updateTaskDeadlineField(t.id, e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.dataEntregue || ''}
                      onChange={(e) => updateTaskDataEntregue(t.id, e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
```

- [ ] **Step 13: Update the empty-state colSpan (6 columns → 7)**

Find:

```jsx
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              )}
```

Replace with:

```jsx
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              )}
```

- [ ] **Step 14: Use `deadline` in the create-activity modal's date input**

Find:

```jsx
            <input
              type="date"
              value={newTask.dataEntrega}
              onChange={(e) => setNewTask((n) => ({ ...n, dataEntrega: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
```

Replace with:

```jsx
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((n) => ({ ...n, deadline: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
```

- [ ] **Step 15: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no type/compile errors.

- [ ] **Step 16: Manual verification in the browser**

Start the dev server, go to the Tarefas tab, create a task with a Deadline in the past and no Data Entregue — confirm the Status badge shows "Atrasada" (red). Fill in Data Entregue — confirm it flips to "Concluído" (green). Reload the page — confirm the task's status is unchanged (localStorage round-trip) and that a task created before this change (if any exists from prior testing) still shows correctly after migration.

- [ ] **Step 17: Commit**

```bash
git add pages/index.js
git commit -m "feat: decouple deadline from delivery date, derive task status"
```

---

### Task 4: Overdue KPIs

**Files:**
- Modify: `pages/index.js`

**Interfaces:**
- Consumes: `countOverdue`, `avgCurrentDelay`, `avgHistoricalDelay` from `lib/taskMetrics.js` (Task 2); `today`, `kpis` from Task 3.
- Produces: `kpis.atrasadas`, `kpis.mediaAtrasoAtual`, `kpis.mediaAtrasoHistorico` fields, rendered as a second KPI card row.

- [ ] **Step 1: Import the metrics functions**

Find:

```js
import { deriveStatus, migrateLegacyTask } from '../lib/taskStatus';
```

Replace with:

```js
import { deriveStatus, migrateLegacyTask } from '../lib/taskStatus';
import { countOverdue, avgCurrentDelay, avgHistoricalDelay } from '../lib/taskMetrics';
```

- [ ] **Step 2: Add a `formatDays` display helper next to `statusBadgeClass`**

Find:

```js
function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/10 text-green';
  if (status === 'Atrasada') return 'bg-red/10 text-red';
  return 'bg-skyblue/10 text-skyblue';
}
```

Replace with:

```js
function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/10 text-green';
  if (status === 'Atrasada') return 'bg-red/10 text-red';
  return 'bg-skyblue/10 text-skyblue';
}

function formatDays(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} dias`;
}
```

- [ ] **Step 3: Extend the `kpis` object**

Find:

```js
  const kpis = {
    total: tasks.length,
    concluidas: tasks.filter((t) => deriveStatus(t, today) === 'Concluído').length,
    emProgresso: tasks.filter((t) => deriveStatus(t, today) === 'Em Progresso').length,
    altaPrioridade: tasks.filter((t) => t.prioridade === 'Alta').length,
  };
```

Replace with:

```js
  const kpis = {
    total: tasks.length,
    concluidas: tasks.filter((t) => deriveStatus(t, today) === 'Concluído').length,
    emProgresso: tasks.filter((t) => deriveStatus(t, today) === 'Em Progresso').length,
    altaPrioridade: tasks.filter((t) => t.prioridade === 'Alta').length,
    atrasadas: countOverdue(tasks, today),
    mediaAtrasoAtual: avgCurrentDelay(tasks, today),
    mediaAtrasoHistorico: avgHistoricalDelay(tasks),
  };
```

- [ ] **Step 4: Add the second KPI card row in `renderTarefas`**

Find:

```jsx
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total" value={kpis.total} colorClass="text-skyblue" />
          <KpiCard label="Em Progresso" value={kpis.emProgresso} colorClass="text-orange" />
          <KpiCard label="Concluídas" value={kpis.concluidas} colorClass="text-green" />
          <KpiCard label="Alta Prioridade" value={kpis.altaPrioridade} colorClass="text-red" />
        </div>
```

Replace with:

```jsx
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total" value={kpis.total} colorClass="text-skyblue" />
          <KpiCard label="Em Progresso" value={kpis.emProgresso} colorClass="text-orange" />
          <KpiCard label="Concluídas" value={kpis.concluidas} colorClass="text-green" />
          <KpiCard label="Alta Prioridade" value={kpis.altaPrioridade} colorClass="text-red" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Atrasadas" value={kpis.atrasadas} colorClass="text-red" />
          <KpiCard
            label="Média de atraso (atual)"
            value={formatDays(kpis.mediaAtrasoAtual)}
            colorClass="text-orange"
          />
          <KpiCard
            label="Média de atraso (histórico)"
            value={formatDays(kpis.mediaAtrasoHistorico)}
            colorClass="text-navy"
          />
        </div>
```

(`text-navy` is an interim color for the third card — Task 7 replaces it with `text-muted` once the dark palette exists.)

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual verification in the browser**

On the Tarefas tab, confirm a new second row of 3 cards appears below the existing 4. Create a task with a past Deadline and no Data Entregue: "Atrasadas" should read 1 and "Média de atraso (atual)" should show the correct day count. Fill in Data Entregue for that task: "Atrasadas" should drop back to 0 and "Média de atraso (histórico)" should update to reflect the delay.

- [ ] **Step 7: Commit**

```bash
git add pages/index.js
git commit -m "feat: add overdue task KPIs"
```

---

### Task 5: Label the Tarefas filters (Status / Responsável / Prioridade)

**Files:**
- Modify: `pages/index.js`

**Interfaces:**
- No new functions. Pure JSX restructure of the existing filter bar in `renderTarefas`.

- [ ] **Step 1: Wrap each filter control with a labeled column**

Find:

```jsx
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar tarefa..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[180px]"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option>Todos</option>
            <option>Em Progresso</option>
            <option>Atrasada</option>
            <option>Concluído</option>
          </select>
          <select
            value={filters.responsavel}
            onChange={(e) => setFilters((f) => ({ ...f, responsavel: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option>Todos</option>
            {responsaveis.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={filters.prioridade}
            onChange={(e) => setFilters((f) => ({ ...f, prioridade: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option>Todos</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="ml-auto flex items-center gap-1 bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} /> Criar Atividade
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1 bg-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Download size={16} /> Exportar PDF
          </button>
        </div>
```

Replace with:

```jsx
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 font-medium">Buscar</label>
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              <option>Em Progresso</option>
              <option>Atrasada</option>
              <option>Concluído</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Responsável</label>
            <select
              value={filters.responsavel}
              onChange={(e) => setFilters((f) => ({ ...f, responsavel: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {responsaveis.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Prioridade</label>
            <select
              value={filters.prioridade}
              onChange={(e) => setFilters((f) => ({ ...f, prioridade: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="ml-auto flex items-center gap-1 bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} /> Criar Atividade
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1 bg-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Download size={16} /> Exportar PDF
          </button>
        </div>
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual verification in the browser**

On the Tarefas tab, confirm the labels "Buscar", "Status", "Responsável", "Prioridade" appear above their respective controls, and that filtering still works.

- [ ] **Step 4: Commit**

```bash
git add pages/index.js
git commit -m "feat: label the Tarefas filter controls"
```

---

### Task 6: Dark theme foundation + Header/Nav/Processar tab

**Files:**
- Modify: `tailwind.config.js`
- Modify: `styles/globals.css`
- Modify: `pages/index.js`

**Interfaces:**
- Produces: Tailwind color tokens `canvas`, `panel`, `edge`, `ink`, `muted`, consumed by every subsequent dark-theme task (7, 8).

- [ ] **Step 1: Add dark palette tokens to Tailwind config**

Find (`tailwind.config.js`):

```js
      colors: {
        navy: '#1A3A52',
        orange: '#FF9500',
        skyblue: '#4A90E2',
        green: '#2ECC71',
        red: '#E63946',
      },
```

Replace with:

```js
      colors: {
        navy: '#1A3A52',
        orange: '#FF9500',
        skyblue: '#4A90E2',
        green: '#2ECC71',
        red: '#E63946',
        canvas: '#0B0E14',
        panel: '#12161F',
        edge: '#1F2430',
        ink: '#E8EAED',
        muted: '#8B93A1',
      },
```

- [ ] **Step 2: Set dark defaults and fix the date-picker icon in global CSS**

Find (`styles/globals.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
}

input[type='date']::-webkit-calendar-picker-indicator {
  cursor: pointer;
}
```

Replace with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
  background-color: #0B0E14;
  color: #E8EAED;
  color-scheme: dark;
}

input[type='date']::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(1);
}
```

- [ ] **Step 3: Reskin the page wrapper, header, and nav**

Find (`pages/index.js`):

```jsx
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold">
          Post-Meeting Progress <span className="text-orange">by Willian</span>
        </h1>
      </header>
      <nav className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange text-orange'
                : 'border-transparent text-navy/60 hover:text-navy'
            }`}
          >
```

Replace with:

```jsx
    <div className="min-h-screen bg-canvas">
      <header className="bg-panel border-b border-edge text-ink px-6 py-4">
        <h1 className="text-xl font-bold">
          Post-Meeting Progress <span className="text-orange">by Willian</span>
        </h1>
      </header>
      <nav className="bg-panel border-b border-edge px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange text-orange'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
```

- [ ] **Step 4: Reskin the Processar tab**

Find:

```jsx
  function renderProcessar() {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-navy mb-4">Cole a Transcrição</h2>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião..."
            className="w-full h-64 border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
          />
          <button
            onClick={handleProcessar}
            disabled={isProcessing}
            className="mt-4 bg-orange text-white font-semibold px-6 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isProcessing ? 'Processando...' : 'Processar'}
          </button>
        </div>

        {previewData && (
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange">
            <h2 className="text-lg font-bold text-navy mb-2">Prévia do Processamento</h2>
            <p className="text-sm text-gray-700 mb-4">{previewData.resumo}</p>

            <h3 className="font-semibold text-navy mb-2">
              Atividades ({previewData.tarefas.length})
            </h3>
            {previewData.tarefas.length > 0 ? (
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-4">
                {previewData.tarefas.map((t, i) => (
                  <li key={i}>
                    {t.descricao} —{' '}
                    <span className="text-gray-500">
                      {t.responsavel} ({t.prioridade})
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400 mb-4">Nenhuma tarefa encontrada</p>
            )}

            <div className="flex gap-3 text-sm mb-4">
              <span className="px-3 py-1 bg-skyblue/10 text-skyblue rounded-full font-medium">
                Combinados ({previewData.combinados.length})
              </span>
              <span className="px-3 py-1 bg-green/10 text-green rounded-full font-medium">
                Insights ({previewData.insights.length})
              </span>
            </div>

            <button
              onClick={handleConcluir}
              className="bg-green text-white font-semibold px-6 py-2 rounded-md hover:opacity-90"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    );
  }
```

Replace with:

```jsx
  function renderProcessar() {
    return (
      <div className="space-y-6">
        <div className="bg-panel border border-edge rounded-lg p-6">
          <h2 className="text-lg font-bold text-ink mb-4">Cole a Transcrição</h2>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião..."
            className="w-full h-64 bg-canvas border border-edge text-ink placeholder:text-muted rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
          />
          <button
            onClick={handleProcessar}
            disabled={isProcessing}
            className="mt-4 bg-orange text-white font-semibold px-6 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isProcessing ? 'Processando...' : 'Processar'}
          </button>
        </div>

        {previewData && (
          <div className="bg-panel border border-edge rounded-lg p-6 border-l-4 border-l-orange">
            <h2 className="text-lg font-bold text-ink mb-2">Prévia do Processamento</h2>
            <p className="text-sm text-ink mb-4">{previewData.resumo}</p>

            <h3 className="font-semibold text-ink mb-2">
              Atividades ({previewData.tarefas.length})
            </h3>
            {previewData.tarefas.length > 0 ? (
              <ol className="list-decimal list-inside text-sm text-ink space-y-1 mb-4">
                {previewData.tarefas.map((t, i) => (
                  <li key={i}>
                    {t.descricao} —{' '}
                    <span className="text-muted">
                      {t.responsavel} ({t.prioridade})
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted mb-4">Nenhuma tarefa encontrada</p>
            )}

            <div className="flex gap-3 text-sm mb-4">
              <span className="px-3 py-1 bg-skyblue/15 text-skyblue rounded-full font-medium">
                Combinados ({previewData.combinados.length})
              </span>
              <span className="px-3 py-1 bg-green/15 text-green rounded-full font-medium">
                Insights ({previewData.insights.length})
              </span>
            </div>

            <button
              onClick={handleConcluir}
              className="bg-green text-white font-semibold px-6 py-2 rounded-md hover:opacity-90"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    );
  }
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual verification in the browser**

Confirm the header, nav, and Processar tab now render on a near-black background with light text and the orange accent intact, matching the approved palette.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js styles/globals.css pages/index.js
git commit -m "feat: add dark palette tokens, reskin header/nav/Processar tab"
```

---

### Task 7: Dark theme — Tarefas tab

**Files:**
- Modify: `pages/index.js`

**Interfaces:**
- Consumes: `canvas`/`panel`/`edge`/`ink`/`muted` tokens from Task 6.

- [ ] **Step 1: Bump badge opacity from `/10` to `/15`**

Find:

```js
function priorityBadgeClass(p) {
  if (p === 'Alta') return 'bg-red/10 text-red';
  if (p === 'Baixa') return 'bg-green/10 text-green';
  return 'bg-orange/10 text-orange';
}

function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/10 text-green';
  if (status === 'Atrasada') return 'bg-red/10 text-red';
  return 'bg-skyblue/10 text-skyblue';
}
```

Replace with:

```js
function priorityBadgeClass(p) {
  if (p === 'Alta') return 'bg-red/15 text-red';
  if (p === 'Baixa') return 'bg-green/15 text-green';
  return 'bg-orange/15 text-orange';
}

function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/15 text-green';
  if (status === 'Atrasada') return 'bg-red/15 text-red';
  return 'bg-skyblue/15 text-skyblue';
}
```

- [ ] **Step 2: Reskin `KpiCard` and the histórico card's interim color**

Find:

```jsx
function KpiCard({ label, value, colorClass }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
```

Replace with:

```jsx
function KpiCard({ label, value, colorClass }) {
  return (
    <div className="bg-panel border border-edge rounded-lg p-4">
      <p className="text-xs text-muted font-medium">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
```

Find:

```jsx
          <KpiCard
            label="Média de atraso (histórico)"
            value={formatDays(kpis.mediaAtrasoHistorico)}
            colorClass="text-navy"
          />
```

Replace with:

```jsx
          <KpiCard
            label="Média de atraso (histórico)"
            value={formatDays(kpis.mediaAtrasoHistorico)}
            colorClass="text-muted"
          />
```

- [ ] **Step 3: Reskin the filter bar**

Find:

```jsx
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 font-medium">Buscar</label>
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              <option>Em Progresso</option>
              <option>Atrasada</option>
              <option>Concluído</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Responsável</label>
            <select
              value={filters.responsavel}
              onChange={(e) => setFilters((f) => ({ ...f, responsavel: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {responsaveis.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Prioridade</label>
            <select
              value={filters.prioridade}
              onChange={(e) => setFilters((f) => ({ ...f, prioridade: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="ml-auto flex items-center gap-1 bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} /> Criar Atividade
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1 bg-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Download size={16} /> Exportar PDF
          </button>
        </div>
```

Replace with:

```jsx
        <div className="bg-panel border border-edge rounded-lg p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-muted font-medium">Buscar</label>
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="bg-canvas border border-edge text-ink placeholder:text-muted rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-medium">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              <option>Em Progresso</option>
              <option>Atrasada</option>
              <option>Concluído</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-medium">Responsável</label>
            <select
              value={filters.responsavel}
              onChange={(e) => setFilters((f) => ({ ...f, responsavel: e.target.value }))}
              className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {responsaveis.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-medium">Prioridade</label>
            <select
              value={filters.prioridade}
              onChange={(e) => setFilters((f) => ({ ...f, prioridade: e.target.value }))}
              className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            >
              <option>Todos</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="ml-auto flex items-center gap-1 bg-panel border border-edge text-ink px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/5"
          >
            <Plus size={16} /> Criar Atividade
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1 bg-orange text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Download size={16} /> Exportar PDF
          </button>
        </div>
```

- [ ] **Step 4: Reskin the table**

Find:

```jsx
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy border-b border-gray-200">
                <th className="p-3">Descrição</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Data Entregue</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">{t.descricao}</td>
                  <td className="p-3">
                    {editingResponsavelId === t.id ? (
                      <input
                        autoFocus
                        value={responsavelDraft}
                        onChange={(e) => setResponsavelDraft(e.target.value)}
                        onBlur={() => updateTaskResponsavel(t.id, responsavelDraft)}
                        onKeyDown={(e) => e.key === 'Enter' && updateTaskResponsavel(t.id, responsavelDraft)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingResponsavelId(t.id);
                          setResponsavelDraft(t.responsavel);
                        }}
                        className="text-navy hover:underline"
                      >
                        {t.responsavel}
                      </button>
                    )}
                  </td>
                  <td className="p-3 relative">
                    <button
                      onClick={() => setEditingPriorityId(editingPriorityId === t.id ? null : t.id)}
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityBadgeClass(t.prioridade)}`}
                    >
                      {t.prioridade}
                    </button>
                    {editingPriorityId === t.id && (
                      <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            onClick={() => updateTaskPriority(t.id, p)}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 whitespace-nowrap"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                        deriveStatus(t, today)
                      )}`}
                    >
                      {deriveStatus(t, today)}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.deadline || ''}
                      onChange={(e) => updateTaskDeadlineField(t.id, e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.dataEntregue || ''}
                      onChange={(e) => updateTaskDataEntregue(t.id, e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => requestDelete('tasks', t.id)} className="text-red hover:opacity-70">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
```

Replace with:

```jsx
        <div className="bg-panel border border-edge rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink border-b border-edge">
                <th className="p-3">Descrição</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Data Entregue</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} className="border-b border-edge hover:bg-white/5">
                  <td className="p-3 text-ink">{t.descricao}</td>
                  <td className="p-3">
                    {editingResponsavelId === t.id ? (
                      <input
                        autoFocus
                        value={responsavelDraft}
                        onChange={(e) => setResponsavelDraft(e.target.value)}
                        onBlur={() => updateTaskResponsavel(t.id, responsavelDraft)}
                        onKeyDown={(e) => e.key === 'Enter' && updateTaskResponsavel(t.id, responsavelDraft)}
                        className="bg-canvas border border-edge text-ink rounded px-2 py-1 text-sm w-32"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingResponsavelId(t.id);
                          setResponsavelDraft(t.responsavel);
                        }}
                        className="text-ink hover:underline"
                      >
                        {t.responsavel}
                      </button>
                    )}
                  </td>
                  <td className="p-3 relative">
                    <button
                      onClick={() => setEditingPriorityId(editingPriorityId === t.id ? null : t.id)}
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityBadgeClass(t.prioridade)}`}
                    >
                      {t.prioridade}
                    </button>
                    {editingPriorityId === t.id && (
                      <div className="absolute z-10 mt-1 bg-panel border border-edge rounded-md shadow-lg">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            onClick={() => updateTaskPriority(t.id, p)}
                            className="block w-full text-left px-3 py-2 text-xs text-ink hover:bg-white/5 whitespace-nowrap"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                        deriveStatus(t, today)
                      )}`}
                    >
                      {deriveStatus(t, today)}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.deadline || ''}
                      onChange={(e) => updateTaskDeadlineField(t.id, e.target.value)}
                      className="bg-canvas border border-edge text-ink rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.dataEntregue || ''}
                      onChange={(e) => updateTaskDataEntregue(t.id, e.target.value)}
                      className="bg-canvas border border-edge text-ink rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => requestDelete('tasks', t.id)} className="text-red hover:opacity-70">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual verification in the browser**

Confirm the Tarefas tab (KPI cards, filter bar, table, priority dropdown, status/priority badges) renders fully dark with legible text and correctly colored badges, and that the date-picker calendar icons are visible (not black-on-black).

- [ ] **Step 7: Commit**

```bash
git add pages/index.js
git commit -m "feat: reskin Tarefas tab for dark theme"
```

---

### Task 8: Dark theme — Combinados/Insights tabs + modals

**Files:**
- Modify: `pages/index.js`

**Interfaces:**
- Consumes: `canvas`/`panel`/`edge`/`ink`/`muted` tokens from Task 6. This is the final reskin task — after it, no `bg-white`, `text-navy`, `text-gray-*`, or `border-gray-*` classes should remain in the file.

- [ ] **Step 1: Reskin `renderCombinados`**

Find:

```jsx
  function renderCombinados() {
    return (
      <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
        {combinados.length === 0 && (
          <p className="p-6 text-center text-gray-400">Nenhum combinado registrado</p>
        )}
        {combinados.map((c) => (
          <div key={c.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-navy font-medium">{c.descricao}</p>
              <p className="text-xs text-gray-500 mt-1">
                {c.responsavel} · {c.dataReuniao} {c.horaReuniao}
              </p>
            </div>
            <button onClick={() => requestDelete('combinados', c.id)} className="text-red hover:opacity-70">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
```

Replace with:

```jsx
  function renderCombinados() {
    return (
      <div className="bg-panel border border-edge rounded-lg divide-y divide-edge">
        {combinados.length === 0 && (
          <p className="p-6 text-center text-muted">Nenhum combinado registrado</p>
        )}
        {combinados.map((c) => (
          <div key={c.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink font-medium">{c.descricao}</p>
              <p className="text-xs text-muted mt-1">
                {c.responsavel} · {c.dataReuniao} {c.horaReuniao}
              </p>
            </div>
            <button onClick={() => requestDelete('combinados', c.id)} className="text-red hover:opacity-70">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
```

- [ ] **Step 2: Reskin `renderInsights`**

Find:

```jsx
  function renderInsights() {
    return (
      <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
        {insights.length === 0 && (
          <p className="p-6 text-center text-gray-400">Nenhum insight registrado</p>
        )}
        {insights.map((i) => (
          <div key={i.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-navy font-medium">{i.descricao}</p>
              <p className="text-xs text-gray-500 mt-1">
                {i.responsavel} · {i.dataReuniao} {i.horaReuniao}
              </p>
            </div>
            <button onClick={() => requestDelete('insights', i.id)} className="text-red hover:opacity-70">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
```

Replace with:

```jsx
  function renderInsights() {
    return (
      <div className="bg-panel border border-edge rounded-lg divide-y divide-edge">
        {insights.length === 0 && (
          <p className="p-6 text-center text-muted">Nenhum insight registrado</p>
        )}
        {insights.map((i) => (
          <div key={i.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink font-medium">{i.descricao}</p>
              <p className="text-xs text-muted mt-1">
                {i.responsavel} · {i.dataReuniao} {i.horaReuniao}
              </p>
            </div>
            <button onClick={() => requestDelete('insights', i.id)} className="text-red hover:opacity-70">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
```

- [ ] **Step 3: Reskin the create-activity modal**

Find:

```jsx
  function renderCreateModal() {
    return (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={() => setShowCreateModal(false)}
      >
        <div
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-navy">Criar Atividade</h3>
            <button onClick={() => setShowCreateModal(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Descrição"
              value={newTask.descricao}
              onChange={(e) => setNewTask((n) => ({ ...n, descricao: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Responsável"
              value={newTask.responsavel}
              onChange={(e) => setNewTask((n) => ({ ...n, responsavel: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={newTask.prioridade}
              onChange={(e) => setNewTask((n) => ({ ...n, prioridade: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((n) => ({ ...n, deadline: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-sm rounded-md text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 text-sm rounded-md bg-orange text-white font-semibold hover:opacity-90"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    );
  }
```

Replace with:

```jsx
  function renderCreateModal() {
    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        onClick={() => setShowCreateModal(false)}
      >
        <div
          className="bg-panel border border-edge rounded-lg shadow-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-ink">Criar Atividade</h3>
            <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Descrição"
              value={newTask.descricao}
              onChange={(e) => setNewTask((n) => ({ ...n, descricao: e.target.value }))}
              className="w-full bg-canvas border border-edge text-ink placeholder:text-muted rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Responsável"
              value={newTask.responsavel}
              onChange={(e) => setNewTask((n) => ({ ...n, responsavel: e.target.value }))}
              className="w-full bg-canvas border border-edge text-ink placeholder:text-muted rounded-md px-3 py-2 text-sm"
            />
            <select
              value={newTask.prioridade}
              onChange={(e) => setNewTask((n) => ({ ...n, prioridade: e.target.value }))}
              className="w-full bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((n) => ({ ...n, deadline: e.target.value }))}
              className="w-full bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-sm rounded-md text-muted hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 text-sm rounded-md bg-orange text-white font-semibold hover:opacity-90"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Reskin the delete-confirmation modal**

Find:

```jsx
  function renderDeleteModal() {
    return (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={() => setDeleteConfirm(null)}
      >
        <div
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-bold text-navy mb-2">Confirmar exclusão</h3>
          <p className="text-sm text-gray-600 mb-5">
            Esta ação não pode ser desfeita. Deseja continuar?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm rounded-md text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm rounded-md bg-red text-white font-semibold hover:opacity-90"
            >
              Confirmar Deletar
            </button>
          </div>
        </div>
      </div>
    );
  }
```

Replace with:

```jsx
  function renderDeleteModal() {
    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        onClick={() => setDeleteConfirm(null)}
      >
        <div
          className="bg-panel border border-edge rounded-lg shadow-xl p-6 w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-bold text-ink mb-2">Confirmar exclusão</h3>
          <p className="text-sm text-muted mb-5">
            Esta ação não pode ser desfeita. Deseja continuar?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm rounded-md text-muted hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm rounded-md bg-red text-white font-semibold hover:opacity-90"
            >
              Confirmar Deletar
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Grep for leftover light-theme classes**

Run: `grep -nE "bg-white|text-navy|text-gray-|border-gray-" pages/index.js`
Expected: no output (empty match — everything has been converted).

- [ ] **Step 7: Full manual regression pass in the browser**

Repeat the same interactions verified during the original build: create a manual task, edit its priority, edit its responsável inline, set a deadline, mark it delivered, delete a task (confirm via modal, cancel via ESC), reload the page and confirm localStorage persistence — all under the new dark theme. Also check Combinados and Insights tabs render correctly if any sample data exists.

- [ ] **Step 8: Commit**

```bash
git add pages/index.js
git commit -m "feat: reskin Combinados/Insights tabs and modals for dark theme"
```
