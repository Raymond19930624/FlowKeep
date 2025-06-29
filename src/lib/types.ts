

export interface TransactionData {
  type: 'income' | 'expense';
  date: string; // ISO string format (e.g., "2023-10-26")
  person: string; // 收款人 / 請款人
  count?: number; // 人數 (income only)
  item: string;
  voucherType?: '發票' | '收據' | '其他'; // 憑證類型 (expense only)
  amount: number;
  notes?: string;
}

export interface Transaction extends TransactionData {
  id: string;
  projectId: string;
}

// For creating a new project
export interface ProjectData {
  name: string;
  passcode: string;
  useKiwiMaru?: boolean;
  kiwiMaruSupported?: boolean;
  commonIncomeItems?: string[];
  commonExpenseItems?: string[];
}

// The full project object structure
export interface Project {
  id: string;
  name: string;
  passcode: string;
  useKiwiMaru: boolean;
  kiwiMaruSupported: boolean;
  transactions: Transaction[];
  commonIncomeItems: string[];
  commonExpenseItems: string[];
}
