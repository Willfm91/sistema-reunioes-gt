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
            content: `Transcrição: ${transcription}

Retorne apenas este JSON válido (sem markdown, sem texto extra):
{"resumo":"","tarefas":[],"combinados":[],"insights":[],"dataReuniao":"01/01/2026","horaReuniao":"10:00"}`
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

    // Limpa conteúdo
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // Extrai JSON
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      console.error('Sem JSON:', content);
      return res.status(500).json({ error: 'Sem JSON na resposta' });
    }

    let jsonStr = content.substring(startIdx, endIdx + 1);
    
    // Tenta parsear
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON error:', e, 'String:', jsonStr.substring(0, 200));
      // Tenta limpar caracteres problemáticos
      jsonStr = jsonStr.replace(/\n/g, ' ').replace(/\r/g, '');
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e2) {
        return res.status(500).json({ error: 'JSON inválido' });
      }
    }

    const result = {
      resumo: parsed.resumo || 'Resumo não extraído',
      tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas : [],
      combinados: Array.isArray(parsed.combinados) ? parsed.combinados : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      dataReuniao: parsed.dataReuniao || '01/01/2026',
      horaReuniao: parsed.horaReuniao || '10:00',
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao processar' });
  }
}
