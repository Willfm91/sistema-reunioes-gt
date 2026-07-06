import { supabase } from './supabase';

// TASKS
export async function fetchTasks() {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  return data || [];
}

export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert([task]).select();
  if (error) {
    console.error('Error creating task:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select();
  if (error) {
    console.error('Error updating task:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) {
    console.error('Error deleting task:', error);
    return false;
  }
  return true;
}

// COMBINADOS
export async function fetchCombinados() {
  const { data, error } = await supabase.from('combinados').select('*');
  if (error) {
    console.error('Error fetching combinados:', error);
    return [];
  }
  return data || [];
}

export async function createCombinado(combinado) {
  const { data, error } = await supabase.from('combinados').insert([combinado]).select();
  if (error) {
    console.error('Error creating combinado:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function updateCombinado(id, updates) {
  const { data, error } = await supabase.from('combinados').update(updates).eq('id', id).select();
  if (error) {
    console.error('Error updating combinado:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function deleteCombinado(id) {
  const { error } = await supabase.from('combinados').delete().eq('id', id);
  if (error) {
    console.error('Error deleting combinado:', error);
    return false;
  }
  return true;
}

// INSIGHTS
export async function fetchInsights() {
  const { data, error } = await supabase.from('insights').select('*');
  if (error) {
    console.error('Error fetching insights:', error);
    return [];
  }
  return data || [];
}

export async function createInsight(insight) {
  const { data, error } = await supabase.from('insights').insert([insight]).select();
  if (error) {
    console.error('Error creating insight:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function updateInsight(id, updates) {
  const { data, error } = await supabase.from('insights').update(updates).eq('id', id).select();
  if (error) {
    console.error('Error updating insight:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function deleteInsight(id) {
  const { error } = await supabase.from('insights').delete().eq('id', id);
  if (error) {
    console.error('Error deleting insight:', error);
    return false;
  }
  return true;
}

// OKRS
export async function fetchOkrs() {
  const { data, error } = await supabase.from('okrs').select('*');
  if (error) {
    console.error('Error fetching okrs:', error);
    return [];
  }
  return data || [];
}

export async function createOkr(okr) {
  const { data, error } = await supabase.from('okrs').insert([okr]).select();
  if (error) {
    console.error('Error creating okr:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function updateOkr(id, updates) {
  const { data, error } = await supabase.from('okrs').update(updates).eq('id', id).select();
  if (error) {
    console.error('Error updating okr:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function deleteOkr(id) {
  const { error } = await supabase.from('okrs').delete().eq('id', id);
  if (error) {
    console.error('Error deleting okr:', error);
    return false;
  }
  return true;
}
