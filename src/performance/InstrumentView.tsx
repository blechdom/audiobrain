import { useId, useRef } from 'react';
import { getOperatorDefinition, type GraphDocument, type GraphNode } from '../graph';
import type { NodeSnapshot } from '../runtime/AudioBrainRuntime';
import { useProjectStore } from '../store';

interface InstrumentViewProps { node: GraphNode; project: GraphDocument; snapshot?: NodeSnapshot; compact?: boolean }

export function InstrumentView({ node, project, snapshot, compact }: InstrumentViewProps) {
  const store = useProjectStore();
  const unique = useId().replaceAll(':', '');
  const drag = useRef<{ x: number; value: number; pointerId: number } | null>(null);
  const geometry = snapshot?.geometry;
  const points = new Map(geometry?.points.map((point) => [point.id, point]) ?? []);
  const features = snapshot?.features ?? [];
  const isShape = node.kind === 'view.shapes';
  const isGraph = node.kind === 'view.graph';
  const intent = Object.entries(node.viewBindings ?? {})[0];
  const binding = intent?.[1];
  const target = project.nodes.find((candidate) => candidate.id === binding?.nodePath[0]);
  const parameter = target && getOperatorDefinition(target.kind).params.find((candidate) => candidate.id === binding?.paramId);
  const numeric = parameter?.type === 'number' || parameter?.type === 'integer' ? parameter : null;
  const value = numeric && target ? Number(target.params[numeric.id] ?? numeric.default) : 0;
  const wired = Boolean(target && numeric && project.edges.some((edge) => edge.target.nodeId === target.id && edge.target.portId === numeric.id));
  const token = `view:${node.id}:${unique}`;
  const label = isShape ? 'Shape contour' : isGraph ? 'Graph topology' : 'L-System branches';
  const setValue = (next: number) => {
    if (!target || !numeric) return;
    const snapped = numeric.min + Math.round((next - numeric.min) / numeric.step) * numeric.step;
    store.setParameter(target.id, numeric.id, Math.min(numeric.max, Math.max(numeric.min, Number(snapped.toFixed(6)))));
  };
  const release = () => { drag.current = null; store.endGesture(token); };
  return <div className={`instrument-view ${compact ? 'compact' : ''}`}>
    <svg viewBox="-1.25 -1.25 2.5 2.5" preserveAspectRatio="xMidYMid meet"
      aria-label={numeric ? `${label}, drag to change ${numeric.label}` : label}
      role={numeric ? 'slider' : 'img'} tabIndex={numeric ? 0 : undefined} aria-disabled={wired || undefined}
      aria-valuemin={numeric?.min} aria-valuemax={numeric?.max} aria-valuenow={numeric ? value : undefined} aria-valuetext={numeric ? `${value}${numeric.unit ? ` ${numeric.unit}` : ''}` : undefined}
      onPointerDown={(event) => {
        if (!numeric || wired) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, value, pointerId: event.pointerId };
        store.beginGesture(token);
      }}
      onPointerMove={(event) => {
        if (!drag.current || !numeric || wired || drag.current.pointerId !== event.pointerId) return;
        const width = event.currentTarget.getBoundingClientRect().width;
        setValue(drag.current.value + (event.clientX - drag.current.x) / Math.max(width, 1) * (numeric.max - numeric.min));
      }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
      onKeyDown={(event) => {
        if (!numeric || wired || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); store.beginGesture(token);
        setValue(event.key === 'Home' ? numeric.min : event.key === 'End' ? numeric.max : value + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1) * numeric.step * (event.shiftKey ? 10 : 1));
      }} onKeyUp={() => store.endGesture(token)}>
      <defs>
        <pattern id={`grid-${unique}`} width="0.25" height="0.25" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.006" fill="#36404a" /></pattern>
        <radialGradient id={`glow-${unique}`}><stop offset="0" stopColor={isShape ? '#a88cff' : '#65ddff'} stopOpacity=".14" /><stop offset="1" stopColor="#080a0f" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x="-1.3" y="-1.3" width="2.6" height="2.6" fill={`url(#grid-${unique})`} />
      <circle r="1.15" fill={`url(#glow-${unique})`} />
      <path d="M-1.1 0H1.1 M0-1.1V1.1" stroke="#333b45" strokeWidth=".004" strokeDasharray=".02 .04" />
      {isShape && <><circle r="1" fill="none" stroke="#333b45" strokeWidth=".004" strokeDasharray=".012 .04" /><circle r="0.5" fill="none" stroke="#252e38" strokeWidth=".004" /></>}
      {geometry?.segments.map((segment) => {
        const from = points.get(segment.from); const to = points.get(segment.to);
        if (!from || !to) return null;
        return <line key={segment.id} x1={from.x} y1={-from.y} x2={to.x} y2={-to.y}
          stroke={isShape ? '#a88cff' : isGraph ? '#7089af' : '#8bd7b4'} strokeWidth={isShape ? '.012' : '.007'} strokeOpacity={isShape ? '.9' : '.7'} />;
      })}
      {isGraph && geometry?.points.map((point) => <g key={point.id}><circle cx={point.x} cy={-point.y} r=".045" fill="#141b29" stroke="#a88cff" strokeWidth=".009" /><circle cx={point.x} cy={-point.y} r=".013" fill="#e8e1ff" /></g>)}
      {features.slice(0, 128).map((feature, index) => <g key={`${feature.id}-${index}`}>
        {isShape && <line x1="0" y1="0" x2={feature.x} y2={-feature.y} stroke="#d8ff5f" strokeWidth=".004" strokeOpacity=".3" />}
        <circle cx={feature.x} cy={-feature.y} r=".085" fill="#d8ff5f" opacity=".09" />
        <circle cx={feature.x} cy={-feature.y} r=".027" fill="#d8ff5f" />
      </g>)}
      {isShape && <circle r=".015" fill="#9299a7" />}
    </svg>
    <div className="view-caption"><span>{label}</span><span>{wired ? `${numeric?.label ?? 'Parameter'} controlled by wire` : numeric ? `Drag · ${numeric.label.toLowerCase()}` : 'Live view'}</span></div>
    {!geometry && <span className="view-empty">Connect geometry to this view</span>}
  </div>;
}
