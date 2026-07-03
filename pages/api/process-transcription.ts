import type { NextApiRequest, NextApiResponse } from 'next';

interface ProcessedResult {
  resumo: string;
  tarefas: Array<{
    descricao: string;
    responsavel: string;
    prioridade: 'Alta' | 'Média' | 'Baixa';
  }>;
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
        max_tokens: 2000,
        system: `Você é um assistente especializado em processar transcrições de reuniões comerciais brasileiras. 
        Analise a transcrição e extraia:
        1. Um resumo conciso da reunião (2-3 linhas)
        2. Todas as tarefas/demandas mencionadas com responsáveis e prioridade
        3. Data e hora da reunião se mencionadas (caso contrário use hoje)

        IMPORTANTE: Retorne APENAS um JSON válido (sem markdown, sem explicações adicionais) com esta estrutura exata:
        {
          "resumo": "string com resumo da reunião",
          "tarefas": [
            {
              "descricao": "descrição clara da tarefa",
              "responsavel": "nome completo ou função da pessoa responsável",
              "prioridade": "Alta" ou "Média" ou "Baixa"
            }
          ],
          "dataReuniao": "data no formato DD/MM/YYYY",
          "horaReuniao": "hora no formato HH:MM"
        }
        
        Se não conseguir extrair data/hora, use a data de hoje. Se não houver tarefas, retorne array vazio.`,
        messages: [
          {
            role: 'user',
            content: `Processe esta transcrição de reunião comercial:\n\n${transcription}`,
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

    // Parse JSON - remover markdown se houver
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return res.status(500).json({ error: 'Formato de resposta inválido' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as ProcessedResult;

    // Validar estrutura
    if (!parsed.resumo || !Array.isArray(parsed.tarefas) || !parsed.dataReuniao || !parsed.horaReuniao) {
      return res.status(500).json({ error: 'Estrutura de resposta incompleta' });
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar transcrição',
    });
  }
}
