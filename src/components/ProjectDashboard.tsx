
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Project, Transaction, TransactionData } from '@/lib/types';
import { getProjectById, addTransaction as apiAddTransaction, updateTransaction as apiUpdateTransaction, deleteTransaction as apiDeleteTransaction } from '@/lib/storage';
import TransactionForm from './TransactionForm';
import TransactionTable from './TransactionTable';
import StatisticsDisplay from './StatisticsDisplay';
import TransactionChart from './TransactionChart';
import { Button } from '@/components/ui/button';
import { Undo2, AlertTriangle, FileDown, TrendingUp, TrendingDown, LogOut, MoreHorizontal, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as RUIDialogTitle, DialogDescription as RUIDialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { exportProjectToExcel } from '@/lib/exportUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

interface ProjectDashboardProps {
  projectId: string;
}

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdminContext, setIsAdminContext] = useState(false);
  const [activeTab, setActiveTab] = useState('income');
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionIdToDelete, setTransactionIdToDelete] = useState<string | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const loadProjectData = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedProject = await getProjectById(projectId);

      if (loadedProject) {
        setProject(loadedProject);
        setTransactions(loadedProject.transactions);
      } else {
        toast({ title: "錯誤", description: "活動不存在或無法載入。", variant: "destructive" });
        router.push('/');
      }
    } catch (error) {
        console.error("Failed to load project data:", error);
        toast({ title: "錯誤", description: "載入活動資料失敗。", variant: "destructive" });
        router.push('/');
    } finally {
        setIsLoading(false);
    }
  }, [projectId, router, toast]);

  useEffect(() => {
    loadProjectData();
    const fromAdminParam = searchParams.get('fromAdmin');
    setIsAdminContext(fromAdminParam === 'true');
  }, [loadProjectData, searchParams]);


  const handleSaveTransaction = async (data: TransactionData, typeToSave: 'income' | 'expense', editingId?: string) => {
    setIsSubmitting(true);
    try {
      if (project) {
        if (editingId) {
          const transactionToUpdate: Transaction = { ...data, id: editingId };
          await apiUpdateTransaction(project.id, transactionToUpdate);
          toast({ title: "成功", description: `紀錄已成功更新。` });
        } else {
          await apiAddTransaction(project.id, data);
          toast({ title: "成功", description: `紀錄已成功新增。` });
        }
        await loadProjectData(); // Refresh data
        setIsEditModalOpen(false);
        setEditingTransaction(null);
      }
    } catch (error) {
      toast({ title: "錯誤", description: `儲存紀錄失敗: ${(error as Error).message}`, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    if (!transactionId) {
      toast({
        title: "錯誤",
        description: "無法刪除紀錄：交易 ID 無效。",
        variant: "destructive",
      });
      return;
    }
    setTransactionIdToDelete(transactionId);
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteTransaction = async () => {
    if (!project || !transactionIdToDelete) {
      toast({ title: "錯誤", description: "刪除操作無法完成，缺少必要資訊。", variant: "destructive" });
      setIsDeleteConfirmOpen(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await apiDeleteTransaction(project.id, transactionIdToDelete);
      toast({ title: "成功", description: "紀錄已刪除。" });
      await loadProjectData(); // Refresh data
    } catch (error) {
      toast({ title: "錯誤", description: `刪除紀錄時發生預期外的錯誤: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsDeleteConfirmOpen(false);
      setTransactionIdToDelete(null);
      setIsSubmitting(false);
    }
  };

  const handleExportCurrentProject = async () => {
    if (project) {
        setIsLoading(true);
        try {
            const freshProjectData = await getProjectById(project.id);
            if (freshProjectData) {
                exportProjectToExcel(freshProjectData, freshProjectData.transactions);
                toast({ title: "成功", description: `活動 "${freshProjectData.name}" 已匯出為 Excel 檔案。`});
            } else {
                toast({ title: "錯誤", description: "無法獲取最新的專案資料進行匯出。", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "錯誤", description: `匯出失敗: ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    } else {
        toast({ title: "錯誤", description: "找不到專案資料，無法匯出。", variant: "destructive" });
    }
  };


  const totalIncome = useMemo(() =>
    transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0,
  [transactions]);

  const totalExpenses = useMemo(() =>
    transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0,
  [transactions]);

  const balance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  const totalAttendees = useMemo(() =>
    transactions
      .filter(t => t.type === 'income' && typeof t.count === 'number' && t.count > 0)
      .reduce((sum, t) => sum + (t.count ?? 0), 0) || 0,
  [transactions]);

  if (isLoading && !project) {
    return <div className="flex items-center justify-center h-screen font-body">讀取活動資料中...</div>;
  }

  if (!project) {
    return <div className="flex items-center justify-center h-screen font-body">活動無法載入或不存在。</div>;
  }

  const commonIncomeItems = project.commonIncomeItems.sort((a,b) => a.localeCompare(b));
  const commonExpenseItems = project.commonExpenseItems.sort((a,b) => a.localeCompare(b));

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 font-body animate-fade-in pb-24 md:pb-8 md:p-8">
        <header className="mb-8">
            <div 
              className="relative bg-card border-y border-border py-4 paper-tape-decorator paper-tape-top-left paper-tape-bottom-right z-0"
              style={{ '--tape-color': 'hsla(var(--chart-3) / 0.6)' } as React.CSSProperties}
            >
                <div className="text-center">
                    <h1 className={cn(
                        "text-3xl sm:text-4xl text-foreground/90 tracking-wider font-medium",
                        project.useKiwiMaru ? "font-headline" : "font-body"
                      )}>
                        {project.name}
                    </h1>
                    <p className="text-center text-sm text-muted-foreground font-body mt-1">收支詳細記錄</p>
                </div>
            </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/5 lg:flex-shrink-0">
              <Card className={cn(
                  "overflow-hidden border-2 border-t-4 transition-colors",
                  activeTab === 'income' ? "border-chart-1" : "border-chart-2"
              )}>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 rounded-none bg-card p-0">
                          <TabsTrigger
                            value="income"
                            className="flex-1 rounded-none border-b-2 p-4 shadow-none data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground data-[state=active]:border-chart-1 data-[state=active]:text-chart-1 data-[state=active]:font-semibold bg-transparent hover:bg-transparent focus:shadow-none transition-none"
                          >
                                <TrendingUp className="mr-2 h-5 w-5" />
                                收入
                          </TabsTrigger>
                          <TabsTrigger
                            value="expense"
                            className="flex-1 rounded-none border-b-2 p-4 shadow-none data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground data-[state=active]:border-chart-2 data-[state=active]:text-chart-2 data-[state=active]:font-semibold bg-transparent hover:bg-transparent focus:shadow-none transition-none"
                          >
                              <TrendingDown className="mr-2 h-5 w-5" />
                              支出
                          </TabsTrigger>
                      </TabsList>
                      <TabsContent value="income" className="p-4 sm:p-6">
                          <TransactionForm
                              formType="income"
                              onSave={handleSaveTransaction}
                              isLoading={isSubmitting}
                              commonItems={commonIncomeItems}
                              projectId={project.id}
                              onCommonItemsChange={loadProjectData}
                          />
                      </TabsContent>
                      <TabsContent value="expense" className="p-4 sm:p-6">
                          <TransactionForm
                              formType="expense"
                              onSave={handleSaveTransaction}
                              isLoading={isSubmitting}
                              commonItems={commonExpenseItems}
                              projectId={project.id}
                              onCommonItemsChange={loadProjectData}
                          />
                      </TabsContent>
                  </Tabs>
              </Card>
          </div>
          <div className="flex-1 space-y-6">
            <StatisticsDisplay
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              balance={balance}
              totalAttendees={totalAttendees}
            />
            <Card className="shadow-lg overflow-hidden">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">
                      <span>收支紀錄清單</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <TransactionTable 
                        transactions={transactions} 
                        onEdit={handleEditTransaction} 
                        onDelete={handleDeleteTransaction}
                    />
                </CardContent>
            </Card>
            <TransactionChart transactions={transactions} />
          </div>
        </div>
        
        <Dialog open={isEditModalOpen} onOpenChange={(isOpen) => {
          setIsEditModalOpen(isOpen);
          if (!isOpen) {
            setEditingTransaction(null);
          }
        }}>
          <DialogContent className="sm:max-w-lg font-body">
            <DialogHeader>
              <RUIDialogTitle>{editingTransaction?.type === 'income' ? '編輯收入' : '編輯支出'}</RUIDialogTitle>
              {editingTransaction && (
                <RUIDialogDescription>
                  修改您的 {editingTransaction.type === 'income' ? '收入' : '支出'} 詳細資訊。
                </RUIDialogDescription>
              )}
            </DialogHeader>
            {editingTransaction && project && (
              <TransactionForm
                formType={editingTransaction.type}
                onSave={handleSaveTransaction}
                isLoading={isSubmitting}
                commonItems={(editingTransaction.type === 'income' ? commonIncomeItems : commonExpenseItems)}
                projectId={project.id}
                onCommonItemsChange={loadProjectData}
                editingTransaction={editingTransaction}
                onCancelEdit={() => {
                  setIsEditModalOpen(false);
                  setEditingTransaction(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                確認刪除紀錄
              </AlertDialogTitle>
              <AlertDialogDescription>
                您確定要刪除這筆紀錄嗎？此操作無法復原。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTransactionIdToDelete(null)} disabled={isSubmitting}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={executeDeleteTransaction} disabled={isSubmitting}>{isSubmitting ? "刪除中..." : "確認刪除"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {project.name} - FlowKeep</p>
        </footer>

      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative z-50">
           <div className={cn(
              "absolute bottom-[4.5rem] right-0 flex flex-col items-center gap-2 transition-all duration-300 ease-in-out",
              isMenuOpen ? "opacity-100" : "opacity-0 -translate-y-4 pointer-events-none"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" onClick={() => { handleExportCurrentProject(); setIsMenuOpen(false); }} aria-label="匯出 Excel" disabled={isLoading || isSubmitting}
                    style={{ backgroundColor: 'hsla(var(--button-logout-bg))', color: 'hsla(var(--button-logout-fg))', border: '1px solid hsla(var(--button-logout-border))'}}
                    className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
                  >
                    <FileDown className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>匯出 Excel</p></TooltipContent>
              </Tooltip>
              {isAdminContext && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon" onClick={() => { router.push('/admin'); setIsMenuOpen(false); }} aria-label="返回活動管理" disabled={isLoading || isSubmitting}
                      style={{ backgroundColor: 'hsla(var(--button-back-bg))', color: 'hsla(var(--button-back-fg))', border: '1px solid hsla(var(--button-back-border))'}}
                      className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
                    >
                      <Undo2 className="h-6 w-6" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left"><p>返回活動管理</p></TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" onClick={() => { router.push('/'); setIsMenuOpen(false); }} aria-label="登出" disabled={isLoading || isSubmitting}
                    style={{ backgroundColor: 'hsla(var(--button-exit-bg))', color: 'hsla(var(--button-exit-fg))', border: '1px solid hsla(var(--button-exit-border))'}}
                    className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
                  >
                    <LogOut className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>登出</p></TooltipContent>
              </Tooltip>
           </div>
           
           <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMenuOpen ? "destructive" : "balance"}
                size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="開啟選單"
                className="h-12 w-12 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              >
                <div className="relative flex h-full w-full items-center justify-center">
                    <X className={cn('absolute h-6 w-6 transition-all duration-300 ease-in-out', isMenuOpen ? 'rotate-0 scale-100' : '-rotate-180 scale-0')} />
                    <MoreHorizontal className={cn('absolute h-6 w-6 transition-all duration-300 ease-in-out', isMenuOpen ? 'rotate-180 scale-0' : 'rotate-0 scale-100')} />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left"><p>選單</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
