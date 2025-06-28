import type React from 'react';

const WalletIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M19.64 7.02982C20.3905 7.21485 21 7.82823 21 8.57795V17.422C21 18.1718 20.3905 18.7851 19.64 18.9702L5.32087 22.4216C4.05388 22.7237 3 21.7269 3 20.4014V5.5986C3 4.27311 4.05388 3.27631 5.32087 3.57843L19.64 7.02982Z" />
    <path d="M3 8H21" />
    <ellipse cx="16.5" cy="13.5" rx="1.5" ry="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export default WalletIcon;
