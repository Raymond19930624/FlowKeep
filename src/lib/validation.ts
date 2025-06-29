import { z } from 'zod';

export const projectSchema = z.object({
  name: z.string()
    .min(1, '活動名稱不能為空')
    .max(100, '活動名稱太長'),
  passcode: z.string()
    .min(6, '密碼至少需要6個字元')
    .max(50, '密碼太長'),
});

export const transactionSchema = z.object({
  date: z.string().min(1, '請選擇日期'),
  type: z.enum(['income', 'expense']),
  item: z.string().min(1, '項目不能為空'),
  person: z.string().min(1, '人員不能為空'),
  amount: z.number().min(0, '金額必須大於0'),
  count: z.number().optional(),
  voucherType: z.string().optional(),
  notes: z.string().optional(),
});

export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; errors?: Record<string, string>; data?: T } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach(issue => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    });
    return { success: false, errors };
  }
  
  return { success: true, data: result.data };
}
