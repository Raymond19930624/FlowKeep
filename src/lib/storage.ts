
'use server'
import { unstable_cache, revalidateTag } from 'next/cache';
import { getProjectsSheet, getTransactionsSheet } from './google-sheets';
import type { Project, Transaction, ProjectData, TransactionData } from './types';

const ADMIN_CONFIG_ID = '__ADMIN_CONFIG__';

// --- Helper Functions for Data Parsing ---
function parseProject(row: any): Project {
    return {
        id: row.get('id') as string,
        name: row.get('name') as string,
        passcode: String(row.get('passcode') || ''),
        useKiwiMaru: row.get('useKiwiMaru') === 'TRUE',
        commonIncomeItems: (row.get('commonIncomeItems') as string || '').split(',').filter(Boolean),
        commonExpenseItems: (row.get('commonExpenseItems') as string || '').split(',').filter(Boolean),
        transactions: [], // This will be populated separately
    };
}

function parseTransaction(row: any): Transaction {
    const amountStr = row.get('amount');
    const countStr = row.get('count');
    return {
        id: row.get('id') as string,
        projectId: row.get('projectId') as string,
        type: row.get('type') as 'income' | 'expense',
        date: row.get('date') as string,
        person: row.get('person') as string,
        item: row.get('item') as string,
        amount: amountStr ? parseInt(amountStr, 10) : 0,
        notes: (row.get('notes') as string) || '',
        count: countStr ? parseInt(countStr, 10) : undefined,
        voucherType: row.get('voucherType') as '發票' | '收據' | '其他' | undefined,
    };
}


// --- Admin Passcode Functions ---
export const getAdminPasscode = unstable_cache(async (): Promise<string> => {
    try {
        const projectsSheet = await getProjectsSheet();
        if (!projectsSheet) {
            throw new Error('無法載入 Google Sheet');
        }
        
        const rows = await projectsSheet.getRows();
        const configRow = rows.find(row => row.get('id') === ADMIN_CONFIG_ID);

        if (!configRow || !configRow.get('passcode')) {
            throw new Error('在 Google Sheet 中找不到管理員密碼設定');
        }
        
        let passcode = String(configRow.get('passcode'));
        if (!passcode) {
            throw new Error('管理員密碼為空');
        }
        
        // 移除可能的前導單引號（如果有的話）
        if (passcode.startsWith("'")) {
            passcode = passcode.substring(1);
        }
        
        console.log('從 Google Sheet 讀取到的管理員密碼:', passcode);
        return passcode;
    } catch (error) {
        console.error('讀取管理員密碼時發生錯誤:', error);
        throw new Error('無法讀取管理員密碼，請檢查 Google Sheet 設定');
    }
}, 
['admin_passcode'], 
{ tags: ['admin_passcode'] });

