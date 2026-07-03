import React, { useState, useEffect } from 'react';
import { BarChart3, Settings, Filter, Edit2, Trash2 } from 'lucide-react';

export default function TaskAutomationSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [transcription, setTranscription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingPrioridade, setEditingPrioridade] = useState(null);
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  const [formData, setFormData] = useState({
    taskId: null,
    deadline: '',
    deliveryDate: '',
    status: 'Não Iniciado'
  });

  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Error loading tasks:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  const processTranscription = async () => {
    if (!transcription.trim()) {
      alert('Cole a transcrição antes de processar');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/process-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription })
      });

      if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
      const result = await response.json();
      setProcessedData(result);
    } catch (error) {
      alert(`Erro ao processar: ${error.message}`);
    }
    setProcessing(false);
  };

  const addTasksToBoard = () => {
    if (!processedData) return;

    const newTasks = processedData.tarefas.map((t, idx) => ({
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
    alert('Tarefas adicionadas ao dashboard!');
  };

  const updatePrioridade = (taskId, novaPrioridade) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, prioridade: novaPrioridade } : t
    ));
    setEditingPrioridade(null);
  };

  const updateTask = (taskId) => {
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

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const getResponsaveisUnicos = () => {
    const responsaveis = tasks.map(t => t.responsavel);
    return [...new Set(responsaveis)].filter(Boolean);
  };

  const Dashboard = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const atrasadas = tasks.filter(t => {
      if (t.status === 'Concluído') return false;
      if (!t.deadline) return false;
      const deadlineDate = new Date(t.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      return deadlineDate < today;
    }).length;

    const concluidas = tasks.filter(t => t.status === 'Concluído').length;
    const emProgresso = tasks.filter(t => t.status === 'Em Progresso').length;

    const tarefasFiltradas = tasks.filter(t => {
      if (filterResponsavel && t.responsavel !== filterResponsavel) return false;
      if (filterPrioridade && t.prioridade !== filterPrioridade) return false;
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#1A3A52' }}>
            <Filter size={18} /> Filtros
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Responsável:</label>
              <select
                value={filterResponsavel}
                onChange={(e) => setFilterResponsavel(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
              >
                <option value="">Todos</option>
                {getResponsaveisUnicos().map(resp => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Prioridade:</label>
              <select
                value={filterPrioridade}
                onChange={(e) => setFilterPrioridade(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
              >
                <option value="">Todas</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F0F8FF', borderColor: '#4A90E2' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#4A90E2' }}>Total</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{tasks.length}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F0FFF4', borderColor: '#2ECC71' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#2ECC71' }}>Concluídas</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{concluidas}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FFF5E6', borderColor: '#FF9500' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#FF9500' }}>Em Progresso</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{emProgresso}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FFF0F0', borderColor: '#E63946' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#E63946' }}>Atrasadas</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{atrasadas}</div>
          </div>
        </div>

        <div className="space-y-3">
          {tarefasFiltradas.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>{tasks.length === 0 ? 'Nenhuma tarefa ainda. Processe uma reunião para começar!' : 'Nenhuma tarefa corresponde aos filtros selecionados.'}</p>
            </div>
          ) : (
            tarefasFiltradas.map(task => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const deadlineDate = task.deadline ? new Date(task.deadline) : null;
              if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);
              const isAtrasada = deadlineDate && deadlineDate < today && task.status !== 'Concluído';
              
              return (
                <div key={task.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold" style={{ color: '#1A3A52' }}>{task.descricao}</p>
                      <p className="text-sm mt-1" style={{ color: '#555555' }}>Responsável: {task.responsavel}</p>
                      <p className="text-xs mt-1" style={{ color: '#888888' }}>Data: {task.dataReuniao} às {task.horaReuniao}</p>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {editingPrioridade === task.id ? (
                          <select
                            value={task.prioridade}
                            onChange={(e) => updatePrioridade(task.id, e.target.value)}
                            onBlur={() => setEditingPrioridade(null)}
                            autoFocus
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ border: '1px solid #FF9500', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
                          >
                            <option>Alta</option>
                            <option>Média</option>
                            <option>Baixa</option>
                          </select>
                        ) : (
                          <span 
                            onClick={() => setEditingPrioridade(task.id)}
                            className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                            style={{
                              backgroundColor: task.prioridade === 'Alta' ? '#FFE6E6' : task.prioridade === 'Média' ? '#FFF9F0' : '#F0F8FF',
                              color: task.prioridade === 'Alta' ? '#E63946' : task.prioridade === 'Média' ? '#FF9500' : '#4A90E2'
                            }}
                            title="Clique para editar"
                          >
                            {task.prioridade}
                          </span>
                        )}
                        <span className="px-3 py-1 rounded text-xs font-medium" style={{
                          backgroundColor: task.status === 'Concluído' ? '#F0FFF4' : task.status === 'Em Progresso' ? '#FFF9F0' : '#F5F5F5',
                          color: task.status === 'Concluído' ? '#2ECC71' : task.status === 'Em Progresso' ? '#FF9500' : '#888888'
                        }}>
                          {task.status}
                        </span>
                        {isAtrasada && (
                          <span className="px-3 py-1 rounded text-xs font-medium" style={{
                            backgroundColor: '#FFE6E6',
                            color: '#E63946'
                          }}>
                            Atrasada
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {editingTask === task.id ? (
                        <div className="space-y-2">
                          <input
                            type="date"
                            value={formData.deadline}
                            onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
                          />
                          <input
                            type="date"
                            value={formData.deliveryDate}
                            onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
                          />
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: e.target.value})}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
                          >
                            <option>Não Iniciado</option>
                            <option>Em Progresso</option>
                            <option>Concluído</option>
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTask(task.id)}
                              className="flex-1 text-white px-2 py-1 rounded text-sm font-medium"
                              style={{ backgroundColor: '#4A90E2' }}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingTask(null)}
                              className="flex-1 px-2 py-1 rounded text-sm font-medium"
                              style={{ backgroundColor: '#F0F0F0', color: '#555555' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-sm">
                          <p style={{ color: '#555555' }}>Deadline: <span className="font-semibold">{task.deadline || '—'}</span></p>
                          <p style={{ color: '#555555' }}>Entrega: <span className="font-semibold">{task.dataEntrega || '—'}</span></p>
                          {task.statusEntrega && (
                            <p style={{ color: task.diasAtraso > 0 ? '#E63946' : '#2ECC71', fontWeight: 'semibold' }}>{task.statusEntrega}</p>
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
                              className="text-sm font-medium"
                              style={{ color: '#4A90E2' }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-sm font-medium"
                              style={{ color: '#E63946' }}
                            >
                              Deletar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(26, 58, 82, 0.1)' }}>
          <div className="text-white p-8" style={{ background: 'linear-gradient(135deg, #1A3A52 0%, #2D5A7B 100%)' }}>
            <h1 className="text-4xl font-bold mb-1">TaskFlow</h1>
            <p className="text-base mb-3 opacity-90">by Willian Marins</p>
            <p className="text-base opacity-95">Processe transcrições, extraia tarefas e acompanhe prazos automaticamente</p>
          </div>

          <div className="border-b border-slate-200 flex">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'processor', label: 'Processar', icon: Settings }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-4 px-6 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2"
                  style={{
                    borderBottomColor: activeTab === tab.id ? '#FF9500' : 'transparent',
                    color: activeTab === tab.id ? '#1A3A52' : '#888888',
                    backgroundColor: activeTab === tab.id ? '#FFF9F0' : 'transparent'
                  }}
                >
                  <IconComponent size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {activeTab === 'dashboard' && <Dashboard />}

            {activeTab === 'processor' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="border-2 rounded-lg p-6" style={{ borderColor: '#FF9500', backgroundColor: '#FFF9F0' }}>
                  <h2 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Cole a Transcrição</h2>
                  <p className="text-sm mb-3" style={{ color: '#555555' }}>Abra o vídeo da reunião no Google Drive → Clique em "Transcrição" → Copie e cole aqui</p>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Cole a transcrição completa da reunião aqui..."
                    className="w-full h-48 p-4 border rounded-lg focus:outline-none font-mono text-sm"
                    style={{ borderColor: '#FF9500' }}
                  />
                </div>

                <button
                  onClick={processTranscription}
                  disabled={processing || !transcription.trim()}
                  className="w-full text-white py-4 rounded-lg font-bold text-lg transition"
                  style={{ 
                    background: 'linear-gradient(135deg, #FF9500 0%, #FFB347 100%)',
                    opacity: processing || !transcription.trim() ? '0.6' : '1',
                    cursor: processing || !transcription.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {processing ? 'Processando...' : 'Processar Transcrição com Claude'}
                </button>

                {processedData && (
                  <div className="border-2 rounded-lg p-6" style={{ borderColor: '#2ECC71', backgroundColor: '#F0FFF4' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: '#1A3A52' }}>Resultado da Análise</h2>
                    
                    <div className="bg-white p-4 rounded-lg mb-4">
                      <p className="text-sm font-semibold mb-1" style={{ color: '#1A3A52' }}>RESUMO DA REUNIÃO</p>
                      <p style={{ color: '#555555' }}>{processedData.resumo}</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg mb-4">
                      <p className="text-sm font-semibold mb-2" style={{ color: '#1A3A52' }}>TAREFAS IDENTIFICADAS</p>
                      <div className="space-y-2">
                        {processedData.tarefas.map((t, i) => (
                          <div key={i} style={{ borderLeft: '4px solid #FF9500', paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}>
                            <p className="font-semibold" style={{ color: '#1A3A52' }}>{t.descricao}</p>
                            <p className="text-sm" style={{ color: '#555555' }}>Responsável: {t.responsavel}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={addTasksToBoard}
                      className="w-full text-white py-3 rounded-lg font-semibold transition"
                      style={{ 
                        backgroundColor: '#2ECC71'
                      }}
                    >
                      Adicionar Tarefas ao Dashboard
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
