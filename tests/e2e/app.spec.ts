import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function enterDemo(page: Page) { await page.goto('/login'); await page.getByRole('button', { name: 'Conhecer a demonstração' }).click(); await expect(page.locator('.balance')).toHaveText(/2\.315,00/); }
async function amount(page: Page, value: string) { await expect.poll(async () => (await page.locator('.balance').innerText()).replace(/[^\d,.-]/g, '')).toBe(value); }
async function screenshot(page: Page, name: string, project: string) { await mkdir('docs/evidence', { recursive: true }); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `docs/evidence/${project}-${name}.png`, fullPage: true }); }

test('rotas protegidas, nove telas, layout e capturas em 390/1440px', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/cartoes'); await expect(page).toHaveURL(/\/login$/);
  for (const [name, size] of [['rose', 58], ['mail', 19], ['lock', 19], ['security', 17]] as const) {
    const asset = page.locator(`img[src="/figma/${name}.svg"]`);
    await expect(asset).toBeVisible();
    expect(await asset.evaluate((img: HTMLImageElement) => ({ loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height }))).toEqual({ loaded: true, width: size, height: size });
  }
  await screenshot(page, 'login', testInfo.project.name);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crie sua conta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Esqueceu sua senha?', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recupere seu acesso', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para entrar', exact: true }).click();
  await enterDemo(page); await screenshot(page, 'dashboard', testInfo.project.name);
  const cardId = await page.locator('.mini-card').first().getAttribute('href');
  for (const [path, title, file] of [['/financas', 'Minhas finanças', 'financas'], ['/cartoes', 'Meus cartões', 'cartoes'], [cardId!, 'Nubank', 'fatura'], ['/planner', 'Meu planner', 'planner'], ['/desejos', 'Meus desejos', 'desejos'], ['/analises', 'Um olhar para seus números', 'analises'], ['/configuracoes', 'Meu espaço', 'configuracoes']]) {
    await page.goto(path); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await screenshot(page, file, testInfo.project.name);
  }
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Sair do meu espaço' }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/financas'); await expect(page).toHaveURL(/\/login$/);
});

test('CRUD persistente, recorrência individual, recebimento e pagamento de fatura', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-20T09:00:00-03:00') });
  await enterDemo(page); await page.goto('/financas');
  await page.getByRole('button', { name: 'Despesa', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Academia');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100,01');
  await dialog.getByLabel('Vencimento', { exact: true }).fill('2026-12-10');
  await dialog.getByLabel('Repetir mensalmente').check(); await expect(dialog.getByLabel(/Repetir até|Último mês/)).toHaveCount(0); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).not.toBeVisible(); await page.reload();
  await expect(page.getByRole('table').getByText('Academia', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Academia', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByLabel('Valor (R$)', { exact: true }).fill('110,01'); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Academia' }).getByText(/110,01/)).toBeVisible();
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Academia' }).getByText(/100,01/)).toBeVisible();
  await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir Academia', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.reload(); await expect(page.getByRole('table').getByText('Academia', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Receitas/ }).click();
  await page.getByRole('button', { name: 'Receita', exact: true }).click();
  dialog = page.getByRole('dialog'); await expect(dialog.locator('input[type="date"]')).toHaveCount(1);
  await expect(dialog.getByLabel('Data prevista', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Descrição', { exact: true }).fill('Freela'); await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await dialog.getByLabel('Data do recebimento', { exact: true }).fill('2026-12-05'); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('table').getByText('Recebido', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Freela', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.goto('/cartoes'); await page.getByRole('link', { name: 'Ver fatura e parcelas' }).first().click();
  await page.getByRole('button', { name: 'Registrar pagamento', exact: true }).click(); await page.getByLabel('Data efetiva').fill('2026-12-05'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reabrir fatura', exact: true })).toBeVisible();
  await page.goto('/'); await amount(page, '2.315,00');
});

test('desejo reservado vira compra sem dupla contagem; evento e preferências persistem', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-09T14:00:00-03:00') });
  await enterDemo(page);
  await page.getByRole('button', { name: /^Notificações/ }).click();
  await expect(page.getByRole('dialog').getByText('Consulta', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/desejos'); await page.getByRole('button', { name: 'Comprei', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Data da compra').fill('2026-12-10');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.getByText('Desejo realizado', { exact: true })).toBeVisible();
  await page.goto('/'); await amount(page, '2.315,00');
  await page.goto('/planner'); await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  let dialog = page.getByRole('dialog'); await dialog.getByLabel('Título do compromisso').fill('Estudar MCP');
  await dialog.getByLabel('Início', { exact: true }).fill('2026-12-15T10:00'); await dialog.getByLabel('Término', { exact: true }).fill('2026-12-15T11:00');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudar MCP', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Estudar MCP' }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Título do compromisso').fill('Apresentar MCP'); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir Apresentar MCP' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Apresentar MCP', exact: true })).toHaveCount(0);
  await page.goto('/configuracoes'); await page.getByLabel('Nome', { exact: true }).fill('Maria'); await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  await page.getByRole('switch').click(); await expect(page.getByRole('switch')).not.toBeChecked();
  await page.reload(); await expect(page.getByRole('switch')).not.toBeChecked();
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Boa tarde, Maria/ })).toBeVisible();
});

