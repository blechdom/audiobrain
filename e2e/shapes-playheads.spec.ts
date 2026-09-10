import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
});

test('Shapes exposes point, line and radar readers directly in Performance', async ({ page }) => {
  const controls = page.locator('.performance-panel .widget-playheads');
  const graphic = page.locator('.performance-panel .instrument-view');
  await expect(page.locator('.performance-panel').getByRole('slider', { name: 'Curvature', exact: true })).toHaveValue('0');
  await expect(controls.getByLabel('Main reader')).toHaveValue('points');
  await expect(graphic.locator('[data-reader-type="points"]')).toHaveCount(4);
  await expect(graphic.locator('[data-reader-glyph]')).toHaveCount(0);
  await expect(graphic.locator('[data-reader-contact]')).toHaveCount(4);

  await controls.getByLabel('Main reader').selectOption('line');
  await expect(graphic.locator('[data-reader-glyph="line"]')).toHaveCount(4);
  await controls.getByLabel('Playhead 2 line axis').selectOption('horizontal');
  const line = graphic.getByTestId('reader-2').locator('[data-reader-glyph]');
  await expect.poll(async () => (await line.getAttribute('y1')) === (await line.getAttribute('y2'))).toBe(true);
  await controls.getByLabel('Playhead 2 reader').selectOption('radar');
  await expect(graphic.locator('[data-reader-glyph="line"]')).toHaveCount(3);
  await expect(graphic.locator('[data-reader-glyph="radar"]')).toHaveCount(1);
  await controls.getByLabel('Main reader').selectOption('radar');
  await expect(graphic.locator('[data-reader-glyph="radar"]')).toHaveCount(4);
  await expect(page.locator('.transport .audio-button')).toHaveText('Enable audio');
});

