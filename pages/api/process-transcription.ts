import type { NextApiRequest, NextApiResponse } from 'next';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const VALID_PRIORITIES = ['Alta', 'Media', 'Baixa'];

interface ExtractedTask {
  descricao: string;
  responsavel: string;
  prioridade: string;
}

interface ExtractedItem {
  descricao: string;
  responsavel: string;
}

interface ProcessResult {
  resumo: string;
  tarefas: ExtractedTask[];
  combinados: ExtractedItem[];
  insights: ExtractedItem[];
  dataReuniao: string;
  horaReuniao: string;
}

function defaultResult(): ProcessResult {
  const now = new Date();
  return {
    resumo: 'Reunião',
    tarefas: [],
    combinados: [],
    insights: [],
    dataReuniao: now.toLocaleDateString('pt-BR'),
    horaReuniao: now.toTimeString().slice(0, 5),
  };
}

function buildPrompt(transcription: string): string {
  return `Voce e um especialista em extrair tarefas de transcricoes.

TRANSCRICAO:
${transcription}

EXTRAIA:
1. TAREFAS: Acoes especificas com descricao COMPLETA
2. COMBINADOS: Decisoes e acordos
3. INSIGHTS: Problemas e oportunidades

CRITICO: Cada tarefa DEVE TER uma descricao CLARA E COMPLETA. Nao deixe em branco!

Retorne JSON VALIDO (sem markdown):
{
  "resumo": "resumo em 2-3 linhas",
  "tarefas": [
    {"descricao": "descricao completa do que fazer", "responsavel": "nome", "prioridade": "Media"}
  ],
  "combinados": [
    {"descricao": "o que foi decidido", "responsavel": "nome"}
  ],
  "insights": [
    {"descricao": "problema ou oportunidade", "responsavel": "nome"}
  ],
  "dataReuniao": "01/01/2026",
  "horaReuniao": "10:00"
}`;
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '');
  cleaned = cleaned.replace(/[\r\n\t]/g, ' ');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned.trim();
}

function normalizePriority(value: unknown): string {
  if (typeof value === 'string') {
    const match = VALID_PRIORITIES.find((v) => v.toLowerCase() === value.trim().toLowerCase());
    if (match) return match;
  }
  return 'Média';
}

function normalizeTasks(tarefas: unknown): ExtractedTask[] {
  if (!Array.isArray(tarefas)) return [];
  return tarefas
    .map((t: any) => ({
      descricao: typeof t?.descricao === 'string' ? t.descricao.trim() : '',
      responsavel:
        typeof t?.responsavel === 'string' && t.responsavel.trim()
          ? t.responsavel.trim()
          : 'Não especificado',
      prioridade: normalizePriority(t?.prioridade),
    }))
    .filter((t) => t.descricao.length > 0);
}

function normalizeItems(items: unknown): ExtractedItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({
      descricao: typeof i?.descricao === 'string' ? i.descricao.trim() : '',
      responsavel:
        typeof i?.responsavel === 'string' && i.responsavel.trim()
          ? i.responsavel.trim()
          : 'Não especificado',
    }))
    .filter((i) => i.descricao.length > 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { transcription } = req.body || {};

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length === 0) {
    return res.status(400).json({ error: 'Transcricao e obrigatoria' });
  }

  const rawApiKey = process.env.CLAUDE_API_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY;

  if (!rawApiKey) {
    return res.status(500).json({ error: 'API key nao configurada' });
  }

  // Strip any non-ASCII characters (e.g. stray bullets/whitespace pasted into
  // the env var) so the value is a valid HTTP header (ByteString / Latin-1).
  const apiKey = rawApiKey.replace(/[^\x20-\x7E]/g, '').trim();

  try {
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildPrompt(transcription) }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      return res.status(200).json(defaultResult());
    }

    const data = await claudeResponse.json();
    console.log('Claude response:', JSON.stringify(data).substring(0, 500));

    if (!data?.content?.[0]?.text) {
      console.log('No text found in Claude response');
      return res.status(200).json(defaultResult());
    }
    const rawText = data?.content?.[0]?.text || '';
    console.log('Raw text length:', rawText.length);
    const cleaned = cleanJsonResponse(rawText);
    console.log('Cleaned JSON length:', cleaned.length);

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(200).json(defaultResult());
    }

    const fallback = defaultResult();

    const result: ProcessResult = {
      resumo:
        typeof parsed.resumo === 'string' && parsed.resumo.trim()
          ? parsed.resumo.trim()
          : fallback.resumo,
      tarefas: normalizeTasks(parsed.tarefas),
      combinados: normalizeItems(parsed.combinados),
      insights: normalizeItems(parsed.insights),
      dataReuniao:
        typeof parsed.dataReuniao === 'string' && parsed.dataReuniao.trim()
          ? parsed.dataReuniao.trim()
          : fallback.dataReuniao,
      horaReuniao:
        typeof parsed.horaReuniao === 'string' && parsed.horaReuniao.trim()
          ? parsed.horaReuniao.trim()
          : fallback.horaReuniao,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Process transcription error:', error);
    return res.status(200).json(defaultResult());
  }
}