export async function setAdminPasscode(newPasscode: string): Promise<void> {
    const projectsSheet = await getProjectsSheet();
    if (!projectsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const rows = await projectsSheet.getRows();
    const configRow = rows.find(row => row.get('id') === ADMIN_CONFIG_ID);

    // 在密碼前添加單引號，確保它被視為文本
    const passcodeAsText = `'${newPasscode}`;

    if (configRow) {
        configRow.set('passcode', passcodeAsText);
        await configRow.save();
    } else {
        await projectsSheet.addRow({
            id: ADMIN_CONFIG_ID,
            name: 'SYSTEM_ADMIN_CONFIG',
            passcode: passcodeAsText,
        });
    }
    revalidateTag('admin_passcode');
    revalidateTag('projects'); // In case admin logs in to see projects
}


// --- Project Functions ---
export const getProjects = unstable_cache(async (): Promise<Project[]> => {
    const projectsSheet = await getProjectsSheet();
    const transactionsSheet = await getTransactionsSheet();
    
    if (!projectsSheet || !transactionsSheet) {
        console.warn("Build Warning: Could not access Google Sheets. Returning empty project list.");
        return [];
    }
    
    const projectRows = await projectsSheet.getRows();
    const transactionRows = await transactionsSheet.getRows();

    const allTransactions = transactionRows.map(parseTransaction);
    
    const projects = projectRows
      .filter(row => row.get('id') !== ADMIN_CONFIG_ID)
      .map(row => {
        const project = parseProject(row);
        project.transactions = allTransactions.filter(t => t.projectId === project.id);
        return project;
    });

    return projects;
}, ['projects'], { tags: ['projects'] });

export async function getProjectById(projectId: string): Promise<Project | null> {
    const projects = await getProjects();
    return projects.find(p => p.id === projectId) || null;
}

export async function addProject(newProjectData: ProjectData): Promise<Project> {
    const sheet = await getProjectsSheet();
    if (!sheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const newRowData = {
        id: newId,
        name: newProjectData.name,
        passcode: `'${newProjectData.passcode}`,
        useKiwiMaru: newProjectData.useKiwiMaru ? 'TRUE' : 'FALSE',
        commonIncomeItems: '',
        commonExpenseItems: '',
    };

    const newRow = await sheet.addRow(newRowData);
    
    revalidateTag('projects');
    return { ...parseProject(newRow), transactions: [] };
}

export async function updateProject(projectId: string, updatedProjectData: Partial<ProjectData>): Promise<void> {
    const sheet = await getProjectsSheet();
    if (!sheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }
    const rows = await sheet.getRows();
    const rowIndex = rows.findIndex(row => row.get('id') === projectId);

    if (rowIndex === -1) {
        throw new Error("找不到指定的活動");
    }
    const row = rows[rowIndex];
    
    if (updatedProjectData.name !== undefined) row.set('name', updatedProjectData.name);
    if (updatedProjectData.passcode !== undefined) row.set('passcode', `'${updatedProjectData.passcode}`);
    if (updatedProjectData.useKiwiMaru !== undefined) row.set('useKiwiMaru', updatedProjectData.useKiwiMaru ? 'TRUE' : 'FALSE');
    
    await row.save();
    revalidateTag('projects');
}

export async function deleteProject(projectIdToDelete: string): Promise<void> {
    const projectsSheet = await getProjectsSheet();
    const transactionsSheet = await getTransactionsSheet();

    if (!projectsSheet || !transactionsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    // Delete project row
    const projectRows = await projectsSheet.getRows();
    const projectRowToDelete = projectRows.find(row => row.get('id') === projectIdToDelete);
    if (projectRowToDelete) {
        await projectRowToDelete.delete();
    } else {
        throw new Error("找不到指定的活動");
    }

    // Delete associated transaction rows
    const transactionRows = await transactionsSheet.getRows();
    const transactionsToDelete = transactionRows.filter(row => row.get('projectId') === projectIdToDelete);
    
    for (const row of transactionsToDelete.reverse()) { // Delete in reverse to avoid index shifting issues
        await row.delete();
    }
    revalidateTag('projects');
}


// --- Transaction Functions ---
export async function addTransaction(projectId: string, transactionData: TransactionData): Promise<Transaction> {
    const projectsSheet = await getProjectsSheet();
    const transactionsSheet = await getTransactionsSheet();

    if (!projectsSheet || !transactionsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const projectRows = await projectsSheet.getRows({ cache: 'reload' });
    const projectRow = projectRows.find(row => row.get('id') === projectId);

    if (!projectRow) {
        throw new Error("找不到指定的活動");
    }

    const newTransactionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const newTransactionData = {
        id: newTransactionId,
        projectId,
        ...transactionData
    };
    
    await transactionsSheet.addRow(newTransactionData);

    // Update common items
    const commonItemsKey = transactionData.type === 'income' ? 'commonIncomeItems' : 'commonExpenseItems';
    const currentItems = (projectRow.get(commonItemsKey) as string || '').split(',').filter(Boolean);
    if (!currentItems.includes(transactionData.item)) {
        currentItems.push(transactionData.item);
        projectRow.set(commonItemsKey, currentItems.join(','));
        await projectRow.save();
    }

    revalidateTag('projects');

    return { ...transactionData, id: newTransactionId };
}

export async function updateTransaction(projectId: string, updatedTransaction: Transaction): Promise<void> {
    const transactionsSheet = await getTransactionsSheet();
    if (!transactionsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const rows = await transactionsSheet.getRows();
    const rowIndex = rows.findIndex(row => row.get('id') === updatedTransaction.id && row.get('projectId') === projectId);

    if (rowIndex === -1) {
        throw new Error("找不到指定的紀錄");
    }
    const row = rows[rowIndex];

    Object.keys(updatedTransaction).forEach(key => {
        const typedKey = key as keyof Transaction;
        if (typedKey !== 'id' && typedKey !== 'projectId') {
             // @ts-ignore
            const value = updatedTransaction[typedKey];
            row.set(typedKey, value !== undefined ? value : '');
        }
    });

    await row.save();

    // Also update common items if necessary
    const projectsSheet = await getProjectsSheet();
    if (projectsSheet) {
        const projectRows = await projectsSheet.getRows({ cache: 'reload' });
        const projectRow = projectRows.find(p => p.get('id') === projectId);
        if (projectRow) {
            const commonItemsKey = updatedTransaction.type === 'income' ? 'commonIncomeItems' : 'commonExpenseItems';
            const currentItems = (projectRow.get(commonItemsKey) as string || '').split(',').filter(Boolean);
            if (!currentItems.includes(updatedTransaction.item)) {
                currentItems.push(updatedTransaction.item);
                projectRow.set(commonItemsKey, currentItems.join(','));
                await projectRow.save();
            }
        }
    }
    
    revalidateTag('projects');
}

export async function deleteTransaction(projectId: string, transactionId: string): Promise<void> {
    const sheet = await getTransactionsSheet();
    if (!sheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(row => row.get('id') === transactionId && row.get('projectId') === projectId);

    if (rowToDelete) {
        await rowToDelete.delete();
    } else {
        throw new Error("找不到指定的紀錄");
    }
    revalidateTag('projects');
}

// --- Common Item Functions ---

export async function deleteCommonItem(projectId: string, itemType: 'income' | 'expense', itemToDelete: string): Promise<void> {
    const projectsSheet = await getProjectsSheet();
    if (!projectsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const projectRows = await projectsSheet.getRows({ cache: 'reload' });
    const projectRow = projectRows.find(p => p.get('id') === projectId);

    if (!projectRow) {
        throw new Error("找不到指定的活動");
    }

    const commonItemsKey = itemType === 'income' ? 'commonIncomeItems' : 'commonExpenseItems';
    let currentItems = (projectRow.get(commonItemsKey) as string || '').split(',').filter(Boolean);
    currentItems = currentItems.filter(item => item !== itemToDelete);
    projectRow.set(commonItemsKey, currentItems.join(','));
    await projectRow.save();
    revalidateTag('projects');
}

export async function clearCommonItems(projectId: string, itemType: 'income' | 'expense'): Promise<void> {
    const projectsSheet = await getProjectsSheet();
    if (!projectsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }
    
    const projectRows = await projectsSheet.getRows({ cache: 'reload' });
    const projectRow = projectRows.find(p => p.get('id') === projectId);
    
    if (!projectRow) {
        throw new Error("找不到指定的活動");
    }

    const commonItemsKey = itemType === 'income' ? 'commonIncomeItems' : 'commonExpenseItems';
    projectRow.set(commonItemsKey, '');
    await projectRow.save();
    revalidateTag('projects');
}
