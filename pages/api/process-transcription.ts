import type { NextApiRequest, NextApiResponse } from 'next';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const VALID_PRIORITIES = ['Alta', 'Média', 'Baixa'];

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

function sanitizeText(text: string): string {
  return text
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(transcription: string): string {
  const clean = sanitizeText(transcription);
  return `Você é um especialista em extrair tarefas de transcrições.

TRANSCRIÇÃO:
${clean}

EXTRAIA:
1. TAREFAS: Ações específicas com descrição COMPLETA
2. COMBINADOS: Decisões e acordos
3. INSIGHTS: Problemas e oportunidades

CRÍTICO: Cada tarefa DEVE TER uma descricao CLARA E COMPLETA. Não deixe em branco!

Retorne JSON VÁLIDO (sem markdown):
{
  "resumo": "resumo em 2-3 linhas",
  "tarefas": [
    {"descricao": "descrição completa do que fazer", "responsavel": "nome", "prioridade": "Média"}
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
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { transcription } = req.body || {};

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length === 0) {
    return res.status(400).json({ error: 'Transcrição é obrigatória' });
  }

  const apiKey = process.env.CLAUDE_API_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada' });
  }

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
    const rawText = data?.content?.[0]?.text || '';
    const cleaned = cleanJsonResponse(rawText);

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
