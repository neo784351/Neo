import React from 'react';
import { Cpu } from 'lucide-react';
import type { ModelBackendInfo } from '../types';

interface BackendSelectorProps {
  backends: ModelBackendInfo[];
  capability: 'chat' | 'image' | 'writer';
  value: string;
  onChange: (backendKey: string) => void;
  compact?: boolean;
}

export const BackendSelector: React.FC<BackendSelectorProps> = ({
  backends,
  capability,
  value,
  onChange,
  compact = false,
}) => {
  const filtered = backends.filter((b) => b.capabilities.includes(capability));

  if (filtered.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 min-w-0">
      <Cpu className="w-4 h-4 text-[#111827] shrink-0" aria-hidden="true" />
      <label className="sr-only">AI Model Backend</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select AI model backend"
        className={`rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:border-[#111827] transition-colors cursor-pointer ${
          compact ? 'px-2.5 py-1.5 text-xs max-w-[200px]' : 'px-3 py-2 text-sm min-h-[40px] w-full'
        }`}
      >
        {filtered.map((b) => (
          <option key={b.backendKey} value={b.backendKey}>
            {b.displayName} {!b.configured ? '(Unconfigured)' : b.requiresPaidKey ? '· Paid Key' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};
