# Audiobrain performance interface

Status: the version 0.1 performance surface is implemented with shared parameter controls, stable view bindings, pinning, layout movement/resizing, Arrange/Perform modes and fullscreen. This document retains the broader design based on VideoBrain commit `b7af64b1c1615eb521209b480856bff95b33a71f` (2026-09-10). Generic XY/action widgets, multiple named surfaces, explicit label/tab ordering, nested module paths and independent overlapping gesture transactions remain planned. The current project supports top-level parameter/view/meter widgets only.

Audiobrain keeps VideoBrain's graph workspace conventions, visual language,
production component catalog and central project commands. Its video monitor becomes
a **Performance** frame: a graphical instrument surface assembled from controls
and views exposed by graph nodes. Graph editing and performance are two views
of one instrument and one set of saved values.

## What VideoBrain already provides

Source links below point to the fixed GitHub revision audited above. Their line numbers describe that source snapshot.

| Existing foundation | Source evidence | Audiobrain adaptation |
| --- | --- | --- |
| React, TypeScript, Vite, React Flow, Zustand, Lucide, Vitest, Playwright, and Storybook | [package.json](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/package.json), scripts and dependencies | Start with the same toolchain and validation commands. Record the source revision for reused code. |
| Dark surfaces, lime control signals, cyan frame signals, coral output identity, compact typography, visible focus styles | [styles.css](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/styles.css), lines 1–26 and 59–66; [design system](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/docs/DESIGN_SYSTEM.md) | Reuse tokens and components; add explicitly typed audio/event/geometry signal presentation. Keep existing shared signal meanings stable. Color must supplement port labels. |
| Library / graph / monitor-and-Inspector workspace | [App.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/App.tsx), lines 400–449; [workspace CSS](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/styles.css), lines 330–344 | Put Performance in the monitor position and retain an expandable Inspector. Permit a larger Performance workspace on touch devices. |
| React Flow objects derived from the canonical document; registry-based port colors and compiler-based reachability | [GraphEditor.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/GraphEditor.tsx), lines 98–166 | Retain this projection. The surface must not contain a second graph model or its own connection rules. |
| Typed connection validation, reconnecting, selection, snapping, zoom, minimap, and grouped node movement | [GraphEditor.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/GraphEditor.tsx), lines 169–301 and 317–369 | Keep graph gestures; add a separate arrangement mode for performance widgets. Performance placement never changes graph execution order. |
| Numeric/select/text parameter metadata plus explicitly declared XY layout | [types.ts](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/graph/types.ts), lines 94–134; [NodeParameterControls.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/NodeParameterControls.tsx), lines 48–74 | Extend presentation metadata for audio units and useful scales, then render each parameter consistently in node, Inspector, and Performance. |
| Node and Inspector controls dispatch the same saved parameter command | [App.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/App.tsx), lines 402–441; [projectStore.ts](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/store/projectStore.ts), lines 252–279 | Surface controls dispatch that same command. No widget-owned copy of a parameter value. |
| Continuous edits coalesced into undo gestures; bounded history and debounced autosave | [projectStore.ts](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/store/projectStore.ts), lines 29–30, 133–173, 330–339, and 401–437 | Extend to atomic XY edits and overlapping pointer gestures. Layout commands join the same undoable project history. |
| Versioned local storage; parser/compiler validation on load and save | [persistence.ts](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/store/persistence.ts), lines 10–20, 42–71, and 75–97 | Use an Audiobrain storage namespace. Include validated surface definitions in Audiobrain import/export and migrations. |
| Fullscreen visual output | [PreviewPanel.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/PreviewPanel.tsx), lines 412–421 and 480–495 | Fullscreen the entire interactive Performance container, including its controls and stop action. The existing implementation fullscreens only a canvas. |
| Production components and styles in Storybook; deterministic device fixtures | [Storybook preview](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/.storybook/preview.tsx), lines 1–29; [graph stories](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/stories/graph-editor.stories.tsx), lines 19–33 and 130–147 | Add the real surface, shared controls, and complete starter graphs. Device access and sound remain faked in stories. |

Several boundaries are explicitly future work in VideoBrain. Its current
[GraphDocument](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/graph/types.ts), lines 81–85, contains only
schema version, nodes, and edges. Surface layouts are new document data. Nested
modules are specified but outside its MVP in
[architecture](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/docs/ARCHITECTURE.md), lines 107–117. Its supported
wire types are currently only frame, scalar control, and text; audio/event/
geometry types require complete graph and runtime support.

