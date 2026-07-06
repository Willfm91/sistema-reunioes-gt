# 🚀 GUIA RÁPIDO DE DEPLOY - 5 MINUTOS

## Pré-requisitos
- ✅ Conta GitHub (crie em https://github.com/signup)
- ✅ Conta Vercel (crie em https://vercel.com/signup)
- ✅ Chave de API Claude (obtenha em https://console.anthropic.com/account/keys)

---

## ⚡ PASSO A PASSO RÁPIDO

### PASSO 1: Preparar GitHub (2 min)

1. Acesse https://github.com/new
2. Nome do repositório: `sistema-reunioes-gt`
3. Descrição: "Sistema automático de processamento de reuniões"
4. Selecione "Public"
5. Clique "Create repository"
6. Ele vai mostrar comandos para fazer upload dos arquivos

Na sua máquina (ou terminal do GitHub Desktop):
```bash
# No diretório onde está a pasta do projeto
cd sistema-reunioes-gt
git init
git add .
git commit -m "Initial commit - Sistema de reuniões GT"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/sistema-reunioes-gt.git
git push -u origin main
```

> Se aparecer erro de autenticação, gere um Personal Access Token em https://github.com/settings/tokens

---

### PASSO 2: Deploy no Vercel (2 min)

1. Acesse https://vercel.com/new
2. Clique em "Continue with GitHub"
3. Autorize Vercel acessar suas repos
4. Na lista, selecione `sistema-reunioes-gt`
5. Clique "Import"

**Agora vai aparecer a página de configuração**

---

### PASSO 3: Configurar Variáveis de Ambiente (1 min)

Na página que abriu:

1. Procure por "Environment Variables"
2. Em "Name" digite: `NEXT_PUBLIC_CLAUDE_API_KEY`
3. Em "Value" cole sua chave de API do Claude (começa com `sk-`)
   - Obtenha em: https://console.anthropic.com/account/keys
4. Clique em "Add" (botão cinza do lado)
5. **Aparecerá confirmado** ✅

---

### PASSO 4: Deploy (30 seg)

1. Clique no botão grande "Deploy" (azul)
2. Aguarde 2-3 minutos...
3. Você verá: "✅ Congratulations! Your project has been successfully deployed"
4. Clique no link que aparece (tipo `https://sistema-reunioes-gt-xxx.vercel.app`)

**🎉 PRONTO! Sua ferramenta está ao vivo!**

---

## ✅ Verificar se Funcionou

1. Abra o link gerado
2. Clique em "⚙️ Processar"
3. Clique em "🔗 Conectar Google Drive"
4. Cole uma transcrição de teste
5. Clique em "🚀 Processar Transcrição com Claude"
6. Se aparecer o resultado = **tudo funcionando!** ✅

---

## 🆘 Dúvidas Comuns

**P: "Error: API key not configured"**
- R: Verifique se a variável de ambiente foi adicionada corretamente no Vercel
- Vá em: Project → Settings → Environment Variables
- Confirme que `NEXT_PUBLIC_CLAUDE_API_KEY` está lá

**P: Como atualizar depois?**
- R: Faça um `git push` no seu repositório e o Vercel faz deploy automático

**P: Posso usar offline?**
- R: Não, precisa da internet (chamadas à Claude API e Google Drive)

**P: Meus dados ficam seguro?**
- R: Sim! As tarefas ficam no browser (localStorage), não em servidor

---

## 📚 Próximas Evoluções

Depois que testar por 1-2 semanas, podemos adicionar:
- 🔐 Login com Google
- 💾 Banco de dados (Supabase) para backup
- 🔔 Notificações de tarefas atrasadas
- 📊 Relatórios semanais
- 🤖 n8n automático 24/7

---

**Pronto? Vamos começar! 🚀**
