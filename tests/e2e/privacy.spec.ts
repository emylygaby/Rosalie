import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('aviso público, exportação sem saúde e limpeza integral do demo local', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('link', { name: 'Aviso de privacidade e seus direitos' }).click();
  await expect(page.getByRole('heading', { name: 'Aviso de privacidade', exact: true })).toBeVisible();
  await expect(page.getByText(/A responsável pelo aplicativo é Emyly Gabryelle/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'emylygabryelle@gmail.com', exact: true })).toHaveAttribute('href', 'mailto:emylygabryelle@gmail.com');
  await page.goto('/login'); await page.getByRole('button', { name: 'Conhecer a demonstração' }).click();
  await page.goto('/configuracoes');
  await page.evaluate(() => { localStorage.setItem('rosalie.cycle.v1.demo', JSON.stringify({ sensitive: 'nunca-exportar-no-arquivo-geral' })); });
  page.once('dialog', dialog => dialog.accept());
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar meus dados', exact: true }).click(); const download = await downloadPromise;
  const content = await readFile((await download.path())!, 'utf8'); const parsed = JSON.parse(content);
  expect(parsed.data.cards).toHaveLength(2); expect(parsed.data.income_plans).toHaveLength(1); expect(content).not.toContain('nunca-exportar-no-arquivo-geral'); expect(content).not.toMatch(/access_token|refresh_token/);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Apagar dados da demonstração e sair', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('heading', { name: 'Bem-vinda ♡', exact: true })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('rosalie.demo.v1'), localStorage.getItem('rosalie.cycle.v1.demo'), localStorage.getItem('rosalie.cycle.v2.demo'), sessionStorage.getItem('rosalie.demo.session')])).toEqual([null,null,null,null]);
});

test('dados antigos do ciclo exigem escolha e o cofre bloqueia ao sair do planner', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-20T09:00:00-03:00') });
  await page.goto('/login'); await page.getByRole('button', { name: 'Conhecer a demonstração' }).click();
  await page.evaluate(() => localStorage.setItem('rosalie.cycle.v1.demo', JSON.stringify({ consented_at: '2026-12-01T12:00:00Z', cycle_length: 28, period_length: 5, estimates: true, records: [{ id: 'synthetic-record', start_date: '2026-12-01', end_date: '2026-12-04' }] })));
  await page.goto('/planner'); await expect(page.getByRole('alert')).toContainText('sem criptografia'); await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('rosalie.cycle.v1.demo'))).toContain('2026-12-01');
  await page.getByLabel('Frase secreta do cofre', { exact: true }).fill('flores azuis no jardim privado'); await page.getByLabel('Confirme a frase secreta', { exact: true }).fill('flores azuis no jardim privado');
  await page.getByRole('checkbox', { name: /Autorizo o acompanhamento opcional/ }).check(); await page.getByRole('button', { name: 'Proteger registros antigos', exact: true }).click();
  await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(4); expect(await page.evaluate(() => localStorage.getItem('rosalie.cycle.v1.demo'))).toBeNull();
  await page.goto('/'); await page.goto('/planner'); await expect(page.getByRole('button', { name: 'Desbloquear cofre', exact: true })).toBeVisible(); await expect(page.locator('.calendar-day.cycle-recorded')).toHaveCount(0);
});
