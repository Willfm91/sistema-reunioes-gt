import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Calendar, Users, FileText, Play, Trash2, Edit2, Save, X } from 'lucide-react';

interface Task {
  id: number;
  descricao: string;
  responsavel: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  dataReuniao: string;
  horaReuniao: string;
  resumo: string;
  deadline: string;
  dataEntrega: string;
  status: 'Não Iniciado' | 'Em Progresso' | 'Concluído';
  diasAtraso: number;
  statusEntrega?: string;
}

interface Meeting {
  id: number;
  title: string;
  date: string;
  duration: string;
}

interface ProcessedData {
  resumo: string;
  tarefas: Array<{
    descricao: string;
    responsavel: string;
    prioridade: 'Alta' | 'Média' | 'Baixa';
  }>;
  dataReuniao: string;
  horaReuniao: string;
}

export default function TaskAutomationSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [transcription, setTranscription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    taskId: null as number | null,
    deadline: '',
    deliveryDate: '',
    status: 'Não Iniciado' as const
  });

  // Carregar dados do localStorage
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  // Salvar tasks no localStorage
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  const connectGoogleDrive = () => {
    const demoMeetings: Meeting[] = [
      { id: 1, title: 'GT Ana Paula Rezek e Willian', date: '2026-07-02', duration: '45 min' },
      { id: 2, title: 'GT Felipe SDR - Follow-up', date: '2026-07-01', duration: '30 min' },
      { id: 3, title: 'GT Eduardo - Estratégia Q3', date: '2026-06-30', duration: '60 min' }
    ];
    setMeetings(demoMeetings);
    alert('✅ Conectado ao Google Drive! Reuniões GT* carregadas.');
  };

  const processTranscription = async () => {
    if (!transcription.trim()) {
      alert('Cole a transcrição antes de processar');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/process-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: transcription
        })
      });

      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }

      const result = await response.json();
      setProcessedData(result);
      
    } catch (error) {
      alert(`Erro ao processar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    setProcessing(false);
  };

  const addTasksToBoard = () => {
    if (!processedData) return;

    const newTasks: Task[] = processedData.tarefas.map((t, idx) => ({
      id: Date.now() + idx,
      descricao: t.descricao,
      responsavel: t.responsavel,
      prioridade: t.prioridade,
      dataReuniao: processedData.dataReuniao,
      horaReuniao: processedData.horaReuniao,
      resumo: processedData.resumo,
      deadline: '',
      dataEntrega: '',
      status: 'Não Iniciado',
      diasAtraso: 0
    }));

    setTasks([...tasks, ...newTasks]);
    setProcessedData(null);
    setTranscription('');
    setSelectedMeeting(null);
    alert('✅ Tarefas adicionadas ao dashboard!');
  };

  const updateTask = (taskId: number) => {
    const deadline = new Date(formData.deadline);
    const delivery = formData.deliveryDate ? new Date(formData.deliveryDate) : null;
    
    let diasAtraso = 0;
    let statusEntrega = 'Pendente';
    
    if (delivery) {
      diasAtraso = Math.floor((delivery.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      statusEntrega = diasAtraso > 0 ? `Atrasado ${diasAtraso} dias` : `Antecipado ${Math.abs(diasAtraso)} dias`;
    }

    setTasks(tasks.map(t => 
      t.id === taskId 
        ? {
            ...t,
            deadline: formData.deadline,
            dataEntrega: formData.deliveryDate,
            status: formData.status,
            diasAtraso,
            statusEntrega
          }
        : t
    ));

    setEditingTask(null);
    setFormData({ taskId: null, deadline: '', deliveryDate: '', status: 'Não Iniciado' });
  };

  const deleteTask = (taskId: number) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const Dashboard = () => {
    const concluidas = tasks.filter(t => t.status === 'Concluído').length;
    const emProgresso = tasks.filter(t => t.status === 'Em Progresso').length;
    const naoIniciadas = tasks.filter(t => t.status === 'Não Iniciado').length;
    const atrasadas = tasks.filter(t => t.deadline && t.diasAtraso > 0 && t.status !== 'Concluído').length;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-teal-200">
            <div className="text-sm font-medium text-teal-700 mb-1">Total</div>
            <div className="text-2xl font-bold text-teal-900">{tasks.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-700 mb-1">Concluídas</div>
            <div className="text-2xl font-bold text-green-900">{concluidas}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
            <div className="text-sm font-medium text-amber-700 mb-1">Em Progresso</div>
            <div className="text-2xl font-bold text-amber-900">{emProgresso}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-lg border border-red-200">
            <div className="text-sm font-medium text-red-700 mb-1">Atrasadas</div>
            <div className="text-2xl font-bold text-red-900">{atrasadas}</div>
          </div>
        </div>

        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
              <FileText className="mx-auto h-12 w-12 text-slate-400 mb-2" />
              <p className="text-slate-600">Nenhuma tarefa ainda. Processe uma reunião para começar!</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{task.descricao}</p>
                    <p className="text-sm text-slate-600 mt-1">👤 {task.responsavel}</p>
                    <p className="text-xs text-slate-500 mt-1">📅 {task.dataReuniao} às {task.horaReuniao}</p>
                    <div className="mt-2 flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        task.prioridade === 'Alta' ? 'bg-red-100 text-red-700' :
                        task.prioridade === 'Média' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.prioridade}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        task.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                        task.status === 'Em Progresso' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    {editingTask === task.id ? (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="Deadline"
                        />
                        <input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="Data Entrega"
                        />
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          <option>Não Iniciado</option>
                          <option>Em Progresso</option>
                          <option>Concluído</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateTask(task.id)}
                            className="flex-1 bg-teal-600 text-white px-2 py-1 rounded text-sm hover:bg-teal-700"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingTask(null)}
                            className="flex-1 bg-slate-300 text-slate-700 px-2 py-1 rounded text-sm hover:bg-slate-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-600">
                          ⏰ Deadline: <span className="font-semibold">{task.deadline || '—'}</span>
                        </p>
                        <p className="text-slate-600">
                          📦 Entrega: <span className="font-semibold">{task.dataEntrega || '—'}</span>
                        </p>
                        {task.statusEntrega && (
                          <p className={`font-semibold ${task.diasAtraso > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {task.statusEntrega}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              setEditingTask(task.id);
                              setFormData({
                                taskId: task.id,
                                deadline: task.deadline,
                                deliveryDate: task.dataEntrega,
                                status: task.status
                              });
                            }}
                            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Deletar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
            <h1 className="text-3xl font-bold mb-2">🎯 Sistema Automático de Reuniões GT</h1>
            <p className="text-teal-100">Processe transcrições, extraia tarefas e acompanhe prazos automaticamente</p>
          </div>

          {/* Navigation */}
          <div className="border-b border-slate-200 flex">
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'processor', label: '⚙️ Processar' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 font-semibold text-center border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-600 bg-teal-50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'dashboard' && <Dashboard />}

            {activeTab === 'processor' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Step 1: Connect Google Drive */}
                <div className="border-2 border-teal-200 rounded-lg p-6 bg-teal-50">
                  <h2 className="text-lg font-bold text-teal-900 mb-3">1️⃣ Conectar Google Drive</h2>
                  {meetings.length === 0 ? (
                    <button
                      onClick={connectGoogleDrive}
                      className="w-full bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 font-semibold"
                    >
                      🔗 Conectar Google Drive
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {meetings.map(m => (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMeeting(m)}
                          className={`p-3 rounded cursor-pointer border-2 transition ${
                            selectedMeeting?.id === m.id
                              ? 'border-teal-600 bg-white'
                              : 'border-slate-200 hover:border-teal-400'
                          }`}
                        >
                          <p className="font-semibold text-slate-900">{m.title}</p>
                          <p className="text-sm text-slate-600">{m.date} • {m.duration}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: Paste Transcription */}
                <div className="border-2 border-amber-200 rounded-lg p-6 bg-amber-50">
                  <h2 className="text-lg font-bold text-amber-900 mb-3">2️⃣ Cole a Transcrição</h2>
                  <p className="text-sm text-amber-800 mb-3">Abra o vídeo da reunião no Google Drive → Clique em "Transcrição" → Copie e cole aqui</p>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Cole a transcrição completa da reunião aqui..."
                    className="w-full h-48 p-4 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                  />
                </div>

                {/* Step 3: Process */}
                <button
                  onClick={processTranscription}
                  disabled={processing || !transcription.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 font-bold text-lg transition"
                >
                  {processing ? '⏳ Processando...' : '🚀 Processar Transcrição com Claude'}
                </button>

                {/* Step 4: Preview & Add */}
                {processedData && (
                  <div className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
                    <h2 className="text-lg font-bold text-green-900 mb-4">3️⃣ Resultado da Análise</h2>
                    
                    <div className="bg-white p-4 rounded-lg mb-4">
                      <p className="text-sm font-semibold text-slate-600 mb-1">RESUMO DA REUNIÃO</p>
                      <p className="text-slate-900">{processedData.resumo}</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg mb-4">
                      <p className="text-sm font-semibold text-slate-600 mb-2">TAREFAS IDENTIFICADAS</p>
                      <div className="space-y-2">
                        {processedData.tarefas.map((t, i) => (
                          <div key={i} className="border-l-4 border-teal-500 pl-3 py-2">
                            <p className="font-semibold text-slate-900">{t.descricao}</p>
                            <p className="text-sm text-slate-600">👤 {t.responsavel}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={addTasksToBoard}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold"
                    >
                      ✅ Adicionar Tarefas ao Dashboard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
