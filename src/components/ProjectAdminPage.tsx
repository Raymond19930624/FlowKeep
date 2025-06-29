
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";

import type { Project, ProjectData } from '@/lib/types';
import { getProjects, getProjectById, addProject as apiAddProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, getAdminPasscode } from '@/lib/storage';
import { changeAdminPasscode } from '@/app/actions';
import { projectSchema, validateFormData } from '@/lib/validation';

import { PlusCircle, Edit3, Trash2, LogOut, Eye, EyeOff, FileTextIcon, AlertTriangle, LogIn, FileDown, MoreHorizontal, X, KeyRound } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportProjectToExcel } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import { validateEventName } from '@/lib/font-validator';

async function checkFontSupport(font: string, text: string): Promise<boolean> {
  if (!text || typeof window === 'undefined' || !document.fonts) {
    return true; // Fallback for SSR or unsupported browsers
  }
  try {
    await document.fonts.load(`1rem ${font}`, text);
    for (const char of text) {
      if (char.trim() === '') continue;
      if (!document.fonts.check(`1rem ${font}`, char)) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("Font check failed, falling back to default:", error);
    return false;
  }
}

const changePasscodeSchema = z.object({
  currentPasscode: z.string().min(1, { message: "請輸入目前密碼。" }),
  newPasscode: z.string().min(6, { message: "新密碼長度至少需要 6 位。" }),
  confirmNewPasscode: z.string()
}).refine(data => data.newPasscode === data.confirmNewPasscode, {
  message: "新密碼和確認密碼不相符。",
  path: ["confirmNewPasscode"],
});

export default function ProjectAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginPasscode, setLoginPasscode] = useState('');
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [fontValidationError, setFontValidationError] = useState<string | null>(null);
  const [showPasscodes, setShowPasscodes] = useState<Record<string, boolean>>({});

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Partial<Project> | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectPasscode, setProjectPasscode] = useState('');

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  
  const [isChangePasscodeDialogOpen, setIsChangePasscodeDialogOpen] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  // 檢查認證狀態 - 直接使用首頁的認證狀態
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedPasscode = localStorage.getItem('admin_passcode');
        const adminPasscode = await getAdminPasscode();
        setIsAuthenticated(savedPasscode === adminPasscode);
      } catch (error) {
        console.error('認證檢查出錯:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);
  
  // 處理登出
  const handleLogout = () => {
    localStorage.removeItem('admin_passcode');
    setIsAuthenticated(false);
    toast({ title: "已登出", duration: 2000 });
    // 登出後導回首頁
    router.push('/');
  };

  const changePasscodeForm = useForm<z.infer<typeof changePasscodeSchema>>({
    resolver: zodResolver(changePasscodeSchema),
    defaultValues: {
      currentPasscode: "",
      newPasscode: "",
      confirmNewPasscode: "",
    },
  });

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await getProjects();
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({ title: "錯誤", description: "無法載入活動列表。", variant: "destructive", duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 重置表單狀態
  const resetForm = useCallback(() => {
    setCurrentProject(null);
    setProjectName('');
    setProjectPasscode('');
    setFontValidationError(null);
  }, []);

  const handleOpenAddEditDialog = (project?: Project) => {
    // 先重置表單
    resetForm();
    
    // 如果是編輯模式，設置表單值
    if (project) {
      setCurrentProject(project);
      setProjectName(project.name);
      setProjectPasscode(project.passcode);
    }
    
    // 最後再打開對話框
    setIsAddEditDialogOpen(true);
  };

  const handleSaveProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmedName = projectName.trim();
    const trimmedPasscode = projectPasscode.trim();
    
    // 基本驗證
    if (!trimmedName || !trimmedPasscode) {
      toast({ title: "錯誤", description: "請填寫所有必填欄位。", variant: "destructive", duration: 2000 });
      return;
    }

    // 檢查密碼長度
    if (trimmedPasscode.length < 3 || trimmedPasscode.length > 8) {
      toast({ title: "錯誤", description: "活動密碼長度必須介於 3 到 8 位之間。", variant: "destructive", duration: 2000 });
      return;
    }
    
    // 檢查是否與管理員密碼相同
    try {
      const adminPass = await getAdminPasscode();
      if (trimmedPasscode === adminPass) {
        toast({ title: "錯誤", description: "活動密碼不能與管理員密碼相同。", variant: "destructive", duration: 2000 });
        return;
      }
    } catch (error) {
      console.error('獲取管理員密碼時出錯:', error);
    }

    // 檢查是否已存在相同名稱的活動
    const otherProjects = projects.filter((p) => p.id !== (currentProject?.id || ''));
    if (otherProjects.some((p) => p.name === trimmedName)) {
      toast({ title: "錯誤", description: "已存在相同名稱的活動。", variant: "destructive", duration: 2000 });
      return;
    }

    // 檢查是否已存在相同密碼的活動
    if (otherProjects.some((p) => p.passcode === trimmedPasscode)) {
      toast({ title: "錯誤", description: "活動密碼已被其他活動使用。", variant: "destructive", duration: 2000 });
      return;
    }

    // 驗證字型支援（僅提示，不阻止提交）
    let isNameSupported = true;
    try {
      const fontValidation = await validateEventName(trimmedName);
      isNameSupported = fontValidation.isValid;
      
      if (!isNameSupported) {
        setFontValidationError(fontValidation.message || '活動名稱包含不支援的字元');
        // 僅顯示警告，不阻止提交
        toast({
          title: "注意",
          description: "活動名稱包含不支援 Kiwi Maru 字型的字元，將使用預設字體顯示。",
          variant: "default",
          duration: 2000
        });
      } else {
        setFontValidationError(null);
      }
    } catch (error) {
      console.error('字型驗證出錯:', error);
      isNameSupported = false;
      setFontValidationError('字型驗證時發生錯誤，將使用預設字體');
    }
    
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const projectData: Project = {
        id: currentProject?.id || crypto.randomUUID(),
        name: trimmedName,
        passcode: trimmedPasscode,
        useKiwiMaru: isNameSupported,
        kiwiMaruSupported: isNameSupported,
        commonIncomeItems: currentProject?.commonIncomeItems || [],
        commonExpenseItems: currentProject?.commonExpenseItems || [],
        transactions: currentProject?.transactions || [],
        createdAt: currentProject?.createdAt || now,
        updatedAt: now
      };

      if (currentProject?.id) {
        await apiUpdateProject(currentProject.id, projectData);
        toast({ title: "成功", description: "活動已更新。", duration: 2000 });
      } else {
        await apiAddProject(projectData);
        toast({ 
          title: "成功", 
          description: "活動已新增。",
          duration: 2000
        });
      }
  
      await loadProjects();
      setIsAddEditDialogOpen(false);
      setCurrentProject(null);
      setProjectName('');
      setProjectPasscode('');
    } catch (error) {
      console.error("Failed to save project:", error);
      toast({ 
        title: "錯誤", 
        description: error instanceof Error ? error.message : '發生未知錯誤', 
        variant: "destructive", 
        duration: 2000 
      });
    } finally {
      setIsLoading(false);
    }
  };


  const openDeleteConfirmDialog = (projectId: string) => {
    setProjectToDeleteId(projectId);
    setDeleteConfirmInput('');
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDeleteId) return;
    setIsLoading(true);
  
    try {
      const projectToVerify = projects.find(p => p.id === projectToDeleteId);
  
      if (!projectToVerify) {
        toast({ title: "錯誤", description: "找不到要刪除的活動。", variant: "destructive", duration: 2000 });
        setIsDeleteConfirmDialogOpen(false);
        setIsLoading(false);
        return;
      }
  
      if (deleteConfirmInput === projectToVerify.passcode) {
        await apiDeleteProject(projectToDeleteId);
        toast({ 
          title: "成功", 
          description: "活動已刪除。",
          duration: 2000 // 2 秒後自動關閉
        });
        await loadProjects();
        setIsDeleteConfirmDialogOpen(false);
        setProjectToDeleteId(null);
        setDeleteConfirmInput('');
      } else {
        toast({ title: "錯誤", description: "活動密碼錯誤，刪除失敗。", variant: "destructive", duration: 2000 });
      }
    } catch (error) {
      toast({ title: "錯誤", description: (error as Error).message, variant: "destructive", duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };


  const togglePasscodeVisibility = (projectId: string) => {
    setShowPasscodes(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const navigateToProject = (projectId: string) => {
    router.push(`/${projectId}?fromAdmin=true`);
  };

  const handleExportProject = async (project: Project) => {
    setIsLoading(true);
    try {
      // 先獲取完整的專案數據（包括交易記錄）
      const fullProject = await getProjectById(project.id);
      if (!fullProject) {
        throw new Error('無法獲取專案數據');
      }
      exportProjectToExcel(fullProject, fullProject.transactions);
      toast({ title: "成功", description: `活動 "${fullProject.name}" 已匯出為 Excel 檔案。`, duration: 2000 });
    } catch (error) {
      console.error("匯出失敗:", error);
      toast({ title: "錯誤", description: `匯出失敗: ${(error as Error).message}`, variant: "destructive", duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  const onPasscodeChangeSubmit = async (values: z.infer<typeof changePasscodeSchema>) => {
    setIsLoading(true);
    const result = await changeAdminPasscode({
      currentPasscode: values.currentPasscode,
      newPasscode: values.newPasscode,
    });
    setIsLoading(false);

    if (result.success) {
      toast({ title: "成功", description: result.message, duration: 2000 });
      setIsChangePasscodeDialogOpen(false);
      changePasscodeForm.reset();
    } else {
      toast({ title: "錯誤", description: result.message, variant: "destructive", duration: 2000 });
    }
  };


  if (isLoading && projects.length === 0) {
    return <div className="flex items-center justify-center h-screen font-body">讀取中...</div>;
  }

  // 顯示載入中
  if (isAuthenticated === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8 font-body animate-fade-in pb-24 md:pb-8">
        <header className="mb-8">
            <div 
              className="relative bg-card border-y border-border py-4 paper-tape-decorator paper-tape-top-left paper-tape-bottom-right z-0"
              style={{ '--tape-color': 'hsla(255, 60%, 95%, 0.7)' } as React.CSSProperties}
            >
                <div className="text-center">
                    <h1 className="font-headline text-3xl sm:text-4xl text-foreground/90 tracking-wider font-medium">
                        活動管理
                    </h1>
                    <p className="text-center text-sm text-muted-foreground font-noto-sans mt-1">建立、編輯或刪除你的活動</p>
                </div>
            </div>
        </header>
        
        <Card className="shadow-xl overflow-hidden rounded-lg">
          <CardContent className="p-0 sm:p-2 md:p-4 lg:p-6">
            {projects.length === 0 && !isLoading ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileTextIcon className="mx-auto h-12 w-12 mb-4" />
                <p>目前沒有任何活動。</p>
                <p>點擊右下角的「新增活動」按鈕開始建立吧！</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b hover:bg-transparent">
                      <TableHead className="font-semibold">活動名稱</TableHead>
                      <TableHead className="w-[120px] text-center font-semibold md:w-[150px]">活動密碼</TableHead>
                      <TableHead className="w-[50px] text-right font-semibold md:w-[150px]"><span className="sr-only">操作</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id} className="hover:bg-transparent">
                        <TableCell className="font-bold break-words whitespace-normal font-noto-sans">{project.name}</TableCell>
                        <TableCell className="w-[120px] md:w-[150px] text-right md:text-center">
                          <div className="flex items-center justify-end md:justify-center">
                            <span className="font-code w-[9ch] text-left">{showPasscodes[project.id] ? project.passcode : '••••••••'}</span>
                            <span className="inline-flex">
                              <Button variant="ghost" size="icon" onClick={() => togglePasscodeVisibility(project.id)} aria-label={showPasscodes[project.id] ? "隱藏密碼" : "顯示密碼"} disabled={isLoading} className="hover:bg-transparent">
                                {showPasscodes[project.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="w-[50px] text-right md:w-[150px]">
                          <div className="hidden md:flex justify-end space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => navigateToProject(project.id)} aria-label="進入" className="text-muted-foreground hover:bg-transparent hover:text-chart-1-darker">
                                  <LogIn className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>進入</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenAddEditDialog(project)} aria-label="編輯" className="text-muted-foreground hover:bg-transparent hover:text-chart-3-darker">
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>編輯</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleExportProject(project)} aria-label="匯出" className="text-muted-foreground hover:bg-transparent hover:text-chart-4-darker">
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>匯出</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmDialog(project.id)} aria-label="刪除" className="text-muted-foreground hover:bg-transparent hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>刪除</p></TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="md:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">更多操作</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[5rem]">
                                <DropdownMenuItem onClick={() => navigateToProject(project.id)} className="text-chart-1-darker focus:text-chart-1-darker focus:bg-chart-1/10 gap-2">
                                  <LogIn className="h-4 w-4" />
                                  <span>進入</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenAddEditDialog(project)} className="text-chart-3-darker focus:text-chart-3-darker focus:bg-chart-3/10 gap-2">
                                  <Edit3 className="h-4 w-4" />
                                  <span>編輯</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportProject(project)} className="text-chart-4-darker focus:text-chart-4-darker focus:bg-chart-4/10 gap-2">
                                  <FileDown className="h-4 w-4" />
                                  <span>匯出</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDeleteConfirmDialog(project.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2">
                                  <Trash2 className="h-4 w-4" />
                                  <span>刪除</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddEditDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
            // 關閉對話框時重置表單
            resetForm();
          }
          setIsAddEditDialogOpen(isOpen);
        }}>
          <DialogContent className="sm:max-w-[425px] font-body">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }}>
              <DialogHeader>
                <DialogTitle>{currentProject ? '編輯活動' : '新增活動'}</DialogTitle>
                <DialogDescription>
                  {currentProject ? '更新活動資訊' : '建立一個新的活動'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    活動名稱
                  </Label>
                  <Input
                    id="name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="col-span-3"
                    placeholder="請輸入活動名稱"
                    required
                  />
                </div>
                {fontValidationError && (
                  <div className="text-red-500 text-sm -mt-2 col-span-4 text-right">
                    {fontValidationError}
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="passcode" className="text-right">
                    活動密碼
                  </Label>
                  <Input
                    id="passcode"
                    type="password"
                    value={projectPasscode}
                    onChange={(e) => setProjectPasscode(e.target.value)}
                    className="col-span-3"
                    placeholder="請輸入活動密碼 (3-8位)"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>取消</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading}>{isLoading ? "儲存中..." : "儲存變更"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => {
            setIsDeleteConfirmDialogOpen(isOpen);
            if (!isOpen) {
                setProjectToDeleteId(null);
                setDeleteConfirmInput('');
            }
        }}>
            <DialogContent className="sm:max-w-[425px] font-body">
              <form onSubmit={(e) => { e.preventDefault(); handleConfirmDeleteProject(); }}>
                <DialogHeader>
                    <DialogTitle className="font-headline flex items-center">
                      <AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> 確認刪除活動
                      </DialogTitle>
                    <DialogDescription className="break-words">
                        此操作無法復原。請輸入活動密碼以確認刪除活動：<br />
                        <span className="font-sans font-medium" style={{ fontFamily: '"Noto Sans TC", sans-serif' }}>
                            「{projects.find(p => p.id === projectToDeleteId)?.name}」
                        </span>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="deleteConfirmPasscode" className="text-right">活動密碼</Label>
                        <Input
                          id="deleteConfirmPasscode"
                          type="password"
                          value={deleteConfirmInput}
                          onChange={(e) => setDeleteConfirmInput(e.target.value)}
                          className="col-span-3"
                          placeholder="輸入活動密碼"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isLoading}>取消</Button>
                    </DialogClose>
                    <Button type="submit" variant="destructive" disabled={isLoading}>{isLoading ? "刪除中..." : "確認刪除"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
        </Dialog>

        <Dialog open={isChangePasscodeDialogOpen} onOpenChange={(isOpen) => {
            setIsChangePasscodeDialogOpen(isOpen);
            if (!isOpen) changePasscodeForm.reset();
        }}>
          <DialogContent className="sm:max-w-[425px] font-body">
            <Form {...changePasscodeForm}>
              <form onSubmit={changePasscodeForm.handleSubmit(onPasscodeChangeSubmit)}>
                <DialogHeader>
                  <DialogTitle className="font-headline">修改管理員密碼</DialogTitle>
                  <DialogDescription>
                    請輸入您目前的管理員密碼，以及新的密碼。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <FormField
                    control={changePasscodeForm.control}
                    name="currentPasscode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>目前密碼</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="請輸入目前密碼" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasscodeForm.control}
                    name="newPasscode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新密碼</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="長度至少6位" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasscodeForm.control}
                    name="confirmNewPasscode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>確認新密碼</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="再次輸入新密碼" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isLoading}>取消</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isLoading}>{isLoading ? '更新中...' : '更新密碼'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FlowKeep Admin</p>
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
                    size="icon" onClick={() => { handleOpenAddEditDialog(); setIsMenuOpen(false); }} aria-label="新增活動" disabled={isLoading}
                    style={{ backgroundColor: 'hsla(var(--button-add-bg))', color: 'hsla(var(--button-add-fg))', border: '1px solid hsla(var(--button-add-border))'}}
                    className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
                  >
                    <PlusCircle className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>新增活動</p></TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" onClick={() => { setIsChangePasscodeDialogOpen(true); setIsMenuOpen(false); }} aria-label="修改管理員密碼"
                    style={{ backgroundColor: 'hsla(var(--button-back-bg))', color: 'hsla(var(--button-back-fg))', border: '1px solid hsla(var(--button-back-border))'}}
                    className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
                  >
                    <KeyRound className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>修改管理員密碼</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" onClick={() => { router.push('/'); setIsMenuOpen(false); }} aria-label="登出"
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
