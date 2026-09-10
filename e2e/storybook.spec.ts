import { expect, test } from '@playwright/test';

test('published component catalog renders production controls and all three instrument surfaces', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [id, selector] of [
    ['controls-parameter--numeric', 'input[type="range"]'],
    ['workspace-performance--shapes', '.instrument-view svg'],
    ['workspace-performance--l-systems', '.instrument-view svg'],
    ['workspace-performance--graphs', '.instrument-view svg'],
    ['workspace-graph--shapes', '.react-flow__node'],
    ['workspace-presets--library', '.preset-library'],
  ]) {
    await page.goto(`/storybook/iframe.html?id=${id}&viewMode=story`);
    await expect(page.locator(`#storybook-root ${selector}`).first()).toBeVisible();
    await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  }
  expect(errors).toEqual([]);
});
