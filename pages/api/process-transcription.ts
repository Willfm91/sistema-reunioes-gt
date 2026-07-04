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
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: `LEIA ESTA TRANSCRIÇÃO COM MUITA ATENÇÃO:

${transcription}

AGORA EXTRAIA:

1. RESUMO: 2-3 linhas sobre o tema geral
2. TAREFAS: Ações específicas a fazer. Para CADA tarefa, identifique:
   - Descrição clara do que fazer
   - Quem vai fazer (responsável)
   - Prioridade (Alta, Média ou Baixa)
   
3. COMBINADOS: Decisões, acordos e alinhamentos que foram DECIDIDOS:
   - Descrição do que foi combinado
   - Quem está envolvido

4. INSIGHTS: Problemas, fraquezas e oportunidades IDENTIFICADAS:
   - Descrição do problema ou oportunidade
   - Quem mencionou ou está relacionado

5. DATA E HORA da reunião

Responda APENAS com este JSON (nada antes, nada depois):
{
  "resumo": "texto",
  "tarefas": [
    {"descricao": "ação completa", "responsavel": "nome", "prioridade": "Alta"},
    {"descricao": "ação completa", "responsavel": "nome", "prioridade": "Média"}
  ],
  "combinados": [
    {"descricao": "o que foi combinado", "responsavel": "nome"}
  ],
  "insights": [
    {"descricao": "problema ou oportunidade", "responsavel": "nome"}
  ],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}`
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

    // Garantir estrutura e filtrar vazios
    const result = {
      resumo: String(parsed.resumo || 'Sem resumo'),
      tarefas: (Array.isArray(parsed.tarefas) ? parsed.tarefas : [])
        .filter((t: any) => t.descricao && t.descricao.trim())
        .map((t: any) => ({
          descricao: String(t.descricao).trim(),
          responsavel: String(t.responsavel || 'Sem responsável').trim(),
          prioridade: ['Alta', 'Média', 'Baixa'].includes(t.prioridade) ? t.prioridade : 'Média'
        })),
      combinados: (Array.isArray(parsed.combinados) ? parsed.combinados : [])
        .filter((c: any) => c.descricao && c.descricao.trim())
        .map((c: any) => ({
          descricao: String(c.descricao).trim(),
          responsavel: String(c.responsavel || 'Geral').trim()
        })),
      insights: (Array.isArray(parsed.insights) ? parsed.insights : [])
        .filter((i: any) => i.descricao && i.descricao.trim())
        .map((i: any) => ({
          descricao: String(i.descricao).trim(),
          responsavel: String(i.responsavel || 'Geral').trim()
        })),
      dataReuniao: String(parsed.dataReuniao || new Date().toLocaleDateString('pt-BR')),
      horaReuniao: String(parsed.horaReuniao || new Date().toTimeString().slice(0, 5)),
    };

    console.log('✅ OK:', result.tarefas.length, result.combinados.length, result.insights.length);
    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }
}
