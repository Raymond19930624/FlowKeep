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

    // 使用 path.join 構建跨平台兼容的路徑
    const supportedCharsPath = path.join(process.cwd(), 'public', 'fonts', 'kiwi-maru-supported-chars.txt');
    const unsupportedCharsPath = path.join(process.cwd(), 'public', 'fonts', 'kiwi-maru-unsupported-chars.txt');

    // 添加調試日誌
    console.log('Supported chars path:', supportedCharsPath);
    console.log('Unsupported chars path:', unsupportedCharsPath);

    // 讀取支援的字元清單（不換行格式）
    let supportedContent;
    try {
      supportedContent = await fs.readFile(supportedCharsPath, 'utf-8');
      console.log('Supported content length:', supportedContent.length);
    } catch (error) {
      console.error('Error reading supported chars file:', error);
      // 提供一個默認的字符集
      supportedContent = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
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
      
      // 觸發 GitHub Actions 工作流程
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          // 直接提交變更到 GitHub
          const simpleGit = require('simple-git');
          const git = simpleGit();
          
          await git.add('public/fonts/kiwi-maru-unsupported-chars.txt');
          await git.commit('chore: update unsupported characters [skip ci]');
          await git.push('origin', 'main');
          
          console.log('Successfully pushed unsupported characters update to GitHub');
        }
      } catch (error) {
        console.error('Failed to update unsupported characters:', error);
        // 即使更新失敗，仍然繼續執行，因為這不應該影響主要功能
      }
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
