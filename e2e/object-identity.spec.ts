import { expect, test } from '@playwright/test';
import type { GraphDocument } from '../src/graph';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('a named duplicate retains its identity and independent values through export and import', async ({ page }) => {
  await page.locator('.react-flow__node[data-id="geometry"] .node-header').click();
  await page.locator('.inspector').getByRole('button', { name: /^Duplicate / }).click();
  const name = page.getByRole('textbox', { name: 'Object name', exact: true });
  await name.fill('Second Morphazoid'); await name.press('Enter');
  const inspector = page.locator('.inspector');
  await inspector.getByRole('slider', { name: 'Curvature', exact: true }).fill('-0.4');
  const identity = await inspector.locator('.object-identity code').textContent();
  await expect(page.getByTestId('widget-curvature').getByRole('slider')).toHaveValue('0');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'New instrument', exact: true }).click();
  await page.getByLabel('Import AudioBrain JSON').setInputFiles(path);
  await page.locator('.node-header').filter({ hasText: 'Second Morphazoid' }).click();
  await expect(inspector.locator('.object-identity code')).toHaveText(identity!);
  await expect(inspector.getByRole('slider', { name: 'Curvature', exact: true })).toHaveValue('-0.4');
  await expect(page.getByTestId('widget-curvature').getByRole('slider')).toHaveValue('0');
});

test('adding a preset produces two independently controlled instruments with nonoverlapping phone graphics', async ({ page }) => {
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  await page.getByRole('button', { name: 'Add Morphazoid Shapes', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(18);
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
  const shapes = page.locator('.instrument-view');
  await expect(shapes).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('audiobrain.project.v1') ?? '{}') as Partial<GraphDocument>).nodes?.length)).toBe(18);
  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('audiobrain.project.v1')!) as GraphDocument);
  const second = project.nodes.find(node => node.kind === 'shapes.geometry' && node.id !== 'geometry')!;
  const widget = project.performance.widgets.find(item => item.target.nodePath[0] === second.id && item.target.paramId === 'curvature')!;
  await page.getByTestId(`widget-${widget.id}`).getByRole('slider').fill('0.5');
  await expect(page.getByTestId('widget-curvature').getByRole('slider')).toHaveValue('0');
  await page.setViewportSize({ width: 390, height: 844 });
  const a = await shapes.nth(0).boundingBox(), b = await shapes.nth(1).boundingBox();
  expect(a && b && a.y + a.height <= b.y).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
