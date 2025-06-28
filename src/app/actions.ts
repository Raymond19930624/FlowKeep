
'use server';

import { getAdminPasscode, setAdminPasscode } from '@/lib/storage';

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const serverPasscode = await getAdminPasscode();
  return passcode === serverPasscode;
}

export async function changeAdminPasscode(data: { currentPasscode: string; newPasscode: string; }): Promise<{ success: boolean; message: string; }> {
  const serverPasscode = await getAdminPasscode();
  if (data.currentPasscode !== serverPasscode) {
    return { success: false, message: '目前密碼錯誤。' };
  }

  if (!data.newPasscode || data.newPasscode.length < 6) {
    return { success: false, message: '新密碼長度至少需要 6 位。' };
  }

  if (data.newPasscode === serverPasscode) {
    return { success: false, message: '新密碼不可與目前密碼相同。' };
  }

  try {
    await setAdminPasscode(data.newPasscode);
    return { success: true, message: '管理員密碼已成功更新。' };
  } catch (error) {
    console.error("Error changing admin passcode:", error);
    return { success: false, message: `更新密碼時發生未知錯誤：${(error as Error).message}` };
  }
}
