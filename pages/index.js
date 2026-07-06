import { useEffect, useState } from 'react';
import { Trash2, Plus, X, Download, Sun, Moon, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import { deriveStatus, migrateLegacyTask } from '../lib/taskStatus';
import { countOverdue, avgCurrentDelay, avgHistoricalDelay } from '../lib/taskMetrics';
import {
  krProgress,
  objectiveProgress,
  cycleTiming,
  migrateObjective,
  objectiveInPeriod,
} from '../lib/okr';

const TABS = [
  { id: 'processar', label: 'Processar' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'okrs', label: 'OKRs' },
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
  if (p === 'Alta') return 'bg-red/15 text-red';
  if (p === 'Baixa') return 'bg-green/15 text-green';
  return 'bg-gold/15 text-gold';
}

function statusBadgeClass(status) {
  if (status === 'Concluído') return 'bg-green/15 text-green';
  if (status === 'Atrasada') return 'bg-red/15 text-red';
  return 'bg-skyblue/15 text-skyblue';
}

function formatDays(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} dias`;
}

function openDatePicker(e) {
  try {
    if (typeof e.currentTarget.showPicker === 'function') {
      e.currentTarget.showPicker();
    }
  } catch {
    // showPicker can throw if unsupported or not user-activated; the native
    // click behavior still applies, so we silently ignore.
  }
}

function exportListPDF(headingLabel, items, filePrefix, responsavelLabel) {
  const doc = new jsPDF();
  const dateStr = new Date().toISOString().slice(0, 10);
  const responsavelText =
    responsavelLabel && responsavelLabel !== 'Todos'
      ? `Responsável: ${responsavelLabel}`
      : 'Responsável: Todos';

  doc.setFontSize(16);
  doc.setTextColor(26, 58, 82);
  doc.text(`Post-Meeting Progress - ${headingLabel}`, 14, 18);

  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(responsavelText, 14, 26);

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 33);

  let y = 44;
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  items.forEach((item, index) => {
    if (y > 285) {
      doc.addPage();
      y = 20;
    }
    const lines = doc.splitTextToSize(`${index + 1}. ${item.descricao}`, 180);
    doc.text(lines, 14, y);
    y += lines.length * 6 + 2;
  });

  if (items.length === 0) {
    doc.setTextColor(150);
    doc.text('Nada para exportar.', 14, y);
  }

  doc.save(`PostMeeting_${filePrefix}_${dateStr}.pdf`);
}

function formatBR(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function exportOkrReportPDF(okrs, tasks, today, de, ate) {
  const doc = new jsPDF();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filtered = okrs.filter((o) => objectiveInPeriod(o, de, ate));

  doc.setFontSize(16);
  doc.setTextColor(26, 58, 82);
  doc.text('Relatório de OKRs — Post-Meeting Progress', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const periodoText =
    de || ate
      ? `Período: ${formatBR(de) || 'início'} a ${formatBR(ate) || 'hoje'}`
      : 'Período: todos os ciclos';
  doc.text(periodoText, 14, 26);

  const avg = filtered.length
    ? Math.round(filtered.reduce((acc, o) => acc + objectiveProgress(o), 0) / filtered.length)
    : 0;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${filtered.length} objetivo(s) · Progresso médio: ${avg}% · Exportado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    33
  );

  let y = 44;
  filtered.forEach((o, idx) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(26, 58, 82);
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${o.objetivo || 'Objetivo sem título'}`, 180);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    const timing = cycleTiming(o.cicloInicio, o.cicloFim, today);
    let cicloLine = 'Ciclo: não definido';
    if (o.cicloInicio && o.cicloFim) {
      cicloLine = `Ciclo: ${formatBR(o.cicloInicio)} a ${formatBR(o.cicloFim)}`;
      if (timing) {
        cicloLine +=
          timing.diasRestantes === 0
            ? ' (encerrado)'
            : ` (faltam ${timing.diasRestantes} dias · ${timing.tempoDecorridoPct}% do tempo)`;
      }
    }
    doc.text(cicloLine, 14, y);
    y += 5;

    doc.setTextColor(16, 120, 90);
    doc.text(`Progresso do objetivo: ${objectiveProgress(o)}%`, 14, y);
    y += 6;

    doc.setTextColor(40, 40, 40);
    (o.krs || []).forEach((k) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const u = k.unidade ? ` ${k.unidade}` : '';
      const krText = `- ${k.descricao || 'KR'}: ${k.baseline}${u} -> ${k.meta}${u} (atual ${k.atual}${u}) = ${krProgress(k)}%`;
      const krLines = doc.splitTextToSize(krText, 172);
      doc.text(krLines, 18, y);
      y += krLines.length * 5;
    });

    const linked = tasks.filter((t) => (o.krs || []).some((k) => k.id === t.krId));
    if (linked.length > 0) {
      const done = linked.filter((t) => deriveStatus(t, today) === 'Concluído').length;
      const late = linked.filter((t) => deriveStatus(t, today) === 'Atrasada').length;
      const prog = linked.filter((t) => deriveStatus(t, today) === 'Em Progresso').length;
      doc.setTextColor(110);
      doc.text(
        `Ações vinculadas: ${linked.length} (${done} concluídas, ${prog} em progresso, ${late} atrasadas)`,
        18,
        y
      );
      y += 6;
    }
    y += 4;
  });

  if (filtered.length === 0) {
    doc.setTextColor(150);
    doc.text('Nenhum objetivo no período selecionado.', 14, y);
  }

  doc.save(`PostMeeting_Relatorio_OKRs_${dateStr}.pdf`);
}

