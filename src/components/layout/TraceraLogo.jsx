import React from 'react';
import { Link } from 'react-router-dom';

const sizeClasses = {
  compact: 'h-[3.25rem] w-[3.25rem]',
  default: 'h-[5.4rem] w-[5.4rem]',
};

const LogoMark = ({ compact = false, tone = 'light' }) => {
  const isDark = tone === 'dark';
  const logoSrc = isDark ? '/proveny-symbol-dark.svg' : '/proveny-symbol.svg';

  return (
    <div className={`relative ${compact ? sizeClasses.compact : sizeClasses.default} overflow-visible`}>
      {isDark && (
        <div className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(232,202,160,0.18)_0%,rgba(232,202,160,0.06)_38%,transparent_72%)] blur-md" />
      )}
      <img
        src={logoSrc}
        alt=""
        aria-hidden="true"
        className="relative h-full w-full object-contain drop-shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
      />
    </div>
  );
};

const TraceraLogo = ({ to = '/', onClick, compact = false, tone = 'light', showLabel = true }) => {
  const isDark = tone === 'dark';

  return (
    <Link to={to} onClick={onClick} aria-label="Proveny home" className="group inline-flex flex-col items-center justify-center gap-0">
      <LogoMark compact={compact} tone={tone} />
      {showLabel && (
        <div
          className={`-mt-0.5 font-semibold leading-none tracking-[0.12em] transition-colors ${compact ? 'text-[0.64rem]' : 'text-[0.88rem]'} ${isDark ? 'text-stone-300 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-950'}`}
          style={{ fontFamily: '"Avenir Next", "Pretendard", system-ui, sans-serif' }}
        >
          PROVENY
        </div>
      )}
    </Link>
  );
};

export const ProvenyLockup = ({ to = '/', onClick, tone = 'light', compact = false }) => {
  const isDark = tone === 'dark';

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="Proveny home"
      className={`inline-flex items-center gap-2.5 rounded-[1.35rem] border px-3 py-2.5 pr-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] backdrop-blur ${isDark ? 'border-white/10 bg-white/6' : 'border-white/85 bg-white/78'}`}
    >
      <LogoMark compact tone={tone} />
      <div className="min-w-0">
        <div className={`text-[8px] font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-stone-300/80' : 'text-slate-500'}`}>
          Verified Ownership Network
        </div>
        <div
          className={`mt-0.5 font-semibold leading-none tracking-[0.18em] ${compact ? 'text-[1rem]' : 'text-[1.12rem] sm:text-[1.22rem]'} ${isDark ? 'text-white' : 'text-slate-950'}`}
          style={{ fontFamily: '"Avenir Next", "Pretendard", system-ui, sans-serif' }}
        >
          PROVENY
        </div>
      </div>
    </Link>
  );
};

export default TraceraLogo;
