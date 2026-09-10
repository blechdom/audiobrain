import { Activity, AudioLines, CircleDot, GitBranch, Network, Radio, SlidersHorizontal, Volume2, Waves } from 'lucide-react';

export function signalColor(type: string): string {
  if (type.startsWith('audio.')) return '#65ddff';
  if (type.startsWith('geometry.')) return '#a88cff';
  if (type.startsWith('event.') || type.startsWith('music.')) return '#ffba72';
  if (type.startsWith('text.')) return '#e7cf8e';
  return '#d8ff5f';
}

export function nodePresentation(kind: string) {
  if (kind.startsWith('shapes.')) return { icon: CircleDot, color: '#a88cff', category: 'Shapes' };
  if (kind.startsWith('lsystem.')) return { icon: GitBranch, color: '#a88cff', category: 'L-Systems' };
  if (kind.startsWith('graph.')) return { icon: Network, color: '#a88cff', category: 'Graphs' };
  if (kind.startsWith('voice.')) return { icon: AudioLines, color: '#ffba72', category: 'Voices' };
  if (kind.startsWith('mapping.')) return { icon: SlidersHorizontal, color: '#ffba72', category: 'Musical mapping' };
  if (kind.startsWith('audio.')) return { icon: kind === 'audio.output' ? Volume2 : Waves, color: '#65ddff', category: 'Audio' };
  if (kind.startsWith('io.')) return { icon: Radio, color: '#d8ff5f', category: 'Connections' };
  if (kind.startsWith('view.') || kind.startsWith('analysis.')) return { icon: Activity, color: '#a0abbc', category: 'Views & analysis' };
  return { icon: SlidersHorizontal, color: '#d8ff5f', category: 'Control & timing' };
}
