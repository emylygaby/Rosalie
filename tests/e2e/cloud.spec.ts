import { test, expect, type Page, type Route } from '@playwright/test';
import { demoData } from '../../src/seed';

const owner = '00000000-0000-4000-8000-000000000001';
async function simulatedLogin(page: Page, save?: (route: Route) => Promise<void>, logoutFails = false) {
  const payload = demoData(); payload.profile.name = 'Conta de teste';
  const user = { id: owner, email: 'synthetic@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() };
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: owner, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000) + 3600, amr: [{ method: 'password', timestamp: Math.floor(Date.now()/1000) }] })}.c3ludGhldGljLXNpZ25hdHVyZQ`;
  // Todas as requisições ao host fictício são interceptadas, inclusive caminhos inesperados.
  await page.route('https://rosalie-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/token') return route.fulfill({ json: { access_token: accessToken, refresh_token: 'synthetic-refresh-token', expires_in: 3600, token_type: 'bearer', user } });
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path === '/auth/v1/logout') return logoutFails ? route.abort('internetdisconnected') : route.fulfill({ status: 204 });
    if (path.endsWith('/rosalie_initialize')) return route.fulfill({ json: null });
    if (path.endsWith('/rosalie_load')) return route.fulfill({ json: { user_id: owner, revision: 0, payload } });
    if (path.endsWith('/rosalie_save')) return save ? save(route) : route.fulfill({ json: 1 });
    return route.fulfill({ status: 503, json: { message: 'Serviço simulado indisponível.' } });
  });
  await page.goto('/login'); await page.getByLabel('E-mail', { exact: true }).fill(user.email); await page.getByLabel('Senha', { exact: true }).fill('uma senha sintética para testes'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.balance')).toBeVisible();
}
test('logout offline remove dados e sessão; resposta atrasada de gravação não restaura a conta', async ({ page }) => {
  let pending: Route | undefined;
  await simulatedLogin(page, async route => { pending = route; }, true);
  expect(await page.evaluate(() => !!sessionStorage.getItem('rosalie.auth.v2'))).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => k.includes('auth')))).toBe(false);
  await page.goto('/configuracoes'); await page.getByLabel('Nome', { exact: true }).fill('NOME QUE NÃO PODE REAPARECER'); await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
  await expect.poll(() => !!pending).toBe(true);
  await page.locator('.sidebar-logout').click(); await expect(page).toHaveURL(/\/login$/);
  await pending!.fulfill({ json: 1 });
  await expect(page.getByText(/NOME QUE NÃO PODE REAPARECER/)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('rosalie.auth.v2'))).toBeNull();
  await expect(page.getByRole('alert')).toContainText(/revogação|sessão foi encerrada/);
  // Reautenticação pendente também não pode disparar SIGNED_IN e reabrir a conta.
  await simulatedLogin(page);
  await page.goto('/configuracoes'); await page.getByRole('button', { name: 'Excluir minha conta', exact: true }).click();
  let reauthRoute: Route | undefined, deletionCalls = 0;
  await page.route('https://rosalie-test.supabase.co/auth/v1/token**', async route => { reauthRoute = route; });
  await page.route('https://rosalie-test.supabase.co/functions/v1/delete-account', async route => { deletionCalls++; await route.fulfill({ json: { deleted: true } }); });
  await page.getByLabel('Confirme sua senha para excluir a conta').fill('uma senha sintética para testes'); await page.getByLabel('Digite EXCLUIR').fill('EXCLUIR');
  await page.getByRole('button', { name: 'Excluir conta e dados definitivamente', exact: true }).click(); await expect.poll(() => !!reauthRoute).toBe(true);
  // Usa a sessão sintética já emitida; não há contato com um serviço real.
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('rosalie.auth.v2')!));
  await page.locator('.sidebar-logout').click(); await expect(page).toHaveURL(/\/login$/);
  await reauthRoute!.fulfill({ json: session });
  await expect(page.getByRole('heading', { name: 'Bem-vinda de volta ♡', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('rosalie.auth.v2'))).toBeNull();
  expect(deletionCalls).toBe(0);
});
test('inatividade encerra sessão da conta e falha de exclusão não apresenta sucesso', async ({ page }) => {
  await page.clock.install({ time: new Date() }); await simulatedLogin(page);
  await page.goto('/configuracoes'); await page.getByRole('button', { name: 'Excluir minha conta', exact: true }).click();
  await page.getByLabel('Confirme sua senha para excluir a conta').fill('uma senha sintética para testes'); await page.getByLabel('Digite EXCLUIR').fill('EXCLUIR');
  await page.getByRole('button', { name: 'Excluir conta e dados definitivamente', exact: true }).click();
  await expect(page.locator('.privacy-center').getByRole('alert')).toContainText(/indisponível|Não foi possível/);
  await expect(page).toHaveURL(/\/configuracoes$/); await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Conta de teste');
  await page.route('https://rosalie-test.supabase.co/functions/v1/delete-account', route => route.fulfill({ json: { message: 'Resposta sem prova de exclusão.' } }));
  await page.getByLabel('Confirme sua senha para excluir a conta').fill('uma senha sintética para testes');
  await page.getByRole('button', { name: 'Excluir conta e dados definitivamente', exact: true }).click();
  await expect(page.locator('.privacy-center').getByRole('alert')).toContainText('não confirmou a exclusão');
  await expect(page).toHaveURL(/\/configuracoes$/);
  await page.clock.fastForward(16 * 60 * 1000); await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('rosalie.auth.v2'))).toBeNull();
});
