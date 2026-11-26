import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { NeoLogo } from './NeoLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-between bg-white text-[#111827] px-6 py-10">
      {/* Subtle monochrome abstract waves */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 400"
        className="pointer-events-none absolute top-0 left-0 w-full h-72 opacity-50"
        preserveAspectRatio="none"
      >
        <path
          d="M0,120 C280,220 560,20 880,120 C1120,195 1290,85 1440,130 L1440,0 L0,0 Z"
          fill="#F5F5F7"
        />
      </svg>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 320"
        className="pointer-events-none absolute bottom-0 left-0 w-full h-56 opacity-50"
        preserveAspectRatio="none"
      >
        <path
          d="M0,220 C360,110 680,290 1040,190 C1230,135 1350,180 1440,150 L1440,320 L0,320 Z"
          fill="#F5F5F7"
        />
      </svg>

      <div />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6 rounded-2xl"
        >
          <NeoLogo size="xl" showWordmark={false} />
        </motion.div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-2 text-[#111827]">
          NEO AI
        </h1>
        <p className="text-[#111827] text-base sm:text-lg font-medium mb-1">
          Your Personal AI Assistant
        </p>
        <p className="text-[#6B7280] text-sm tracking-wide mb-9">
          Ask • Create • Explore
        </p>

        <div className="w-52 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full rounded-full bg-[#111827]"
          />
        </div>
      </motion.div>

      <p className="relative z-10 text-xs font-medium text-[#6B7280]">
        Powered by Advanced AI
      </p>
    </div>
  );
};
