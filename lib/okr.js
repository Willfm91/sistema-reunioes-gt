// Pure OKR progress math. A Key Result tracks an outcome metric moving from a
// baseline toward a meta (target); progress is how far `atual` has moved along
// that range. Works for both increasing targets (8 -> 15) and decreasing ones
// (10 -> 5). Objective progress is the average of its KRs.

export function krProgress(kr) {
  const raw = [kr.baseline, kr.meta, kr.atual];
  if (raw.some((v) => v === '' || v === null || v === undefined)) {
    return 0;
  }
  const baseline = Number(kr.baseline);
  const meta = Number(kr.meta);
  const atual = Number(kr.atual);
  if (!Number.isFinite(baseline) || !Number.isFinite(meta) || !Number.isFinite(atual)) {
    return 0;
  }
  if (meta === baseline) {
    return atual === meta ? 100 : 0;
  }
  const ratio = (atual - baseline) / (meta - baseline);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function objectiveProgress(objective) {
  const krs = objective && Array.isArray(objective.krs) ? objective.krs : [];
  if (krs.length === 0) return 0;
  const sum = krs.reduce((acc, kr) => acc + krProgress(kr), 0);
  return Math.round(sum / krs.length);
}

// Given a cycle's start/end dates (YYYY-MM-DD) and today, returns how many days
// remain and how much of the cycle's time has elapsed. Returns null when the
// dates are missing or invalid, so the UI can simply hide the countdown.
export function cycleTiming(inicio, fim, today) {
  if (!inicio || !fim) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(`${inicio}T00:00:00`);
  const end = new Date(`${fim}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  const totalDays = Math.round((end - start) / msPerDay);
  const diasRestantes = Math.max(0, Math.round((end - now) / msPerDay));
  let tempoDecorridoPct;
  if (totalDays <= 0) {
    tempoDecorridoPct = now >= end ? 100 : 0;
  } else {
    tempoDecorridoPct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  }
  return { totalDays, diasRestantes, tempoDecorridoPct };
}

// Decides whether an objective falls within a report period [de, ate] using
// "active in the period" semantics: its cycle must overlap the range. An empty
// bound means "open" on that side; no bounds at all includes everything.
// Objectives without cycle dates are always included so nothing silently
// disappears from a filtered report.
export function objectiveInPeriod(objective, de, ate) {
  if (!de && !ate) return true;
  const inicio = objective.cicloInicio;
  const fim = objective.cicloFim;
  if (!inicio || !fim) return true;
  if (de && fim < de) return false; // cycle ends before the period starts
  if (ate && inicio > ate) return false; // cycle starts after the period ends
  return true;
}

// Migrates an objective from the old free-text `ciclo` field to the new
// start/end date fields. Idempotent: objectives that already have the new
// fields are returned unchanged.
export function migrateObjective(o) {
  if (o.cicloInicio !== undefined || o.cicloFim !== undefined) return o;
  const { ciclo, ...rest } = o;
  return { ...rest, cicloInicio: '', cicloFim: '' };
}
