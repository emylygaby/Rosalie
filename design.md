# Rosalie — Personal Planner & Finance

> **Versão:** 1.2 — especificação de projeto acadêmico, prototipação com IA e MCP  
> **Objetivo:** definir produto, escopo, regras de negócio, design system, arquitetura, fluxos, telas e critérios de aceitação para Figma/Stitch e implementação.  
> **Idioma:** pt-BR. **Moeda:** BRL. **Fuso horário:** America/Sao_Paulo.

## Revisão 1.2 — segurança e privacidade (16/11/2026)

Esta revisão prevalece sobre descrições anteriores. Responsável: Emyly Gabryelle, canal emylygabryelle@gmail.com. Relatório completo: [SEGURANCA-LGPD.md](docs/SEGURANCA-LGPD.md); operação e pendências de produção: [OPERACAO-PRIVACIDADE.md](docs/OPERACAO-PRIVACIDADE.md).

- Aviso público e cadastro mínimo; nada de CPF, idade/nascimento ou gênero. Consentimento do ciclo separado do serviço essencial.
- Cofre local criptografado para saúde, frase secreta separada, migração/exclusão dos legados, bloqueio ao sair/ocultar e após 5 minutos inativo; retenção de 365 dias explicitada.
- Sessão por aba, logout local mesmo offline, saída após 15 minutos inativos na conta; respostas antigas não podem restaurar dados na interface.
- RLS mantida; DML direto negado e gravações somente pelo RPC validado, transacional, com escopo de auth.uid() e helper privado.
- Exportação JSON sem tokens/saúde, fotos separadas, limpeza de dados locais e arquivos sem referência. Exclusão da conta por função servidor verificada, senha recente, limpeza de imagens e cascata; falha não é sucesso.
- Imagens recriadas em WebP sem metadados originais; URLs assinadas de 60 segundos. Links HTTPS sem credenciais, CSP e cabeçalhos de produção preparados.
- Conformidade jurídica depende também de operação, provedor e configurações reais; não declarar certificação com base apenas nos testes locais.

## Revisão 1.1 — pedido funcional de 16/11/2026

Esta revisão prevalece sobre os requisitos anteriores em caso de divergência. O detalhamento completo está em [docs/ALTERACOES-1.1.md](docs/ALTERACOES-1.1.md).

- Despesas fixas não pedem data de término: repetem enquanto a série estiver ativa.
- Receita adicional tem uma única data, a do recebimento. Ela é somada apenas ao mês recebido e nunca copiada para outro mês.
- A renda mensal média é informada explicitamente, com mês de vigência, e forma a base recorrente do orçamento. Não representa recebimento confirmado.
- Dashboard e análises mostram a composição do próximo mês. Valores insuficientes são apresentados sem sinal negativo, com rótulo “Falta cobrir”, preservando o cálculo interno.
- Cadastro mínimo: e-mail, nome/apelido e senha de autenticação; nenhum campo de CPF, idade ou gênero. Foto de perfil é opcional e editável/removível.
- Acolhimento inicial/retorno é reconhecido no navegador, com saudação por horário de São Paulo e nome preferido no dashboard.
- O planner mantém a agenda e acrescenta tarefas/prioridades, hábitos semanais e foco/anotações mensais.
- O ciclo menstrual é opcional, exige autorização específica, mantém os dados somente neste navegador e permite excluir tudo. Datas estimadas são identificadas e não são usadas como contracepção nem diagnóstico.

## 1. Visão do produto

**Nome provisório:** Rosalie — Personal Planner & Finance.  
**Tagline:** Organize seus dias, planeje seus sonhos.  
**Tipo:** aplicação web responsiva com evolução para PWA instalável no celular.  
**Estratégia:** mobile-first, com layout desktop funcional.  
**Usuário prioritário:** pessoa que deseja acompanhar a própria rotina e planejar finanças pessoais; protótipo orientado a uma usuária única, com autenticação individual. Potencial público-alvo: adultos e jovens adultos, aproximadamente 18–35 anos.  
**Problema:** compromissos, despesas à vista, cartões, parcelamentos e desejos de compra costumam ficar fragmentados, dificultando a visão do orçamento mensal e o planejamento de meses futuros.  
**Proposta de valor:** reunir agenda e finanças em uma experiência de uso simples, visualmente acolhedora, com projeções explicáveis, gastos segregados por cartão e inclusão de produtos desejados no planejamento financeiro sem confundi-los com gastos efetivados.

