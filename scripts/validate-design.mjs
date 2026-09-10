#!/usr/bin/env node
// Presets are executable projects, checked with the production importer/compiler.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({ root, configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { parseGraphDocument, compileGraph, OPERATOR_DEFINITIONS } = await server.ssrLoadModule('/src/graph/index.ts');
  const files = process.argv.slice(2).length ? process.argv.slice(2).map(file => resolve(file)) : (await readdir(resolve(root, 'presets'))).filter(file => file.endsWith('.json')).sort().map(file => resolve(root, 'presets', file));
  if (!files.length) throw new Error('No presets found');
  const ids = new Set();
  for (const file of files) {
    const document = parseGraphDocument(await readFile(file, 'utf8'));
    const graph = compileGraph(document);
    if (ids.has(document.id)) throw new Error(`Duplicate preset ID ${document.id}`);
    ids.add(document.id);
    if (graph.reachableNodeIds.size !== document.nodes.length) throw new Error(`${document.id}: preset contains inactive nodes`);
    console.log(`PASS ${document.title}: ${document.nodes.length} nodes, ${document.edges.length} cables, ${document.performance.widgets.length} performance widgets`);
  }
  console.log(`Validated ${files.length} production presets against ${OPERATOR_DEFINITIONS.length} operator definitions.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await server.close();
}
