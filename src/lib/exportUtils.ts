
import * as XLSX from 'xlsx';
import type { Project, Transaction } from './types';
import { format, parseISO, isValid } from 'date-fns';

interface ExcelRow {
  '日期': string;
  '類型': '收入' | '支出';
  '項目': string;
  '人員': string;
  '報名人數'?: number | string;
  '憑證類型'?: Transaction['voucherType'] | string;
  '金額': number;
  '備註'?: string;
}

const excelColumnOrder: (keyof ExcelRow)[] = [
  '日期',
  '類型',
  '項目',
  '人員',
  '報名人數',
  '憑證類型',
  '金額',
  '備註',
];

export function exportProjectToExcel(project: Project, transactions: Transaction[]): void {
  if (!project) {
    console.error("Project data is missing for export.");
    alert("無法匯出：專案資料遺失。");
    return;
  }
  const fileName = `${project.name}_收支紀錄.xlsx`;

  const transactionsToExport: ExcelRow[] = transactions.map(t => {
    const row: ExcelRow = {
      '日期': isValid(parseISO(t.date)) ? format(parseISO(t.date), 'yyyy/MM/dd') : t.date,
      '類型': t.type === 'income' ? '收入' : '支出',
      '項目': t.item,
      '人員': t.person,
      '金額': t.amount,
      '備註': t.notes || '',
    };
    if (t.type === 'income') {
      row['報名人數'] = t.count ?? '';
    } else {
      row['憑證類型'] = t.voucherType || '';
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(transactionsToExport, { header: excelColumnOrder });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '交易紀錄');

  const colWidths = [
    { wch: 12 }, // 日期
    { wch: 8 },  // 類型
    { wch: 25 }, // 項目
    { wch: 15 }, // 人員
    { wch: 10 }, // 報名人數
    { wch: 12 }, // 憑證類型
    { wch: 12 }, // 金額
    { wch: 30 }, // 備註
  ];
  worksheet['!cols'] = colWidths;

  for (let R = 1; R <= transactionsToExport.length; ++R) {
    const amountCellRef = XLSX.utils.encode_cell({c: excelColumnOrder.indexOf('金額'), r: R});
    if(worksheet[amountCellRef]) {
      worksheet[amountCellRef].t = 'n';
      worksheet[amountCellRef].z = '#,##0';
    }

    const countCellRef = XLSX.utils.encode_cell({c: excelColumnOrder.indexOf('報名人數'), r: R});
    if(worksheet[countCellRef] && transactionsToExport[R-1]['報名人數'] !== '' && transactionsToExport[R-1]['報名人數'] !== undefined) {
       worksheet[countCellRef].t = 'n';
       worksheet[countCellRef].z = '#,##0';
    }
  }

  XLSX.writeFile(workbook, fileName);
}