**Delimitação:** o aplicativo não é banco digital, não executa pagamentos, não movimenta dinheiro, não importa automaticamente dados bancários e não oferece aconselhamento financeiro profissional. Todas as informações são inseridas manualmente.

## 2. Requisitos de usuário

- **RU01:** Como usuária, quero fazer login para manter meus dados privados.
- **RU02:** Quero visualizar em uma única tela meu mês financeiro e meus próximos compromissos.
- **RU03:** Quero informar minha renda mensal média, registrar receitas adicionais pelo recebimento e cadastrar despesas categorizadas.
- **RU04:** Quero identificar despesas fixas e repeti-las automaticamente nos meses relevantes.
- **RU05:** Quero separar Nubank, Santander e quaisquer outros cartões e visualizar gastos e faturas individualmente.
- **RU06:** Quero cadastrar compras parceladas e visualizar seu impacto nos meses futuros.
- **RU07:** Quero acompanhar valores já pagos, a pagar, gastos realizados e compromissos previstos sem contagem duplicada.
- **RU08:** Quero criar eventos/lembretes no calendário e receber avisos de proximidade quando a funcionalidade de notificações estiver habilitada.
- **RU09:** Quero registrar produtos desejados com nome, preço, foto opcional e prioridade.
- **RU10:** Quero reservar uma compra desejada para o próximo mês e vê-la descontada do orçamento **planejado**, mas não registrada como despesa efetiva antes da compra.
- **RU11:** Quero compreender despesas por categoria, por cartão e ao longo do tempo.
- **RU12:** Quero utilizar o sistema com conforto no celular e também demonstrá-lo no computador.

## 3. Requisitos funcionais

### 3.1 Essenciais para o MVP

| ID | Requisito | Critério de aceitação |
|---|---|---|
| RF01 | Login/logout e sessão autenticada | Acesso às telas internas é condicionado à autenticação; logout encerra sessão. |
| RF02 | Dashboard mensal | Selecionar mês atual/próximo e apresentar receitas, obrigações, disponível planejado, despesas e próximos eventos. |
| RF03 | CRUD de receitas | Criar, editar, excluir e categorizar receitas adicionais, com somente a data do recebimento. |
| RF04 | CRUD de despesas à vista | Registrar descrição, valor, categoria, data de vencimento/pagamento, recorrência e status. |
| RF05 | Recorrência mensal | Repetir cobranças sem data final enquanto a série estiver ativa, sem duplicar o mesmo mês; permitir pausar a série. |
| RF06 | CRUD de cartões | Nome/apelido, bandeira opcional, limite opcional, dia de fechamento e dia de vencimento. |
| RF07 | Compras por cartão | Cada lançamento pertence a exatamente um cartão e a um mês de fatura. |
| RF08 | Parcelamentos | Informar valor total, número de parcelas e primeira fatura; gerar parcelas futuras com soma exata em centavos. |
| RF09 | Fatura por cartão e mês | Exibir total de parcelas/compras daquela fatura, compras e status de pagamento. |
| RF10 | Consolidado mensal | Despesas à vista e faturas do mês compõem a projeção, sem duplicar pagamento da fatura. |
| RF11 | Lista de desejos | CRUD com nome, valor estimado, categoria, prioridade, link e imagem opcional. |
| RF12 | Reserva de compra | Atribuir mês-alvo a desejo; refletir valor no orçamento projetado sem transformá-lo em gasto real. |
| RF13 | Conversão em compra | Ao marcar o desejo como comprado, gerar lançamento/compra no cartão e remover ou ajustar a reserva para não contar duas vezes. |
| RF14 | Planner | Calendário e agenda preservados; eventos, tarefas/prioridades, hábitos e anotações. Ciclo menstrual opcional, local e consentido. |
| RF15 | Avisos internos | Indicador de compromissos próximos e contas vencendo na interface. |
| RF16 | Análises | Ao menos gráfico de despesas por categoria, gastos por cartão e comparação atual x próximo mês. |
| RF17 | Navegação responsiva | Mobile com barra inferior e desktop com sidebar, incluindo estados vazios e formulários. |
| RF18 | Dados persistentes | Cadastros permanecem após atualizar a página ou reiniciar navegador. |

