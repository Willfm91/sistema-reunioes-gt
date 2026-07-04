import React, { useState, useEffect } from 'react';
import { BarChart3, Settings, Filter, Edit2, Trash2, Download, CheckCircle, Lightbulb } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function TaskAutomationSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [combinados, setCombinados] = useState([]);
  const [insights, setInsights] = useState([]);
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
    const savedCombinados = localStorage.getItem('combinados');
    const savedInsights = localStorage.getItem('insights');
    
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Error loading tasks:', e);
      }
    }
    
    if (savedCombinados) {
      try {
        setCombinados(JSON.parse(savedCombinados));
      } catch (e) {
        console.error('Error loading combinados:', e);
      }
    }
    
    if (savedInsights) {
      try {
        setInsights(JSON.parse(savedInsights));
      } catch (e) {
        console.error('Error loading insights:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  useEffect(() => {
    if (combinados.length > 0) {
      localStorage.setItem('combinados', JSON.stringify(combinados));
    }
  }, [combinados]);

  useEffect(() => {
    if (insights.length > 0) {
      localStorage.setItem('insights', JSON.stringify(insights));
    }
  }, [insights]);

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

    // Adicionar tarefas
    setTasks([...tasks, ...newTasks]);

    // Adicionar combinados (se existirem)
    if (processedData.combinados && processedData.combinados.length > 0) {
      const newCombinados = processedData.combinados.map((c, idx) => ({
        id: Date.now() + 10000 + idx,
        descricao: c.descricao,
        responsavel: c.responsavel || 'Geral',
        dataReuniao: processedData.dataReuniao,
        horaReuniao: processedData.horaReuniao
      }));
      setCombinados([...combinados, ...newCombinados]);
    }

    // Adicionar insights (se existirem)
    if (processedData.insights && processedData.insights.length > 0) {
      const newInsights = processedData.insights.map((i, idx) => ({
        id: Date.now() + 20000 + idx,
        descricao: i.descricao,
        responsavel: i.responsavel || 'Geral',
        dataReuniao: processedData.dataReuniao,
        horaReuniao: processedData.horaReuniao
      }));
      setInsights([...insights, ...newInsights]);
    }

    setProcessedData(null);
    setTranscription('');
    alert('Tarefas, combinados e insights adicionados!');
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

  const clearAllData = () => {
    if (confirm('Tem certeza que quer deletar TODAS as atividades, combinados e insights? Esta ação não pode ser desfeita!')) {
      setTasks([]);
      setCombinados([]);
      setInsights([]);
      localStorage.removeItem('tasks');
      localStorage.removeItem('combinados');
      localStorage.removeItem('insights');
      alert('Todos os dados foram deletados!');
    }
  };
    if (tarefasParaExportar.length === 0) {
      alert('Nenhuma tarefa para exportar com os filtros selecionados!');
      return;
    }

    // Agrupar por responsável
    const tarefasPorResponsavel = {};
    tarefasParaExportar.forEach(task => {
      const responsavel = task.responsavel || 'Sem responsável';
      if (!tarefasPorResponsavel[responsavel]) {
        tarefasPorResponsavel[responsavel] = [];
      }
      tarefasPorResponsavel[responsavel].push(task);
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let yPosition = 20;
    let contador = 1;

    // Para cada responsável
    Object.keys(tarefasPorResponsavel).forEach((responsavel, indexResp) => {
      const tarefasResponsavel = tarefasPorResponsavel[responsavel];
      
      // Se não é a primeira página e há espaço insuficiente, nova página
      if (indexResp > 0 && yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      // Título com responsável
      doc.setFontSize(14);
      doc.setTextColor(26, 58, 82);
      doc.setFont(undefined, 'bold');
      const primeiraData = tarefasResponsavel[0].dataReuniao;
      doc.text(`Atividades Pendentes | ${responsavel}`, marginLeft, yPosition);
      yPosition += 6;
      
      // Data da reunião
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Data da reunião: ${primeiraData}`, marginLeft, yPosition);
      yPosition += 8;

      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 8;

      // Tarefas deste responsável
      tarefasResponsavel.forEach((task, indexTask) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - 25) {
          doc.addPage();
          yPosition = 15;
        }

        // Atividade
        doc.setFontSize(9);
        doc.setTextColor(26, 58, 82);
        doc.setFont(undefined, 'normal');
        const atividadeText = `${contador}. ${task.descricao}`;
        const atividadeLines = doc.splitTextToSize(atividadeText, contentWidth - 5);
        doc.text(atividadeLines, marginLeft + 5, yPosition);
        yPosition += atividadeLines.length * 4 + 2;

        // Deadline
        doc.setFontSize(8);
        doc.setTextColor(85, 85, 85);
        const deadlineText = `Deadline: ${task.deadline || 'Não definido'}`;
        doc.text(deadlineText, marginLeft + 10, yPosition);
        yPosition += 6;

        // Espaço entre tarefas
        yPosition += 2;
        contador++;
      });

      // Espaço entre responsáveis
      yPosition += 4;
    });

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('TaskFlow by Willian Marins - Sistema de Gerenciamento de Atividades', marginLeft, pageHeight - 8);

    // Salvar
    doc.save(`TaskFlow_Atividades_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const Dashboard = () => {
    // Filtro de datas - PRIMEIRO calcula as filtradas
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

    // DEPOIS calcula os KPIs baseado nas filtradas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const atrasadas = tarefasFiltradas.filter(t => {
      if (t.status === 'Concluído') return false;
      if (!t.deadline) return false;
      const deadlineDate = new Date(t.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      return deadlineDate < today;
    }).length;

    // Tarefas concluídas com atraso (das filtradas)
    const concluidasComAtraso = tarefasFiltradas.filter(t => t.status === 'Concluído' && t.diasAtraso > 0);
    const mediaAtraso = concluidasComAtraso.length > 0 
      ? (concluidasComAtraso.reduce((sum, t) => sum + t.diasAtraso, 0) / concluidasComAtraso.length).toFixed(1)
      : 0;

    const concluidas = tarefasFiltradas.filter(t => t.status === 'Concluído').length;
    const emProgresso = tarefasFiltradas.filter(t => t.status === 'Não Iniciado' || t.status === 'Em Progresso').length;
    const total = tarefasFiltradas.length;

    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
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

        <div className="flex justify-end">
          <button
            onClick={() => generatePDFWithTasks(tarefasFiltradas)}
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F0F8FF', borderColor: '#1A3A52' }}>
            <div className="text-sm font-medium mb-1" style={{ color: '#1A3A52' }}>Total</div>
            <div className="text-2xl font-bold" style={{ color: '#1A3A52' }}>{total}</div>
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
                            <div className="absolute top-0 left-0 bg-white border-2 border-orange-400 rounded shadow-lg z-10" style={{ borderColor: '#FF9500' }}>
                              {['Alta', 'Média', 'Baixa'].map(p => (
                                <div
                                  key={p}
                                  onClick={() => {
                                    updatePrioridade(task.id, p);
                                    setEditingPrioridade(task.id);
                                  }}
                                  className="px-4 py-2 cursor-pointer text-sm transition"
                                  style={{ 
                                    color: p === 'Alta' ? '#E63946' : p === 'Média' ? '#FF9500' : '#1A3A52',
                                    backgroundColor: task.prioridade === p ? '#FFF9F0' : '#FFFFFF'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#F5F5F5'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = task.prioridade === p ? '#FFF9F0' : '#FFFFFF'}
                                >
                                  {p === task.prioridade ? '✓ ' : '  '}{p}
                                </div>
                              ))}
                            </div>
                            <span 
                              className="px-3 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor: task.prioridade === 'Alta' ? '#FFE6E6' : task.prioridade === 'Média' ? '#FFF9F0' : '#F0F8FF',
                                color: task.prioridade === 'Alta' ? '#E63946' : task.prioridade === 'Média' ? '#FF9500' : '#1A3A52',
                                border: '2px solid #FF9500'
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

  const Combinados = () => {
    const addCombinado = () => {
      const descricao = prompt('Descreva o combinado:');
      const responsavel = prompt('De quem é? (nome):');
      const dataReuniao = prompt('Data da reunião (YYYY-MM-DD):');
      const horaReuniao = prompt('Hora da reunião (HH:MM):');

      if (descricao && responsavel && dataReuniao && horaReuniao) {
        const novoCombinado = {
          id: Date.now(),
          descricao,
          responsavel,
          dataReuniao,
          horaReuniao
        };
        setCombinados([...combinados, novoCombinado]);
        alert('Combinado adicionado!');
      }
    };

    const deleteCombinado = (id) => {
      if (confirm('Tem certeza que quer deletar este combinado?')) {
        setCombinados(combinados.filter(c => c.id !== id));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={addCombinado}
            className="px-4 py-2 rounded text-sm font-semibold text-white transition"
            style={{ backgroundColor: '#FF9500' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}
          >
            + Adicionar Combinado
          </button>
        </div>

        <div className="space-y-3">
          {combinados.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>Nenhum combinado registrado ainda.</p>
            </div>
          ) : (
            combinados.map(combinado => (
              <div key={combinado.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: '#1A3A52' }}>{combinado.descricao}</p>
                    <p className="text-sm mt-2" style={{ color: '#555555' }}>Pessoa: <span className="font-semibold">{combinado.responsavel}</span></p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#555555' }}>Data: <span className="font-semibold">{combinado.dataReuniao}</span></p>
                    <p className="text-sm mt-2" style={{ color: '#555555' }}>Hora: <span className="font-semibold">{combinado.horaReuniao}</span></p>
                  </div>
                  <div className="flex justify-end items-start">
                    <button
                      onClick={() => deleteCombinado(combinado.id)}
                      className="text-sm font-medium"
                      style={{ color: '#E63946' }}
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const Insights = () => {
    const addInsight = () => {
      const descricao = prompt('Descreva o insight (ex: Hooks dos videos são fracos, dificuldade em chamar atenção):');
      const responsavel = prompt('De quem é? (nome):');
      const dataReuniao = prompt('Data da reunião (YYYY-MM-DD):');
      const horaReuniao = prompt('Hora da reunião (HH:MM):');

      if (descricao && responsavel && dataReuniao && horaReuniao) {
        const novoInsight = {
          id: Date.now(),
          descricao,
          responsavel,
          dataReuniao,
          horaReuniao
        };
        setInsights([...insights, novoInsight]);
        alert('Insight adicionado!');
      }
    };

    const deleteInsight = (id) => {
      if (confirm('Tem certeza que quer deletar este insight?')) {
        setInsights(insights.filter(i => i.id !== id));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={addInsight}
            className="px-4 py-2 rounded text-sm font-semibold text-white transition"
            style={{ backgroundColor: '#FF9500' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}
          >
            + Adicionar Insight
          </button>
        </div>

        <div className="space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>Nenhum insight registrado ainda.</p>
            </div>
          ) : (
            insights.map(insight => (
              <div key={insight.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: '#1A3A52' }}>{insight.descricao}</p>
                    <p className="text-sm mt-2" style={{ color: '#555555' }}>Pessoa: <span className="font-semibold">{insight.responsavel}</span></p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#555555' }}>Data: <span className="font-semibold">{insight.dataReuniao}</span></p>
                    <p className="text-sm mt-2" style={{ color: '#555555' }}>Hora: <span className="font-semibold">{insight.horaReuniao}</span></p>
                  </div>
                  <div className="flex justify-end items-start">
                    <button
                      onClick={() => deleteInsight(insight.id)}
                      className="text-sm font-medium"
                      style={{ color: '#E63946' }}
                    >
                      Deletar
                    </button>
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
    <div className="min-h-screen bg-gray-50 p-4" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0, 82, 255, 0.15)' }}>
          <div className="text-white p-8" style={{ background: 'linear-gradient(135deg, #1A3A52 0%, #2D5A7B 100%)' }}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold mb-1">TaskFlow</h1>
                <p className="text-base mb-3 opacity-90">by Willian Marins</p>
                <p className="text-base opacity-95">Processe transcrições, extraia tarefas e acompanhe prazos automaticamente</p>
              </div>
              <button
                onClick={clearAllData}
                className="px-4 py-2 rounded text-sm font-semibold transition text-red-600"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
                title="Deletar tudo"
              >
                Limpar Tudo
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 flex">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'processor', label: 'Processar', icon: Settings },
              { id: 'combinados', label: 'Combinados', icon: CheckCircle },
              { id: 'insights', label: 'Insights', icon: Lightbulb }
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

            {activeTab === 'combinados' && <Combinados />}

            {activeTab === 'insights' && <Insights />}

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
