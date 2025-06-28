import type React from 'react';

const CashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" transform="rotate(-5 12 12)" />
    <circle cx="12" cy="12" r="3" transform="rotate(-5 12 12)" />
    <path d="M17 10L17 14" transform="rotate(-5 12 12)" />
    <path d="M7 10L7 14" transform="rotate(-5 12 12)" />
  </svg>
);

export default CashIcon;
