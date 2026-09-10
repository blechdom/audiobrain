/** Morphazoid Shapes' reader colors, repeated for additional numbered heads. */
const SHAPES_HEAD_COLORS = ['#69f2bd', '#78a7ff', '#cb8fff', '#e8c46b'] as const;

export function shapesHeadColor(index: number): string {
  return SHAPES_HEAD_COLORS[Math.max(0, index) % SHAPES_HEAD_COLORS.length] ?? SHAPES_HEAD_COLORS[0];
}
