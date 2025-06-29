
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
import { getProjects, addProject as apiAddProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, getAdminPasscode } from '@/lib/storage';
import { changeAdminPasscode } from '@/app/actions';

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

  const handleSaveProject = async () => {
    const trimmedName = projectName.trim();
    const trimmedPasscode = projectPasscode.trim();
    
    if (!trimmedName || !trimmedPasscode) {
      toast({ title: "錯誤", description: "請填寫活動名稱和密碼。", variant: "destructive", duration: 2000 });
      return;
    }

    if (trimmedPasscode.length < 3 || trimmedPasscode.length > 8) {
      toast({ title: "錯誤", description: "活動密碼長度必須介於 3 到 8 位之間。", variant: "destructive", duration: 2000 });
      return;
    }
    
    setIsLoading(true);
  
    try {
      const adminPass = await getAdminPasscode();
      if (trimmedPasscode === adminPass) {
        toast({ title: "錯誤", description: "活動密碼不能與管理員密碼相同。", variant: "destructive", duration: 2000 });
        setIsLoading(false);
        return;
      }
      
      const allProjects = await getProjects();
      const isEditing = !!currentProject?.id;
  
      const otherProjects = isEditing
        ? allProjects.filter((p) => p.id !== currentProject!.id)
        : allProjects;
  
      if (otherProjects.some((p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        toast({ title: "錯誤", description: "活動名稱已被使用。", variant: "destructive", duration: 2000 });
        setIsLoading(false);
        return;
      }
  
      if (otherProjects.some((p) => p.passcode === trimmedPasscode)) {
        toast({ title: "錯誤", description: "活動密碼已被其他活動使用。", variant: "destructive", duration: 2000 });
        setIsLoading(false);
        return;
      }

      // 驗證字型支援（僅提示，不阻止提交）
      try {
        const fontValidation = await validateEventName(trimmedName);
        if (!fontValidation.isValid) {
          setFontValidationError(fontValidation.message || '活動名稱包含不支援的字元');
          // 僅顯示警告，不阻止提交
          toast({
            title: "注意",
            description: "活動名稱包含不支援 Kiwi Maru 字型的字元，可能會影響顯示效果。",
            variant: "default",
            duration: 2000 // 2 秒後自動關閉
          });
        } else {
          setFontValidationError(null);
        }
      } catch (error) {
        console.error('字型驗證出錯:', error);
        // 即使驗證出錯也繼續執行，僅記錄錯誤
        setFontValidationError('字型驗證時發生錯誤，但不影響活動建立');
      }
      
      console.log(`活動名稱 "${trimmedName}" 已通過字型驗證`);
  
      // 重新驗證字型支援狀態，確保結果準確
      let isNameSupported = true;
      try {
        const validation = await validateEventName(trimmedName);
        isNameSupported = validation.isValid;
        console.log(`字型支援狀態: ${isNameSupported ? '支援' : '不支援'}`);
      } catch (error) {
        console.error('驗證字型時出錯:', error);
        isNameSupported = false;
      }
      
      // 如果字型不支援，強制關閉 useKiwiMaru
      const useKiwiMaru = isNameSupported; // 只有當字型支援時才啟用 Kiwi Maru
      
      const projectData: ProjectData = { 
        name: trimmedName, 
        passcode: trimmedPasscode,
        useKiwiMaru,
        kiwiMaruSupported: isNameSupported,
      };
      
      console.log('專案字型設定:', {
        useKiwiMaru,
        kiwiMaruSupported: isNameSupported,
        name: trimmedName
      });
      
      console.log('儲存的專案資料:', {
        ...projectData,
        passcode: '***' // 隱藏密碼
      });

      if (isEditing && currentProject?.id) {
        await apiUpdateProject(currentProject.id, projectData);
        toast({ title: "成功", description: "活動已更新。", duration: 2000 });
      } else {
        await apiAddProject(projectData);
        toast({ 
          title: "成功", 
          description: "活動已新增。",
          duration: 2000 // 2 秒後自動關閉
        });
      }
  
      await loadProjects();
      setIsAddEditDialogOpen(false);
      setCurrentProject(null);
      setProjectName('');
      setProjectPasscode('');
  
    } catch (error) {
      console.error("Failed to save project:", error);
      toast({ title: "錯誤", description: (error as Error).message, variant: "destructive", duration: 2000 });
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
      exportProjectToExcel(project, project.transactions);
      toast({ title: "成功", description: `活動 "${project.name}" 已匯出為 Excel 檔案。`, duration: 2000 });
    } catch (error) {
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
                <DialogTitle className="font-headline">{currentProject?.id ? '編輯活動' : '新增活動'}</DialogTitle>
                <DialogDescription>
                  {currentProject?.id ? '修改您的活動詳細資訊。' : '建立一個新的活動來追蹤收支。'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="projectName" className="text-right">活動名稱</Label>
                  <div className="col-span-3 relative">
                    <Input 
                      id="projectName" 
                      value={projectName} 
                      onChange={(e) => setProjectName(e.target.value)} 
                      className={`w-full ${fontValidationError ? 'border-red-500 pr-8' : ''}`} 
                      placeholder="例如：春季團建活動" 
                    />
                    {fontValidationError && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-4 w-4 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-sm text-red-600">{fontValidationError}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="projectPasscode" className="text-right">活動密碼</Label>
                  <Input id="projectPasscode" type="password" value={projectPasscode} onChange={(e) => setProjectPasscode(e.target.value)} className="col-span-3" placeholder="設定活動存取密碼" />
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
