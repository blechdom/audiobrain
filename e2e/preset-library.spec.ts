import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

interface ExportedProject {
  documentType: string;
  nodes: { id: string; kind: string }[];
  performance: { widgets: { target: { nodePath: string[] } }[] };
  presetOrigins?: { instanceId: string; presetId: string; nodeIds: string[]; recipe: { familyId: string; settings: unknown } }[];
}

async function readDownload(download: Download): Promise<unknown> {
  const file = await download.path();
  if (!file) throw new Error('Expected a locally available preset download');
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

async function exportProject(page: Page): Promise<ExportedProject> {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  return await readDownload(await downloading) as ExportedProject;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('source grammar rebuilds an editable graph and independent instances retain their original preset identity', async ({ page }) => {
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
  for (const action of ['Load', 'Add', 'Add']) {
    await page.getByRole('button', { name: 'Presets', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search presets' }).fill('l-system-grammars:pythagorean');
    const card = page.locator('[data-preset-id="l-system-grammars:pythagorean"]');
    await expect(card).toContainText('Graph ready');
    await card.getByRole('button', { name: `${action} Pythagorean tree`, exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await expect(page.locator('.performance-panel .instrument-view svg')).toHaveCount(3);
  await expect(page.locator('.transport .audio-button')).toHaveText('Enable audio');
  const project = await exportProject(page);
  expect(project.documentType).toBe('audiobrain.project');
  expect(project.presetOrigins).toHaveLength(3);
  const origins = project.presetOrigins!;
  expect(new Set(origins.map(origin => origin.instanceId)).size).toBe(3);
  expect(origins.every(origin => origin.presetId === 'l-system-grammars:pythagorean')).toBe(true);
  const copiedNodeIds = origins.flatMap(origin => origin.nodeIds);
  expect(new Set(copiedNodeIds).size).toBe(copiedNodeIds.length);
  expect(new Set(project.nodes.map(node => node.id)).size).toBe(project.nodes.length);
  expect(origins[1].recipe.settings).toEqual(origins[0].recipe.settings);
  expect(origins[2].recipe.settings).toEqual(origins[0].recipe.settings);
  expect(origins.every(origin => origin.nodeIds.every(id => project.nodes.some(node => node.id === id)))).toBe(true);
  expect(project.performance.widgets.every(widget => widget.target.nodePath.every(id => project.nodes.some(node => node.id === id)))).toBe(true);
  await page.getByRole('button', { name: 'New instrument', exact: true }).click();
  await page.getByLabel('Import AudioBrain JSON').setInputFiles({ name: 'three-trees.audiobrain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('.performance-panel .instrument-view svg')).toHaveCount(3);
  const restored = await exportProject(page);
  expect(restored.presetOrigins).toEqual(origins);
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  const downloadingPreset = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export current as preset', exact: true }).click();
  const portable = await readDownload(await downloadingPreset) as { documentType: string; recipe: { kind: string; graph: ExportedProject } };
  expect(portable.documentType).toBe('audiobrain.instrument-preset');
  expect(portable.recipe.kind).toBe('graph');
  expect(portable.recipe.graph).toEqual(restored);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'New instrument', exact: true }).click();
  await page.getByLabel('Import AudioBrain JSON').setInputFiles({ name: 'three-trees.audiobrain-preset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(portable)) });
  await expect(page.locator('.performance-panel .instrument-view svg')).toHaveCount(3);
  expect(await exportProject(page)).toEqual(restored);
});

test('unsupported original presets stay discoverable and export exact source settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  await expect(page.locator('.preset-card')).toHaveCount(48);
  await page.getByRole('searchbox', { name: 'Search presets' }).fill('graph-delay-patches:clearSteps');
  const card = page.locator('[data-preset-id="graph-delay-patches:clearSteps"]');
  await expect(card).toContainText('Needs features');
  await expect(card.getByRole('button', { name: /^(Load|Add) / })).toHaveCount(0);
  await card.getByText('Original source and identity').click();
  await expect(card.getByText('graph-delay-patches:clearSteps', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Export source preset Clear Steps', exact: true }).click();
  const definition = await readDownload(await downloading) as { documentType: string; id: string; recipe: { familyId: string; settings: unknown; source: { revision: string; path: string } } };
  const archive = JSON.parse(await readFile('contracts/morphazoid-presets.json', 'utf8')) as { source: { revision: string }; families: { id: string; entries: { id: string; raw: unknown }[] }[] };
  const original = archive.families.find(family => family.id === 'graph-delay-patches')!.entries.find(entry => entry.id === definition.id)!;
  expect(definition.documentType).toBe('audiobrain.instrument-preset');
  expect(definition.id).toBe('graph-delay-patches:clearSteps');
  expect(definition.recipe.settings).toEqual(original.raw);
  expect(definition.recipe.source.revision).toBe(archive.source.revision);
  expect(definition.recipe.source.path).toBe('src/graph-delay.js');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
  await page.getByLabel('Import AudioBrain JSON').setInputFiles({ name: 'source-preset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition)) });
  await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
  await expect(page.locator('.transport .audio-button')).toHaveText('Enable audio');
  await expect(page.locator('.notice')).toBeVisible();
});

test('the complete source library can be searched on phone layouts without mounting every card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(page.locator('.preset-card')).toHaveCount(48);
  await page.getByRole('searchbox', { name: 'Search presets' }).fill('wheel-of-organs-wheel-organ-presets:giant');
  await expect(page.locator('[data-preset-id="wheel-of-organs-wheel-organ-presets:giant"]')).toBeVisible();
  await expect(page.locator('.preset-card')).toHaveCount(1);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Show 48 more presets', exact: true }).click();
  await expect(page.locator('.preset-card')).toHaveCount(96);
  await page.getByRole('combobox', { name: 'Preset availability' }).selectOption('ready');
  await expect(page.locator('[data-preset-status="blocked"]')).toHaveCount(0);
  await expect(page.locator('.preset-card').first()).toContainText('Graph ready');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('closing the library cancels a pending source reconstruction without replacing the current graph', async ({ page }) => {
  let releaseArchive: () => void = () => undefined;
  let archiveRequested: () => void = () => undefined;
  const held = new Promise<void>(resolve => { releaseArchive = resolve; });
  const requested = new Promise<void>(resolve => { archiveRequested = resolve; });
  const archiveUrl = /morphazoid-presets(?:\.json|-)[^/]*$/;
  await page.route(archiveUrl, async route => { archiveRequested(); await held; await route.continue(); });
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search presets' }).fill('l-system-grammars:pythagorean');
  await page.getByRole('button', { name: 'Load Pythagorean tree', exact: true }).click();
  try {
    await requested;
    await expect(page.getByText('Preparing Pythagorean tree…', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const downloaded = page.waitForResponse(archiveUrl);
    releaseArchive();
    await (await downloaded).finished();
    await expect(page.getByRole('heading', { name: 'Morphazoid Shapes', exact: true })).toBeVisible();
    // Reusing the now-cached archive proves its promise has settled. The
    // canceled reconstruction must still leave only this intentional copy.
    await page.getByRole('button', { name: 'Presets', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search presets' }).fill('l-system-grammars:pythagorean');
    await page.getByRole('button', { name: 'Add Pythagorean tree', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const project = await exportProject(page);
    expect(project.presetOrigins).toHaveLength(1);
    expect(project.nodes.some(node => node.kind === 'shapes.geometry')).toBe(true);
  } finally { releaseArchive(); }
});
