import { useState, useEffect } from 'react';

// 預設字體，用於比較
const FALLBACK_FONT = 'Arial, sans-serif';
const TARGET_FONT = 'Kiwi Maru';

// 創建一個隱藏的 canvas 元素來檢測字體支援
const getCanvasContext = () => {
  if (typeof document === 'undefined') return null;
  
  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
};

// 檢查單個字元是否支援目標字體
const checkCharSupport = (char: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(false);
      return;
    }

    const fontSize = 100;
    const text = char;
    
    try {
      // 設置畫布大小
      canvas.width = fontSize * 2;
      canvas.height = fontSize * 2;
      
      // 繪製參考字體（Arial）
      ctx.font = `${fontSize}px ${FALLBACK_FONT}`;
      ctx.fillText(text, 0, fontSize);
      const referencePixels = ctx.getImageData(0, 0, fontSize * 2, fontSize * 2).data;
      
      // 清空畫布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 繪製目標字體（Kiwi Maru）
      ctx.font = `${fontSize}px ${TARGET_FONT}, ${FALLBACK_FONT}`;
      ctx.fillText(text, 0, fontSize);
      const targetPixels = ctx.getImageData(0, 0, fontSize * 2, fontSize * 2).data;
      
      // 比較兩個像素數據是否不同
      let isDifferent = false;
      for (let i = 0; i < referencePixels.length; i++) {
        if (referencePixels[i] !== targetPixels[i]) {
          isDifferent = true;
          break;
        }
      }
      
      resolve(isDifferent);
    } catch (error) {
      console.error('Error checking font support:', error);
      resolve(false);
    }
  });
};

// 檢查整個字串是否完全支援目標字體
const checkTextSupport = async (text: string): Promise<boolean> => {
  if (!text) return false;
  
  // 檢查每個字元
  for (const char of text) {
    // 跳過空白字元
    if (/\s/.test(char)) continue;
    
    const isSupported = await checkCharSupport(char);
    if (!isSupported) {
      return false;
    }
  }
  
  return text.length > 0; // 確保不是空字串
};

export const useFontSupport = (text: string): boolean => {
  const [isFontSupported, setIsFontSupported] = useState<boolean>(false);
  
  useEffect(() => {
    // 確保在客戶端執行
    if (typeof window === 'undefined') return;
    
    let isMounted = true;
    
    const checkSupport = async () => {
      try {
        const supported = await checkTextSupport(text);
        if (isMounted) {
          setIsFontSupported(supported);
        }
      } catch (error) {
        console.error('Error in useFontSupport:', error);
        if (isMounted) {
          setIsFontSupported(false);
        }
      }
    };
    
    checkSupport();
    
    return () => {
      isMounted = false;
    };
  }, [text]);
  
  return isFontSupported;
};
