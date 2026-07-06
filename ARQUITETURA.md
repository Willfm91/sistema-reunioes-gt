# 🏗️ Como a Aplicação Funciona (Técnico)

## 📊 Diagrama de Fluxo

```
[Usuário coloca transcrição]
           ↓
[Frontend React clica "Processar"]
           ↓
[Next.js API route: /api/process-transcription]
           ↓
[Claude API processa]
           ↓
[Retorna JSON com tarefas]
           ↓
[Frontend mostra resultado]
           ↓
[Usuário confirma e salva em localStorage]
           ↓
[Dashboard mostra tarefas com status]
```

---

## 🔧 Componentes Principais

### 1. **Frontend (React + Next.js)**
**Arquivo:** `pages/index.tsx`

- Interface completa em React
- Abas: Dashboard e Processar
- Gerencia estado com `useState`
- Salva dados em `localStorage` do navegador
- Comunica com API via `fetch()`

### 2. **Backend API (Next.js + Node.js)**
**Arquivo:** `pages/api/process-transcription.ts`

- Rota HTTP POST
- Recebe transcrição
- Faz chamada à Claude API
- Parse do JSON retornado
- Retorna dados estruturados

### 3. **Claude API**
**Serviço externo:** https://api.anthropic.com

- Processa naturalmente linguagem (transcrição)
- Extrai tarefas, responsáveis, prioridades
- Retorna JSON estruturado

### 4. **Armazenamento**
**Tipo:** localStorage (navegador)

- Guarda tarefas no navegador do usuário
- Persiste mesmo depois de fechar/reabrir
- Não precisa de servidor/banco de dados

---

## 🔐 Fluxo de Dados

### Request → API → Claude → Response

```
Frontend
   ↓ (POST /api/process-transcription)
   ├─ { transcription: "texto completo..." }
   ↓
Next.js API Route
   ├─ Valida se transcrição está vazia
   ├─ Pega NEXT_PUBLIC_CLAUDE_API_KEY do env
   ├─ Faz fetch para https://api.anthropic.com/v1/messages
   ├─ Body contém: prompt + transcrição
   ↓
Claude API
   ├─ Analisa a transcrição
   ├─ Retorna JSON com:
   │  {
   │    "resumo": "...",
   │    "tarefas": [...],
   │    "dataReuniao": "DD/MM/YYYY",
   │    "horaReuniao": "HH:MM"
   │  }
   ↓
Next.js API Route
   ├─ Parse JSON da resposta
   ├─ Valida estrutura
   ├─ Retorna para Frontend
   ↓
Frontend React
   ├─ Mostra preview das tarefas
   ├─ Usuário clica "Adicionar ao Dashboard"
   ├─ Salva em localStorage
   ├─ Dashboard atualiza
```

---

## 🌐 Tecnologias Usadas

| Tecnologia | Função |
|-----------|--------|
| **Next.js 14** | Framework React + Backend |
| **React 18** | Interface componentizada |
| **TypeScript** | Type safety no código |
| **Tailwind CSS** | Estilos responsivos |
| **Claude API** | Processamento de IA |
| **Vercel** | Hosting + Deploy |
| **localStorage** | Persistência de dados |

---

## 📱 Stack de Desenvolvimento

```
Frontend
├── React 18
│   └── Hooks (useState, useEffect)
├── Tailwind CSS
│   └── Estilos utilitários
└── Lucide Icons
    └── Ícones SVG

Backend
├── Next.js API Routes
├── Node.js
├── TypeScript
└── Fetch API (chamadas HTTP)

Deployment
├── Vercel (hosting)
├── GitHub (versionamento)
└── Environment Variables (segurança)
```

---

## 🔄 Ciclo de Vida de uma Tarefa

### 1. Criação
```
Usuário cola transcrição
    ↓
Claude extrai tarefa
    ↓
Task adicionada ao state
    ↓
Salva em localStorage
```

### 2. Edição
```
Usuário clica "Editar"
    ↓
Mostra formulário (deadline, entrega, status)
    ↓
Usuário preenche
    ↓
Sistema calcula: dias de atraso/antecipação
    ↓
Atualiza localStorage
```

### 3. Dashboard
```
Lê todas tarefas do localStorage
    ↓
Calcula KPIs (total, concluídas, atrasadas)
    ↓
Renderiza interface
```

---

## 🎯 Prompt Usado com Claude

O sistema envia este prompt ao Claude:

```
"Você é um assistente especializado em processar 
transcrições de reuniões comerciais brasileiras.

Analise a transcrição e extraia:
1. Um resumo conciso (2-3 linhas)
2. Todas as tarefas/demandas mencionadas
3. Responsáveis
4. Prioridades (Alta/Média/Baixa)
5. Data e hora da reunião

Retorne APENAS um JSON válido (sem markdown)..."
```

Isso garante que Claude sempre retorna dados estruturados que o frontend pode processar.

---

## 📦 Variáveis de Ambiente

```
NEXT_PUBLIC_CLAUDE_API_KEY=sk-...
│
└─ "PUBLIC" = pode ser acessada do frontend
   (mas ainda é segura em Vercel - não aparece no código)
```

> ⚠️ Nunca commita `.env` no Git (está em `.gitignore`)

---

## 🚀 Fluxo de Deploy

```
1. Você faz `git push`
   ↓
2. GitHub recebe mudanças
   ↓
3. Vercel detecta novo push
   ↓
4. Vercel executa `npm run build`
   ↓
5. Next.js compila
   ↓
6. Vercel faz deploy em CDN global
   ↓
7. Seu app fica online em https://seu-dominio.vercel.app
   ↓
8. Qualquer um pode acessar
```

---

## 🔒 Segurança

### ✅ O que é seguro
- Chave de API em variável de ambiente
- localStorage (dados no navegador do usuário)
- HTTPS automático no Vercel
- Sem exposição de dados sensíveis

### ⚠️ Limitações
- localStorage tem limite (~5MB por domínio)
- Dados perdidos se usuário limpar cache
- Não sincroniza entre dispositivos

### 🚀 Para Produção (depois)
- Adicionar banco de dados (Supabase)
- Adicionar autenticação (OAuth)
- Adicionar backup automático
- Monitorar uso de API (rate limiting)

---

## 📊 Performance

- **Frontend:** Renderiza em milissegundos (React)
- **API:** ~1-2 segundos (Claude processa)
- **Total:** ~2-3 segundos por requisição

---

## 🐛 Troubleshooting Técnico

| Erro | Causa | Solução |
|------|-------|---------|
| "API key not configured" | Env var não definida | Adicione em Vercel Settings |
| "Method not allowed" | GET em vez de POST | Verifique fetch no frontend |
| "JSON parse error" | Claude retornou mal formatado | Check Claude response |
| localStorage full | Muitos dados | Limpar browser cache |

---

## 📈 Escalabilidade Futura

Quando precisar escalar:

1. **Banco de Dados:** Supabase (PostgreSQL)
2. **Autenticação:** NextAuth.js + Google OAuth
3. **Automação:** n8n monitorando Drive 24/7
4. **Cache:** Redis para requisições frequentes
5. **Fila:** Bull.js para processamentos pesados

---

**Resumo:** Arquitetura simples, robusta e escalável! 🎯
