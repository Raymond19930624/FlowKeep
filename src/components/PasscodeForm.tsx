
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getProjects } from '@/lib/storage';
import { verifyAdminPasscode } from '@/app/actions';
import type { Project } from '@/lib/types';
import WalletIcon from '@/components/icons/WalletIcon';

export default function PasscodeForm() {
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const fetchedProjects = await getProjects();
        setProjects(fetchedProjects);
      } catch (error) {
        console.error("Failed to load projects:", error);
        toast({
          title: "錯誤",
          description: "無法載入活動列表。",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, [toast]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!selectedProjectId) {
      toast({
        title: "提醒",
        description: "請先選擇一個活動。",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    const project = projects.find(p => p.id === selectedProjectId);

    if (project && project.passcode === passcode) {
      router.push(`/${project.id}`);
    } else {
      toast({
        title: "錯誤",
        description: "密碼錯誤或活動不存在。",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const isValid = await verifyAdminPasscode(adminPasscode);
      if (isValid) {
        router.push('/admin');
      } else {
        toast({
          title: "錯誤",
          description: "管理員密碼錯誤。",
          variant: "destructive",
        });
        setAdminPasscode('');
      }
    } catch (error) {
       toast({
        title: "登入錯誤",
        description: "驗證時發生未知錯誤。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
        <Card className="w-full max-w-md shadow-lg paper-tape-decorator paper-tape-top-left paper-tape-bottom-right">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 text-primary">
              <WalletIcon className="w-16 h-16" />
            </div>
            <CardTitle className="font-headline text-3xl">FlowKeep</CardTitle>
            <CardDescription className="font-body">把活動變成故事，把收支寫成風景</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={isLoading}>
                  <SelectTrigger className="w-full font-body">
                    <SelectValue placeholder="請選擇活動..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="font-body">
                          {project.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="loading" disabled>
                        {isLoading ? "載入活動中..." : "沒有可用的活動"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="請輸入活動密碼"
                  required
                  className="font-body"
                  disabled={isLoading || !selectedProjectId}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4">
              <Button type="submit" variant="expense" className="w-full font-body" disabled={isLoading || !selectedProjectId}>
                進入活動
              </Button>
              <Button type="button" variant="income" className="w-full font-body" onClick={() => setIsAdminDialogOpen(true)}>
                活動管理
              </Button>
            </CardFooter>
          </form>
        </Card>
        <footer className="mt-8 text-center text-sm text-muted-foreground font-body">
          <p>&copy; {new Date().getFullYear()} FlowKeep. All rights reserved.</p>
          <p className="mt-1">為活動設計的收支紀錄工具。</p>
        </footer>
      </div>

      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-lg sm:max-w-[425px] font-body">
          <DialogHeader>
            <DialogTitle className="font-headline">活動管理登入</DialogTitle>
            <DialogDescription>
              請輸入管理員密碼以進入活動管理頁面。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-passcode" className="text-left">管理員密碼</Label>
                <Input
                  id="admin-passcode"
                  type="password"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="輸入管理員密碼"
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAdminDialogOpen(false)}>取消</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? "登入中..." : "登入"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
