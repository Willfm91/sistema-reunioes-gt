import type { NextApiRequest, NextApiResponse } from 'next';

interface Tarefa {
  descricao: string;
  responsavel: string;
  prioridade: string;
}

interface Combinado {
  descricao: string;
  responsavel: string;
}

interface Insight {
  descricao: string;
  responsavel: string;
}

interface ProcessedResult {
  resumo: string;
  tarefas: Tarefa[];
  combinados: Combinado[];
  insights: Insight[];
  dataReuniao: string;
  horaReuniao: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessedResult | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcription } = req.body;

  if (!transcription) {
    return res.status(400).json({ error: 'Transcrição é obrigatória' });
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key não configurada' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: `Você é um especialista em análise de transcrições de reuniões comerciais brasileiras.

Sua tarefa é extrair PRECISAMENTE:

1. RESUMO: 2-3 linhas sobre o que foi discutido
2. TAREFAS: Ações específicas que precisam ser feitas (com quem vai fazer e prioridade)
3. COMBINADOS: Alinhamentos, decisões e acordos que foram FEITOS/DECIDIDOS na reunião
   - Exemplos: "Vamos fazer reunião toda segunda", "Felipe vai parar de mandar áudios para clientes", "Decisão: usar nova ferramenta X", "Acordamos em aumentar frequência de comunicação"
   - IMPORTANTE: Combinado é algo que TODOS CONCORDARAM em fazer/mudar, não é uma tarefa, é um ACORDO
4. INSIGHTS: Dificuldades, problemas, fraquezas e oportunidades IDENTIFICADAS
   - Exemplos: "Eduardo tem dificuldade em criar hooks para vídeos", "O conteúdo não está retendo a atenção das pessoas", "Faltam mais publicações", "As pessoas desistem no meio do vídeo"
   - IMPORTANTE: Insight é um PROBLEMA ou OPORTUNIDADE identificada durante a reunião, não é um acordo

LEIA TODA A TRANSCRIÇÃO CUIDADOSAMENTE:
- Procure por palavras como: "combinamos", "decidimos", "vamos", "a partir de agora", "daqui pra frente", "vou parar de", "vamos começar a"
- Para insights: "dificuldade", "problema", "desafio", "fraqueza", "oportunidade", "precisa melhorar", "não está funcionando"

Retorne APENAS um JSON válido (sem markdown, sem explicações adicionais):
{
  "resumo": "string resumo da reunião",
  "tarefas": [
    {
      "descricao": "descrição clara da tarefa",
      "responsavel": "nome completo da pessoa responsável",
      "prioridade": "Alta ou Média ou Baixa"
    }
  ],
  "combinados": [
    {
      "descricao": "descrição do combinado/alinhamento/acordo feito",
      "responsavel": "nome da pessoa relacionada ao combinado"
    }
  ],
  "insights": [
    {
      "descricao": "descrição do problema ou oportunidade identificada",
      "responsavel": "nome da pessoa a quem o insight se refere"
    }
  ],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}

IMPORTANTE: Extraia TUDO que conseguir encontrar. Não deixe combinados ou insights na transcrição. Leia linha por linha.`,
        messages: [
          {
            role: 'user',
            content: `Analise COMPLETAMENTE esta transcrição de reunião e extraia todas as tarefas, combinados e insights:\n\n${transcription}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API Error:', error);
      return res.status(500).json({ error: 'Erro ao processar com Claude' });
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      return res.status(500).json({ error: 'Resposta vazia do Claude' });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return res.status(500).json({ error: 'Formato de resposta inválido' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as ProcessedResult;

    if (!parsed.resumo || !Array.isArray(parsed.tarefas) || !parsed.dataReuniao || !parsed.horaReuniao) {
      return res.status(500).json({ error: 'Estrutura de resposta incompleta' });
    }

    if (!parsed.combinados) parsed.combinados = [];
    if (!parsed.insights) parsed.insights = [];

    console.log('Resposta ParsedD:', {
      tarefas: parsed.tarefas.length,
      combinados: parsed.combinados.length,
      insights: parsed.insights.length
    });

    res.status(200).json(parsed);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar transcrição',
    });
  }
}