The existing node controls and Inspector separately render registry parameters;
they do not yet share a single field renderer. Extracting that renderer is part
of this proposal. Also, VideoBrain's Storybook accessibility setting is currently
`test: 'todo'`; the presence of the addon does not establish an automated
accessibility release gate.

## One instrument, three editing surfaces

The node card, Inspector, and Performance widget all read a parameter through the
production registry and project store. They share labels, defaults, units, bounds,
steps, enumeration choices, validation, and formatting. The compact and expanded
presentations can differ in size without acquiring different semantics.

Extract a production `ParameterControl` with a binding resolver and a gesture
adapter. Compose it into `NodeParameterControls`, Inspector fields, and surface
widgets. For declared multi-axis controls, an `XYControl` shares the same
parameter resolution and command path and retains accessible individual axis
inputs. Do not infer an XY instrument from two adjacent numeric parameters.

An **Add to Performance** action beside a parameter or declared view creates a
reference and an initial layout rectangle. It does not clone the node, add a DSP
processor, or copy its value. Pinning the same target twice is idempotent in the current editor; a widget and its node always share the same saved value.

| Surface capability | Binding | Behavior |
| --- | --- | --- |
| Slider, numeric field, select, toggle | Published parameter ID on a stable node path | Edits the saved literal using the shared project command. Uses the parameter's declared type and constraints. |
| XY control | Two published numeric parameters explicitly paired by registry metadata | Sends one atomic parameter batch per pointer update and one undo gesture per interaction. |
| Shapes, L-System, or Graphs canvas | Published `viewId` on a stable node path | Reads a bounded snapshot from its existing model/runtime; sends declared edit commands or runtime input events. Rendering the view never runs another instrument model. |
| Trigger pad or keyboard | Published `actionId` with a typed event contract | Sends timestamped runtime events, including release/cancel. A note-on is not a persisted boolean parameter. |
| Meter, scope, or value display | Published read-only view or output port | Reads throttled runtime telemetry. Never writes meter samples to the project or undo history. |
| Label/group | Presentation metadata only | Organizes the surface without changing the graph. |

A geometry view can render in a node thumbnail and in Performance simultaneously,
but both observe the same model revision. For example, dragging the Shapes curve
edits its curvature through a declared command; neither canvas owns a private
shape model. A cursor, note gate, or live input sample is session/runtime
data unless the user explicitly records it into a supported project asset.

## Implemented serialized surface contract

Production schema version 1 stores the surface in the canonical document's `performance` field. The current boundary is defined in `src/graph/types.ts` and validated in `src/graph/model.ts`:

```ts
type NodePath = readonly [string]; // One stable top-level node ID in v1.

type WidgetBinding =
  | { kind: 'param'; target: { nodePath: NodePath; paramId: string } }
  | { kind: 'view'; target: { nodePath: NodePath; viewId: string } }
  | { kind: 'meter'; target: { nodePath: NodePath; portId: string } };

type SurfaceWidget = WidgetBinding & {
  id: string;
  layout: { x: number; y: number; w: number; h: number };
};

interface PerformanceSurface {
  version: 1;
  columns: number;
  widgets: SurfaceWidget[];
}
```

For these projects, widget order provides the initial keyboard order and the
target's declaration supplies presentation and labeling. Multi-parameter groups,
published runtime `actionId` bindings, decorative labels/groups, explicit tab
order, and multiple named surfaces are subsequent schema extensions. Runtime
transport actions remain outside the saved widget parameter values.

Interactive view nodes also declare `viewBindings`: a semantic intent name maps
to a public `{nodePath, paramId}` target. The view's registry entry declares its
allowed intents and expected parameter types. A Shapes curvature drag, Canopy
angle drag, or Graph edge-time gesture resolves that explicit reference through
the same command dispatcher as a slider. Read-only input wires do not grant a
view permission to guess and mutate an upstream node. Validate each binding's
intent name, target, parameter type, and value bounds centrally.

The current schema covers parameter gestures. Authored vertex/edge editing needs a
subsequent model-action binding (`moveVertex`, `setEdgeEnabled`) with stable model
IDs, saved topology overrides, revision validation and bounded edits. It is part
of the Graphs implementation target below, not present in the fixture schema.

Rectangles use finite, bounded logical grid units. Presentation compatibility,
minimum dimensions, label length, widget count, unique IDs, and target existence
are validated centrally. A surface widget stores no parameter value, alternate
parameter range, executable callback, source code, device handle, or copied
geometry. Group/label decoration can extend the presentation schema separately.

