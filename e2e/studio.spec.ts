import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('three instruments render their own geometry and make audio only after arming', async ({ page }) => {
  for (const name of ['Morphazoid Shapes', 'Morphazoid L-Systems', 'Morphazoid Graphs']) {
    await page.getByLabel('Instrument preset').selectOption({ label: name });
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.performance-panel .instrument-view svg')).toBeVisible();
    expect(await page.locator('.performance-panel .instrument-view line').count()).toBeGreaterThan(2);
  }
  await expect(page.locator('.transport .audio-button')).toHaveText('Enable audio');
  await page.getByLabel('Instrument preset').selectOption({ label: 'Morphazoid Shapes' });
  await page.getByRole('button', { name: 'Play transport', exact: true }).click();
  await expect(page.locator('.transport .audio-button')).toHaveText('Enable audio');
  await page.locator('.transport .audio-button').click();
  await expect(page.locator('.transport .audio-button')).toHaveText('Audio on');
  for (const name of ['Morphazoid Shapes', 'Morphazoid L-Systems', 'Morphazoid Graphs']) {
    await page.getByLabel('Instrument preset').selectOption({ label: name });
    await expect(page.locator('.transport .audio-button')).toHaveText('Audio on');
    await expect.poll(() => page.locator('meter').first().evaluate((meter) => (meter as HTMLMeterElement).value), { timeout: 15000 }).toBeGreaterThan(0.00001);
  }
  await page.getByRole('button', { name: 'Panic — stop all sound' }).click();
  await expect(page.getByRole('button', { name: 'Play transport', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('meter').first().evaluate((meter) => (meter as HTMLMeterElement).value)).toBeLessThan(0.00001);
});

test('performance controls, direct gestures, arrangement and export share project state', async ({ page }) => {
  const surface = page.locator('.performance-panel');
  const sides = surface.getByRole('slider', { name: 'Sides', exact: true });
  await sides.fill('7');
  await expect(page.locator('.operator-node').getByRole('slider', { name: 'Sides', exact: true })).toHaveValue('7');
  const shape = surface.getByRole('slider', { name: /Shape contour, drag/ });
  await shape.focus(); await page.keyboard.press('ArrowRight');
  await expect(surface.getByRole('slider', { name: 'Curvature', exact: true })).toHaveValue('0.16');
  await page.getByRole('button', { name: 'Arrange', exact: true }).click();
  await expect(page.getByText('Drag a handle to move.', { exact: false })).toBeVisible();
  const widget = page.getByTestId('widget-character');
  const before = await widget.getAttribute('style');
  await page.getByRole('button', { name: 'Move character down', exact: true }).click();
  await expect(widget).not.toHaveAttribute('style', before!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(widget).toHaveAttribute('style', before!);
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
  await expect(page.getByTestId('graph-editor')).toHaveCount(0);
  await expect(surface.getByRole('slider', { name: 'Sides', exact: true })).toHaveValue('7');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('audiobrain.json');
});

test('invalid import preserves current graph and hardware never auto-starts', async ({ page }) => {
  await page.getByLabel('Import AudioBrain JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 999, nodes: [] })) });
  await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.connection-card').filter({ has: page.getByRole('heading', { name: 'MIDI', exact: true }) })).toContainText('disabled');
  await expect(page.locator('.connection-card').filter({ has: page.getByRole('heading', { name: 'Microphone', exact: true }) })).toContainText('disabled');
});

test('perform controls remain reachable on phone portrait and landscape', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Perform', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('.performance-panel').getByRole('slider', { name: 'Character', exact: true }).fill('0.5');
    await expect(page.locator('.performance-panel').getByRole('slider', { name: 'Character', exact: true })).toHaveValue('0.5');
  }
});


test('cables can be selected, deleted, reconnected and undone', async ({ page }) => {
  const cables = page.locator('.react-flow__edge');
  await expect(cables).toHaveCount(9);
  const edge = page.locator('.react-flow__edge[data-id="gain-audio-to-out-audio"]');
  await edge.focus();
  await page.keyboard.press('Enter');
  await expect(edge).toHaveClass(/selected/);
  await page.keyboard.press('Delete');
  await expect(cables).toHaveCount(8);
  await expect(page.locator('.graph-diagnostic')).toBeVisible();
  await page.locator('.react-flow__node[data-id="gain"] .react-flow__handle.source[data-handleid="audio"]').click();
  await page.locator('.react-flow__node[data-id="out"] .react-flow__handle.target[data-handleid="audio"]').click();
  await expect(cables).toHaveCount(9);
  await expect(page.locator('.graph-diagnostic')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cables).toHaveCount(8);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cables).toHaveCount(9);
});


test('new instruments can be named and return to the previous graph with undo', async ({ page }) => {
  await page.getByRole('button', { name: 'New instrument', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rename instrument', exact: true }).click();
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Morphazoid Experiment');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Morphazoid Experiment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(9);
  await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
});
