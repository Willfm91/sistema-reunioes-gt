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
