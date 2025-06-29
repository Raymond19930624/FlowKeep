import React from 'react';
import { FontAwareText } from '@/components/ui/font-aware-text';

export const FontExample: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">字體支援測試</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">支援 Kiwi Maru 的文字：</h2>
          <FontAwareText as="p" className="text-xl">
            これはテストです
          </FontAwareText>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">不支援 Kiwi Maru 的文字：</h2>
          <FontAwareText as="p" className="text-xl">
            這是一個測試
          </FontAwareText>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">混合文字：</h2>
          <FontAwareText as="p" className="text-xl">
            これはテストです 這是一個測試
          </FontAwareText>
        </div>
      </div>
    </div>
  );
};

export default FontExample;
