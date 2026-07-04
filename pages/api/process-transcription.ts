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

    console.log('=== PROCESSANDO TRANSCRIÇÃO ===');
    console.log('Tamanho:', transcription.length, 'caracteres');

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
        messages: [
          {
            role: 'user',
            content: `Você é um assistente especializado em extrair informações de transcrições de reuniões.

LEIA CUIDADOSAMENTE esta transcrição e extraia:

1. RESUMO: Um resumo breve (2-3 linhas) do que foi discutido
2. TAREFAS: Ações específicas que alguém precisa fazer (com responsável e prioridade Alta/Média/Baixa)
3. COMBINADOS: Decisões, alinhamentos e acordos que foram DECIDIDOS na reunião
4. INSIGHTS: Problemas, dificuldades e oportunidades IDENTIFICADAS
5. DATA E HORA: Da reunião (se mencionada)

RETORNE EXATAMENTE NESTE FORMATO JSON (sem nada antes ou depois):

{
  "resumo": "texto aqui",
  "tarefas": [{"descricao": "text", "responsavel": "nome", "prioridade": "Alta"}],
  "combinados": [{"descricao": "text", "responsavel": "nome"}],
  "insights": [{"descricao": "text", "responsavel": "nome"}],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}

TRANSCRIÇÃO:
${transcription}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro Claude:', errorData);
      return res.status(response.status).json({ 
        error: `Erro Claude: ${errorData.error?.message || 'Desconhecido'}` 
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    console.log('📝 Resposta bruta:', content.substring(0, 300));

    // Estratégia 1: Procurar JSON puro entre { }
    let jsonStr: string | null = null;
    
    // Tira espaços em branco e procura o primeiro { até o último }
    const trimmed = content.trim();
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = trimmed.substring(firstBrace, lastBrace + 1);
      console.log('✅ JSON encontrado entre { }');
    }

    if (!jsonStr) {
      console.error('❌ Nenhum JSON encontrado em:', content);
      return res.status(500).json({ 
        error: `Resposta sem JSON: ${content.substring(0, 200)}` 
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
      console.log('✅ JSON parseado com sucesso');
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('JSON problemático:', jsonStr.substring(0, 500));
      return res.status(500).json({ 
        error: `JSON inválido: ${parseError instanceof Error ? parseError.message : 'erro desconhecido'}` 
      });
    }

    // Validação e defaults
    const result = {
      resumo: parsed.resumo || 'Sem resumo',
      tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas.filter((t: any) => t.descricao) : [],
      combinados: Array.isArray(parsed.combinados) ? parsed.combinados.filter((c: any) => c.descricao) : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights.filter((i: any) => i.descricao) : [],
      dataReuniao: parsed.dataReuniao || new Date().toLocaleDateString('pt-BR'),
      horaReuniao: parsed.horaReuniao || new Date().toTimeString().slice(0, 5),
    };

    console.log('✅ SUCESSO!');
    console.log('  - Tarefas:', result.tarefas.length);
    console.log('  - Combinados:', result.combinados.length);
    console.log('  - Insights:', result.insights.length);

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Erro ao processar: ${msg}` });
  }
}
