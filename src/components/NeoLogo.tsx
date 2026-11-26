import React from 'react';

interface NeoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export const NeoLogo: React.FC<NeoLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const dims =
    size === 'sm'
      ? 'w-7 h-7'
      : size === 'md'
        ? 'w-9 h-9'
        : size === 'lg'
          ? 'w-14 h-14'
          : 'w-20 h-20';

  const textSize =
    size === 'sm'
      ? 'text-base'
      : size === 'md'
        ? 'text-lg'
        : size === 'lg'
          ? 'text-2xl'
          : 'text-3xl';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative ${dims} shrink-0 flex items-center justify-center rounded-xl bg-white neo-soft-shadow`}>
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full rounded-xl"
          aria-label="NEO AI Logo"
        >
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="16"
            fill="#FFFFFF"
            stroke="#F0F0F2"
            strokeWidth="1.5"
          />
          <path
            d="M19 46V18h6.4l13.4 18.8V18H45v28h-6.2L25.2 27.1V46H19z"
            fill="#111827"
          />
        </svg>
      </div>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight whitespace-nowrap shrink-0 text-[#111827] ${textSize}`}
        >
          NEO AI
        </span>
      )}
    </div>
  );
};