### 3.2 Evolução pós-MVP

- Notificações push PWA com consentimento e serviço de agendamento no backend; no iPhone, push para web app adicionada à tela de início em versões compatíveis.
- Lembretes configuráveis (ex.: 1 dia antes, no horário).
- Metas de economia e acompanhamento de progresso.
- Exportação CSV/PDF e backup controlado.
- Análise de tendências por vários meses e filtros personalizados.
- Múltiplas carteiras/contas correntes e saldos reconciliados.
- Modo escuro ou novas paletas opcionais.

## 4. Regras de negócio financeiras (obrigatórias)

### 4.1 Conceitos separados

1. **Receitas realizadas:** entradas efetivamente recebidas no mês.
2. **Base mensal de planejamento:** renda média informada pela pessoa e vigente no mês; não comprova recebimento. Receitas adicionais são recebimentos registrados, válidos apenas no respectivo mês.
3. **Despesa à vista:** pagamento por Pix, dinheiro ou débito, com seu próprio status.
4. **Compra em cartão:** despesa associada a cartão e fatura de referência; pode ser parcelada.
5. **Fatura:** obrigação consolidada do cartão para um mês de vencimento.
6. **Liquidação da fatura:** pagamento dessa obrigação, que **não** gera uma segunda despesa no relatório de gastos.
7. **Desejo reservado:** compromisso hipotético com impacto somente na visão de planejamento, até a conversão em compra.

### 4.2 Fórmulas do painel

Usar o **mês de vencimento da fatura** como referência padrão para o orçamento mensal, com rótulos visíveis ao usuário. Não confundir mês da compra com mês da fatura.

- **Despesas previstas do mês** = despesas não-cartão com vencimento no mês + total das faturas com vencimento no mês.
- **Receita de referência do mês** = renda média informada e vigente no mês + receitas extras efetivamente recebidas nesse mês. Extras de outros meses não se repetem.
- **Disponível antes dos desejos** = receita de referência do mês − despesas previstas do mês.
- **Disponível planejado** = disponível antes dos desejos − soma dos desejos reservados para aquele mês.
- **Total a pagar** = despesas não pagas do mês + faturas ainda não quitadas do mês.
- **Gastos por cartão** = soma dos itens de fatura daquele cartão no período de referência.
- **Resultado realizado** = receitas efetivamente recebidas − despesas à vista efetivamente pagas − pagamentos de faturas realizados (somente como fluxo de caixa, nunca como despesa duplicada).

A projeção acima é **orçamento mensal sem saldo inicial**, não o saldo bancário real. Caso venha a existir controle de contas/carteiras, tratar saldo inicial e transferências numa visão própria de fluxo de caixa.

### 4.3 Regras especiais

- Ao registrar uma compra de R$ 120 em 3 parcelas, criar 3 parcelas de R$ 40 para três faturas consecutivas; quando o valor não for divisível, distribuir os centavos de maneira determinística e preservar o total exato.
- Se cartão A tiver R$ 200 em fatura e cartão B R$ 150 no mesmo mês, o consolidado de cartões será R$ 350, e cada cartão terá seu próprio detalhe.
- Se um desejo de R$ 180 for reservado para dezembro, a projeção de dezembro cai R$ 180. O registro de despesas reais não muda até o desejo virar compra. Ao realizar a compra, cancelar/ajustar a reserva e criar o lançamento efetivo, sem duplicar R$ 180.
- Para compra parcelada, o valor total não entra inteiro como despesa no mês da compra: entram as parcelas nos meses das respectivas faturas. Apresentar a dívida futura total como indicador distinto, se necessário.
- Datas de fechamento/vencimento configuráveis por cartão. Para o MVP, atribuir `statement_month` ao criar a compra; a regra de fechamento deve ser testada com compras antes/depois do fechamento. Permitir ajustar a primeira fatura manualmente em caso de divergência do banco.
- Categorias: moradia, alimentação, beleza/cuidados, transporte, lazer, saúde, educação, assinaturas, outros; tipo financeiro (fixo, variável, cartão/parcelado) não substitui a categoria temática.
- Despesas recorrentes geram ocorrências mensais únicas, que podem ser pagas ou editadas individualmente sem alterar necessariamente toda a série.
- Usar valores monetários em centavos inteiros no domínio ou NUMERIC(12,2) no banco. Nunca fazer a contabilidade com floats binários.

