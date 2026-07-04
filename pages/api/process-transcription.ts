import type { NextApiRequest, NextApiResponse } from 'next';

interface ProcessedResult {
  resumo: string;
  tarefas: any[];
  combinados: any[];
  insights: any[];
  dataReuniao: string;
  horaReuniao: string;
}

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
    // Tenta ambas as variáveis (com e sem NEXT_PUBLIC_)
    const apiKey = process.env.CLAUDE_API_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
    
    if (!apiKey) {
      console.error('API Key não configurada. Variáveis disponíveis:', Object.keys(process.env).filter(k => k.includes('CLAUDE')));
      return res.status(500).json({ 
        error: 'API key não configurada no Vercel. Configure CLAUDE_API_KEY ou NEXT_PUBLIC_CLAUDE_API_KEY nas variáveis de ambiente.' 
      });
    }

    const systemPrompt = `Você é um especialista em análise de transcrições de reuniões comerciais.

EXTRAIA com PRECISÃO:

1. **RESUMO** (2-3 linhas)

2. **TAREFAS** (ações que precisam ser feitas)
   - Formato: descrição, responsável, prioridade (Alta/Média/Baixa)

3. **COMBINADOS** (Alinhamentos, decisões, acordos DECIDIDOS)
   - Busque por: "combinamos", "decidimos", "vamos", "a partir de agora", "daqui pra frente", "vou parar de"
   - EXEMPLO: "Felipe vai parar de mandar áudios para clientes"
   - É algo que TODOS concordaram em fazer/mudar

4. **INSIGHTS** (Dificuldades, problemas, oportunidades IDENTIFICADAS)
   - Busque por: "problema", "dificuldade", "desafio", "fraqueza", "não está funcionando", "precisa melhorar"
   - EXEMPLO: "Eduardo tem dificuldade em criar hooks para vídeos"
   - É um PROBLEMA ou OPORTUNIDADE identificada

LEIA TODA A TRANSCRIÇÃO e extraia TUDO que encontrar.

Retorne JSON VÁLIDO (sem markdown):
{
  "resumo": "resumo aqui",
  "tarefas": [{"descricao": "...", "responsavel": "...", "prioridade": "Alta"}],
  "combinados": [{"descricao": "...", "responsavel": "..."}],
  "insights": [{"descricao": "...", "responsavel": "..."}],
  "dataReuniao": "DD/MM/YYYY",
  "horaReuniao": "HH:MM"
}`;

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
            content: `Analise esta transcrição de reunião:\n\n${transcription}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API Error:', errorData);
      return res.status(500).json({ error: `Erro Claude: ${errorData.error?.message || 'Desconhecido'}` });
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      return res.status(500).json({ error: 'Resposta vazia da API' });
    }

    // Procura JSON na resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Resposta sem JSON:', content);
      return res.status(500).json({ error: 'Resposta não contém JSON válido' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as ProcessedResult;

    // Validação básica
    if (!parsed.resumo) parsed.resumo = 'Resumo não extraído';
    if (!parsed.tarefas) parsed.tarefas = [];
    if (!parsed.combinados) parsed.combinados = [];
    if (!parsed.insights) parsed.insights = [];
    if (!parsed.dataReuniao) parsed.dataReuniao = new Date().toLocaleDateString('pt-BR');
    if (!parsed.horaReuniao) {
      const now = new Date();
      parsed.horaReuniao = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    console.log('✅ Extração bem-sucedida:', {
      tarefas: parsed.tarefas.length,
      combinados: parsed.combinados.length,
      insights: parsed.insights.length,
    });

    res.status(200).json(parsed);
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ error: `Erro ao processar: ${errorMessage}` });
  }
}
