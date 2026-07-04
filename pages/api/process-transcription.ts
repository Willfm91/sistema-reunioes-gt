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
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Extraia dados desta transcrição em JSON:

${transcription}

JSON com TAREFAS (o que fazer, quem faz, prioridade), COMBINADOS (decisões), INSIGHTS (problemas):

{
  "resumo": "resumo breve",
  "tarefas": [{"descricao": "ação", "responsavel": "nome", "prioridade": "Alta"}],
  "combinados": [{"descricao": "decisão", "responsavel": "nome"}],
  "insights": [{"descricao": "problema/oportunidade", "responsavel": "nome"}],
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

    // Remove markdown
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // Extrai JSON
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'JSON não encontrado' });
    }

    const jsonStr = content.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr);

    const result = {
      resumo: String(parsed.resumo || 'Reunião'),
      tarefas: (Array.isArray(parsed.tarefas) ? parsed.tarefas : []).filter((t: any) => t.descricao),
      combinados: (Array.isArray(parsed.combinados) ? parsed.combinados : []).filter((c: any) => c.descricao),
      insights: (Array.isArray(parsed.insights) ? parsed.insights : []).filter((i: any) => i.descricao),
      dataReuniao: String(parsed.dataReuniao || '01/01/2026'),
      horaReuniao: String(parsed.horaReuniao || '10:00'),
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro' });
  }
}