test('relative positions and independent directions persist across reader mode changes', async ({ page }) => {
  const controls = page.locator('.performance-panel .widget-playheads');
  const graphic = page.locator('.performance-panel .instrument-view');
  await controls.getByRole('slider', { name: 'Playhead 1 relative phase', exact: true }).fill('0.2');
  await controls.getByRole('slider', { name: 'Playhead 2 relative phase', exact: true }).fill('0.6');
  await controls.getByLabel('Playhead 2 direction').selectOption('reverse');
  await expect(graphic.getByTestId('reader-1')).toHaveAttribute('data-direction', '1');
  await expect(graphic.getByTestId('reader-2')).toHaveAttribute('data-direction', '-1');
  await controls.getByLabel('Main reader').selectOption('line');
  await expect(controls.getByRole('slider', { name: 'Playhead 1 relative phase', exact: true })).toHaveValue('0.2');
  await expect(controls.getByRole('slider', { name: 'Playhead 2 relative phase', exact: true })).toHaveValue('0.6');
  await expect(controls.getByLabel('Playhead 2 direction')).toHaveValue('reverse');
  await controls.getByLabel('Main reader').selectOption('points');
  const firstPhase = Number(await graphic.getByTestId('reader-1').getAttribute('data-phase'));
  const secondPhase = Number(await graphic.getByTestId('reader-2').getAttribute('data-phase'));
  await page.getByRole('button', { name: 'Play transport', exact: true }).click();
  await expect.poll(async () => Number(await graphic.getByTestId('reader-1').getAttribute('data-phase'))).toBeGreaterThan(firstPhase + 0.005);
  await expect.poll(async () => Number(await graphic.getByTestId('reader-2').getAttribute('data-phase'))).toBeLessThan(secondPhase - 0.005);
  await page.getByRole('button', { name: 'Pause transport', exact: true }).click();
  await controls.getByRole('button', { name: 'Align heads', exact: true }).click();
  for (let index = 1; index <= 4; index += 1) await expect(controls.getByRole('slider', { name: `Playhead ${index} relative phase`, exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(controls.getByRole('slider', { name: 'Playhead 2 relative phase', exact: true })).toHaveValue('0.6');
  await controls.getByRole('button', { name: 'Even spacing', exact: true }).click();
  await expect(controls.getByRole('slider', { name: 'Playhead 2 relative phase', exact: true })).toHaveValue('0.25');
});

test('twelve heads and all their controls remain reachable on phone layouts', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const controls = page.locator('.performance-panel .widget-playheads');
    await controls.getByRole('slider', { name: 'Playhead count', exact: true }).fill('12');
    const lastDirection = controls.getByLabel('Playhead 12 direction');
    await lastDirection.scrollIntoViewIfNeeded();
    await lastDirection.selectOption('reverse');
    await expect(lastDirection).toHaveValue('reverse');
    await expect(page.locator('.performance-panel .instrument-view [data-reader-type]')).toHaveCount(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await controls.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test('mouse gestures move one head, translate and rotate the actual shape, and undo together', async ({ page }) => {
  const graphic = page.locator('.performance-panel .instrument-view');
  const controls = page.locator('.performance-panel .widget-playheads');
  const svg = graphic.locator('svg');
  await graphic.scrollIntoViewIfNeeded();
  const pointOnScreen = async (x: number, y: number) => svg.evaluate((element, point) => {
    const root = element as SVGSVGElement, matrix = root.getScreenCTM()!;
    const p = root.createSVGPoint(); p.x = point.x; p.y = -point.y;
    const screen = p.matrixTransform(matrix); return { x: screen.x, y: screen.y };
  }, { x, y });
  const headPoint = async (index: number) => graphic.locator(`[data-reader-contact="${index}"] circle`).last().evaluate((circle) => {
    const root = (circle as SVGCircleElement).ownerSVGElement!, matrix = root.getScreenCTM()!;
    const p = root.createSVGPoint(); p.x = Number(circle.getAttribute('cx')); p.y = Number(circle.getAttribute('cy'));
    const screen = p.matrixTransform(matrix); return { x: screen.x, y: screen.y };
  });
  const first = await headPoint(1), second = await headPoint(2);
  await page.mouse.move(first.x, first.y); await page.mouse.down();
  await page.mouse.move(second.x, second.y, { steps: 10 }); await page.mouse.up();
  await expect(controls.getByRole('slider', { name: 'Playhead 1 relative phase', exact: true })).toHaveValue('0.25');
  await expect(controls.getByRole('slider', { name: 'Playhead 2 relative phase', exact: true })).toHaveValue('0.25');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(controls.getByRole('slider', { name: 'Playhead 1 relative phase', exact: true })).toHaveValue('0');

  await graphic.getByRole('button', { name: 'Move', exact: true }).click();
  const start = await pointOnScreen(0, 0), moved = await pointOnScreen(.2, .1);
  const headBeforeMove = await headPoint(1);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(moved.x, moved.y, { steps: 6 }); await page.mouse.up();
  await expect.poll(async () => (await headPoint(1)).x - headBeforeMove.x).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => Math.abs((await headPoint(1)).x - headBeforeMove.x)).toBeLessThan(1);

  await graphic.getByRole('button', { name: 'Rotate', exact: true }).click();
  const rotationStart = await pointOnScreen(.7, 0), rotationEnd = await pointOnScreen(0, .7);
  await page.mouse.move(rotationStart.x, rotationStart.y); await page.mouse.down();
  await page.mouse.move(rotationEnd.x, rotationEnd.y, { steps: 10 }); await page.mouse.up();
  await expect(graphic.getByRole('slider', { name: 'Shape contour, drag to change Rotation', exact: true })).toHaveAttribute('aria-valuenow', '-90');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(graphic.getByRole('slider', { name: 'Shape contour, drag to change Rotation', exact: true })).toHaveAttribute('aria-valuenow', '0');
  await graphic.getByRole('button', { name: 'Show playhead controls', exact: true }).click();
  await expect(controls.getByLabel('Main reader')).toBeInViewport();
});
