import { useEffect, useState } from 'react';
import { Trash2, Plus, X, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { deriveStatus, migrateLegacyTask } from '../lib/taskStatus';
import { countOverdue, avgCurrentDelay, avgHistoricalDelay } from '../lib/taskMetrics';

const TABS = [
  { id: 'processar', label: 'Processar' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'combinados', label: 'Combinados' },
  { id: 'insights', label: 'Insights' },
];

const PRIORITIES = ['Alta', 'Média', 'Baixa'];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

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

function formatDays(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} dias`;
}

function KpiCard({ label, value, colorClass }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('processar');
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [combinados, setCombinados] = useState([]);
  const [insights, setInsights] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  const [filters, setFilters] = useState({
    status: 'Todos',
    responsavel: 'Todos',
    prioridade: 'Todos',
    search: '',
  });

  const [editingPriorityId, setEditingPriorityId] = useState(null);
  const [editingResponsavelId, setEditingResponsavelId] = useState(null);
  const [responsavelDraft, setResponsavelDraft] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    descricao: '',
    responsavel: '',
    prioridade: 'Média',
    deadline: '',
  });

  useEffect(() => {
    setTasks(loadFromStorage('tasks', []).map(migrateLegacyTask));
    setCombinados(loadFromStorage('combinados', []));
    setInsights(loadFromStorage('insights', []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('combinados', JSON.stringify(combinados));
  }, [combinados, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('insights', JSON.stringify(insights));
  }, [insights, hydrated]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCreateModal(false);
        setEditingPriorityId(null);
        setEditingResponsavelId(null);
        setDeleteConfirm(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleProcessar() {
    if (!transcription || transcription.trim().length === 0) {
      alert('Cole a transcrição antes de processar');
      return;
    }
    setIsProcessing(true);
    setPreviewData(null);
    try {
      const response = await fetch('/api/process-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Erro ao processar transcrição');
        return;
      }
      setPreviewData(data);
    } catch (error) {
      alert('Erro ao processar transcrição. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleConcluir() {
    if (!previewData) return;
    const meta = { dataReuniao: previewData.dataReuniao, horaReuniao: previewData.horaReuniao };

    const newTasks = previewData.tarefas.map((t) => ({
      id: uid(),
      descricao: t.descricao,
      responsavel: t.responsavel,
      prioridade: t.prioridade,
      deadline: '',
      dataEntregue: '',
      ...meta,
    }));
    const newCombinados = previewData.combinados.map((c) => ({ id: uid(), ...c, ...meta }));
    const newInsights = previewData.insights.map((i) => ({ id: uid(), ...i, ...meta }));

    setTasks((prev) => [...prev, ...newTasks]);
    setCombinados((prev) => [...prev, ...newCombinados]);
    setInsights((prev) => [...prev, ...newInsights]);

    setPreviewData(null);
    setTranscription('');
    setActiveTab('tarefas');
  }

  function updateTaskDeadlineField(id, date) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deadline: date } : t)));
  }

  function updateTaskDataEntregue(id, date) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, dataEntregue: date } : t)));
  }

  function updateTaskPriority(id, prioridade) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, prioridade } : t)));
    setEditingPriorityId(null);
  }

  function updateTaskResponsavel(id, responsavel) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, responsavel: responsavel.trim() || 'Não especificado' } : t))
    );
    setEditingResponsavelId(null);
  }

  function requestDelete(type, id) {
    setDeleteConfirm({ type, id });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === 'tasks') setTasks((prev) => prev.filter((t) => t.id !== id));
    if (type === 'combinados') setCombinados((prev) => prev.filter((c) => c.id !== id));
    if (type === 'insights') setInsights((prev) => prev.filter((i) => i.id !== id));
    setDeleteConfirm(null);
  }

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
    atrasadas: countOverdue(tasks, today),
    mediaAtrasoAtual: avgCurrentDelay(tasks, today),
    mediaAtrasoHistorico: avgHistoricalDelay(tasks),
  };

  function exportPDF() {
    const doc = new jsPDF();
    const dateStr = new Date().toISOString().slice(0, 10);
    doc.setFontSize(16);
    doc.setTextColor(26, 58, 82);
    doc.text('Post-Meeting Progress - Atividades', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 25);

    let y = 35;
    doc.setFontSize(9);
    filteredTasks.forEach((t, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(26, 58, 82);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${t.descricao}`, 14, y);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80);
      y += 5;
      doc.text(
        `Responsável: ${t.responsavel} | Prioridade: ${t.prioridade} | Status: ${deriveStatus(t, today)}`,
        18,
        y
      );
      y += 8;
    });

    if (filteredTasks.length === 0) {
      doc.setTextColor(150);
      doc.text('Nenhuma tarefa para exportar.', 14, y);
    }

    doc.save(`PostMeeting_Atividades_${dateStr}.pdf`);
  }

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

  function renderTarefas() {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

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

  return (
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
            {tab.label}
            {tab.id === 'tarefas' && tasks.length > 0 ? ` (${tasks.length})` : ''}
            {tab.id === 'combinados' && combinados.length > 0 ? ` (${combinados.length})` : ''}
            {tab.id === 'insights' && insights.length > 0 ? ` (${insights.length})` : ''}
          </button>
        ))}
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        {activeTab === 'processar' && renderProcessar()}
        {activeTab === 'tarefas' && renderTarefas()}
        {activeTab === 'combinados' && renderCombinados()}
        {activeTab === 'insights' && renderInsights()}
      </main>
      {showCreateModal && renderCreateModal()}
      {deleteConfirm && renderDeleteModal()}
    </div>
  );
}
