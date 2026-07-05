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
