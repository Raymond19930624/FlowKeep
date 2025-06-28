import type React from 'react';

const StickyNoteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="hsl(var(--primary)/0.2)" /* Light fill for sticky note */
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M4 4.99988H16C17.1046 4.99988 18 5.89531 18 6.99988V19.9999L13 17.9999L8 19.9999L4 17.9999V4.99988Z" />
    <path d="M4 5V3" />
    <path d="M18 5V3" />
    <path d="M8 9H14" />
    <path d="M8 12H12" />
  </svg>
);

export default StickyNoteIcon;