For a top-level node, a path is `[nodeId]`. A future containing module may use stable
instance paths internally, but external bindings terminate at its published
parameter, action, view, or port. They do not reach through a module to private
child IDs. A module's public views and controls need the same versioning policy
as its public wires. This preserves the boundary described by VideoBrain's
[module contract](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/docs/GRAPH_PROTOCOL_STRATEGY.md), lines 300–311.

Parameter IDs and published view IDs remain stable when labels change. Deleting a referenced node currently removes its bound widgets and view intents in the same undoable command; undo restores both the node and its exact bindings. Import rejects stale widget targets, and never rebinds by label or array position. Disabled repairable missing-target widgets and explicit duplicate-with-surface operations remain possible future extensions.

| Ownership | Data |
| --- | --- |
| Project, saved and undoable | Graph, parameter literals, declared model data, surface definition, widget IDs and bindings, grid rectangles, widget order; labels and explicit tab order when introduced. |
| Session, transient | Graph/Arrange/Perform mode, active surface, selection, hover, pointer capture, open panels, fullscreen status, device permissions. |
| Runtime, transient | Audio context and voices, compiled plans, resolved modulation, input events, analyzer data, geometry snapshots, view subscriptions, device connections. |

This follows VideoBrain's [state ownership](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/docs/ARCHITECTURE.md),
lines 119–129. Runtime status is a separate throttled channel, not a stream of
project mutations.

## Parameter precedence and control routing

VideoBrain retains a saved literal while a compatible connected signal overrides
its resolved runtime value; disconnect restores the literal. See
[architecture](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/docs/ARCHITECTURE.md), line 97. Audiobrain should
preserve this rule across all three editing surfaces.

When a wire controls a parameter, show its source and distinguish **saved** from
**live** value. Editing the saved value is valid but must not imply the sound
changed. Provide navigation to the controlling source. Offer **Add source control
to Performance** when a user wants to perform the source itself. Do not disconnect
or override a wire implicitly when a widget moves.

One performer control driving several destinations is an explicit graph macro
or control source connected through named conversions. Audio-rate smoothing,
unit conversion, fanout, MIDI learning, and modulation depth do not live in
hidden widget code. MIDI/OSC input targets the same published graph contracts;
the visible UI observes the resulting value. A view-specific action may change
declared model state, but it must use a validated typed command.

The event path is separate from saved edits. A trigger or keyboard action sends
a timestamped input event to the runtime scheduler; it does not reconstruct an
audio graph or create an undo entry per note. Recording and replay, if added,
must be explicit features with their own bounded asset and clock contracts.

## Graph, Arrange, and Perform

**Graph** mode retains the library, graph editor, Performance preview, and
Inspector. Pinning is available on parameters and published views. Selecting a
widget can navigate to its node without changing its binding.

**Arrange** mode edits the surface. Drag handles and resize handles operate on
layout rectangles; interacting with the instrument control still changes its
value. Move, resize, add and remove are validated project
commands; widget relabel/reorder controls remain planned. These commands with one undo step per gesture. Removing a widget does not remove its
node. Keyboard move/resize controls offer the same layout operations without a
pointer. Use explicit arrangement handles so a Shapes drag cannot accidentally
move the entire Shapes widget.

**Perform** mode locks layout, emphasizes the instrument views, and hides graph
editing chrome. It preserves parameter editing, trigger actions, input readiness,
transport, and a clearly available stop/all-notes-off action. Fullscreen applies
to this whole container. Escape/fullscreen exit returns to the prior focus and
layout. If browser fullscreen is unavailable, expanded in-page Perform remains
usable. Mode and fullscreen changes do not edit the project.

For touch layouts, choose readable minimum control sizes and an explicit stacked
layout when the grid becomes too narrow; do not scale the entire desktop panel
until controls become tiny. Saved positions use a logical surface grid; viewport
size selects its projection. Add saved breakpoint layouts only when required by
real instruments, with a documented deterministic fallback for older projects.

## Gestures, lifecycle, and accessibility targets

VideoBrain's current gesture implementation stores one global `gestureStart` in
[projectStore.ts](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/store/projectStore.ts), lines 133–173 and
330–339. This is sufficient inspiration for ordinary single-pointer edits but
needs deliberate extension for multi-touch performance. Use gesture tokens and
atomic parameter batches. Track overlapping participants so releasing one finger
cannot commit another finger's active edit. Define deterministic ordering for two
writers to the same literal; do not let layout dragging join a parameter gesture.

