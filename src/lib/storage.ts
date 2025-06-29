
'use server'
import { unstable_cache, revalidateTag } from 'next/cache';
import { getProjectsSheet, getTransactionsSheet } from './google-sheets';
import type { Project, Transaction, ProjectData, TransactionData } from './types';
import { isTextFullySupported } from './font-utils';

const ADMIN_CONFIG_ID = '__ADMIN_CONFIG__';

// --- Helper Functions for Data Parsing ---
async function parseProject(row: any): Promise<Project> {
    const name = row.get('name') as string;
    const useKiwiMaru = row.get('useKiwiMaru') === 'TRUE';
    
    // 檢查名稱是否完全支援 Kiwi Maru 字體
    const kiwiMaruSupported = useKiwiMaru ? await isTextFullySupported(name) : false;
    
    return {
        id: row.get('id') as string,
        name,
        passcode: String(row.get('passcode') || ''),
        useKiwiMaru,
        kiwiMaruSupported,
        commonIncomeItems: (row.get('commonIncomeItems') as string || '').split(',').filter(Boolean),
        commonExpenseItems: (row.get('commonExpenseItems') as string || '').split(',').filter(Boolean),
        transactions: [], // This will be populated separately
    };
}

function parseTransaction(row: any): Transaction {
    const amountStr = row.get('amount');
    const countStr = row.get('count');
    const projectId = row.get('projectId') as string;
    
    const transaction: Transaction = {
        id: row.get('id') as string,
        projectId,
        type: row.get('type') as 'income' | 'expense',
        date: row.get('date') as string,
        person: row.get('person') as string,
        item: row.get('item') as string,
        amount: amountStr ? parseInt(amountStr, 10) : 0,
        notes: (row.get('notes') as string) || '',
        count: countStr ? parseInt(countStr, 10) : undefined,
        voucherType: row.get('voucherType') as '發票' | '收據' | '其他' | undefined,
    };
    
    return transaction;
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
    if (!projectsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const rows = await projectsSheet.getRows();
    const projectPromises = rows.map(row => parseProject(row));
    const projects = await Promise.all(projectPromises);
    
    // 過濾掉管理員配置行
    return projects.filter(project => project.id !== ADMIN_CONFIG_ID);
}, ['projects'], { tags: ['projects'] });

export async function getProjectById(projectId: string): Promise<Project | null> {
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    
    // 獲取該項目的交易記錄
    // 獲取該項目的交易記錄
    const transactionsSheet = await getTransactionsSheet();
    if (!transactionsSheet) {
        return {
            ...project,
            transactions: []
        };
    }
    
    const rows = await transactionsSheet.getRows({
        offset: 1,
        limit: 1000,
    });
    
    const transactions: Transaction[] = rows
        .map(parseTransaction)
        .filter(t => t.projectId === projectId);
        
    return {
        ...project,
        transactions
    };
}

export async function addProject(newProjectData: ProjectData): Promise<Project> {
    // 確保 kiwiMaruSupported 和 useKiwiMaru 是布林值
    const kiwiMaruSupported = Boolean(newProjectData.kiwiMaruSupported);
    const useKiwiMaru = Boolean(newProjectData.useKiwiMaru);
    
    console.log('新增專案 - 字型支援狀態:', { 
        kiwiMaruSupported,
        useKiwiMaru,
        inputData: newProjectData 
    });
    const sheet = await getProjectsSheet();
    if (!sheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }
    const newId = crypto.randomUUID();
    
    // 初始化 commonItems 為空陣列
    const commonIncomeItems = newProjectData.commonIncomeItems || [];
    const commonExpenseItems = newProjectData.commonExpenseItems || [];

    const project: Project = {
        id: newId,
        name: newProjectData.name,
        passcode: newProjectData.passcode,
        useKiwiMaru,
        kiwiMaruSupported,
        transactions: [],
        commonIncomeItems,
        commonExpenseItems,
    };

    const newRowData = {
        id: newId,
        name: newProjectData.name,
        passcode: `'${newProjectData.passcode}`,
        useKiwiMaru: useKiwiMaru ? 'TRUE' : 'FALSE',
        kiwiMaruSupported: kiwiMaruSupported ? 'TRUE' : 'FALSE',
        commonIncomeItems: commonIncomeItems.join(','),
        commonExpenseItems: commonExpenseItems.join(','),
    };
    
    console.log('準備寫入 Google Sheets 的資料:', {
        ...newRowData,
        passcode: '***' // 隱藏密碼
    });
    
    console.log('新增專案資料:', {
        ...newRowData,
        passcode: '***' // 隱藏密碼
    });

    const newRow = await sheet.addRow(newRowData);
    
    revalidateTag('projects');
    return project;
}

