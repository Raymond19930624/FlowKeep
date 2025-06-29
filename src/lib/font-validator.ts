// 檢查字串中的所有字元是否都被支援
export async function isFullySupported(text: string): Promise<{ isValid: boolean; message?: string; unsupportedChars?: string[] }> {
  try {
    const response = await fetch('/api/validate-font', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('API 請求失敗');
    }

    const data = await response.json();
    return {
      isValid: data.isSupported,
      unsupportedChars: data.unsupportedChars || [],
      message: data.isSupported ? undefined : `以下字元不支援 Kiwi Maru 字型: ${(data.unsupportedChars || []).join(' ')}`
    };
  } catch (error) {
    console.error('字型驗證失敗:', error);
    return {
      isValid: false,
      message: '字型驗證服務暫時不可用',
      unsupportedChars: []
    };
  }
}

// 檢查活動名稱是否完全支援
export async function validateEventName(eventName: string): Promise<{ isValid: boolean; message?: string }> {
  if (!eventName || typeof eventName !== 'string') {
    return {
      isValid: false,
      message: '無效的輸入'
    };
  }

  try {
    const result = await isFullySupported(eventName);
    return {
      isValid: result.isValid,
      message: result.message
    };
  } catch (error) {
    console.error('驗證字型時出錯:', error);
    return {
      isValid: false,
      message: '字型驗證時發生錯誤，請稍後再試'
    };
  }
}