Native controls remain labeled and keyboard-operable. Scope control gestures away
from graph dragging, panning, scrolling, and global keyboard shortcuts. Existing
XY controls demonstrate pointer capture, cancellation, keyboard steps, and
individual axis inputs in
[NodeParameterControls.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/NodeParameterControls.tsx),
lines 170–265. Extend cleanup to mode switches, widget deletion, unmount, lost
pointer capture, window blur, and device loss. Momentary controls must release
their active gates on those boundaries; persisted literals do not reset merely
because their widget disappears.

Graph commands, layout commands, and trigger keys need explicit focus scope.
Space on a focused button must activate that button without also toggling global
transport. Deletion in Arrange removes the selected widget; deletion in Graph
removes the selected graph item. Labels, visible focus, non-color connection
cues, predictable tab order, reduced motion, accessible numeric alternatives for
graphic editing, and restrained live-region updates are part of the component
contract. Meters must not announce every rendered sample to a screen reader.

The audio runtime must be owned above GraphEditor and Performance, with explicit
project/session lifecycle management. VideoBrain currently creates and disposes
its renderer inside
[PreviewPanel.tsx](https://github.com/blechdom/videobrain/blob/b7af64b1c1615eb521209b480856bff95b33a71f/src/components/PreviewPanel.tsx), lines 172–193;
copying that ownership to a performance panel would stop sound when the panel
unmounts. Mounting a surface only attaches views and subscriptions. Minimizing,
switching modes, resizing, and entering fullscreen must not create a new audio
context, duplicate voices, reset a sequence, or restart a microphone.

Start Audio is an explicit user action. Changing a preset stops old voices and
pending events and releases its device sessions according to the runtime
contract, then shows the new graph and its surface together. Undo can restore
project data without silently restoring a microphone grant or reopening a
connection. Unmounting the application releases the runtime, while removing a
single view releases only that view's observers and graphics resources.

## Implementation order and validation

1. Extract design tokens and the shared parameter renderer from the audited
   production UI. Preserve a source/provenance record and keep Audiobrain's graph
   registry authoritative for its types and constraints.
2. Add validated surface metadata and binding resolution to the canonical
   Audiobrain document, parser, store commands, history, import/export, and local
   persistence. Separate presentation revisions from structural audio revisions.
3. Add pinning, Arrange, locked Perform, fullscreen-container behavior, and
   runtime-independent view subscriptions.
4. Register Shapes, L-System, and Graphs views with typed edit/action contracts.
   Each starter loads one graph and its matching performance surface atomically.
5. Add production Storybook stories for shared controls, stale bindings, wired
   parameters, arranging, touch layout, device-unavailable states, and each
   complete starter. Drive interactive fixtures through an isolated production
   project store; do not recreate store semantics in story handlers.
6. Verify binding and history behavior with focused unit/component tests, then
   exercise graph-to-surface synchronization, keyboard use, fullscreen, reload,
   preset replacement, and audio lifecycle in browser tests. Real audio timing
   behavior needs runtime coverage beyond silent Storybook fixtures.

Acceptance scenarios for the broader design (not all are current release guarantees):

- Pin Shapes rotation, change it in any of the three editing surfaces, and see
  the same saved value everywhere. Export/reload preserves the binding and layout.
- Add a second view of the same Shapes model. A curvature edit appears in both
  without doubling geometry evaluation or sounding a second voice.
- Connect an LFO to a pinned value. Both surfaces identify the live source; edits
  retain the fallback literal, and disconnect restores that literal.
- Arrange the Graphs canvas and its instrument controls, undo the arrangement,
  and enter locked Perform. Moving graph nodes has no effect on this layout.
- Perform on two controls simultaneously. Releasing one pointer does not end the
  other gesture; undo grouping follows the documented transaction policy.
- Trigger a note and cancel its pointer, change mode, or lose window focus. The
  matching release reaches the runtime; no note remains stuck.
- Resize or fullscreen the performance container during an L-System phrase.
  The audio clock, phrase position, device sessions, and voice count continue.
- Delete a node referenced by a widget. The current command removes the widget and node together; undo restores the exact binding. Stable IDs preserve bindings when labels change.
- Operate parameters, arrangement, transport, and fullscreen without a mouse.
  A focused trigger's Space key does not also toggle global transport.
- Load each starter with no account or device permission. After Start Audio,
  its deterministic built-in source is usable; optional device controls report
  readiness and require their explicit start action.
- Open the matching Storybook stories with deterministic fixtures. They request
  no microphone/MIDI permission, open no network connection, and emit no sound.