## 5. Arquitetura tecnológica

| Camada | Escolha | Justificativa |
|---|---|---|
| Interface | React + TypeScript + Vite | Componentes reutilizáveis e desenvolvimento local rápido. |
| Estilo | Tailwind CSS | Implementação fiel aos tokens do Figma. |
| Navegação | React Router | Telas derivadas e rotas protegidas. |
| UI / ícones | Componentes próprios + Lucide | Ícones consistentes, modernos e discretos. |
| Gráficos | Recharts ou biblioteca similar | Indicadores visuais e gráficos responsivos. |
| Backend gerenciado | Supabase | Auth, PostgreSQL e armazenamento de imagens sem construir API completa no MVP. |
| Banco de dados | PostgreSQL | Relacionamentos e integridade dos lançamentos. |
| Imagens | Supabase Storage (bucket privado) | Fotos de desejos; políticas de acesso. |
| Protótipo visual | Figma com MCP; Stitch como alternativa de geração inicial | Design editável e troca de contexto com IDE. |
| Desenvolvimento | VS Code + agente com suporte MCP | Implementação em arquivos locais. |
| Distribuição | Web responsiva; PWA em etapa posterior | Uso no celular sem publicar inicialmente em loja. |

**Segurança:** restringir todas as tabelas por `user_id` via Row Level Security, testar SELECT/INSERT/UPDATE/DELETE, não inserir chaves secretas de serviço no frontend, usar HTTPS e configurar acesso privado às imagens. Não cadastrar credenciais bancárias reais. Usar dados fictícios nas demonstrações.

### 5.1 Modelo lógico sugerido

- `profiles`: user_id (auth user), nome/apelido, avatar_path privado, revisão e deletion_requested_at técnico. Sem CPF, idade ou gênero.
- `income_plans`: id, user_id, amount em centavos, start_month; referências informadas com vigência.
- `planner_tasks`, `habits`, `habit_checks`, `planner_notes`: tarefas, hábitos, marcações diárias e notas mensais, com RLS.
- Ciclo menstrual: cofre criptografado local separado por usuário, somente com autorização explícita e frase própria; sem tabela ou sincronização remota.
- `categories`: id, user_id, nome, tipo, cor, ícone.
- `cards`: id, user_id, nome, bandeira, fechamento_dia, vencimento_dia, limite_opcional.
- `incomes`: id, user_id, description, amount, category, date técnico de compatibilidade e received_date. O formulário novo usa somente o recebimento; não há previsão duplicada.
- `expenses`: id, user_id, descricao, valor_centavos, categoria_id, vencimento, data_pagamento, status, meio_pagamento (pix/dinheiro/debito), recorrencia_id.
- `recurrence_rules`: id, user_id, tipo_origem, frequencia, dia_mes, data_inicio, data_fim, ativo.
- `card_purchases`: id, user_id, card_id, descricao, categoria_id, valor_total_centavos, data_compra, quantidade_parcelas, observacoes.
- `card_installments`: id, user_id, purchase_id, card_id, numero, valor_centavos, statement_month (YYYY-MM), vencimento_estimado, status.
- `card_statements`: id, user_id, card_id, statement_month, valor_calculado, vencimento, data_pagamento, status (valor calculado preferencialmente por consulta/visão).
- `wishlist_items`: id, user_id, nome, preco_estimado_centavos, categoria, prioridade, imagem_path, url, status, mes_planejado, purchase_id_opcional.
- `planner_events`: id, user_id, titulo, descricao, inicio_em, fim_em, lembrete_minutos, status.
- `notification_preferences`: user_id, preferencias, consentimento_push.

As tabelas de fatura devem sempre reconciliar com as parcelas geradas: evitar guardar totais derivados divergentes quando for possível calculá-los.

## 6. Design system — romantismo rococó contemporâneo

