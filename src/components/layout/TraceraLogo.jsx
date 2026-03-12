import React from 'react';
import { Link } from 'react-router-dom';

const sizeClasses = {
  compact: 'h-[2.5rem] w-[2.5rem]',
  default: 'h-[3.8rem] w-[3.8rem]',
};

const LogoMark = ({ compact = false, tone = 'light' }) => {
  const isDark = tone === 'dark';

  return (
    <div
      className={`relative ${compact ? sizeClasses.compact : sizeClasses.default} overflow-hidden rounded-[1rem] shadow-[0_18px_40px_rgba(15,23,42,0.16)]`}
    >
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-[linear-gradient(145deg,#06090f_0%,#111827_55%,#1f2937_100%)]'
            : 'bg-[linear-gradient(145deg,#06090f_0%,#111827_55%,#1f2937_100%)]'
        }`}
      />
      <div className="absolute inset-[5%] rounded-[0.82rem] border border-white/8" />
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-[20%]">
        <defs>
          <linearGradient id="traceraGold" x1="8%" y1="10%" x2="90%" y2="92%">
            <stop offset="0%" stopColor="#f5cd98" />
            <stop offset="52%" stopColor="#c98a4a" />
            <stop offset="100%" stopColor="#7d4d22" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#traceraGold)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 28h64" strokeWidth="6.4" />
          <path d="M50 28v44" strokeWidth="6.4" />
          <path d="M30 72h40" strokeWidth="6.4" />
          <path d="M32 28l18 22 18-22" strokeWidth="5.2" opacity="0.95" />
          <path d="M39 72l11-12 11 12" strokeWidth="5.2" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
};

const TraceraLogo = ({ to = '/', onClick, compact = false, tone = 'light' }) => {
  const isDark = tone === 'dark';

  return (
    <Link to={to} onClick={onClick} className="group inline-flex flex-col items-center justify-center gap-1.5">
      <LogoMark compact={compact} tone={tone} />
      <div
        className={`font-semibold tracking-[0.26em] transition-colors ${
          compact ? 'text-[0.62rem]' : 'text-[0.78rem]'
        } ${isDark ? 'text-stone-300 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-950'}`}
        style={{ fontWeight: 600 }}
      >
        TRACERA
      </div>
    </Link>
  );
};

export default TraceraLogo;
