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
      console.error('❌ API Key não encontrada');
      return res.status(500).json({ error: 'API key não configurada' });
    }

    console.log('=== PROCESSANDO ===');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Extraia dados desta transcrição e retorne APENAS JSON válido.

Transcrição:
${transcription}

Responda com APENAS este JSON (nada antes, nada depois):
{"resumo":"breve resumo","tarefas":[],"combinados":[],"insights":[],"dataReuniao":"01/01/2026","horaReuniao":"10:00"}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro API:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'API Error' });
    }

    const data = await response.json();
    let content = data.content?.[0]?.text || '';

    console.log('📝 Raw:', content.substring(0, 200));

    // Remove markdown se houver
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extrai JSON entre { }
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('❌ Sem JSON:', content);
      return res.status(500).json({ error: 'Resposta sem JSON válido' });
    }

    const jsonStr = content.substring(startIdx, endIdx + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('❌ Parse error:', e);
      return res.status(500).json({ error: 'JSON inválido na resposta' });
    }

    // Garantir estrutura
    const result = {
      resumo: String(parsed.resumo || 'Sem resumo'),
      tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas : [],
      combinados: Array.isArray(parsed.combinados) ? parsed.combinados : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      dataReuniao: String(parsed.dataReuniao || '01/01/2026'),
      horaReuniao: String(parsed.horaReuniao || '10:00'),
    };

    console.log('✅ OK:', result.tarefas.length, result.combinados.length, result.insights.length);
    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }
}