**Direção criativa:** delicadeza de papelaria premium; referências a romance/rococó por meio de bordas suaves, arcos discretos, molduras sutis, pequenas flores e ornamentos em pontos estratégicos. Dados e formulários permanecem modernos, simples e legíveis. **Não** criar excesso de arabescos, texturas atrás de gráficos, rosa fluorescente ou contraste fraco.

### 6.1 Tokens de cor

| Papel | Token | Hex |
|---|---|---|
| Rosa principal | `color.brand.rose` | `#B86C87` |
| Rosa escuro (botões/contraste) | `color.brand.roseDeep` | `#7D3654` |
| Rosa claro | `color.brand.blush` | `#F8DFE7` |
| Lilás secundário | `color.accent.lilac` | `#DED3EB` |
| Champanhe terciário | `color.accent.champagne` | `#EADBC6` |
| Fundo marfim | `color.surface.page` | `#FFF9F7` |
| Superfície de cards | `color.surface.card` | `#FFFFFF` |
| Borda sutil | `color.border.soft` | `#EADBE2` |
| Texto principal | `color.text.primary` | `#352934` |
| Texto secundário | `color.text.muted` | `#6E626C` |
| Entrada/positivo | `color.status.positive` | `#286E56` |
| Saída/alerta | `color.status.negative` | `#9F3656` |

As cores semânticas de positivo/negativo são funcionais; nunca depender apenas da cor para informar status.

### 6.2 Tipografia

- **Títulos e destaques decorativos:** Playfair Display (serif), peso 500–600.
- **Texto de interface, legendas, formulários, tabelas e valores:** Inter (sans-serif), peso 400–700; números tabulares para valores.
- **H1 mobile:** 28px/36px; **H1 desktop:** 36px/44px.
- **H2:** 22px/30px; **H3:** 18px/26px.
- **Body:** 16px/24px; **label:** 14px/20px; **caption:** 12px/16px.
- Informações financeiras importantes não devem usar fontes caligráficas.

### 6.3 Espaçamento, geometria, ícones e responsividade

- Base de 4px; tokens de espaçamento `4, 8, 12, 16, 24, 32, 48` px.
- Padding horizontal mobile: 16px (24px em telas largas); cartões com 16–24px de padding.
- Radius: input 12px, botões 14px, cards 20px, modais 24px.
- Altura mínima de campo/botão: 44–48px; alvos de toque ao menos 44px.
- Ícones Lucide: 20–24px, traço coerente; símbolos decorativos (laço, coração, flor) apenas em locais não críticos.
- Sombra muito leve, contorno sutil, uso generoso de espaços em branco.
- `390 × 844` para quadro mobile base; `1440 × 900` para desktop, com adaptação fluida.
- Mobile: bottom navigation fixa; desktop: sidebar e grid flexível.
- Breakpoints sugeridos: `md:768px`, `lg:1024px`; evitar largura fixa de conteúdo principal.
- **Figma obrigatório:** variáveis nomeadas para cores, espaçamentos e raios; estilos tipográficos; auto layout em todos os componentes e frames; componentes/variants para botões, campos, cards, tabs, ícones, badges e navegação; evitar posicionamento absoluto para estrutura.

### 6.4 Estados necessários

Desenhar e implementar estados padrão, vazio, carregando, erro, vencido, pago, programado, selecionado e desabilitado. Foco visível, leitura por teclado, campos com labels e mensagens úteis.

## 7. Telas e componentes

| Tela | Conteúdo mínimo | Interações principais |
|---|---|---|
| 01. Login | marca, email, senha, entrar | autenticar, mostrar erro |
| 02. Dashboard | seletor mensal, receitas, a pagar, disponível planejado, cards de cartões, próximos eventos, gráfico pequeno | navegar para módulos, mudar mês |
| 03. Finanças | filtros, lista de receitas/despesas, totais, categoria, status | adicionar/editar/registrar pagamento |
| 04. Cartões | listagem individual de cartões, total de cada fatura, limite opcional | abrir cartão, criar cartão |
| 05. Detalhes do cartão | seletor de fatura, lançamentos e parcelas, total e status | adicionar compra, visualizar parcelas |
| 06. Planner | calendário mensal, agenda diária, lembretes | adicionar/editar evento |
| 07. Lista de desejos | grid/lista de produtos, fotos, preços, prioridade, mês-alvo | adicionar desejo, reservar compra, converter em gasto |
| 08. Análises | gráficos por categoria/cartão e comparação temporal | alterar período |
| 09. Configurações | perfil, preferências, notificações, logout | atualizar preferências |

