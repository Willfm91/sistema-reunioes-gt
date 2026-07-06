import { describe, it, expect } from 'vitest';
import {
  krProgress,
  objectiveProgress,
  cycleTiming,
  migrateObjective,
  objectiveInPeriod,
} from './okr';

describe('krProgress', () => {
  it('computes progress toward an increasing target', () => {
    expect(krProgress({ baseline: 8, meta: 15, atual: 11 })).toBe(43);
  });

  it('returns 100 when an increasing target is reached', () => {
    expect(krProgress({ baseline: 8, meta: 15, atual: 15 })).toBe(100);
  });

  it('clamps to 100 when the target is overshot', () => {
    expect(krProgress({ baseline: 8, meta: 15, atual: 20 })).toBe(100);
  });

  it('clamps to 0 when below the baseline', () => {
    expect(krProgress({ baseline: 8, meta: 15, atual: 5 })).toBe(0);
  });

  it('computes progress toward a decreasing target', () => {
    expect(krProgress({ baseline: 10, meta: 5, atual: 8 })).toBe(40);
  });

  it('returns 100 when a decreasing target is reached', () => {
    expect(krProgress({ baseline: 10, meta: 5, atual: 5 })).toBe(100);
  });

  it('handles baseline equal to meta', () => {
    expect(krProgress({ baseline: 5, meta: 5, atual: 5 })).toBe(100);
    expect(krProgress({ baseline: 5, meta: 5, atual: 4 })).toBe(0);
  });

  it('returns 0 for non-numeric values', () => {
    expect(krProgress({ baseline: 0, meta: 10, atual: '' })).toBe(0);
    expect(krProgress({ baseline: '', meta: '', atual: '' })).toBe(0);
  });
});

describe('objectiveProgress', () => {
  it('averages the progress of its KRs', () => {
    const objective = {
      krs: [
        { baseline: 0, meta: 10, atual: 4 }, // 40
        { baseline: 0, meta: 10, atual: 6 }, // 60
      ],
    };
    expect(objectiveProgress(objective)).toBe(50);
  });

  it('rounds the average', () => {
    const objective = {
      krs: [
        { baseline: 8, meta: 15, atual: 11 }, // 43
        { baseline: 0, meta: 10, atual: 10 }, // 100
      ],
    };
    expect(objectiveProgress(objective)).toBe(72);
  });

  it('returns 0 when there are no KRs', () => {
    expect(objectiveProgress({ krs: [] })).toBe(0);
    expect(objectiveProgress({})).toBe(0);
  });
});

describe('cycleTiming', () => {
  it('computes days remaining and elapsed percentage mid-cycle', () => {
    const t = cycleTiming('2026-07-01', '2026-07-15', '2026-07-10');
    expect(t).toEqual({ totalDays: 14, diasRestantes: 5, tempoDecorridoPct: 64 });
  });

  it('clamps elapsed to 0 before the cycle starts', () => {
    const t = cycleTiming('2026-07-01', '2026-07-15', '2026-06-25');
    expect(t.tempoDecorridoPct).toBe(0);
    expect(t.diasRestantes).toBe(20);
  });

  it('reports 0 days remaining and 100% elapsed after the cycle ends', () => {
    const t = cycleTiming('2026-07-01', '2026-07-15', '2026-07-20');
    expect(t.diasRestantes).toBe(0);
    expect(t.tempoDecorridoPct).toBe(100);
  });

  it('returns null when a date is missing', () => {
    expect(cycleTiming('', '2026-07-15', '2026-07-10')).toBeNull();
    expect(cycleTiming('2026-07-01', '', '2026-07-10')).toBeNull();
  });

  it('returns null when end is before start', () => {
    expect(cycleTiming('2026-07-15', '2026-07-01', '2026-07-10')).toBeNull();
  });
});

describe('migrateObjective', () => {
  it('converts a legacy free-text ciclo objective to date fields', () => {
    const legacy = { id: '1', objetivo: 'X', ciclo: 'Q3 2026', krs: [] };
    expect(migrateObjective(legacy)).toEqual({
      id: '1',
      objetivo: 'X',
      cicloInicio: '',
      cicloFim: '',
      krs: [],
    });
  });

  it('leaves an already-migrated objective unchanged', () => {
    const modern = { id: '2', objetivo: 'Y', cicloInicio: '2026-07-01', cicloFim: '2026-07-15', krs: [] };
    expect(migrateObjective(modern)).toEqual(modern);
  });
});

describe('objectiveInPeriod', () => {
  const period = ['2026-07-01', '2026-07-31'];
  const obj = (cicloInicio, cicloFim) => ({ cicloInicio, cicloFim });

  it('includes everything when no period is set', () => {
    expect(objectiveInPeriod(obj('2026-01-01', '2026-01-10'), '', '')).toBe(true);
  });

  it('includes a cycle fully inside the period', () => {
    expect(objectiveInPeriod(obj('2026-07-15', '2026-07-30'), ...period)).toBe(true);
  });

  it('includes a cycle that starts before but crosses into the period', () => {
    expect(objectiveInPeriod(obj('2026-06-25', '2026-07-10'), ...period)).toBe(true);
  });

  it('includes a cycle that ends after but crosses into the period', () => {
    expect(objectiveInPeriod(obj('2026-07-20', '2026-08-05'), ...period)).toBe(true);
  });

  it('excludes a cycle entirely after the period', () => {
    expect(objectiveInPeriod(obj('2026-08-01', '2026-08-15'), ...period)).toBe(false);
  });

  it('excludes a cycle entirely before the period', () => {
    expect(objectiveInPeriod(obj('2026-06-01', '2026-06-20'), ...period)).toBe(false);
  });

  it('respects an open lower bound (only "até" set)', () => {
    expect(objectiveInPeriod(obj('2026-08-01', '2026-08-15'), '', '2026-07-31')).toBe(false);
    expect(objectiveInPeriod(obj('2026-06-01', '2026-06-20'), '', '2026-07-31')).toBe(true);
  });

  it('respects an open upper bound (only "de" set)', () => {
    expect(objectiveInPeriod(obj('2026-06-01', '2026-06-20'), '2026-07-01', '')).toBe(false);
    expect(objectiveInPeriod(obj('2026-08-01', '2026-08-15'), '2026-07-01', '')).toBe(true);
  });

  it('always includes objectives without cycle dates', () => {
    expect(objectiveInPeriod(obj('', ''), ...period)).toBe(true);
  });
});