function KpiCard({ label, value, colorClass }) {
  return (
    <div className="bg-panel border border-edge rounded-lg p-4">
      <p className="text-xs text-muted font-medium">{label}</p>
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
  const [okrs, setOkrs] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState('dark');

  const [filters, setFilters] = useState({
    status: 'Todos',
    responsavel: 'Todos',
    prioridade: 'Todos',
    search: '',
  });
  const [combinadoResponsavel, setCombinadoResponsavel] = useState('Todos');
  const [insightResponsavel, setInsightResponsavel] = useState('Todos');
  const [okrReportDe, setOkrReportDe] = useState('');
  const [okrReportAte, setOkrReportAte] = useState('');

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
    krId: '',
  });

  useEffect(() => {
    setTasks(loadFromStorage('tasks', []).map(migrateLegacyTask));
    setCombinados(loadFromStorage('combinados', []));
    setInsights(loadFromStorage('insights', []));
    setOkrs(loadFromStorage('okrs', []).map(migrateObjective));
    setTheme(loadFromStorage('theme', 'dark'));
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('theme', JSON.stringify(theme));
  }, [theme, hydrated]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'clean' : 'dark'));
  }

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
    if (!hydrated) return;
    window.localStorage.setItem('okrs', JSON.stringify(okrs));
  }, [okrs, hydrated]);

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
      krId: '',
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

  function requestClear(type) {
    setDeleteConfirm({ type, all: true });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    const { type, id, all } = deleteConfirm;
    if (all) {
      if (type === 'tasks') {
        setTasks([]);
        setFilters((f) => ({ ...f, responsavel: 'Todos' }));
      }
      if (type === 'combinados') {
        setCombinados([]);
        setCombinadoResponsavel('Todos');
      }
      if (type === 'insights') {
        setInsights([]);
        setInsightResponsavel('Todos');
      }
    } else {
      if (type === 'tasks') setTasks((prev) => prev.filter((t) => t.id !== id));
      if (type === 'combinados') setCombinados((prev) => prev.filter((c) => c.id !== id));
      if (type === 'insights') setInsights((prev) => prev.filter((i) => i.id !== id));
      if (type === 'okr') setOkrs((prev) => prev.filter((o) => o.id !== id));
    }
    setDeleteConfirm(null);
  }

  function updateTaskKr(id, krId) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, krId } : t)));
  }

  function addObjective() {
    setOkrs((prev) => [...prev, { id: uid(), objetivo: '', cicloInicio: '', cicloFim: '', krs: [] }]);
  }

  function updateObjectiveField(id, field, value) {
    setOkrs((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  }

  function addKr(objectiveId) {
    setOkrs((prev) =>
      prev.map((o) =>
        o.id === objectiveId
          ? {
              ...o,
              krs: [
                ...o.krs,
                { id: uid(), descricao: '', unidade: '', baseline: '', meta: '', atual: '' },
              ],
            }
          : o
      )
    );
  }

  function updateKrField(objectiveId, krId, field, value) {
    setOkrs((prev) =>
      prev.map((o) =>
        o.id === objectiveId
          ? { ...o, krs: o.krs.map((k) => (k.id === krId ? { ...k, [field]: value } : k)) }
          : o
      )
    );
  }

  function deleteKr(objectiveId, krId) {
    setOkrs((prev) =>
      prev.map((o) =>
        o.id === objectiveId ? { ...o, krs: o.krs.filter((k) => k.id !== krId) } : o
      )
    );
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
      krId: newTask.krId || '',
      dataReuniao: now.toLocaleDateString('pt-BR'),
      horaReuniao: now.toTimeString().slice(0, 5),
    };
    setTasks((prev) => [...prev, task]);
    setNewTask({ descricao: '', responsavel: '', prioridade: 'Média', deadline: '', krId: '' });
    setShowCreateModal(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  const responsaveis = Array.from(new Set(tasks.map((t) => t.responsavel))).filter(Boolean);

  const krOptions = okrs.flatMap((o) =>
    o.krs.map((k) => ({
      id: k.id,
      label: `${o.objetivo || 'Objetivo'} · ${k.descricao || 'KR'}`,
    }))
  );

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

  function renderProcessar() {
    return (
      <div className="space-y-6">
        <div className="bg-panel border border-edge rounded-lg p-6">
          <h2 className="text-lg font-bold text-ink mb-4">Cole a Transcrição</h2>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião..."
            className="w-full h-64 bg-canvas border border-edge text-ink placeholder:text-muted rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald"
          />
          <button
            onClick={handleProcessar}
            disabled={isProcessing}
            className="mt-4 bg-emerald text-white font-semibold px-6 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isProcessing ? 'Processando...' : 'Processar'}
          </button>
        </div>

        {previewData && (
          <div className="bg-panel border border-edge rounded-lg p-6 border-l-4 border-l-emerald">
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

  function renderTarefas() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total" value={kpis.total} colorClass="text-skyblue" />
          <KpiCard label="Em Progresso" value={kpis.emProgresso} colorClass="text-gold" />
          <KpiCard label="Concluídas" value={kpis.concluidas} colorClass="text-green" />
          <KpiCard label="Alta Prioridade" value={kpis.altaPrioridade} colorClass="text-red" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Atrasadas" value={kpis.atrasadas} colorClass="text-red" />
          <KpiCard
            label="Média de atraso (atual)"
            value={formatDays(kpis.mediaAtrasoAtual)}
            colorClass="text-gold"
          />
          <KpiCard
            label="Média de atraso (histórico)"
            value={formatDays(kpis.mediaAtrasoHistorico)}
            colorClass="text-muted"
          />
        </div>

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
            onClick={() => exportListPDF('Atividades', filteredTasks, 'Atividades', filters.responsavel)}
            className="flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Download size={16} /> Exportar PDF
          </button>
          <button
            onClick={() => requestClear('tasks')}
            disabled={tasks.length === 0}
            className="flex items-center gap-1 border border-red/40 text-red px-4 py-2 rounded-md text-sm font-semibold hover:bg-red/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} /> Limpar tudo
          </button>
        </div>

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
                <th className="p-3">KR</th>
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
                      onClick={openDatePicker}
                      className="bg-canvas border border-edge text-ink rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={t.dataEntregue || ''}
                      onChange={(e) => updateTaskDataEntregue(t.id, e.target.value)}
                      onClick={openDatePicker}
                      className="bg-canvas border border-edge text-ink rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={krOptions.some((k) => k.id === t.krId) ? t.krId : ''}
                      onChange={(e) => updateTaskKr(t.id, e.target.value)}
                      className="bg-canvas border border-edge text-ink rounded px-2 py-1 text-xs max-w-[160px]"
                    >
                      <option value="">—</option>
                      {krOptions.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
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
                  <td colSpan={8} className="p-6 text-center text-muted">
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

  function renderItemFilterBar(responsaveisList, value, onChange, onExport, onClear, isEmpty) {
    return (
      <div className="bg-panel border border-edge rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted font-medium">Responsável</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
          >
            <option>Todos</option>
            {responsaveisList.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onExport}
          className="ml-auto flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
        >
          <Download size={16} /> Exportar PDF
        </button>
        <button
          onClick={onClear}
          disabled={isEmpty}
          className="flex items-center gap-1 border border-red/40 text-red px-4 py-2 rounded-md text-sm font-semibold hover:bg-red/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} /> Limpar tudo
        </button>
      </div>
    );
  }

  function renderCombinados() {
    const combinadoResponsaveis = Array.from(new Set(combinados.map((c) => c.responsavel))).filter(Boolean);
    const filtered = combinados.filter(
      (c) => combinadoResponsavel === 'Todos' || c.responsavel === combinadoResponsavel
    );
    return (
      <div className="space-y-6">
        {renderItemFilterBar(
          combinadoResponsaveis,
          combinadoResponsavel,
          setCombinadoResponsavel,
          () => exportListPDF('Combinados', filtered, 'Combinados', combinadoResponsavel),
          () => requestClear('combinados'),
          combinados.length === 0
        )}
        <div className="bg-panel border border-edge rounded-lg divide-y divide-edge">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-muted">Nenhum combinado registrado</p>
          )}
          {filtered.map((c) => (
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
      </div>
    );
  }

  function renderInsights() {
    const insightResponsaveis = Array.from(new Set(insights.map((i) => i.responsavel))).filter(Boolean);
    const filtered = insights.filter(
      (i) => insightResponsavel === 'Todos' || i.responsavel === insightResponsavel
    );
    return (
      <div className="space-y-6">
        {renderItemFilterBar(
          insightResponsaveis,
          insightResponsavel,
          setInsightResponsavel,
          () => exportListPDF('Insights', filtered, 'Insights', insightResponsavel),
          () => requestClear('insights'),
          insights.length === 0
        )}
        <div className="bg-panel border border-edge rounded-lg divide-y divide-edge">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-muted">Nenhum insight registrado</p>
          )}
          {filtered.map((i) => (
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
      </div>
    );
  }

  function renderOkrs() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted">
            Defina os objetivos do ciclo e acompanhe os resultados-chave (KRs).
          </p>
          <button
            onClick={addObjective}
            className="flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} /> Novo Objetivo
          </button>
        </div>

        {okrs.length > 0 && (
          <div className="bg-panel border border-edge rounded-lg p-4 flex flex-wrap items-end gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Relatório para diretoria</p>
              <p className="text-xs text-muted">Filtre os objetivos ativos no período e exporte o PDF.</p>
            </div>
            <div className="flex flex-col gap-1 ml-auto">
              <label className="text-xs text-muted font-medium">De</label>
              <input
                type="date"
                value={okrReportDe}
                onChange={(e) => setOkrReportDe(e.target.value)}
                onClick={openDatePicker}
                className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-medium">Até</label>
              <input
                type="date"
                value={okrReportAte}
                onChange={(e) => setOkrReportAte(e.target.value)}
                onClick={openDatePicker}
                className="bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => exportOkrReportPDF(okrs, tasks, today, okrReportDe, okrReportAte)}
              className="flex items-center gap-1 bg-emerald text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
            >
              <Download size={16} /> Exportar Relatório PDF
            </button>
          </div>
        )}

        {okrs.length === 0 && (
          <div className="bg-panel border border-edge rounded-lg p-6 text-center text-muted">
            Nenhum objetivo definido. Clique em "Novo Objetivo" para começar.
          </div>
        )}

        {okrs.map((o) => {
          const oProg = objectiveProgress(o);
          const timing = cycleTiming(o.cicloInicio, o.cicloFim, today);
          return (
            <div key={o.id} className="bg-panel border border-edge rounded-lg p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    value={o.objetivo}
                    onChange={(e) => updateObjectiveField(o.id, 'objetivo', e.target.value)}
                    placeholder="Objetivo (ex: Tornar a prospecção previsível)"
                    className="w-full bg-canvas border border-edge text-ink placeholder:text-muted rounded-md px-3 py-2 text-base font-semibold"
                  />
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col text-[10px] text-muted gap-1">
                      Início do ciclo
                      <input
                        type="date"
                        value={o.cicloInicio || ''}
                        onChange={(e) => updateObjectiveField(o.id, 'cicloInicio', e.target.value)}
                        onClick={openDatePicker}
                        className="bg-canvas border border-edge text-ink rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="flex flex-col text-[10px] text-muted gap-1">
                      Fim do ciclo
                      <input
                        type="date"
                        value={o.cicloFim || ''}
                        onChange={(e) => updateObjectiveField(o.id, 'cicloFim', e.target.value)}
                        onClick={openDatePicker}
                        className="bg-canvas border border-edge text-ink rounded px-2 py-1 text-xs"
                      />
                    </label>
                    {timing && (
                      <span className="flex items-center gap-1 text-xs text-muted pb-1">
                        <Clock size={13} />
                        {timing.diasRestantes === 0
                          ? 'Ciclo encerrado'
                          : `Faltam ${timing.diasRestantes} ${timing.diasRestantes === 1 ? 'dia' : 'dias'}`}
                        <span className="text-muted/70">· {timing.tempoDecorridoPct}% do tempo decorrido</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => requestDelete('okr', o.id)}
                  className="text-red hover:opacity-70 mt-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Progresso do objetivo</span>
                  <span className="font-semibold text-ink">{oProg}%</span>
                </div>
                <div className="h-2 bg-canvas border border-edge rounded-full overflow-hidden">
                  <div className="h-full bg-emerald" style={{ width: `${oProg}%` }} />
                </div>
              </div>

              <div className="space-y-3">
                {o.krs.map((k) => {
                  const p = krProgress(k);
                  const linked = tasks.filter((t) => t.krId === k.id);
                  return (
                    <div key={k.id} className="bg-canvas border border-edge rounded-md p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          value={k.descricao}
                          onChange={(e) => updateKrField(o.id, k.id, 'descricao', e.target.value)}
                          placeholder="Resultado-chave (ex: Conversão lead→reunião)"
                          className="flex-1 bg-panel border border-edge text-ink placeholder:text-muted rounded px-2 py-1.5 text-sm"
                        />
                        <button
                          onClick={() => deleteKr(o.id, k.id)}
                          className="text-red hover:opacity-70 mt-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col text-[10px] text-muted gap-1">
                          Baseline
                          <input
                            type="number"
                            value={k.baseline}
                            onChange={(e) => updateKrField(o.id, k.id, 'baseline', e.target.value)}
                            className="w-20 bg-panel border border-edge text-ink rounded px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col text-[10px] text-muted gap-1">
                          Meta
                          <input
                            type="number"
                            value={k.meta}
                            onChange={(e) => updateKrField(o.id, k.id, 'meta', e.target.value)}
                            className="w-20 bg-panel border border-edge text-ink rounded px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col text-[10px] text-muted gap-1">
                          Atual
                          <input
                            type="number"
                            value={k.atual}
                            onChange={(e) => updateKrField(o.id, k.id, 'atual', e.target.value)}
                            className="w-20 bg-panel border border-edge text-ink rounded px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col text-[10px] text-muted gap-1">
                          Unidade
                          <input
                            value={k.unidade}
                            onChange={(e) => updateKrField(o.id, k.id, 'unidade', e.target.value)}
                            placeholder="%"
                            className="w-16 bg-panel border border-edge text-ink placeholder:text-muted rounded px-2 py-1 text-sm"
                          />
                        </label>
                        <div className="flex-1 min-w-[140px]">
                          <div className="flex justify-between text-[10px] text-muted mb-1">
                            <span>Progresso</span>
                            <span className="font-semibold text-ink">{p}%</span>
                          </div>
                          <div className="h-2 bg-panel border border-edge rounded-full overflow-hidden">
                            <div className="h-full bg-gold" style={{ width: `${p}%` }} />
                          </div>
                        </div>
                      </div>
                      {linked.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[10px] text-muted mb-1">
                            Ações vinculadas ({linked.length})
                          </p>
                          <ul className="space-y-1">
                            {linked.map((t) => (
                              <li key={t.id} className="text-xs text-ink flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(
                                    deriveStatus(t, today)
                                  )}`}
                                >
                                  {deriveStatus(t, today)}
                                </span>
                                {t.descricao} <span className="text-muted">— {t.responsavel}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => addKr(o.id)}
                  className="flex items-center gap-1 text-sm text-emerald font-semibold hover:underline"
                >
                  <Plus size={14} /> Adicionar KR
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
              onClick={openDatePicker}
              className="w-full bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            />
            <select
              value={newTask.krId}
              onChange={(e) => setNewTask((n) => ({ ...n, krId: e.target.value }))}
              className="w-full bg-canvas border border-edge text-ink rounded-md px-3 py-2 text-sm"
            >
              <option value="">Vincular a KR (opcional)</option>
              {krOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
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
              className="px-4 py-2 text-sm rounded-md bg-emerald text-white font-semibold hover:opacity-90"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDeleteModal() {
    const isClearAll = deleteConfirm?.all;
    const typeLabels = {
      tasks: 'TODAS as atividades',
      combinados: 'TODOS os combinados',
      insights: 'TODOS os insights',
    };
    const title = isClearAll ? 'Limpar tudo' : 'Confirmar exclusão';
    const message = isClearAll
      ? `Isso vai excluir ${typeLabels[deleteConfirm.type]}. Esta ação não pode ser desfeita. Deseja continuar?`
      : 'Esta ação não pode ser desfeita. Deseja continuar?';
    const confirmLabel = isClearAll ? 'Limpar tudo' : 'Confirmar Deletar';
    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        onClick={() => setDeleteConfirm(null)}
      >
        <div
          className="bg-panel border border-edge rounded-lg shadow-xl p-6 w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-bold text-ink mb-2">{title}</h3>
          <p className="text-sm text-muted mb-5">{message}</p>
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
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-panel border-b border-edge text-ink px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Post-Meeting Progress <span className="text-emerald">by Willian</span>
        </h1>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label="Alternar tema"
          className="flex items-center gap-2 bg-canvas border border-edge text-ink px-3 py-2 rounded-md text-sm font-medium hover:border-emerald transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Clean' : 'Dark'}
        </button>
      </header>
      <nav className="bg-panel border-b border-edge px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald text-emerald'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.id === 'tarefas' && tasks.length > 0 ? ` (${tasks.length})` : ''}
            {tab.id === 'okrs' && okrs.length > 0 ? ` (${okrs.length})` : ''}
            {tab.id === 'combinados' && combinados.length > 0 ? ` (${combinados.length})` : ''}
            {tab.id === 'insights' && insights.length > 0 ? ` (${insights.length})` : ''}
          </button>
        ))}
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        {activeTab === 'processar' && renderProcessar()}
        {activeTab === 'tarefas' && renderTarefas()}
        {activeTab === 'okrs' && renderOkrs()}
        {activeTab === 'combinados' && renderCombinados()}
        {activeTab === 'insights' && renderInsights()}
      </main>
      {showCreateModal && renderCreateModal()}
      {deleteConfirm && renderDeleteModal()}
    </div>
  );
}