**Formulários/diálogos reutilizáveis:** nova transação, nova receita, novo cartão, compra parcelada, novo evento, novo desejo e confirmação de exclusão.

### 7.1 Organização da home mobile

1. Cabeçalho 'Olá, bem-vinda' + ícone notificações + seletor de mês.
2. Card grande 'Seu mês em números' com disponível planejado e ajuda contextual.
3. Três indicadores: entradas previstas, despesas previstas, reservas de desejos.
4. Bloco 'Minhas faturas' com mini-cards Nubank / Santander.
5. Bloco 'Próximos compromissos' com 2–3 eventos.
6. Bloco 'Desejos planejados' com produtos do mês.
7. Bottom navigation: Início, Finanças, Planner, Desejos, Mais.

### 7.2 Comportamento desktop

Sidebar com ícones/nomes de módulos; dashboard em grid de 12 colunas; cards de indicadores no topo, gráficos e listas lado a lado; sem comprimir elementos mobile em uma única coluna estreita.

## 8. Dados fictícios para demonstração

Todos os dados a seguir são exemplos inventados e não representam contas reais:

- Mês de referência: dezembro/2026.
- Renda mensal média informada: R$ 2.800,00, vigente desde dezembro/2026. Receitas extras iniciais: zero. Essa média não é registrada como recebimento efetivo.
- Despesa fixa: água R$ 40,00; internet R$ 95,00.
- Nubank: compra 'Body splash' R$ 120,00 em 6 parcelas de R$ 20,00, primeira fatura em dezembro.
- Santander: 'Mercado' R$ 150,00 em uma parcela, fatura dezembro.
- Desejo: 'Perfume' R$ 180,00 reservado para dezembro, ainda não comprado.
- Evento: 'Consulta' em 10/12/2026 às 14h, aviso interno de proximidade.

**Cálculo da demonstração (somente itens acima):** faturas do mês R$ 170,00; despesa à vista prevista R$ 135,00; total previsto R$ 305,00; disponível antes dos desejos R$ 2.495,00; disponível planejado R$ 2.315,00. A compra parcelada tem parcelas futuras de R$ 20,00 ainda previstas; não lançar os R$ 120,00 integralmente em dezembro.

## 9. Plano de execução MCP

### Etapa 1 — Validação do escopo

Definir projeto, requisitos, regras de negócio e MVP. Criar repositório Git e arquivos `design.md` e `README.md`. Validar os cálculos e selecionar dados fictícios.

### Etapa 2 — Design system no Figma ou Stitch

Usar IA com este `design.md` como fonte de verdade. Primeiro gerar paleta, tipografia, componentes e o frame do Dashboard mobile, com variantes e auto layout. Corrigir uma tela antes de solicitar o restante. Se usar Stitch, exportar os designs necessários ao Figma e **conferir manualmente** variáveis, componentes e auto layout. Não assumir que a exportação já atende aos critérios do professor.

### Etapa 3 — Fluxos de navegação

Criar Login → Dashboard → Finanças → Cartões → Detalhe; Dashboard → Planner → Evento; Dashboard → Desejos → Reserva → Orçamento do mês seguinte. Conectar telas no protótipo clicável. Inspecionar desktop e mobile.

### Etapa 4 — MCP com editor local

Conectar Figma MCP no VS Code com cliente de IA compatível; autorizar a conexão. Passar links **de frames específicos** ao agente. Solicitar leitura de contextos/variáveis e implementação em React + Tailwind, usando componentes reutilizáveis e design tokens. Implementar por tela para reduzir chamadas e retrabalho. Nunca mandar apenas screenshot se o MCP disponibiliza layout estruturado.

### Etapa 5 — Implementação funcional

Primeiro navegação e estados com dados mockados; depois autenticação, schema e políticas RLS, CRUD, cálculos, gráficos e uploads. Testar consistência do orçamento antes de implementar extras visuais. Não simular persistência como se fosse real.

