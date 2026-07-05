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
