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