### Etapa 6 — Validação e entrega

Testar cenários: compra parcelada; dois cartões; fatura paga; desejo planejado e comprado; mês seguinte; evento próximo; login/logout; redimensionamento mobile/desktop; dados persistidos. Registrar vídeo curto ou capturas do design, fluxo MCP, implementação e testes. Documentar limitações (push opcional/fase futura, por exemplo).

## 10. Critérios de pronto (Definition of Done)

- [ ] Dashboard e telas derivadas navegáveis.
- [ ] Login/logout funcional ou autenticado como exigido pela demonstração.
- [ ] Componentes Figma editáveis, variáveis e auto layout verificados.
- [ ] Evidência de conexão e uso efetivo do MCP com o editor local.
- [ ] Layout responsivo em 390px e 1440px.
- [ ] Cadastro de receitas, despesas, cartões e desejos persistente.
- [ ] Visão por cartão e consolidado mensal conciliados.
- [ ] Parcelas lançadas nos meses corretos.
- [ ] Desejos reduzem apenas orçamento projetado, sem despesa duplicada.
- [ ] Painel distingue valores realizados, a pagar e planejados.
- [ ] Planner e indicador de lembretes próximos funcionais.
- [ ] Pelo menos dois gráficos úteis com dados consistentes.
- [ ] Políticas RLS e acesso às imagens testados, caso Supabase seja usado.
- [ ] Repositório com README, stack, instruções e decisões técnicas.

## 11. Referências técnicas verificadas em novembro/2026

- Figma MCP Server: https://developers.figma.com/docs/figma-mcp-server/
- Figma MCP no VS Code: https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server
- Figma MCP best practices: https://help.figma.com/hc/en-us/articles/34855090823063-MCP-server-best-practices
- Google Stitch, DESIGN.md e MCP: https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Web push no iOS (PWA na tela inicial): https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

## 12. Critérios adicionais da revisão 1.1

- [ ] Formulários sem prazo final da despesa fixa e sem duplicação de datas na receita.
- [ ] Renda média com vigência, extras limitados ao recebimento e composição explícita do próximo mês.
- [ ] Déficit exibido como valor positivo rotulado “Falta cobrir”, sem mascarar a insuficiência.
- [ ] Nome preferido no cadastro/dashboard, foto privada editável e boas-vindas distintas por retorno.
- [ ] Tarefas, prioridades, hábitos e anotações persistentes, com agenda mantida.
- [ ] Ciclo opcional com autorização, histórico editável/apagável e estimativas claramente separadas de registros reais.
- [ ] Migração incremental das 16 tabelas e bucket privado de fotos testada localmente.
- [ ] Privacidade documentada sem declarar conformidade legal integral nem enviar registros do ciclo ao Supabase.

Referências do ciclo: https://www.nhs.uk/conditions/periods/fertility-in-the-menstrual-cycle/ e https://womenshealth.gov/menstrual-cycle/premenstrual-syndrome.
Base normativa: LGPD, especialmente arts. 5º e 11: https://normas.leg.br/?urn=urn:lex:br:federal:lei:2018-08-14%3B13709!art5.

## 13. Critérios de segurança e privacidade da revisão 1.2

- [x] Aviso público com responsável/canal e escolhas específicas do ciclo.
- [x] Criptografia, migração/exclusão local e bloqueio do cofre testados.
- [x] DML negado, RLS, wrapper e isolamento testados localmente nas 16 tabelas.
- [x] Exportação, limpeza local e falha de exclusão exercitadas em navegador.
- [x] Logout offline, resposta atrasada e expiração por inatividade testados com Auth/RPC simulados.
- [x] Dependências sem avisos conhecidos na consulta de 16/11/2026; CSP do preview verificada.
- [ ] Migração 003 e função de exclusão implantadas e validadas com duas contas em homologação real.
- [ ] Hospedagem HTTPS e cabeçalhos reais conferidos; controles Auth configurados.
- [ ] Região/transferências, retenção de logs/backups, atendimento e bases validados antes de dados reais.

Os itens locais concluídos não concluem automaticamente os itens operacionais nem a auditoria Figma pendente.
