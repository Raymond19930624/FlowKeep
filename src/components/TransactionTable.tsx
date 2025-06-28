
"use client";

import React, { useState, useRef } from 'react';
import type { Transaction } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { Trash2, Edit3, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";


interface TransactionTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
}

type SortKey = keyof Transaction | null;
type SortOrder = 'asc' | 'desc';

export default function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();

  const handleSort = (key: keyof Transaction) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedTransactions = React.useMemo(() => {
    if (!sortKey) return transactions;
    return [...transactions].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === undefined || valA === null) return sortOrder === 'asc' ? -1 : 1;
      if (valB === undefined || valB === null) return sortOrder === 'asc' ? 1 : -1;

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        if (sortKey === 'date') {
             comparison = new Date(valA).getTime() - new Date(valB).getTime();
        } else {
            comparison = valA.localeCompare(valB);
        }
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = valA === valB ? 0 : valA ? -1 : 1;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortKey, sortOrder]);

  const handleShowDetails = (transaction: Transaction) => {
    setDetailTransaction(transaction);
    setIsDetailDialogOpen(true);
  };

  const handlePressStart = (transaction: Transaction) => {
    longPressTimer.current = setTimeout(() => {
      handleShowDetails(transaction);
    }, 500); // 500ms for long press
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };


  const SortableHeader = ({ tKey, label, className }: { tKey: keyof Transaction; label: string, className?: string }) => (
    <TableHead 
      onClick={() => handleSort(tKey)} 
      className={cn("cursor-pointer", className)}
    >
      <div className={cn("flex items-center", 
        className?.includes('text-center') ? 'justify-center' : 
        className?.includes('text-right') ? 'justify-end' : 'justify-start'
      )}>
        {label}
        {sortKey === tKey && <ArrowUpDown className="ml-2 h-4 w-4" />}
      </div>
    </TableHead>
  );

  return (
    <TooltipProvider>
      <div className="overflow-hidden bg-card text-card-foreground">
        {transactions.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p>尚無任何紀錄。</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-0 bg-background hover:bg-background">
                <SortableHeader tKey="date" label="日期" className="w-[90px]" />
                <SortableHeader tKey="item" label="項目" />
                <SortableHeader tKey="person" label={"人員"} className="hidden sm:table-cell w-[100px]" />
                <SortableHeader tKey="amount" label="金額" className="w-[90px] text-right"/>
                <TableHead className="hidden md:table-cell">備註</TableHead>
                <TableHead className="w-[50px] text-right"><span className="sr-only">操作</span></TableHead> 
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((transaction) => {
                const isIncome = transaction.type === 'income';
                return (
                  <TableRow 
                    key={transaction.id}
                    onMouseDown={() => handlePressStart(transaction)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(transaction)}
                    onTouchEnd={handlePressEnd}
                    onTouchMove={handlePressEnd}
                    className="cursor-pointer"
                  >
                    <TableCell>{format(parseISO(transaction.date), 'yyyy/MM/dd')}</TableCell>
                    <TableCell>{transaction.item}</TableCell>
                    <TableCell className="hidden sm:table-cell">{transaction.person}</TableCell>
                    <TableCell className={cn("text-right font-medium", isIncome ? "text-green-600" : "text-red-600")}>
                        {isIncome ? '' : '-'}{transaction.amount.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{transaction.notes || '-'}</TableCell>
                    <TableCell className="py-2 px-4 text-right">
                      <div className="hidden sm:flex justify-end items-center space-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onEdit(transaction)} aria-label="編輯" className="text-muted-foreground hover:bg-transparent hover:text-chart-3-darker">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p>編輯</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onDelete(transaction.id)} aria-label="刪除" className="text-muted-foreground hover:bg-transparent hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p>刪除</p></TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="sm:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">更多操作</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[5rem]">
                            <DropdownMenuItem onClick={() => onEdit(transaction)} className="text-chart-3-darker focus:text-chart-3-darker focus:bg-chart-3/10 gap-2">
                              <Edit3 className="h-4 w-4" />
                              <span>編輯</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(transaction.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2">
                              <Trash2 className="h-4 w-4" />
                              <span>刪除</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="font-body">
          <DialogHeader>
            <DialogTitle>紀錄詳細資訊</DialogTitle>
            <DialogDescription>
              以下是這筆紀錄的完整內容。
            </DialogDescription>
          </DialogHeader>
          {detailTransaction && (
            <div className="grid grid-cols-[max-content_auto_1fr] gap-x-2 gap-y-2 py-4 text-sm">
              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">日期</strong>
              <span>:</span>
              <span>{format(parseISO(detailTransaction.date), 'yyyy/MM/dd')}</span>
              
              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">類型</strong>
              <span>:</span>
              <span>{detailTransaction.type === 'income' ? '收入' : '支出'}</span>
              
              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">項目</strong>
              <span>:</span>
              <span>{detailTransaction.item}</span>
              
              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">人員</strong>
              <span>:</span>
              <span>{detailTransaction.person}</span>
              
              {detailTransaction.type === 'income' ? (
                <>
                  <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">報名人數</strong>
                  <span>:</span>
                  <span>{detailTransaction.count ?? '-'}</span>
                </>
              ) : (
                <>
                  <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">憑證類型</strong>
                  <span>:</span>
                  <span>{detailTransaction.voucherType ?? '-'}</span>
                </>
              )}

              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify]">金額</strong>
              <span>:</span>
              <span className={cn("font-medium", detailTransaction.type === 'income' ? "text-green-600" : "text-red-600")}>
                {detailTransaction.type === 'expense' && '-'}{detailTransaction.amount.toLocaleString('en-US')}
              </span>
              
              <strong className="w-16 text-muted-foreground text-justify [text-align-last:justify] self-start">備註</strong>
              <span className="self-start">:</span>
              <span className="col-span-1 whitespace-pre-wrap break-words self-start">{detailTransaction.notes || '-'}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
