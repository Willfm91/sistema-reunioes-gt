import { useState, useEffect } from 'react';
import { BarChart3, Settings, Filter, Edit2, Trash2, Download, CheckCircle, Lightbulb, Plus } from 'lucide-react';
import jsPDF from 'jspdf';

export default function Home() {
  const [activeTab, setActiveTab] = useState('processor');
  const [tasks, setTasks] = useState([]);
  const [combinados, setCombinados] = useState([]);
  const [insights, setInsights] = useState([]);
  const [transcription, setTranscription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [openPrioridadeDropdown, setOpenPrioridadeDropdown] = useState(null);
  const [editingResponsavel, setEditingResponsavel] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterStatus, setFilterStatus] = useState('aberto');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [formData, setFormData] = useState({
    taskId: null,
    deadline: '',
    deliveryDate: '',
    responsavel: ''
  });
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    descricao: '',
    responsavel: '',
    prioridade: 'Média',
    deadline: ''
  });

  // Carregar dados do localStorage
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

  // Salvar tarefas
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  // Salvar combinados
  useEffect(() => {
    if (combinados.length > 0) {
      localStorage.setItem('combinados', JSON.stringify(combinados));
    }
  }, [combinados]);

  // Salvar insights
  useEffect(() => {
    if (insights.length > 0) {
      localStorage.setItem('insights', JSON.stringify(insights));
    }
  }, [insights]);

  const createNewTask = () => {
    if (!newTaskData.descricao.trim()) {
      alert('Descreva a atividade');
      return;
    }

    const novaTask = {
      id: Date.now(),
      descricao: newTaskData.descricao,
      responsavel: newTaskData.responsavel || 'Sem responsável',
      prioridade: newTaskData.prioridade,
      dataReuniao: new Date().toISOString().split('T')[0],
      horaReuniao: new Date().toTimeString().split(' ')[0].substring(0, 5),
      resumo: '',
      deadline: newTaskData.deadline,
      dataEntrega: '',
      status: 'Em Progresso',
      diasAtraso: 0
    };

    setTasks([...tasks, novaTask]);
    setNewTaskData({ descricao: '', responsavel: '', prioridade: 'Média', deadline: '' });
    setShowCreateTask(false);
    alert('Atividade criada!');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription })
      });

      if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
      const result = await response.json();
      console.log('Resultado da API:', result);
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
      status: 'Em Progresso',
      diasAtraso: 0
    }));

    setTasks([...tasks, ...newTasks]);

    if (processedData.combinados && processedData.combinados.length > 0) {
      const newCombinados = processedData.combinados.map((c, idx) => ({
        id: Date.now() + 10000 + idx,
        descricao: c.descricao,
        responsavel: c.responsavel || 'Geral',
        dataReuniao: processedData.dataReuniao,
        horaReuniao: processedData.horaReuniao
      }));
      setCombinados([...combinados, ...newCombinados]);
      console.log('Combinados adicionados:', newCombinados);
    }

    if (processedData.insights && processedData.insights.length > 0) {
      const newInsights = processedData.insights.map((i, idx) => ({
        id: Date.now() + 20000 + idx,
        descricao: i.descricao,
        responsavel: i.responsavel || 'Geral',
        dataReuniao: processedData.dataReuniao,
        horaReuniao: processedData.horaReuniao
      }));
      setInsights([...insights, ...newInsights]);
      console.log('Insights adicionados:', newInsights);
    }

    setProcessedData(null);
    setTranscription('');
    alert('Tarefas, combinados e insights adicionados!');
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

  const generatePDFCombinados = (combinadosFiltrados) => {
    if (combinadosFiltrados.length === 0) {
      alert('Nenhum combinado para exportar com os filtros selecionados!');
      return;
    }

    const combinadosPorResponsavel = {};
    combinadosFiltrados.forEach(combinado => {
      const responsavel = combinado.responsavel || 'Sem responsável';
      if (!combinadosPorResponsavel[responsavel]) {
        combinadosPorResponsavel[responsavel] = [];
      }
      combinadosPorResponsavel[responsavel].push(combinado);
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let yPosition = 20;
    let contador = 1;

    doc.setFontSize(18);
    doc.setTextColor(26, 58, 82);
    doc.setFont(undefined, 'bold');
    doc.text('Combinados da Reunião', marginLeft, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, marginLeft, yPosition);
    yPosition += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
    yPosition += 8;

    Object.keys(combinadosPorResponsavel).forEach((responsavel, indexResp) => {
      const combinadosResponsavel = combinadosPorResponsavel[responsavel];

      if (indexResp > 0 && yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(12);
      doc.setTextColor(26, 58, 82);
      doc.setFont(undefined, 'bold');
      doc.text(responsavel, marginLeft, yPosition);
      yPosition += 6;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Data: ${combinadosResponsavel[0].dataReuniao}`, marginLeft, yPosition);
      yPosition += 6;

      doc.setDrawColor(220, 220, 220);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 6;

      combinadosResponsavel.forEach((combinado) => {
        if (yPosition > pageHeight - 25) {
          doc.addPage();
          yPosition = 15;
        }

        doc.setFontSize(9);
        doc.setTextColor(26, 58, 82);
        doc.setFont(undefined, 'normal');
        const descricaoText = `${contador}. ${combinado.descricao}`;
        const descricaoLines = doc.splitTextToSize(descricaoText, contentWidth - 5);
        doc.text(descricaoLines, marginLeft + 5, yPosition);
        yPosition += descricaoLines.length * 4 + 3;
        contador++;
      });

      yPosition += 4;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Post-Meeting Progress by Willian - Sistema de Gerenciamento de Atividades', marginLeft, pageHeight - 8);

    doc.save(`PostMeeting_Combinados_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generatePDFInsights = (insightsFiltrados) => {
    if (insightsFiltrados.length === 0) {
      alert('Nenhum insight para exportar com os filtros selecionados!');
      return;
    }

    const insightsPorResponsavel = {};
    insightsFiltrados.forEach(insight => {
      const responsavel = insight.responsavel || 'Sem responsável';
      if (!insightsPorResponsavel[responsavel]) {
        insightsPorResponsavel[responsavel] = [];
      }
      insightsPorResponsavel[responsavel].push(insight);
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let yPosition = 20;
    let contador = 1;

    doc.setFontSize(18);
    doc.setTextColor(26, 58, 82);
    doc.setFont(undefined, 'bold');
    doc.text('Insights da Reunião', marginLeft, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, marginLeft, yPosition);
    yPosition += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
    yPosition += 8;

    Object.keys(insightsPorResponsavel).forEach((responsavel, indexResp) => {
      const insightsResponsavel = insightsPorResponsavel[responsavel];

      if (indexResp > 0 && yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(12);
      doc.setTextColor(26, 58, 82);
      doc.setFont(undefined, 'bold');
      doc.text(responsavel, marginLeft, yPosition);
      yPosition += 6;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Data: ${insightsResponsavel[0].dataReuniao}`, marginLeft, yPosition);
      yPosition += 6;

      doc.setDrawColor(220, 220, 220);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 6;

      insightsResponsavel.forEach((insight) => {
        if (yPosition > pageHeight - 25) {
          doc.addPage();
          yPosition = 15;
        }

        doc.setFontSize(9);
        doc.setTextColor(26, 58, 82);
        doc.setFont(undefined, 'normal');
        const descricaoText = `${contador}. ${insight.descricao}`;
        const descricaoLines = doc.splitTextToSize(descricaoText, contentWidth - 5);
        doc.text(descricaoLines, marginLeft + 5, yPosition);
        yPosition += descricaoLines.length * 4 + 3;
        contador++;
      });

      yPosition += 4;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Post-Meeting Progress by Willian - Sistema de Gerenciamento de Atividades', marginLeft, pageHeight - 8);

    doc.save(`PostMeeting_Insights_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generatePDFWithTasks = (tarefasParaExportar) => {
    if (tarefasParaExportar.length === 0) {
      alert('Nenhuma tarefa para exportar com os filtros selecionados!');
      return;
    }

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

    Object.keys(tarefasPorResponsavel).forEach((responsavel, indexResp) => {
      const tarefasResponsavel = tarefasPorResponsavel[responsavel];

      if (indexResp > 0) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(14);
      doc.setTextColor(26, 58, 82);
      doc.setFont(undefined, 'bold');
      doc.text(`Atividades Pendentes | ${responsavel}`, marginLeft, yPosition);
      yPosition += 7;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Data da reunião: ${tarefasResponsavel[0].dataReuniao}`, marginLeft, yPosition);
      yPosition += 7;

      doc.setDrawColor(200, 200, 200);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 7;

      tarefasResponsavel.forEach((task, idx) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 15;
        }

        const descricaoCompleta = `${idx + 1}. ${task.descricao}`;
        const lines = doc.splitTextToSize(descricaoCompleta, contentWidth - 5);
        doc.setFontSize(9);
        doc.setTextColor(26, 58, 82);
        doc.setFont(undefined, 'normal');
        doc.text(lines, marginLeft, yPosition);
        yPosition += lines.length * 4 + 2;

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'normal');
        doc.text(`Deadline: ${task.deadline || 'Sem data'}`, marginLeft + 2, yPosition);
        yPosition += 5;
      });
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Post-Meeting Progress by Willian - Sistema de Gerenciamento de Atividades', marginLeft, pageHeight - 8);

    doc.save(`PostMeeting_Atividades_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const updatePrioridade = (taskId, newPrioridade) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, prioridade: newPrioridade } : task
    ));
    setOpenPrioridadeDropdown(null);
  };

  const updateResponsavel = (taskId, newResponsavel) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, responsavel: newResponsavel } : task
    ));
    setEditingResponsavel(null);
  };

  const updateDeliveryDate = (taskId, newDate) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        let newStatus = task.status;
        if (newDate) {
          newStatus = 'Concluído';
        } else {
          newStatus = 'Em Progresso';
        }
        return { ...task, dataEntrega: newDate, status: newStatus };
      }
      return task;
    }));
  };

  const saveTaskChanges = () => {
    if (!formData.taskId) return;

    const updatedTasks = tasks.map(task => {
      if (task.id === formData.taskId) {
        let newStatus = task.status;
        if (formData.deliveryDate) {
          newStatus = 'Concluído';
        } else {
          newStatus = 'Em Progresso';
        }

        return {
          ...task,
          deadline: formData.deadline,
          dataEntrega: formData.deliveryDate,
          status: newStatus,
          responsavel: formData.responsavel || task.responsavel
        };
      }
      return task;
    });

    setTasks(updatedTasks);
    setFormData({ taskId: null, deadline: '', deliveryDate: '', responsavel: '' });
    setEditingTask(null);
  };

  const deleteTask = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
    setDeleteConfirm(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (editingTask) setEditingTask(null);
      if (editingResponsavel) setEditingResponsavel(null);
      if (openPrioridadeDropdown) setOpenPrioridadeDropdown(null);
      if (showCreateTask) setShowCreateTask(false);
      if (deleteConfirm) setDeleteConfirm(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTask, editingResponsavel, openPrioridadeDropdown, showCreateTask, deleteConfirm]);

  const Dashboard = () => {
    const tarefasFiltradas = tasks.filter(task => {
      if (filterStatus === 'aberto' && task.status === 'Concluído') return false;
      if (filterStatus === 'concluidas' && task.status !== 'Concluído') return false;
      if (filterResponsavel && task.responsavel !== filterResponsavel) return false;
      if (filterPrioridade && task.prioridade !== filterPrioridade) return false;
      if (filterDataInicio && task.dataReuniao < filterDataInicio) return false;
      if (filterDataFim && task.dataReuniao > filterDataFim) return false;
      return true;
    });

    const today = new Date().toISOString().split('T')[0];
    const atrasadas = tarefasFiltradas.filter(t => {
      if (t.status === 'Concluído') return false;
      if (!t.deadline) return false;
      const deadlineDate = new Date(t.deadline);
      return deadlineDate < new Date(today);
    }).length;

    const concluidas = tarefasFiltradas.filter(t => t.status === 'Concluído').length;
    const emProgresso = tarefasFiltradas.filter(t => t.status !== 'Concluído').length;
    const total = tarefasFiltradas.length;

    const diasAtrasoTotal = tarefasFiltradas.reduce((sum, t) => {
      if (t.status === 'Concluído' || !t.deadline) return sum;
      const deadlineDate = new Date(t.deadline);
      const diffTime = new Date(today) - deadlineDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return sum + (diffDays > 0 ? diffDays : 0);
    }, 0);

    const mediaAtraso = atrasadas > 0 ? (diasAtrasoTotal / atrasadas).toFixed(1) : 0;

    const pessoasUnicas = [...new Set(tasks.map(t => t.responsavel))].filter(Boolean);
    const datasUnicas = [...new Set(tasks.map(t => t.dataReuniao))].filter(Boolean);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
            <p className="text-xs mb-2" style={{ color: '#888888' }}>Total</p>
            <p className="text-2xl font-bold" style={{ color: '#4A90E2' }}>{total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
            <p className="text-xs mb-2" style={{ color: '#888888' }}>Concluídas</p>
            <p className="text-2xl font-bold" style={{ color: '#2ECC71' }}>{concluidas}</p>
          </div>
          <div className="bg-white p-4 rounded-lg" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
            <p className="text-xs mb-2" style={{ color: '#888888' }}>Em Progresso</p>
            <p className="text-2xl font-bold" style={{ color: '#FF9500' }}>{emProgresso}</p>
          </div>
          <div className="bg-white p-4 rounded-lg" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
            <p className="text-xs mb-2" style={{ color: '#888888' }}>Atrasadas</p>
            <p className="text-2xl font-bold" style={{ color: '#E63946' }}>{atrasadas}</p>
          </div>
          <div className="bg-white p-4 rounded-lg" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
            <p className="text-xs mb-2" style={{ color: '#888888' }}>Média Atraso</p>
            <p className="text-2xl font-bold" style={{ color: '#9B59B6' }}>{mediaAtraso}d</p>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                <option value="aberto">Em Aberto</option>
                <option value="concluidas">Concluídas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Responsável:</label>
              <select value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                <option value="">Todos</option>
                {pessoasUnicas.map(pessoa => (<option key={pessoa} value={pessoa}>{pessoa}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Prioridade:</label>
              <select value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                <option value="">Todas</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Data Início:</label>
              <input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Data Fim:</label>
              <input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setShowCreateTask(true)} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#FF9500' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'} onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}>
            + Criar Atividade
          </button>
          <button onClick={() => generatePDFWithTasks(tarefasFiltradas)} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#1A3A52' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#0F1A29'} onMouseLeave={(e) => e.target.style.backgroundColor = '#1A3A52'}>
            Exportar PDF
          </button>
        </div>

        <div className="space-y-3">
          {tarefasFiltradas.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>Nenhuma tarefa encontrada</p>
            </div>
          ) : (
            tarefasFiltradas.map(task => (
              <div key={task.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <p className="font-semibold" style={{ color: '#1A3A52' }}>{task.descricao}</p>
                  </div>
                  <div></div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#555555' }} className="text-sm">Responsável:</span>
                      <span className="font-semibold" style={{ color: '#1A3A52' }}>{editingResponsavel === task.id ? (<input type="text" value={formData.responsavel} onChange={(e) => setFormData({...formData, responsavel: e.target.value})} autoFocus className="px-2 py-1 rounded text-sm" style={{ border: '1px solid #FF9500' }} onBlur={() => {updateResponsavel(task.id, formData.responsavel || task.responsavel); setFormData({...formData, responsavel: ''});}} />) : (<span onClick={() => {setEditingResponsavel(task.id); setFormData({...formData, responsavel: task.responsavel});}} className="cursor-pointer text-sm">{task.responsavel}</span>)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-3">
                  <div className="lg:col-span-2"></div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span style={{ color: '#555555' }}>Prioridade:</span>
                      <div className="relative">
                        <div 
                          onClick={() => setOpenPrioridadeDropdown(openPrioridadeDropdown === task.id ? null : task.id)}
                          className="px-2 py-1 rounded text-xs font-medium cursor-pointer" 
                          style={{ 
                            backgroundColor: task.prioridade === 'Alta' ? '#FFE6E6' : task.prioridade === 'Média' ? '#FFF9F0' : '#F0F8FF',
                            color: task.prioridade === 'Alta' ? '#E63946' : task.prioridade === 'Média' ? '#FF9500' : '#1A3A52',
                            border: '2px solid #FF9500'
                          }}
                        >
                          {task.prioridade}
                        </div>
                        {openPrioridadeDropdown === task.id && (
                          <div className="absolute top-full mt-1 bg-white border-2 rounded shadow-lg z-10" style={{ borderColor: '#FF9500', minWidth: '100px' }}>
                            {['Alta', 'Média', 'Baixa'].map(p => (
                              <div
                                key={p}
                                onClick={() => updatePrioridade(task.id, p)}
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
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => deleteTask(task.id)} className="text-sm font-medium" style={{ color: '#E63946' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-3">
                  <div className="lg:col-span-2"></div>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm" style={{ color: '#555555' }}>Deadline: <span className="font-semibold">{task.deadline || 'Sem data'}</span></div>
                    <div className="text-sm" style={{ color: '#555555' }}>Status: <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: task.status === 'Concluído' ? '#E6F9F0' : '#FFF3E0', color: task.status === 'Concluído' ? '#2ECC71' : '#FF9500' }}>{task.status}</span></div>
                  </div>
                  <div className="flex justify-end">
                    <input type="date" value={task.dataEntrega} onChange={(e) => updateDeliveryDate(task.id, e.target.value)} className="px-2 py-1 rounded text-xs" style={{ border: '1px solid #FF9500', backgroundColor: '#FFFFFF', color: '#1A3A52' }} title="Data de Entrega" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {processedData && (
          <div className="border-2 rounded-lg p-6" style={{ borderColor: '#FF9500', backgroundColor: '#FFF9F0' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Prévia do Processamento</h3>
            <p className="mb-3" style={{ color: '#555555' }}><strong>Resumo:</strong> {processedData.resumo}</p>
            <p className="mb-3 text-sm" style={{ color: '#555555' }}><strong>Atividades ({processedData.tarefas.length}):</strong></p>
            <div className="mb-4 space-y-2 pl-4 max-h-48 overflow-y-auto">
              {processedData.tarefas.map((t, idx) => (
                <div key={idx} style={{ color: '#555555' }} className="text-sm">
                  <strong>{idx + 1}. {t.descricao}</strong>
                  <br />
                  <span>Responsável: {t.responsavel} | Prioridade: {t.prioridade}</span>
                </div>
              ))}
            </div>
            {processedData.combinados && processedData.combinados.length > 0 && (
              <p className="mb-2 text-sm" style={{ color: '#555555' }}>Combinados encontrados: {processedData.combinados.length}</p>
            )}
            {processedData.insights && processedData.insights.length > 0 && (
              <p className="mb-3 text-sm" style={{ color: '#555555' }}>Insights encontrados: {processedData.insights.length}</p>
            )}
            <button onClick={addTasksToBoard} className="w-full text-white py-3 rounded-lg font-semibold transition" style={{ backgroundColor: '#2ECC71' }}>
              Concluir
            </button>
          </div>
        )}
      </div>
    );
  };

  const Combinados = () => {
    const [filterPessoaCombinado, setFilterPessoaCombinado] = useState('');
    const [filterDataCombinado, setFilterDataCombinado] = useState('');

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

    const combinadosFiltrados = combinados.filter(c => {
      if (filterPessoaCombinado && c.responsavel !== filterPessoaCombinado) return false;
      if (filterDataCombinado && c.dataReuniao !== filterDataCombinado) return false;
      return true;
    });

    const pessoasUnicasCombinado = [...new Set(combinados.map(c => c.responsavel))].filter(Boolean);
    const datasUnicasCombinado = [...new Set(combinados.map(c => c.dataReuniao))].filter(Boolean);

    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
          <div className="flex justify-between items-end gap-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Pessoa:</label>
                <select value={filterPessoaCombinado} onChange={(e) => setFilterPessoaCombinado(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                  <option value="">Todos</option>
                  {pessoasUnicasCombinado.map(pessoa => (<option key={pessoa} value={pessoa}>{pessoa}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Data da Reunião:</label>
                <select value={filterDataCombinado} onChange={(e) => setFilterDataCombinado(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                  <option value="">Todas</option>
                  {datasUnicasCombinado.map(data => (<option key={data} value={data}>{data}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addCombinado} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#FF9500' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'} onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}> + Adicionar</button>
              <button onClick={() => generatePDFCombinados(combinadosFiltrados)} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#1A3A52' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#0F1A29'} onMouseLeave={(e) => e.target.style.backgroundColor = '#1A3A52'}> Exportar PDF</button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {combinadosFiltrados.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>Nenhum combinado registrado ainda.</p>
            </div>
          ) : (
            combinadosFiltrados.map(combinado => (
              <div key={combinado.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <p className="font-semibold" style={{ color: '#1A3A52' }}>{combinado.descricao}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm" style={{ color: '#555555' }}>Pessoa: <span className="font-semibold">{combinado.responsavel}</span></p>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm" style={{ color: '#555555' }}>Data: <span className="font-semibold">{combinado.dataReuniao}</span></p>
                      <p className="text-sm mt-1" style={{ color: '#555555' }}>Hora: <span className="font-semibold">{combinado.horaReuniao}</span></p>
                    </div>
                    <button onClick={() => deleteCombinado(combinado.id)} style={{ color: '#E63946' }}>
                      <Trash2 size={18} />
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
    const [filterPessoaInsight, setFilterPessoaInsight] = useState('');
    const [filterDataInsight, setFilterDataInsight] = useState('');

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

    const insightsFiltrados = insights.filter(i => {
      if (filterPessoaInsight && i.responsavel !== filterPessoaInsight) return false;
      if (filterDataInsight && i.dataReuniao !== filterDataInsight) return false;
      return true;
    });

    const pessoasUnicasInsight = [...new Set(insights.map(i => i.responsavel))].filter(Boolean);
    const datasUnicasInsight = [...new Set(insights.map(i => i.dataReuniao))].filter(Boolean);

    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
          <div className="flex justify-between items-end gap-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Pessoa:</label>
                <select value={filterPessoaInsight} onChange={(e) => setFilterPessoaInsight(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                  <option value="">Todos</option>
                  {pessoasUnicasInsight.map(pessoa => (<option key={pessoa} value={pessoa}>{pessoa}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Por Data da Reunião:</label>
                <select value={filterDataInsight} onChange={(e) => setFilterDataInsight(e.target.value)} className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid #CCCCCC', backgroundColor: '#FFFFFF', color: '#1A3A52' }}>
                  <option value="">Todas</option>
                  {datasUnicasInsight.map(data => (<option key={data} value={data}>{data}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addInsight} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#FF9500' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#E68A00'} onMouseLeave={(e) => e.target.style.backgroundColor = '#FF9500'}> + Adicionar</button>
              <button onClick={() => generatePDFInsights(insightsFiltrados)} className="px-4 py-2 rounded text-sm font-semibold text-white transition" style={{ backgroundColor: '#1A3A52' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#0F1A29'} onMouseLeave={(e) => e.target.style.backgroundColor = '#1A3A52'}> Exportar PDF</button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {insightsFiltrados.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#F9F9F9', border: '1px solid #E0E0E0' }}>
              <p style={{ color: '#888888' }}>Nenhum insight registrado ainda.</p>
            </div>
          ) : (
            insightsFiltrados.map(insight => (
              <div key={insight.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(26, 58, 82, 0.08)' }}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <p className="font-semibold" style={{ color: '#1A3A52' }}>{insight.descricao}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm" style={{ color: '#555555' }}>Pessoa: <span className="font-semibold">{insight.responsavel}</span></p>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm" style={{ color: '#555555' }}>Data: <span className="font-semibold">{insight.dataReuniao}</span></p>
                      <p className="text-sm mt-1" style={{ color: '#555555' }}>Hora: <span className="font-semibold">{insight.horaReuniao}</span></p>
                    </div>
                    <button onClick={() => deleteInsight(insight.id)} style={{ color: '#E63946' }}>
                      <Trash2 size={18} />
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
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0, 82, 255, 0.15)' }}>
          <div className="text-white p-8" style={{ background: 'linear-gradient(135deg, #1A3A52 0%, #2D5A7B 100%)' }}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold mb-1">Post-Meeting Progress</h1>
                <p className="text-base mb-3 opacity-90">by Willian</p>
                <p className="text-base opacity-95">Extraia tarefas, combinados e insights das suas reuniões em um único lugar</p>
              </div>
              <button onClick={clearAllData} className="px-4 py-2 rounded text-sm font-semibold transition" style={{ backgroundColor: '#0052D4', color: '#AAAAAA' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#003DA8'} onMouseLeave={(e) => e.target.style.backgroundColor = '#0052D4'} title="Deletar tudo">Limpar Tudo</button>
            </div>
          </div>

          <div className="border-b border-slate-200 flex">
            {[
              { id: 'processor', label: 'Processar', icon: Settings },
              { id: 'tarefas', label: 'Tarefas', icon: BarChart3 },
              { id: 'combinados', label: 'Combinados', icon: CheckCircle },
              { id: 'insights', label: 'Insights', icon: Lightbulb }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex items-center gap-2 px-6 py-4 border-b-2 font-semibold transition" style={{ borderColor: activeTab === tab.id ? '#FF9500' : 'transparent', color: activeTab === tab.id ? '#FF9500' : '#999999' }} onMouseEnter={(e) => { if (activeTab !== tab.id) e.target.style.color = '#666666'; }} onMouseLeave={(e) => { if (activeTab !== tab.id) e.target.style.color = '#999999'; }}>
                  <IconComponent size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {activeTab === 'tarefas' && <Dashboard />}

            {activeTab === 'combinados' && <Combinados />}

            {activeTab === 'insights' && <Insights />}

            {activeTab === 'processor' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="border-2 rounded-lg p-6" style={{ borderColor: '#FF9500', backgroundColor: '#FFF9F0' }}>
                  <h2 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Cole a Transcrição</h2>
                  <p className="text-sm mb-3" style={{ color: '#555555' }}>Abra o vídeo da reunião no Google Drive → Clique em "Transcrição" → Copie e cole aqui</p>
                  <textarea value={transcription} onChange={(e) => setTranscription(e.target.value)} placeholder="Cole a transcrição completa da reunião aqui..." className="w-full h-48 p-4 border rounded-lg focus:outline-none font-mono text-sm" style={{ borderColor: '#FF9500', backgroundColor: '#FFFFFF' }} />
                  <button onClick={processTranscription} disabled={processing} className="w-full mt-4 text-white py-3 rounded-lg font-semibold transition" style={{ backgroundColor: processing ? '#CCCCCC' : '#FF9500' }} onMouseEnter={(e) => { if (!processing) e.target.style.backgroundColor = '#E68A00'; }} onMouseLeave={(e) => { if (!processing) e.target.style.backgroundColor = '#FF9500'; }}>
                    {processing ? 'Processando...' : 'Processar'}
                  </button>
                </div>

                {processedData && (
                  <div className="border-2 rounded-lg p-6" style={{ borderColor: '#FF9500', backgroundColor: '#FFF9F0' }}>
                    <h3 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Prévia do Processamento</h3>
                    <p className="mb-4" style={{ color: '#555555' }}><strong>Resumo:</strong> {processedData.resumo}</p>
                    <p className="mb-2 text-sm font-semibold" style={{ color: '#1A3A52' }}>Atividades ({processedData.tarefas.length}):</p>
                    <div className="mb-4 space-y-2 pl-4 max-h-48 overflow-y-auto">
                      {processedData.tarefas.map((t, idx) => (
                        <div key={idx} style={{ color: '#555555' }} className="text-sm">
                          <strong>{idx + 1}. {t.descricao}</strong>
                          <br />
                          <span>Responsável: {t.responsavel} | Prioridade: {t.prioridade}</span>
                        </div>
                      ))}
                    </div>
                    {processedData.combinados && processedData.combinados.length > 0 && (
                      <p className="mb-2 text-sm" style={{ color: '#555555' }}>Combinados encontrados: {processedData.combinados.length}</p>
                    )}
                    {processedData.insights && processedData.insights.length > 0 && (
                      <p className="mb-3 text-sm" style={{ color: '#555555' }}>Insights encontrados: {processedData.insights.length}</p>
                    )}
                    <button onClick={addTasksToBoard} className="w-full text-white py-3 rounded-lg font-semibold transition" style={{ backgroundColor: '#2ECC71' }}>
                      Concluir
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm" style={{ boxShadow: '0 10px 40px rgba(26, 58, 82, 0.2)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Criar Nova Atividade</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Descrição:</label>
                <input type="text" value={newTaskData.descricao} onChange={(e) => setNewTaskData({...newTaskData, descricao: e.target.value})} placeholder="Descreva a atividade..." className="w-full px-3 py-2 border rounded" style={{ borderColor: '#FF9500' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Responsável:</label>
                <input type="text" value={newTaskData.responsavel} onChange={(e) => setNewTaskData({...newTaskData, responsavel: e.target.value})} placeholder="Nome da pessoa..." className="w-full px-3 py-2 border rounded" style={{ borderColor: '#FF9500' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Prioridade:</label>
                <select value={newTaskData.prioridade} onChange={(e) => setNewTaskData({...newTaskData, prioridade: e.target.value})} className="w-full px-3 py-2 border rounded" style={{ borderColor: '#FF9500' }}>
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#555555' }}>Deadline (opcional):</label>
                <input type="date" value={newTaskData.deadline} onChange={(e) => setNewTaskData({...newTaskData, deadline: e.target.value})} className="w-full px-3 py-2 border rounded" style={{ borderColor: '#FF9500' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createNewTask} className="flex-1 text-white py-2 rounded-lg font-semibold transition" style={{ backgroundColor: '#2ECC71' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#25B85F'} onMouseLeave={(e) => e.target.style.backgroundColor = '#2ECC71'}>
                Criar
              </button>
              <button onClick={() => {setShowCreateTask(false); setNewTaskData({ descricao: '', responsavel: '', prioridade: 'Média', deadline: '' });}} className="flex-1 py-2 rounded-lg font-semibold transition" style={{ backgroundColor: '#CCCCCC', color: '#555555' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#AAAAAA'} onMouseLeave={(e) => e.target.style.backgroundColor = '#CCCCCC'}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm" style={{ boxShadow: '0 10px 40px rgba(26, 58, 82, 0.2)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#1A3A52' }}>Confirmar Exclusão</h3>
            <p className="mb-6" style={{ color: '#555555' }}>Tem certeza que deseja deletar esta tarefa? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => confirmDelete(deleteConfirm)} className="flex-1 text-white py-2 rounded-lg font-semibold transition" style={{ backgroundColor: '#E63946' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#C92A33'} onMouseLeave={(e) => e.target.style.backgroundColor = '#E63946'}>
                Confirmar Deletar
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg font-semibold transition" style={{ backgroundColor: '#CCCCCC', color: '#555555' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#AAAAAA'} onMouseLeave={(e) => e.target.style.backgroundColor = '#CCCCCC'}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
