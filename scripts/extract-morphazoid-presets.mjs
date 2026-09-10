/** Frozen source extraction: evaluates only an AST-selected declaration closure.
 * Browser page bodies are never imported or run. The VM has no DOM, network,
 * process or filesystem APIs; code generation and nondeterministic globals are disabled.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

export const SOURCE_REVISION = '769b348ab0ee3a8a57e1dd703d0c5cda211e5090';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const friendly = (value) => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const custom = {
  'src/shader-synth-playground.js:SHADER_PLAYGROUND_COMBOS': ['shader-synth-combos', 'Modular Shader Synth combinations and scenes', 'instrument'],
  'src/physics-scenes.js:PHYSICS_SCENES': ['physics-scenes', 'Physics scenes', 'instrument'],
  'src/colony-syrinx.js:COLONY_SYRINX_CALLS': ['colony-syrinx-calls', 'Colony Syrinx calls', 'instrument'],
  'src/l-system.js:L_SYSTEM_PRESETS': ['l-system-grammars', 'L-System grammars', 'grammar'],
  'src/graph-delay.js:GRAPH_PRESETS': ['graph-topologies', 'Graph topologies', 'topology'],
  'src/graph-delay.js:GRAPH_DELAY_PATCHES': ['graph-delay-patches', 'Graph Delay patches', 'instrument'],
  'src/graph-instruments.js:GRAPH_INSTRUMENT_PATCHES': ['graph-instrument-patches', 'Graph Synth / Drums patches', 'instrument'],
  'src/shapes-state.js:DEFAULT_STATE': ['shapes-defaults', 'Shapes default state', 'configuration'],
  'l-systems-app.js:MIX_PRESETS': ['l-systems-mix-presets', 'L-Systems mix presets', 'configuration'],
  'src/audio.js:AMPLITUDE_ENVELOPE_PRESETS': ['amplitude-envelopes', 'Amplitude envelopes', 'envelope'],
  'src/audio.js:PERCUSSION_ENVELOPE_PRESETS': ['percussion-envelopes', 'Percussion envelopes', 'envelope'],
  'l-systems-app.js:DEFAULT_STATE': ['l-systems-defaults', 'L-Systems default state', 'configuration'],
  'l-systems-app.js:DEFAULT_SYNTH_STATE': ['l-systems-synth-defaults', 'L-Systems synth defaults', 'configuration'],
  'l-systems-app.js:DEFAULT_DRUM_STATE': ['l-systems-drum-defaults', 'L-Systems drum defaults', 'configuration'],
  'l-systems-app.js:DEFAULT_MIC_STATE': ['l-systems-mic-defaults', 'L-Systems microphone defaults', 'configuration'],
  'l-systems-app.js:DEFAULT_MIX_STATE': ['l-systems-mix-defaults', 'L-Systems mix defaults', 'configuration'],
  'src/fm-drums.js:DEFAULT_FM_DRUM_VOICES': ['fm-drum-voices', 'FM drum voices', 'timbre'],
  'src/sample-drums.js:DEFAULT_SAMPLE_DRUM_VOICES': ['sample-drum-voices', 'Sample drum voices', 'timbre'],
};
const extra = new Set([
  ...Object.keys(custom),
  'webgpu-synths-app.js:PRESET_LIBRARY',
  'src/constellation-composer.js:DEVICE_PRESET_LIBRARY',
  'src/syrinx-source-models.js:SYRINX_SOURCE_EXAMPLES',
  'src/breath-atlas.js:BREATH_INSTRUMENTS',
  'src/graph-drum-audio.js:GRAPH_DRUM_PERCUSSION_STYLES',
  'src/l-system-drums.js:L_SYSTEM_DRUM_STYLES',
  'src/l-system-drums.js:L_SYSTEM_DRUM_MAPPING_MODES',
  'boidzoid-app.js:TEMPERAMENTS',
  'src/shader-synth-playground.js:SHADER_PLAYGROUND_COMBOS',
  'src/physics-scenes.js:PHYSICS_SCENES',
  'src/colony-syrinx.js:COLONY_SYRINX_CALLS',
  'src/recursion.js:RECURSION_STUDY_DEFINITIONS',
  'src/striped-staircase.js:STRIPED_STAIRCASE_VIEWS',
  'crickets-app.js:CRICKET_RECORDING_SOURCES',
  'birdsong-lab-app.js:BIRDSONG_RECORDING_SOURCES',
  'src/crickets.js:CRICKET_DEMO_DEFINITIONS',
  'src/birdsong-analysis.js:BIRDSONG_DEMO_DEFINITIONS',
  'l-systems-app.js:DEFAULT_STATE',
  'l-systems-app.js:DEFAULT_SYNTH_STATE',
  'l-systems-app.js:DEFAULT_DRUM_STATE',
  'l-systems-app.js:DEFAULT_MIC_STATE',
  'l-systems-app.js:DEFAULT_MIX_STATE',
]);
const exclude = new Map([
  ['src/crickets.js:CRICKET_DEMO_PRESETS','Menu labels derived from archived CRICKET_DEMO_DEFINITIONS.'],
  ['src/birdsong-analysis.js:BIRDSONG_DEMO_PRESETS','Menu labels derived from archived BIRDSONG_DEMO_DEFINITIONS.'],
  ['src/shapes-state.js:SHAPES_BANKS', 'Editor tab identities, not presets.'],
  ['src/amplitude-control.js:PRESETS', 'Menu references to src/audio.js AMPLITUDE_ENVELOPE_PRESETS.'],
  ['src/constellation-composer.js:EMPTY_DEVICE_PRESETS', 'Empty fallback.'],
  ['src/srtuss-master.js:ORIGINAL_PRESETS', 'Included in SRTUSS_MASTER_PRESETS.'],
  ['src/srtuss-master.js:DECOMPOSED_PRESETS', 'Included in SRTUSS_MASTER_PRESETS.'],
  ['src/srtuss-master.js:MASTER_PRESETS', 'Included in SRTUSS_MASTER_PRESETS.'],
  ['src/srtuss-master.js:ADDITIONAL_MASTER_PRESETS', 'Included in SRTUSS_MASTER_PRESETS.'],
  ['src/barber-delay.js:CANDY_PRESETS', 'Included in BARBER_DELAY_PRESETS.'],
  ['src/barber-delay.js:SANDY_PRESETS', 'Included in BARBER_DELAY_PRESETS.'],
  ['webgpu-synths-app.js:PRESETS', 'Shuffled display order of PRESET_LIBRARY; archive retains authored order.'],
  ['shader-synth-playground-app.js:presets', 'Menu projection of SHADER_PLAYGROUND_PRESETS.'],
  ['barber-delay-app.js:presets', 'Page-mode selection from BARBER_DELAY_PRESETS.'],
]);

export class SourceDeclarations {
  constructor(sourceRoot, revision = SOURCE_REVISION) {
    this.root = sourceRoot; this.revision = revision; this.modules = new Map(); this.values = new Map();
    this.files = execFileSync('git', ['ls-tree', '-r', '--name-only', revision], { cwd: sourceRoot, encoding: 'utf8' }).trim().split('\n');
  }
  read(file) {
    if (!this.files.includes(file)) throw new Error(`Source path is not in revision: ${file}`);
    return execFileSync('git', ['show', `${this.revision}:${file}`], { cwd: this.root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  }
  module(file) {
    if (this.modules.has(file)) return this.modules.get(file);
    const source = this.read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const declarations = new Map(); const imports = new Map();
    for (const statement of ast.statements) {
      if (ts.isImportDeclaration(statement)) {
        const relative = statement.moduleSpecifier.text.split('?')[0];
        if (!relative.startsWith('.')) continue;
        const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), relative));
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const specifier of bindings.elements) imports.set(specifier.name.text, { path: dependency, name: specifier.propertyName?.text ?? specifier.name.text });
      }
      if (ts.isExportDeclaration(statement)) continue;
      const declaration = statement;
      if (ts.isVariableStatement(declaration)) for (const entry of declaration.declarationList.declarations) {
        if (ts.isIdentifier(entry.name) && entry.initializer) declarations.set(entry.name.text, { node: entry, expression: entry.initializer, text: `const ${entry.name.text} = ${entry.initializer.getText(ast)};`, position: entry.pos });
      }
      if ((ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) && declaration.name) declarations.set(declaration.name.text, { node: declaration, text: declaration.getText(ast).replace(/^export\s+(?:default\s+)?/, ''), position: declaration.pos });
    }
    const result = { source, ast, declarations, imports }; this.modules.set(file, result); return result;
  }
  references(node) {
    const locals = new Set(); const refs = new Set();
    const bind = (name) => { if (ts.isIdentifier(name)) locals.add(name.text); else if (name && (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))) for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name); };
    const visit = (child) => {
      if (child !== node && (ts.isVariableDeclaration(child) || ts.isParameter(child) || ts.isFunctionDeclaration(child))) bind(child.name);
      if (ts.isIdentifier(child)) {
        const parent = child.parent;
        if (!(ts.isPropertyAccessExpression(parent) && parent.name === child) && !(ts.isPropertyAssignment(parent) && parent.name === child && !ts.isShorthandPropertyAssignment(parent))) refs.add(child.text);
      }
      ts.forEachChild(child, visit);
    };
    visit(node); return [...refs].filter((name) => !locals.has(name));
  }
  expression(file, node) {
    const module = this.module(file);
    const name = '__archiveSelection';
    const key = `${file}:${name}`;
    this.values.delete(key);
    module.declarations.set(name, { node, expression: node, text: `const ${name} = ${node.getText(module.ast)};`, position: Infinity });
    return this.value(file, name);
  }
  printable(text, file) {
    const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const result = ts.transform(parsed, [context => {
      const visit = node => ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) && node.name.text === 'url'
        ? ts.factory.createStringLiteral(`https://raw.githubusercontent.com/blechdom/morphazoid/${this.revision}/${file}`)
        : ts.visitEachChild(node, visit, context);
      return node => ts.visitNode(node, visit);
    }]);
    const printed = ts.createPrinter().printFile(result.transformed[0]);
    result.dispose(); return printed;
  }
  value(file, name, ancestry = []) {
    const key = `${file}:${name}`;
    if (this.values.has(key)) return this.values.get(key);
    if (ancestry.includes(key)) throw new Error(`Cross-module declaration cycle: ${key}`);
    const module = this.module(file); const selected = new Set(); const imported = new Map();
    const include = (id) => {
      if (selected.has(id) || imported.has(id)) return;
      const declaration = module.declarations.get(id);
      if (declaration) {
        selected.add(id);
        for (const dependency of this.references(declaration.node)) if (dependency !== id) include(dependency);
      } else if (module.imports.has(id)) imported.set(id, module.imports.get(id));
    };
    include(name);
    if (!selected.has(name) && !imported.has(name)) throw new Error(`No top-level declaration ${key}`);
    const deps = {};
    for (const [local, dependency] of imported) deps[local] = this.value(dependency.path, dependency.name, [...ancestry, key]);
    const declarations = [...selected].map((id) => module.declarations.get(id)).sort((a, b) => a.position - b.position).map((entry) => this.printable(entry.text, file)).join('\n');
    const context = vm.createContext({ __deps: deps, URL }, { codeGeneration: { strings: false, wasm: false } });
    const imports = Object.keys(deps).map((id) => `const ${id} = __deps[${JSON.stringify(id)}];`).join('\n');
    const setup = 'Math.random = () => { throw new Error("Nondeterministic preset factory"); }; Date = undefined;';
    const result = new vm.Script(`${setup}\n${imports}\n${declarations}\n;${name}`, { filename: key }).runInContext(context, { timeout: 2000 });
    this.values.set(key, result); return result;
  }
  dependencies() { return [...this.modules].map(([file, module]) => ({ path: file, sha256: sha256(module.source) })).sort((a,b) => a.path.localeCompare(b.path)); }
}

function serializable(value, seen = new Set()) {
  if (value instanceof URL) return { $morphazoidValue: 'url', href: value.href };
  if (value === undefined) return { $morphazoidValue: 'undefined' };
  if (typeof value === 'function') return { $morphazoidValue: 'function', source: value.toString() };
  if (Object.is(value, -0)) return { $morphazoidValue: 'number', source: '-0' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { $morphazoidValue: 'number', source: String(value) };
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new Error('Cyclic preset data');
  seen.add(value);
  const result = Array.isArray(value) ? Array.from(value, (entry) => serializable(entry, seen)) : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializable(entry, seen)]));
  seen.delete(value); return result;
}
function entriesFor(value, familyId, singleton = false) {
  const result = [];
  const emit = (raw, sourceId, sourcePath) => {
    const identity = String(raw?.id ?? (typeof raw === 'string' && sourcePath.length === 1 && typeof sourcePath[0] === 'number' ? raw : sourceId));
    result.push({ id: `${familyId}:${sourcePath.length > 1 ? `${sourcePath.slice(0,-1).join('.')}.` : ''}${identity}`, name: String(raw?.name ?? raw?.label ?? raw?.title ?? (typeof raw === 'string' ? raw : identity)), sourceId: identity, sourcePath, raw });
  };
  if (singleton) emit(value, 'default', []);
  else if (Array.isArray(value)) value.forEach((raw,index) => emit(raw, String(index), [index]));
  else if (value && typeof value === 'object') for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw) && raw.length > 0 && raw.every(entry => entry && !Array.isArray(entry) && typeof entry === 'object' && ('id' in entry || 'name' in entry || 'label' in entry))) raw.forEach((entry,index) => emit(entry, String(index), [key,index])); else emit(raw,key,[key]);
  } else throw new Error(`Preset bank is not an object or array: ${familyId}`);
  return result;
}

export function extractArchive(sourceRoot) {
  const source = new SourceDeclarations(sourceRoot);
  const files = source.files.filter((file) => (file.endsWith('.js') && (!file.includes('/') || file.startsWith('src/') || file.startsWith('morphazoidical/'))) && !file.includes('/tests/') && !file.includes('/vendor/'));
  const candidates = [];
  for (const file of files) for (const [name,declaration] of source.module(file).declarations) {
    const key = `${file}:${name}`;
    if ((/(?:^|_)(?:PRESETS|PATCHES|PATTERNS|BANKS)$/.test(name) || name === 'presets' || extra.has(key)) && declaration.expression) candidates.push({ file, name, declaration, key });
  }
  const families = []; const excluded = []; const unresolved = [];
  const addFamily = (file, exportName, id, label, category, raw, options = {}) => {
    const structure = options.singleton ? 'singleton' : Array.isArray(raw) ? 'array' : 'object';
    families.push({ id, label, category, source: { path: file, exportName, sha256: sha256(source.module(file).source) }, structure, valueHash: sha256(JSON.stringify(raw)), entries: entriesFor(raw, id, options.singleton), ...options.metadata });
  };
  const findObject = (node, name) => {
    let result;
    const walk = (child) => {
      if (ts.isVariableDeclaration(child) && child.name.getText() === name) result = child.initializer;
      if (!result) ts.forEachChild(child, walk);
    }; walk(node);
    if (!result) throw new Error(`Nested preset declaration not found: ${name}`);
    return result;
  };
  const unwrap = (node) => ts.isCallExpression(node) && node.arguments.length === 1 ? unwrap(node.arguments[0]) : node;
  const sourceExpression = (file, node) => ({ $morphazoidValue: 'expression', source: node.getText(source.module(file).ast) });
  for (const {file,name,declaration,key} of candidates) {
    if (exclude.has(key)) { excluded.push({ path: file, declaration: name, reason: exclude.get(key) }); continue; }
    if (ts.isIdentifier(declaration.expression)) { excluded.push({ path: file, declaration: name, reason: `Alias of ${declaration.expression.text}; original declaration is inventoried.` }); continue; }
    const stem = file.replace(/^src\//,'').replace(/\.js$/,'').replace(/-app$/,'').replace(/\//g,'-');
    const [id,label,category] = custom[key] ?? [`${stem}-${name.toLowerCase().replace(/_/g,'-')}`, friendly(`${stem} ${name}`), /ENVELOPE/.test(name) ? 'envelope' : /PATTERN|SEQUENCE/.test(name) ? 'pattern' : /VOICE|SOUND|BANK|VOWEL/.test(name) ? 'timbre' : 'instrument'];
    try {
      const raw = serializable(source.value(file,name));
      if (typeof raw !== 'object') { excluded.push({ path:file,declaration:name,reason:'Scalar bound or menu count; not preset data.' }); continue; }
      const singleton = /:DEFAULT_(?:STATE|SYNTH_STATE|DRUM_STATE|MIC_STATE|MIX_STATE)$/.test(key);
      const entries = entriesFor(raw,id,singleton);
      families.push({ id,label,category,source: { path:file,exportName:name,sha256:sha256(source.module(file).source) },structure: singleton ? 'singleton' : Array.isArray(raw) ? 'array' : 'object',valueHash:sha256(JSON.stringify(raw)),entries });
    } catch (error) {
      if (key === 'boidzoid-app.js:TEMPERAMENTS') {
        const object = unwrap(declaration.expression);
        const raw = Object.fromEntries(object.properties.map((property) => [property.name.getText().replace(/^["']|["']$/g, ''), sourceExpression(file, property.initializer)]));
        addFamily(file,name,id,label,'configuration',raw,{metadata:{serialization:'source-expression',requirements:['Viewport-dependent expressions require a source-specific adapter.'],environment:{compactViewport:source.module(file).declarations.get('compactViewport').expression.getText()}}});
        continue;
      }
      unresolved.push({ path:file,declaration:name,reason:error.message,source:declaration.expression.getText(source.module(file).ast),sha256:sha256(source.module(file).source) });
    }
  }
  {
    const file = 'hyper-syrinx-app.js';
    const factory = source.module(file).declarations.get('makePreset').node;
    const raw = serializable(source.expression(file,findObject(factory,'definitions')));
    addFamily(file,'makePreset.definitions','hyper-syrinx-presets','Hyper Syrinx presets','instrument',raw,{metadata:{factory:{declaration:'makePreset',source:factory.getText(source.module(file).ast)},requirements:['Factory module identities must be allocated and kept stable by the destination adapter.']}});
  }
  {
    const file = 'nonorientable-app.js';
    const conditional = source.module(file).declarations.get('PAGE').expression;
    for (const [id,label,branch] of [['klein','Klein bottle',conditional.whenTrue],['moebius','Möbius',conditional.whenFalse]]) {
      for (const property of ['presets','defaults']) {
        const expression = branch.properties.find((entry)=>entry.name.getText() === property).initializer;
        addFamily(file,`PAGE[${id}].${property}`,`${id}-${property}`,`${label} ${property}`,'configuration',serializable(source.expression(file,expression)),{singleton:property==='defaults'});
      }
    }
  }
  {
    const file = 'gesturama-app.js';
    const handler = source.module(file).declarations.get('setPreset').node;
    const dom = new JSDOM(source.read('gesturama.html'));
    const raw = Object.fromEntries([...dom.window.document.querySelectorAll('option[data-preset]')].map(option=>[option.dataset.preset,{label:option.textContent.trim(), $morphazoidValue:'procedural-preset',handler:'setPreset',arguments:[option.dataset.preset],source:handler.getText(source.module(file).ast)}]));
    dom.window.close();
    addFamily(file,'setPreset','gesturama-playing-modes','Gesturama playing modes','configuration',raw,{metadata:{serialization:'source-expression',requirements:['Camera tracking, mode-specific audio and source gesture lifecycle require an adapter.']}});
  }
  const htmlFiles = source.files.filter((file) => file.endsWith('.html') && (!file.includes('/') || file.startsWith('morphazoidical/')));
  const pages = htmlFiles.map((file) => {
    const content = source.read(file);
    const dom = new JSDOM(content);
    const presetChoices = [...dom.window.document.querySelectorAll('button[data-preset], option[data-preset], button[data-graph-patch], select[id*=preset i] > option, select[id*=preset i] > optgroup > option')].map(element=>({sourceId:element.dataset.preset ?? element.dataset.graphPatch ?? element.getAttribute('value'),name:(element.querySelector('b')?.textContent ?? element.textContent).trim()})).filter(entry=>entry.sourceId);
    dom.window.close();
    const entries = [...content.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map((match) => path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1].split('?')[0]))).filter((file) => !file.startsWith('http'));
    const reached = new Set();
    const walk = (file) => { if(reached.has(file) || !source.files.includes(file) || !file.endsWith('.js')) return; reached.add(file); for(const entry of source.module(file).imports.values()) walk(entry.path); };
    entries.forEach(walk);
    const familyIds = families.filter((family) => reached.has(family.source.path)).map((family)=>family.id);
    for (const family of families.filter((family)=>familyIds.includes(family.id))) for(const entry of family.entries) {
      if (entry.raw?.name || entry.raw?.label) continue;
      const menu = presetChoices.find((choice)=>choice.sourceId === entry.sourceId);
      if(menu) entry.name=menu.name;
    }
    return { path:file,sha256:sha256(content),entryModules:entries,familyIds,presetChoices,status:familyIds.length ? 'archived-dependencies' : 'no-named-preset-bank-found',notes:familyIds.length ? 'Includes transitively referenced component banks; not every bank is a full scene preset.' : 'Procedural/default-only page or non-instrument page; no factory preset name invented.' };
  });
  const defaults = [];
  for (const file of files) for(const [name,declaration] of source.module(file).declarations) {
    if (/DEFAULT(?:S|_STATE)$|INITIAL_STATE$/.test(name) && declaration.expression) defaults.push({path:file,declaration:name,source:declaration.expression.getText(source.module(file).ast),sha256:sha256(source.module(file).source)});
  }
  return { kind:'audiobrain.morphazoid-preset-archive',schemaVersion:1,source:{repository:'https://github.com/blechdom/morphazoid',revision:SOURCE_REVISION,auditedAt:'2026-09-10',scope:'Committed authored browser root, src and morphazoidical modules; generated output, user browser storage and uncommitted work are excluded.'},families,pages,defaults,excluded,unresolved,notices:['LICENSE','THIRD_PARTY_NOTICES.md'].map(file=>{const text=source.read(file);return {path:file,sha256:sha256(text),text};}),files:source.dependencies() };
}
export function archiveIndex(archive) {
  return {kind:'audiobrain.morphazoid-preset-index',schemaVersion:1,source:archive.source,families:archive.families.map(family=>({id:family.id,label:family.label,category:family.category,source:family.source,entries:family.entries.map(entry=>({id:entry.id,name:entry.name,sourceId:entry.sourceId,...(typeof entry.raw?.description==='string'?{description:entry.raw.description}:{}),rawBytes:Buffer.byteLength(JSON.stringify(entry.raw))}))}))};
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const sourceRoot = process.argv[process.argv.indexOf('--source-root')+1];
  if (!process.argv.includes('--source-root') || !sourceRoot) throw new Error('Usage: node scripts/extract-morphazoid-presets.mjs --source-root /path/to/morphazoid [--output path]');
  const output = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output')+1] : 'contracts/morphazoid-presets.json';
  const archive = extractArchive(sourceRoot);
  fs.writeFileSync(output,`${JSON.stringify(archive,null,2)}\n`);
  const indexOutput = output.endsWith('morphazoid-presets.json') ? output.replace(/morphazoid-presets\.json$/, 'morphazoid-preset-index.json') : output.replace(/\.json$/, '') + '-index.json';
  fs.writeFileSync(indexOutput,`${JSON.stringify(archiveIndex(archive),null,2)}\n`);
  console.log(JSON.stringify({families:archive.families.length,entries:archive.families.reduce((sum,family)=>sum+family.entries.length,0),pages:archive.pages.length,unresolved:archive.unresolved.map(({path,declaration,reason})=>({path,declaration,reason}))},null,2));
}
