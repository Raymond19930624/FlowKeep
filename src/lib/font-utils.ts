// 不支援的字元快取（存儲 Unicode 編碼）
let unsupportedCharsCache: Set<string> = new Set();
let supportedCharsCache: Set<string> | null = null;
let isCacheInitialized = false; // 標記快取是否已初始化

// 將字元轉換為 Unicode 編碼字符串
function charToUnicode(char: string): string {
  return char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') || '';
}

// 從 txt 檔案讀取不支援字元列表
async function loadUnsupportedCharsFromFile(): Promise<Set<string>> {
  const unsupportedChars = new Set<string>();
  
  try {
    console.log('[字體檢查] 開始載入不支援字元列表...');
    
    // 添加時間戳以避免快取
    const response = await fetch(`/fonts/kiwi-maru-unsupported-chars.txt?t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }
    
    // 確保使用正確的編碼讀取
    const text = await response.text();
    console.log('[字體檢查] 不支援字元列表內容:', JSON.stringify(text));
    
    // 分割成行，並過濾掉空行和註釋
    const lines = text.split(/\r?\n/);
    console.log(`[字體檢查] 找到 ${lines.length} 行`);
    
    // 用於跟蹤已處理的 Unicode 編碼，避免重複
    const processedUnicodes = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳過空行和註釋
      if (!line || line.startsWith('#')) {
        console.log(`[字體檢查] 跳過行 ${i + 1}:`, line);
        continue;
      }
      
      // 處理行中的每個字元
      for (const char of line) {
        if (!char.trim()) continue; // 跳過空白字元
        
        const unicode = charToUnicode(char);
        if (!unicode) {
          console.warn(`[行 ${i + 1}] 無法轉換字元: "${char}"`);
          continue;
        }
        
        if (!processedUnicodes.has(unicode)) {
          unsupportedChars.add(unicode);
          processedUnicodes.add(unicode);
          console.log(`[行 ${i + 1}] 已添加不支援字元: "${char}" (U+${unicode})`);
        } else {
          console.log(`[行 ${i + 1}] 字元 "${char}" (U+${unicode}) 已存在於不支援清單中`);
        }
      }
    }
    
    console.log(`已載入 ${unsupportedChars.size} 個不支援字元`);
    
    return unsupportedChars;
    
  } catch (error) {
    console.error('載入不支援字元列表時發生錯誤:', error);
    return new Set<string>();
  }
}

/**
 * 載入支援的字元集
 */
async function loadSupportedChars(): Promise<Set<string>> {
  if (supportedCharsCache) {
    console.log('[字體檢查] 使用快取中的支援字元集，數量:', supportedCharsCache.size);
    return supportedCharsCache;
  }
  
  try {
    console.log('[字體檢查] 開始載入支援字元集...');
    const response = await fetch('/fonts/kiwi-maru-supported-chars.txt');
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }
    
    const text = await response.text();
    const chars = new Set<string>();
    const charArray = Array.from(text);
    
    // 用於跟蹤已處理的 Unicode 編碼，避免重複
    const processedUnicodes = new Set<string>();
    
    for (const char of charArray) {
      // 跳過空白字元和換行符
      if (char.trim() === '' || char === '\n' || char === '\r') continue;
      
      const unicode = charToUnicode(char);
      if (unicode && !processedUnicodes.has(unicode)) {
        chars.add(unicode);
        processedUnicodes.add(unicode);
      }
    }
    
    supportedCharsCache = chars;
    console.log('[字體檢查] 已載入支援的字元集，唯一字元數量:', supportedCharsCache.size);
    
    return supportedCharsCache;
  } catch (error) {
    console.error('[字體檢查] 載入支援字元集失敗:', error);
    return new Set();
  }
}

// 檢查特定字元是否在支援的字元集中
function isCharSupported(char: string, supportedChars: Set<string>): boolean {
  // 檢查是否為空白字元
  if (char.trim() === '') return true;
  
  // 檢查是否在支援字元集中
  const unicode = charToUnicode(char);
  const isSupported = unicode ? supportedChars.has(unicode) : false;
  
  // 調試日誌
  if (isSupported) {
    console.log(`字元 "${char}" (U+${unicode}) 在支援字元集中`);
  } else {
    console.log(`字元 "${char}" (U+${unicode}) 不在支援字元集中`);
  }
  
  return isSupported;
}

/**
 * 檢查文字是否完全由支援的字元組成
 * @param text 要檢查的文字
 * @returns 如果所有字元都支援則返回 true，否則返回 false
 */
export async function isTextFullySupported(text: string): Promise<boolean> {
  if (!text || typeof text !== 'string') {
    console.log('[字體檢查] 無效的輸入文字');
    return false; // 無效輸入視為不支援
  }
  
  try {
    console.group('[字體檢查] 字體支援檢查');
    console.log('[字體檢查] 檢查文字:', text);
    
    // 1. 初始化快取（如果尚未初始化）
    if (!isCacheInitialized) {
      console.log('[字體檢查] 初始化字元快取...');
      const [unsupportedChars, supportedChars] = await Promise.all([
        loadUnsupportedCharsFromFile(),
        loadSupportedChars()
      ]);
      
      unsupportedCharsCache = unsupportedChars;
      supportedCharsCache = supportedChars;
      isCacheInitialized = true;
      
      console.log(`[字體檢查] 快取初始化完成，不支援字元: ${unsupportedCharsCache.size} 個，支援字元: ${supportedCharsCache?.size || 0} 個`);
    }
    
    // 2. 取得唯一字元，避免重複檢查
    const uniqueChars = Array.from(new Set(text));
    console.log('[字體檢查] 唯一字元:', uniqueChars.map(c => `"${c}" (U+${charToUnicode(c)})`).join(', '));
    
    // 3. 先檢查不支援字元快取
    console.log('[字體檢查] 不支援字元快取內容:', Array.from(unsupportedCharsCache));
    
    for (const char of uniqueChars) {
      if (char.trim() === '') continue; // 跳過空白字元
      
      const unicode = charToUnicode(char);
      if (!unicode) continue; // 跳過無效字元
      
      console.log(`[字體檢查] 檢查字元 "${char}" (U+${unicode}):`);
      
      // 檢查是否在不支援字元快取中
      const isUnsupported = Array.from(unsupportedCharsCache).some(
        unsupportedUnicode => unsupportedUnicode === unicode
      );
      
      console.log(`- 是否在不支援字元快取中: ${isUnsupported}`);
      
      if (isUnsupported) {
        console.log(`[字體檢查] ❌ 字元 "${char}" (U+${unicode}) 在不支援字元清單中`);
        console.groupEnd();
        return false;
      } else {
        console.log(`[字體檢查] ✅ 字元 "${char}" (U+${unicode}) 不在不支援清單中`);
      }
    }
    
    // 4. 檢查支援字元集
    const supportedChars = supportedCharsCache || await loadSupportedChars();
    
    for (const char of uniqueChars) {
      if (char.trim() === '') continue; // 跳過空白字元
      
      const unicode = charToUnicode(char);
      if (!unicode) continue; // 跳過無效字元
      
      // 檢查是否在支援字元集中
      if (!supportedChars.has(unicode)) {
        console.log(`[字體檢查] ❌ 字元 "${char}" (U+${unicode}) 不在支援字元集中`);
        
        // 將不支援的字元加入快取，下次直接判斷為不支援
        unsupportedCharsCache.add(unicode);
        console.groupEnd();
        return false;
      }
    }
    
    console.log('[字體檢查] ✅ 所有字元都支援');
    console.groupEnd();
    return true;
    
  } catch (error) {
    console.error('[字體檢查] 檢查字體支援時出錯:', error);
    console.groupEnd();
    return false; // 出錯時預設為不支援，以確保安全
  }
}

/**
 * 清除快取（只清除記憶體中的快取）
 * 當管理員更新了支援/不支援字元清單時，應該調用此方法
 */
export function clearFontSupportCache() {
  console.log('[字體檢查] 清除字體快取');
  unsupportedCharsCache.clear();
  supportedCharsCache = null;
  isCacheInitialized = false;
}

// 獲取不支援的字元列表
export function getUnsupportedChars(): string[] {
  return Array.from(unsupportedCharsCache);
}

/**
 * 重新載入不支援字元列表（從 txt 檔案）
 * 當管理員更新了不支援字元清單時，應該調用此方法
 */
export async function reloadUnsupportedChars() {
  console.log('[字體檢查] 重新載入不支援字元列表');
  const charsFromFile = await loadUnsupportedCharsFromFile();
  unsupportedCharsCache = charsFromFile;
  
  // 如果支援字元集尚未載入，也一併載入
  if (!supportedCharsCache) {
    await loadSupportedChars();
  }
  
  isCacheInitialized = true;
  console.log(`[字體檢查] 不支援字元列表已更新，目前數量: ${unsupportedCharsCache.size}`);
}

/**
 * 手動添加不支援的字元（暫存到快取）
 * @param chars 要添加的不支援字元，可以是單個字元或字元陣列
 */
export function addUnsupportedChars(chars: string | string[]): void {
  // 如果是單個字元，轉換為陣列
  const charArray = typeof chars === 'string' ? [chars] : chars;
  let addedCount = 0;
  
  // 添加到快取
  charArray.forEach(char => {
    if (char.trim()) {
      const unicode = charToUnicode(char);
      if (unicode && !unsupportedCharsCache.has(unicode)) {
        unsupportedCharsCache.add(unicode);
        addedCount++;
        console.log(`[字體檢查] 已手動添加不支援字元: "${char}" (U+${unicode})`);
      }
    }
  });
  
  if (addedCount > 0) {
    console.log(`[字體檢查] 已添加 ${addedCount} 個不支援字元到快取`);
  }
}

// 預先載入支援的字元集
let supportedCharsPromise: Promise<Set<string>> | null = null;

export function preloadSupportedChars() {
  if (!supportedCharsPromise) {
    supportedCharsPromise = loadSupportedChars();
  }
  return supportedCharsPromise;
}

// 在應用程式啟動時預先載入
preloadSupportedChars();
