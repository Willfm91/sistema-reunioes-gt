# 🎯 Sistema Automático de Reuniões GT

Um sistema web interativo para processar automaticamente transcrições de reuniões Google Meet, extrair tarefas pendentes e acompanhar prazos de entrega.

## ✨ Funcionalidades

- ✅ **Processamento Automático**: Usa Claude API para analisar transcrições
- ✅ **Extração Inteligente**: Identifica tarefas, responsáveis e prioridades
- ✅ **Controle de Prazos**: Define deadlines e rastreia entregas
- ✅ **Cálculo de Atrasos**: Mostra automaticamente dias de atraso/antecipação
- ✅ **Histórico Persistente**: Mantém histórico de todas as reuniões
- ✅ **Dashboard em Tempo Real**: Visão completa das tarefas

## 🚀 Deploy no Vercel (5 minutos)

### Pré-requisitos

1. Conta no [Vercel](https://vercel.com) (gratuita)
2. Conta no [GitHub](https://github.com) (gratuita)
3. Chave de API do Claude (https://console.anthropic.com)

### Passo 1: Preparar o Repositório GitHub

```bash
# Clone este projeto ou crie um novo repo
git clone <seu-repo> sistema-reunioes-gt
cd sistema-reunioes-gt

# Ou crie um repositório do zero
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/sistema-reunioes-gt.git
git push -u origin main
```

### Passo 2: Deploy no Vercel

1. Acesse https://vercel.com/new
2. Clique em "Import Project"
3. Selecione seu repositório GitHub
4. Clique em "Import"

### Passo 3: Configurar Variáveis de Ambiente

Na página de Deploy do Vercel, antes de clicar em "Deploy":

1. Clique em "Environment Variables"
2. Adicione:
   - **Nome**: `NEXT_PUBLIC_CLAUDE_API_KEY`
   - **Valor**: Cole sua chave de API do Claude
3. Clique em "Add"

> ⚠️ **IMPORTANTE**: A chave começa com `sk-` e pode ser obtida em https://console.anthropic.com/account/keys

### Passo 4: Deploy

Clique em "Deploy" e aguarde (leva 2-3 minutos).

Ao finalizar, você receberá um URL como:
```
https://sistema-reunioes-gt.vercel.app
```

## 📋 Como Usar

### Conectar Google Drive

1. Clique em "Conectar Google Drive" (abre uma listagem das reuniões GT*)
2. Selecione a reunião que deseja processar

### Processar Transcrição

1. Abra o vídeo da reunião no Google Drive
2. Clique em "Transcrição" (lado direito)
3. Copie o texto que aparece
4. Cole no campo "Cole a Transcrição"
5. Clique em "Processar Transcrição com Claude"

### Acompanhar Tarefas

1. Vá para a aba "Dashboard"
2. Clique em "Editar" em cada tarefa
3. Preencha:
   - **Deadline**: data combinada para entrega
   - **Data de Entrega**: quando será/foi entregue
   - **Status**: Não Iniciado / Em Progresso / Concluído
4. Clique em "Salvar"

O sistema calcula automaticamente:
- Se foi entregue no prazo
- Quantos dias de atraso ou antecipação

## 🔧 Desenvolvimento Local

### Instalar Dependências

```bash
npm install
# ou
yarn install
```

### Rodar Localmente

```bash
npm run dev
# ou
yarn dev
```

Acesse http://localhost:3000

### Build para Produção

```bash
npm run build
npm start
```

## 📝 Estrutura do Projeto

```
sistema-reunioes-gt/
├── pages/
│   ├── api/
│   │   └── process-transcription.ts  # API que processa com Claude
│   ├── _app.tsx                       # App component
│   └── index.tsx                      # Página principal
├── styles/
│   └── globals.css                    # Estilos globais
├── package.json                       # Dependências
├── next.config.js                     # Configuração Next.js
├── tailwind.config.js                 # Configuração Tailwind
├── tsconfig.json                      # Configuração TypeScript
└── README.md                          # Este arquivo
```

## 🔐 Segurança

- As chaves de API são configuradas como variáveis de ambiente
- Nunca commit sua `.env` no Git (já está em `.gitignore`)
- As tarefas são armazenadas no navegador (`localStorage`)

## 🆘 Troubleshooting

### "Error: API key not configured"

- Verifique se `NEXT_PUBLIC_CLAUDE_API_KEY` foi adicionada nas variáveis de ambiente do Vercel
- Aguarde 2-3 minutos e faça redeploy

### "Method not allowed"

- Certifique-se de que está fazendo POST request para `/api/process-transcription`
- Verifique console do navegador para detalhes

### "Transcription is empty"

- Cole a transcrição antes de clicar em "Processar"
- A transcrição não pode estar em branco

## 📞 Suporte

Para dúvidas ou melhorias, abra uma issue no GitHub ou entre em contato.

## 📄 Licença

MIT

---

**Desenvolvido por Claude | Powered by Anthropic**
# sistema-reunioes-gt
