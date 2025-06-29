import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    const supportedCharsPath = path.join(process.cwd(), 'public/fonts/kiwi-maru-supported-chars.txt');
    const unsupportedCharsPath = path.join(process.cwd(), 'public/fonts/kiwi-maru-unsupported-chars.txt');

    // 讀取支援的字元清單（不換行格式）
    const supportedContent = await fs.readFile(supportedCharsPath, 'utf-8');
    const supportedChars = new Set(supportedContent.split(''));

    // 讀取不支援的字元清單（不換行格式）
    let unsupportedChars = new Set<string>();
    try {
      const unsupportedContent = await fs.readFile(unsupportedCharsPath, 'utf-8');
      unsupportedContent.split('').forEach(char => {
        if (char.trim() !== '') {
          unsupportedChars.add(char);
        }
      });
    } catch (error) {
      // 如果檔案不存在，創建一個空檔案
      await fs.writeFile(unsupportedCharsPath, '', 'utf-8');
    }

    // 檢查每個字元
    const uniqueChars = Array.from(new Set(text.split('')));
    const unsupported: string[] = [];
    const newUnsupported: string[] = [];

    console.log('Checking text:', text);
    console.log('Unique characters:', uniqueChars);
    console.log('First few supported chars:', Array.from(supportedChars).slice(0, 20).join(''));
    console.log('First few unsupported chars:', Array.from(unsupportedChars).slice(0, 20).join(''));

    // 1. 首先檢查是否有任何字元在不支援清單中
    for (const char of uniqueChars) {
      if (char.trim() === '') continue;
      
      console.log(`Checking if '${char}' (${char.charCodeAt(0).toString(16)}) is in unsupported list`);
      
      // 如果字元在不支援清單中，直接返回不支援
      if (unsupportedChars.has(char)) {
        console.log(`Character '${char}' found in unsupported list`);
        return NextResponse.json({
          isSupported: false,
          unsupportedChars: [char],
          reason: 'found_in_unsupported_list'
        });
      }
    }
    
    // 2. 檢查所有字元是否都在支援清單中
    for (const char of uniqueChars) {
      if (char.trim() === '') continue;
      
      console.log(`Checking if '${char}' (${char.charCodeAt(0).toString(16)}) is in supported list`);
      
      // 如果字元不在支援清單中，加入新發現的不支援字元列表
      if (!supportedChars.has(char)) {
        console.log(`Character '${char}' not found in supported list`);
        unsupported.push(char);
        newUnsupported.push(char);
      } else {
        console.log(`Character '${char}' is supported`);
      }
    }

    // 如果有新發現的不支援字元，追加到不支援清單檔案
    if (newUnsupported.length > 0) {
      await fs.appendFile(unsupportedCharsPath, newUnsupported.join(''), 'utf-8');
    }

    return NextResponse.json({
      isSupported: unsupported.length === 0,
      unsupportedChars: unsupported
    });

  } catch (error) {
    console.error('Error validating font:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
