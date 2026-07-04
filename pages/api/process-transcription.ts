import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcription } = req.body;

  if (!transcription || transcription.trim().length === 0) {
    return res.status(400).json({ error: 'Transcrição é obrigatória' });
  }

  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
    
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
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Leia esta transcrição:

${transcription}

Extraia TAREFAS (ações a fazer com descrição clara), COMBINADOS (decisões) e INSIGHTS (problemas/oportunidades).

IMPORTANTE: CADA TAREFA DEVE TER descricao COMPLETA E CLARA.

Retorne APENAS JSON válido:
{
  "resumo": "resumo em 2-3 linhas",
  "tarefas": [
    {"descricao": "descrição COMPLETA da ação", "responsavel": "nome", "prioridade": "Alta"}
  ],
  "combinados": [
    {"descricao": "descrição do que foi combinado", "responsavel": "nome"}
  ],
  "insights": [
    {"descricao": "descrição do problema ou oportunidade", "responsavel": "nome"}
  ],
  "dataReuniao": "01/01/2026",
  "horaReuniao": "10:00"
}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: errorData.error?.message || 'API Error' });
    }

    const data = await response.json();
    let content = data.content?.[0]?.text || '';

    console.log('Raw content:', content.substring(0, 300));

    // Remove markdown backticks
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Extrai tudo entre primeira { e última }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('Nenhum { } encontrado');
      // Retorna estrutura vazia válida
      return res.status(200).json({
        resumo: 'Reunião',
        tarefas: [],
        combinados: [],
        insights: [],
        dataReuniao: new Date().toLocaleDateString('pt-BR'),
        horaReuniao: new Date().toTimeString().slice(0, 5),
      });
    }

    let jsonStr = content.substring(firstBrace, lastBrace + 1);

    // Remove caracteres problemáticos
    jsonStr = jsonStr.replace(/[\r\n\t]/g, ' ');
    jsonStr = jsonStr.replace(/  +/g, ' ');

    console.log('JSON string:', jsonStr.substring(0, 200));

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Se falhar, retorna vazio
      return res.status(200).json({
        resumo: 'Reunião',
        tarefas: [],
        combinados: [],
        insights: [],
        dataReuniao: new Date().toLocaleDateString('pt-BR'),
        horaReuniao: new Date().toTimeString().slice(0, 5),
      });
    }

    // Valida e retorna
    const result = {
      resumo: parsed.resumo && typeof parsed.resumo === 'string' ? parsed.resumo : 'Reunião',
      tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas : [],
      combinados: Array.isArray(parsed.combinados) ? parsed.combinados : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      dataReuniao: parsed.dataReuniao || new Date().toLocaleDateString('pt-BR'),
      horaReuniao: parsed.horaReuniao || new Date().toTimeString().slice(0, 5),
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Catch error:', error);
    // Se tudo falhar, retorna estrutura vazia válida
    res.status(200).json({
      resumo: 'Reunião',
      tarefas: [],
      combinados: [],
      insights: [],
      dataReuniao: new Date().toLocaleDateString('pt-BR'),
      horaReuniao: new Date().toTimeString().slice(0, 5),
    });
  }
}
