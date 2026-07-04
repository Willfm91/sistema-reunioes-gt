import React, { useState, useEffect } from 'react';
import { BarChart3, Settings, Filter, Edit2, Trash2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [editingResponsavel, setEditingResponsavel] = useState(null);
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterStatus, setFilterStatus] = useState('aberto');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    taskId: null,
    deadline: '',
    deliveryDate: '',
    responsavel: ''
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (editingPrioridade && !e.target.closest('[data-prioridade-dropdown]')) {
        setEditingPrioridade(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [editingPrioridade]);

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

  const updateResponsavel = (taskId, novoResponsavel) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, responsavel: novoResponsavel } : t
    ));
    setEditingResponsavel(null);
  };

  const updateTask = (taskId) => {
    const deadline = new Date(formData.deadline);
    const delivery = formData.deliveryDate ? new Date(formData.deliveryDate) : null;
    
    let diasAtraso = 0;
    let statusEntrega = 'Pendente';
    let novoStatus = 'Não Iniciado';
    
    // Se preencheu data de entrega, muda pra Concluído automaticamente
    if (delivery) {
      novoStatus = 'Concluído';
      diasAtraso = Math.floor((delivery.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      statusEntrega = diasAtraso > 0 ? `Atrasado ${diasAtraso} dias` : `Antecipado ${Math.abs(diasAtraso)} dias`;
    }

    setTasks(tasks.map(t => 
      t.id === taskId 
        ? {
            ...t,
            deadline: formData.deadline,
            dataEntrega: formData.deliveryDate,
            status: novoStatus,
            diasAtraso,
            statusEntrega,
            responsavel: formData.responsavel || t.responsavel
          }
        : t
    ));

    setEditingTask(null);
    setFormData({ taskId: null, deadline: '', deliveryDate: '', responsavel: '' });
  };

  const deleteTask = (taskId) => {
    setDeleteConfirm(taskId);
  };

  const confirmDelete = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    setDeleteConfirm(null);
  };

  const getResponsaveisUnicos = () => {
    const responsaveis = tasks.map(t => t.responsavel);
    return [...new Set(responsaveis)].filter(Boolean);
  };

  const generatePDF = () => {
    const tarefasAbertas = tasks.filter(t => t.status !== 'Concluído');
    
    if (tarefasAbertas.length === 0) {
      alert('Nenhuma tarefa em aberto para exportar!');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Título
    doc.setFontSize(20);
    doc.setTextColor(26, 58, 82);
    doc.text('Atividades Pendentes', 20, yPosition);
    yPosition += 10;

    // Data de geração
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, yPosition);
    yPosition += 10;

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 8;

    // Tarefas
    tarefasAbertas.forEach((task, index) => {
      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      // Número da tarefa
      doc.setFontSize(11);
      doc.setTextColor(26, 58, 82);
      doc.text(`${index + 1}. ${task.descricao}`, 20, yPosition);
      yPosition += 7;

      // Detalhes
      doc.setFontSize(9);
      doc.setTextColor(85, 85, 85);
      doc.text(`Responsável: ${task.responsavel}`, 25, yPosition);
      yPosition += 5;
      doc.text(`Prioridade: ${task.prioridade}`, 25, yPosition);
      yPosition += 5;
      doc.text(`Data da Reunião: ${task.dataReuniao} às ${task.horaReuniao}`, 25, yPosition);
      yPosition += 5;
      doc.text(`Deadline: ${task.deadline || 'Não definido'}`, 25, yPosition);
      yPosition += 5;

      // Resumo (se houver)
      // REMOVIDO: Não incluir resumo no PDF

      // Espaço entre tarefas
      yPosition += 5;
      doc.setDrawColor(230, 230, 230);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 5;
    });

    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('TaskFlow by Willian Marins - Sistema de Gerenciamento de Atividades', 20, pageHeight - 10);

    // Salvar
    doc.save(`TaskFlow_Atividades_${new Date().toISOString().split('T')[0]}.pdf`);
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

    // Tarefas concluídas com atraso
    const concluidasComAtraso = tasks.filter(t => t.status === 'Concluído' && t.diasAtraso > 0);
    const mediaAtraso = concluidasComAtraso.length > 0 
      ? (concluidasComAtraso.reduce((sum, t) => sum + t.diasAtraso, 0) / concluidasComAtraso.length).toFixed(1)
      : 0;

    const concluidas = tasks.filter(t => t.status === 'Concluído').length;
    const emProgresso = tasks.filter(t => t.status === 'Não Iniciado' || t.status === 'Em Progresso').length;

    // Filtro de datas
    const tarefasFiltradas = tasks.filter(t => {
      // Filtro de status: Em Aberto ou Concluídas
      if (filterStatus === 'aberto' && t.status === 'Concluído') return false;
      if (filterStatus === 'concluidas' && t.status !== 'Concluído') return false;
      
      if (filterResponsavel && t.responsavel !== filterResponsavel) return false;
      if (filterPrioridade && t.prioridade !== filterPrioridade) return false;
      
      // Filtro de data - verifica se a data da reunião está entre o período
      if (filterDataInicio || filterDataFim) {
        const dataReuniao = t.dataReuniao;
        if (filterDataInicio && dataReuniao < filterDataInicio) return false;
        if (filterDataFim && dataReuniao > filterDataFim) return false;
      }
      
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
          <div className="flex justify-end mb-4">
            <button
              onClick={generatePDF}
              className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition"
              style={{ 
                backgroundColor: '#FF9500',
                color: '#FFFFFF'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}
            >
              <Download size={16} /> Exportar PDF
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
              >
                <option value="aberto">Em Aberto</option>
                <option value="concluidas">Concluídas</option>
              </select>
            </div>
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
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Data Início:</label>
              <input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Data Fim:</label>
              <input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F0F8FF', borderColor: '#1A3A52' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#1A3A52' }}>Total</div>
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
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FFF0F0', borderColor: '#E63946' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#E63946' }}>Média Atraso</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{mediaAtraso} dias</div>
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
                <div key={task.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0, 82, 255, 0.08)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold" style={{ color: '#1A3A52' }}>{task.descricao}</p>
                      {editingResponsavel === task.id ? (
                        <input
                          type="text"
                          value={formData.responsavel || task.responsavel}
                          onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
                          onBlur={() => updateResponsavel(task.id, formData.responsavel || task.responsavel)}
                          onKeyPress={(e) => e.key === 'Enter' && updateResponsavel(task.id, formData.responsavel || task.responsavel)}
                          autoFocus
                          className="w-full px-2 py-1 rounded text-sm mt-1"
                          style={{ border: '1px solid #1A3A52', backgroundColor: '#FFFFFF', color: '#1A3A52' }}
                          placeholder="Nome do responsável"
                        />
                      ) : (
                        <p className="text-sm mt-1 cursor-pointer" style={{ color: '#555555' }} onClick={() => { setEditingResponsavel(task.id); setFormData({...formData, responsavel: task.responsavel}); }} title="Clique para editar">
                          Responsável: <span className="font-semibold">{task.responsavel}</span>
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: '#888888' }}>Data: {task.dataReuniao} às {task.horaReuniao}</p>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {editingPrioridade === task.id ? (
                          <div className="relative inline-block" data-prioridade-dropdown>
                            <div className="absolute top-0 left-0 bg-white border border-gray-300 rounded shadow-lg z-10">
                              {['Alta', 'Média', 'Baixa'].map(p => (
                                <div
                                  key={p}
                                  onClick={() => updatePrioridade(task.id, p)}
                                  className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                                  style={{ color: p === 'Alta' ? '#E63946' : p === 'Média' ? '#FF9500' : '#1A3A52' }}
                                >
                                  {p}
                                </div>
                              ))}
                            </div>
                            <span 
                              className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                              style={{
                                backgroundColor: task.prioridade === 'Alta' ? '#FFE6E6' : task.prioridade === 'Média' ? '#FFF9F0' : '#F0F8FF',
                                color: task.prioridade === 'Alta' ? '#E63946' : task.prioridade === 'Média' ? '#FF9500' : '#1A3A52'
                              }}
                            >
                              {task.prioridade}
                            </span>
                          </div>
                        ) : (
                          <span 
                            onClick={() => setEditingPrioridade(task.id)}
                            className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                            style={{
                              backgroundColor: task.prioridade === 'Alta' ? '#FFE6E6' : task.prioridade === 'Média' ? '#FFF9F0' : '#F0F8FF',
                              color: task.prioridade === 'Alta' ? '#E63946' : task.prioridade === 'Média' ? '#FF9500' : '#1A3A52'
                            }}
                            title="Clique para editar"
                          >
                            {task.prioridade}
                          </span>
                        )}
                        {task.status !== 'Não Iniciado' && (
                          <span className="px-3 py-1 rounded text-xs font-medium" style={{
                            backgroundColor: task.status === 'Concluído' ? '#F0FFF4' : task.status === 'Em Progresso' ? '#FFF9F0' : '#F5F5F5',
                            color: task.status === 'Concluído' ? '#2ECC71' : task.status === 'Em Progresso' ? '#FF9500' : '#888888'
                          }}>
                            {task.status}
                          </span>
                        )}
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
                            placeholder="Preencha para marcar como concluída"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTask(task.id)}
                              className="flex-1 text-white px-2 py-1 rounded text-sm font-medium"
                              style={{ backgroundColor: '#1A3A52' }}
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
                                  responsavel: task.responsavel
                                });
                              }}
                              className="text-sm font-medium"
                              style={{ color: '#1A3A52' }}
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
    <div className="min-h-screen bg-gray-50 p-4" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0, 82, 255, 0.15)' }}>
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
                    background: 'linear-gradient(135deg, #FF9500 0%, #B8FF00 100%)',
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

      {/* Modal de Confirmação de Delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm" style={{ boxShadow: '0 10px 40px rgba(26, 58, 82, 0.2)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Confirmar Exclusão</h3>
            <p className="mb-6" style={{ color: '#555555' }}>Tem certeza que deseja deletar esta tarefa? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmDelete(deleteConfirm)}
                className="flex-1 text-white py-2 rounded-lg font-semibold transition"
                style={{ backgroundColor: '#E63946' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#C92A33'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#E63946'}
              >
                Confirmar Deletar
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg font-semibold transition"
                style={{ backgroundColor: '#E0E0E0', color: '#555555' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#D0D0D0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#E0E0E0'}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
