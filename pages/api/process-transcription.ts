import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcription } = req.body;

  if (!transcription) {
    return res.status(400).json({ error: 'Transcrição é obrigatória' });
  }

  try {
    // Log para debug
    console.log('=== INICIANDO PROCESSAMENTO ===');
    console.log('Tamanho da transcrição:', transcription.length);
    
    const apiKey = process.env.CLAUDE_API_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
    
    if (!apiKey) {
      console.error('❌ API Key não encontrada');
      return res.status(500).json({ 
        error: 'API key não configurada. Configure CLAUDE_API_KEY no Vercel.' 
      });
    }

    console.log('✅ API Key encontrada:', apiKey.substring(0, 20) + '...');

    const systemPrompt = `Você é um especialista em análise de transcrições de reuniões.

EXTRAIA com PRECISÃO:

1. RESUMO (2-3 linhas)
2. TAREFAS (ações que precisam ser feitas)
3. COMBINADOS (Alinhamentos, decisões, acordos)
4. INSIGHTS (Dificuldades, problemas, oportunidades)

Retorne APENAS JSON válido, sem markdown:
{
  "resumo": "...",
  "tarefas": [{"descricao": "...", "responsavel": "...", "prioridade": "Alta|Média|Baixa"}],
  "combinados": [{"descricao": "...", "responsavel": "..."}],
  "insights": [{"descricao": "...", "responsavel": "..."}],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}`;

    console.log('🔄 Enviando para Claude API...');

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
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analise esta transcrição:\n\n${transcription}`,
          },
        ],
      }),
    });

    console.log('📥 Resposta recebida:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro da API:', errorData);
      return res.status(500).json({ 
        error: `Erro Claude (${response.status}): ${errorData.error?.message || JSON.stringify(errorData)}`
      });
    }

    const data = await response.json();
    console.log('📦 JSON recebido:', JSON.stringify(data).substring(0, 200));

    const content = data.content?.[0]?.text;

    if (!content) {
      console.error('❌ Sem conteúdo na resposta');
      return res.status(500).json({ error: 'Resposta sem conteúdo' });
    }

    console.log('📄 Conteúdo extraído:', content.substring(0, 300));

    // Procura JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ JSON não encontrado em:', content);
      return res.status(500).json({ error: 'Resposta não contém JSON válido' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON parseado com sucesso');

    // Validação e defaults
    const result = {
      resumo: parsed.resumo || 'Resumo não extraído',
      tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas : [],
      combinados: Array.isArray(parsed.combinados) ? parsed.combinados : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      dataReuniao: parsed.dataReuniao || new Date().toLocaleDateString('pt-BR'),
      horaReuniao: parsed.horaReuniao || new Date().toTimeString().slice(0, 5),
    };

    console.log('✅ SUCESSO!', {
      tarefas: result.tarefas.length,
      combinados: result.combinados.length,
      insights: result.insights.length,
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Erro: ${msg}` });
  }
}