export async function updateProject(projectId: string, updatedProjectData: Partial<ProjectData>): Promise<void> {
    // 如果更新了名稱或 useKiwiMaru 設置，則檢查字體支援
    if (updatedProjectData.name !== undefined || updatedProjectData.useKiwiMaru !== undefined) {
        const projectsSheet = await getProjectsSheet();
        if (!projectsSheet) {
            throw new Error('無法載入 Google Sheet');
        }
        
        const rows = await projectsSheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === projectId);
        
        if (rowIndex !== -1) {
            const currentName = updatedProjectData.name || rows[rowIndex].get('name');
            const useKiwiMaru = updatedProjectData.useKiwiMaru !== undefined ? 
                updatedProjectData.useKiwiMaru : 
                rows[rowIndex].get('useKiwiMaru') === 'TRUE';
            
            // 檢查名稱是否完全支援 Kiwi Maru 字體
            updatedProjectData.kiwiMaruSupported = useKiwiMaru ? 
                await isTextFullySupported(currentName) : false;
        }
    }
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

    const newTransactionId = crypto.randomUUID();
    // 創建符合 Google Sheets 格式的資料對象
    const rowData: Record<string, any> = {
        id: newTransactionId,
        projectId,
        type: transactionData.type,
        date: transactionData.date,
        person: transactionData.person,
        item: transactionData.item,
        amount: transactionData.amount || 0,
        notes: transactionData.notes || '',
    };
    
    // 只有當這些屬性存在時才添加
    if (transactionData.count !== undefined) {
        rowData.count = transactionData.count;
    }
    if (transactionData.voucherType) {
        rowData.voucherType = transactionData.voucherType;
    }
    
    // 添加行到 Google Sheet
    await transactionsSheet.addRow(rowData);
    
    // 創建並返回完整的交易對象
    const newTransaction: Transaction = {
        id: newTransactionId,
        projectId,
        type: transactionData.type,
        date: transactionData.date,
        person: transactionData.person,
        item: transactionData.item,
        amount: transactionData.amount || 0,
        notes: transactionData.notes || '',
        count: transactionData.count,
        voucherType: transactionData.voucherType,
    };

    // Update common items
    const commonItemsKey = transactionData.type === 'income' ? 'commonIncomeItems' : 'commonExpenseItems';
    const currentItems = (projectRow.get(commonItemsKey) as string || '').split(',').filter(Boolean);
    if (!currentItems.includes(transactionData.item)) {
        currentItems.push(transactionData.item);
        projectRow.set(commonItemsKey, currentItems.join(','));
        await projectRow.save();
    }

    revalidateTag('projects');

    // 返回完整的交易對象
    return {
        id: newTransactionId,
        projectId,
        type: transactionData.type,
        date: transactionData.date,
        person: transactionData.person,
        item: transactionData.item,
        amount: transactionData.amount || 0,
        notes: transactionData.notes || '',
        count: transactionData.count,
        voucherType: transactionData.voucherType,
    };
}

export async function updateTransaction(projectId: string, updatedTransaction: Transaction): Promise<void> {
    const transactionsSheet = await getTransactionsSheet();
    if (!transactionsSheet) {
        throw new Error("Google Sheets is not configured on the server.");
    }

    const rows = await transactionsSheet.getRows({
        offset: 1,
        limit: 1000,
    });
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
