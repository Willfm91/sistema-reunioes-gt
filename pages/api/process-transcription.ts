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

    const systemPrompt = `Você é um assistente que extrai informações de transcrições de reuniões.

TAREFA: Extraia tarefas, combinados e insights de uma transcrição.

DEFINIÇÕES:
- TAREFAS: ações específicas com responsável e prioridade
- COMBINADOS: decisões e alinhamentos que foram acordados
- INSIGHTS: problemas ou oportunidades identificadas

RETORNE APENAS este JSON, sem markdown, sem explicações, sem \`\`\`json\`\`\`:

{
  "resumo": "texto do resumo em 2-3 linhas",
  "tarefas": [
    {"descricao": "texto da tarefa", "responsavel": "nome", "prioridade": "Alta"}
  ],
  "combinados": [
    {"descricao": "texto do combinado", "responsavel": "nome"}
  ],
  "insights": [
    {"descricao": "texto do insight", "responsavel": "nome"}
  ],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}

NÃO ADICIONE NADA ANTES OU DEPOIS DO JSON.
NÃO USE \`\`\`json\`\`\` OU MARKDOWN.
RETORNE APENAS O JSON VÁLIDO.`;

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

    // Procura JSON - tenta várias estratégias
    let jsonStr = null;
    
    // Estratégia 1: JSON entre ``` ```
    const jsonMarkdown = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMarkdown) {
      jsonStr = jsonMarkdown[1];
      console.log('✅ JSON encontrado em markdown');
    }
    
    // Estratégia 2: JSON bruto entre {}
    if (!jsonStr) {
      const jsonRaw = content.match(/\{[\s\S]*\}/);
      if (jsonRaw) {
        jsonStr = jsonRaw[0];
        console.log('✅ JSON encontrado bruto');
      }
    }

    if (!jsonStr) {
      console.error('❌ JSON não encontrado. Resposta completa:', content);
      return res.status(500).json({ error: `Resposta inválida: ${content.substring(0, 200)}` });
    }

    console.log('🔍 Tentando parsear:', jsonStr.substring(0, 100));
    const parsed = JSON.parse(jsonStr);
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
