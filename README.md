# Rosalie · Planner & Finanças

Rosalie é um projeto acadêmico de aplicação web para organizar a rotina e planejar as finanças pessoais em um só lugar. A interface é em português e se adapta ao computador e ao celular.

O projeto está em desenvolvimento e, por enquanto, é destinado à execução local para estudo e demonstração.

## Funcionalidades

- Dashboard com resumo financeiro e composição do orçamento mensal.
- Cadastro de renda mensal média, receitas extras, despesas e contas fixas.
- Controle de cartões, compras parceladas, faturas e pagamentos.
- Planner com calendário, compromissos, tarefas, hábitos e anotações.
- Acompanhamento opcional do ciclo menstrual em um cofre local com frase secreta.
- Lista de desejos com fotos e reserva de valores para compras futuras.
- Gráficos e análises dos gastos.
- Personalização do nome e da foto de perfil, exportação de registros e limpeza dos dados locais.

## Tecnologias

React, TypeScript, Vite, Tailwind CSS, Recharts e Lucide. O projeto também possui integração opcional com Supabase para autenticação e armazenamento.

## Como rodar localmente

Você precisa de Git, npm e Node.js 22 (a partir da versão 22.12) ou 24.

```bash
git clone https://github.com/emylygaby/Rosalie.git
cd Rosalie
npm ci
npm run dev
```

Abra o endereço exibido no terminal, normalmente **http://127.0.0.1:5173**, e clique em **Conhecer a demonstração**.

No modo de demonstração, não é necessário criar uma conta, configurar o Supabase ou criar um arquivo `.env`. Os exemplos e suas alterações ficam salvos no navegador. Use dados fictícios para experimentar as funcionalidades.

Se você já tiver um `.env` com uma configuração do Supabase, deixe `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_ANON_KEY` vazias para executar somente a demonstração local.

No PowerShell, caso o comando `npm` seja bloqueado, use `npm.cmd` nos mesmos comandos:

```powershell
npm.cmd ci
npm.cmd run dev
```

## Outros comandos

```bash
npm test          # Executa os testes automatizados
npm run build    # Gera a versão de produção local
npm run preview  # Abre a versão gerada pelo build
```

Para executar os testes de navegação, tenha o Google Chrome instalado e rode `npm run test:e2e`. A configuração atual desses testes usa comandos do Windows.