test('nova compra parcelada, novo cartão, novo desejo e navegação mobile', async ({ page }, testInfo) => {
  await enterDemo(page);
  if (testInfo.project.name === 'mobile') { await page.getByRole('button', { name: 'Mais', exact: true }).click(); await page.getByRole('dialog').getByRole('link', { name: 'Cartões', exact: true }).click(); }
  else await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Cartões', exact: true }).click();
  await page.getByRole('button', { name: 'Novo cartão', exact: true }).click();
  let dialog = page.getByRole('dialog'); await dialog.getByLabel('Nome do cartão').fill('Inter'); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('link', { name: 'Ver fatura e parcelas' }).last().click();
  await page.getByRole('button', { name: 'Nova compra', exact: true }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Curso MCP'); await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await dialog.getByLabel('Número de parcelas').fill('3'); await dialog.getByLabel('Primeira fatura (vencimento)').fill('2026-12');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(page.getByRole('row').filter({ hasText: 'Curso MCP' }).getByText(/33,34/)).toBeVisible();
  await page.getByRole('button', { name: 'Próximo mês' }).click(); await expect(page.getByRole('row').filter({ hasText: 'Curso MCP' }).getByText(/33,33/)).toBeVisible();
  await page.goto('/desejos'); await page.getByRole('button', { name: 'Novo desejo', exact: true }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('O que você deseja?').fill('Livro'); await dialog.getByLabel('Valor (R$)', { exact: true }).fill('60,00');
  await dialog.getByLabel('Foto do desejo (opcional)').setInputFiles('docs/evidence/desktop-login.png');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  const wish = page.locator('.wish-card').filter({ hasText: 'Livro' });
  await expect(wish.locator('img')).toBeVisible(); await page.reload(); await expect(wish.locator('img')).toBeVisible();
  await wish.getByRole('button', { name: 'Planejar compra' }).click();
  await page.getByLabel('Mês planejado para comprar').fill('2027-01'); await page.getByRole('button', { name: 'Reservar no orçamento' }).click();
  await expect(wish.getByText('janeiro de 2027', { exact: true })).toBeVisible();
  await page.goto('/'); await page.getByLabel('Mês de referência').fill('2027-01'); await amount(page, '2.551,67');
});

test('renda média, extras, orçamento sem sinal negativo, nome e foto de perfil', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-12-20T09:00:00-03:00') });
  await page.goto('/login'); await expect(page.getByRole('heading', { name: 'Bem-vinda ♡', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByLabel('Como você quer ser chamada?')).toBeVisible();
  await expect(page.getByLabel(/CPF|idade|gênero/i)).toHaveCount(0);
  await enterDemo(page); await page.goto('/configuracoes');
  await page.getByLabel('Renda mensal média (R$)', { exact: true }).fill('3000,00');
  await page.getByLabel('Aplicar a partir de', { exact: true }).fill('2026-12'); await page.getByRole('button', { name: 'Salvar renda média', exact: true }).click();
  await expect(page.getByText('Renda média salva', { exact: true })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByLabel('Foto de perfil (opcional)').setInputFiles('docs/evidence/desktop-login.png');
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
  await expect(page.getByText('Perfil salvo', { exact: true })).toBeVisible(); await page.reload();
  const avatar = page.locator('.profile-photo-preview img'); await expect(avatar).toBeVisible();
  expect(await avatar.evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight, webp: img.src.startsWith('data:image/webp') }))).toEqual({ width: 256, height: 256, webp: true });
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Bom dia, Ana/ })).toBeVisible(); await amount(page, '2.515,00');
  await expect(page.locator('.forecast-result')).toHaveText(/2\.845,00/);
  await page.goto('/financas'); await page.getByRole('button', { name: 'Receita', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Descrição', { exact: true }).fill('Bônus'); await dialog.getByLabel('Valor (R$)', { exact: true }).fill('50,00'); await dialog.getByLabel('Data do recebimento', { exact: true }).fill('2026-12-19'); await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.goto('/'); await amount(page, '2.565,00'); await expect(page.locator('.forecast-result')).toHaveText(/2\.845,00/);
  await page.goto('/configuracoes'); await page.getByLabel('Renda mensal média (R$)', { exact: true }).fill('0,00'); await page.getByLabel('Aplicar a partir de', { exact: true }).fill('2027-01'); await page.getByRole('button', { name: 'Salvar renda média', exact: true }).click(); await expect(page.getByText('Renda média salva', { exact: true })).toBeVisible();
  await page.goto('/'); await page.getByLabel('Mês de referência').fill('2027-01'); await amount(page, '155,00'); await expect(page.locator('.balance')).not.toHaveText(/-/); await expect(page.locator('.overview-top')).toContainText('Falta cobrir');
  await screenshot(page, 'orcamento-explicado', testInfo.project.name);
  await page.goto('/configuracoes'); await page.getByRole('button', { name: 'Sair do meu espaço' }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vinda de volta ♡', exact: true })).toBeVisible();
});

test('planner com tarefas, hábitos, notas e ciclo opcional local apagável', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-12-20T09:00:00-03:00') }); await enterDemo(page); await page.goto('/planner');
  await page.getByLabel('Tarefa', { exact: true }).fill('Estudar React'); await page.getByLabel('Dia da tarefa').fill('2026-12-22'); await page.getByRole('button', { name: 'Adicionar tarefa', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Concluir tarefa Estudar React' }).check();
  await page.getByLabel('Novo hábito', { exact: true }).fill('Beber água'); await page.getByRole('button', { name: 'Adicionar hábito', exact: true }).click();
  await page.getByRole('button', { name: /Beber água,/ }).first().click();
  await page.getByLabel('Meu foco do mês').fill('Cuidar de mim'); await page.getByLabel('Anotações do planner').fill('Separar tempo para descanso.'); await page.getByRole('button', { name: 'Salvar anotações', exact: true }).click();
  await expect(page.getByText('Anotações salvas', { exact: true })).toBeVisible(); await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Concluir tarefa Estudar React' })).toBeChecked(); await expect(page.getByRole('button', { name: /Beber água,/ }).first()).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByLabel('Meu foco do mês')).toHaveValue('Cuidar de mim');
  await expect(page.getByLabel('Início da menstruação', { exact: true })).toHaveCount(0);
  await page.getByLabel('Frase secreta do cofre', { exact: true }).fill('flores azuis no jardim privado');
  await page.getByLabel('Confirme a frase secreta', { exact: true }).fill('flores azuis no jardim privado');
  await page.getByRole('button', { name: 'Criar cofre do ciclo', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('rosalie.cycle.v2.demo'))).toBeNull();
  await page.getByRole('checkbox', { name: /Autorizo o acompanhamento opcional/ }).check();
  await page.getByRole('button', { name: 'Criar cofre do ciclo', exact: true }).click();
  await page.getByLabel('Início da menstruação', { exact: true }).fill('2026-12-01');
  await page.getByLabel('Fim do sangramento (opcional)', { exact: true }).fill('2026-12-04');
  await page.getByRole('button', { name: 'Salvar registro do ciclo', exact: true }).click();
  await expect(page.getByText('Ciclo salvo neste navegador', { exact: true })).toBeVisible();
  await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(4); await expect(page.locator('.calendar-day.cycle-ovulation-estimate')).toHaveCount(7);
  const stored = await page.evaluate(() => localStorage.getItem('rosalie.cycle.v2.demo'));
  expect(stored).not.toContain('2026-12-01'); expect(stored).not.toContain('consented_at'); expect(stored).not.toContain('flores azuis');
  expect(await page.evaluate(() => localStorage.getItem('rosalie.demo.v1')?.includes('consented_at'))).toBe(false);
  await screenshot(page, 'planner-completo', testInfo.project.name);
  await page.reload(); await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(0);
  await expect(page.getByLabel('Início da menstruação', { exact: true })).toHaveCount(0);
  await page.getByLabel('Frase secreta do cofre', { exact: true }).fill('uma frase secreta incorreta');
  await page.getByRole('button', { name: 'Desbloquear cofre', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Não foi possível abrir');
  await page.getByLabel('Frase secreta do cofre', { exact: true }).fill('flores azuis no jardim privado');
  await page.getByRole('button', { name: 'Desbloquear cofre', exact: true }).click(); await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox', { name: 'Mostrar estimativas para ciclo regular' }).uncheck(); await page.getByRole('button', { name: 'Salvar registro do ciclo', exact: true }).click(); await expect(page.locator('.calendar-day.cycle-ovulation-estimate')).toHaveCount(0);
  await page.clock.fastForward(5 * 60 * 1000 + 20000); await expect(page.getByRole('button', { name: 'Desbloquear cofre', exact: true })).toBeVisible(); await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(0);
  await page.getByLabel('Frase secreta do cofre', { exact: true }).fill('flores azuis no jardim privado'); await page.getByRole('button', { name: 'Desbloquear cofre', exact: true }).click();
  await page.getByRole('button', { name: 'Apagar dados do ciclo', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('rosalie.cycle.v1.demo'))).toBeNull(); expect(await page.evaluate(() => localStorage.getItem('rosalie.cycle.v2.demo'))).toBeNull();
  await expect(page.getByRole('checkbox', { name: /Autorizo o acompanhamento opcional/ })).not.toBeChecked();

});
