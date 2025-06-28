
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, PlusCircle, Check, ChevronsUpDown, Trash2, XCircle, AlertTriangle } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionData } from '@/lib/types';
import { deleteCommonItem, clearCommonItems } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
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


interface TransactionFormProps {
  formType: 'income' | 'expense';
  onSave: (data: TransactionData, typeToSave: 'income' | 'expense', editingId?: string) => void;
  isLoading: boolean;
  commonItems: string[];
  projectId: string;
  onCommonItemsChange: () => Promise<void>;
  editingTransaction?: Transaction | null;
  onCancelEdit?: () => void;
}

interface FormData {
  date: Date;
  person: string;
  item: string;
  voucherType?: '發票' | '收據' | '其他';
  count?: number | null;
  amount: number | null;
  notes?: string;
}

export default function TransactionForm({
  formType: initialFormType,
  onSave,
  isLoading,
  commonItems = [],
  projectId,
  onCommonItemsChange,
  editingTransaction,
  onCancelEdit,
}: TransactionFormProps) {
  const [currentFormType, setCurrentFormType] = useState(initialFormType);
  const { toast } = useToast();

  const { control, handleSubmit, register, reset, formState: { errors }, setValue, watch, trigger } = useForm<FormData>({
    defaultValues: {
      date: new Date(),
      person: '',
      item: '',
      voucherType: initialFormType === 'expense' ? '發票' : undefined,
      amount: null,
      notes: '',
      count: null,
    }
  });

  const [itemSearch, setItemSearch] = useState('');
  const [isItemPopoverOpen, setIsItemPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isSingleDeleteConfirmOpen, setIsSingleDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const selectedVoucherType = watch("voucherType");

  useEffect(() => {
    if (editingTransaction) {
      setCurrentFormType(editingTransaction.type);
      reset({
        date: parseISO(editingTransaction.date),
        person: editingTransaction.person,
        item: editingTransaction.item,
        voucherType: editingTransaction.type === 'expense' ? editingTransaction.voucherType : undefined,
        amount: editingTransaction.amount,
        notes: editingTransaction.notes || '',
        count: editingTransaction.type === 'income' ? (editingTransaction.count ?? null) : null,
      });
      if(editingTransaction.item) setItemSearch(editingTransaction.item);
    } else {
      setCurrentFormType(initialFormType);
      reset({ 
        date: new Date(),
        person: '',
        item: '',
        voucherType: initialFormType === 'expense' ? '發票' : undefined,
        amount: null,
        notes: '',
        count: initialFormType === 'income' ? null : undefined,
      });
      setItemSearch('');
    }
  }, [editingTransaction, reset, initialFormType]);

  useEffect(() => {
    if (currentFormType === 'income') {
      setValue('voucherType', undefined);
      if(editingTransaction?.type !== 'income') setValue('count', null);
    } else { 
      if (watch('voucherType') === undefined && !editingTransaction) {
        setValue('voucherType', '發票');
      }
      setValue('count', undefined);
    }
  }, [currentFormType, setValue, watch, editingTransaction]);

  const processSubmit: SubmitHandler<FormData> = (data) => {
    const transactionData: TransactionData = {
      date: format(data.date, "yyyy-MM-dd"),
      person: data.person,
      item: data.item,
      amount: Number(data.amount),
      notes: data.notes,
      type: currentFormType,
      ...(currentFormType === 'income' && {
        count: data.count ? Number(data.count) : undefined,
      }),
      ...(currentFormType === 'expense' && {
        voucherType: data.voucherType,
      }),
    };
    
    // Clean up properties that don't belong to the type
    if (transactionData.type === 'income') {
      delete (transactionData as Partial<TransactionData>).voucherType;
    } else {
      delete (transactionData as Partial<TransactionData>).count;
    }

    onSave(transactionData, currentFormType, editingTransaction?.id);
    if (!editingTransaction) { 
      reset({
        date: new Date(),
        person: '',
        item: '',
        voucherType: initialFormType === 'expense' ? '發票' : undefined,
        amount: null,
        notes: '',
        count: initialFormType === 'income' ? null : undefined
      });
      setItemSearch('');
    }
  };

  const openSingleDeleteConfirm = (item: string) => {
    setItemToDelete(item);
    setIsItemPopoverOpen(false); // Close popover to show dialog clearly
    setIsSingleDeleteConfirmOpen(true);
  };

  const executeDeleteSingleCommonItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteCommonItem(projectId, currentFormType, itemToDelete);
      await onCommonItemsChange();
      toast({ title: "成功", description: `常用項目 "${itemToDelete}" 已刪除。` });
    } catch (error) {
      toast({ title: "錯誤", description: `刪除常用項目失敗: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSingleDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleClearAllCommonItems = async () => {
     try {
      await clearCommonItems(projectId, currentFormType);
      await onCommonItemsChange();
      toast({ title: "成功", description: `所有常用${currentFormType === 'income' ? '收入' : '支出'}項目已清除。` });
    } catch (error) {
      toast({ title: "錯誤", description: `清除常用項目失敗: ${(error as Error).message}`, variant: "destructive" });
    }
  };

  const buttonText = editingTransaction ? '更新' : '新增';

  const personPlaceholder = currentFormType === 'income' ? '例: 林小妹' : '例: 蔡大姐';
  const itemPlaceholder = currentFormType === 'income' ? '例: 活動報名費' : '例: 場地佈置';
  const amountPlaceholder = "1500";

  let notesPlaceholderValue = '可選填';
  if (currentFormType === 'expense' && selectedVoucherType === '其他') {
    notesPlaceholderValue = '請填寫憑證名稱，例: XXX計程車隊車資';
  }
  const notesLabel = currentFormType === 'expense' && selectedVoucherType === '其他' ? '備註 (請填寫憑證名稱)' : '備註';

  return (
    <>
      <form onSubmit={handleSubmit(processSubmit)}>
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-date`}>日期</Label>
            <Controller
              name="date"
              control={control}
              rules={{ required: "日期為必填項" }}
              render={({ field }) => (
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value && isValid(field.value) ? format(field.value, "yyyy/MM/dd") : <span>選擇日期</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        trigger("date");
                        setIsCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
          </div>

          <div>
            <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-person`}>{currentFormType === 'income' ? '收款人' : '請款人'}</Label>
            <Input
              id={`${currentFormType}-${editingTransaction?.id || 'new'}-person`}
              {...register("person", { required: `${currentFormType === 'income' ? '收款人' : '請款人'}為必填項` })}
              placeholder={personPlaceholder}
            />
            {errors.person && <p className="text-sm text-destructive mt-1">{errors.person.message}</p>}
          </div>

          {currentFormType === 'income' && (
            <div>
              <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-count`}>報名人數 (可空白)</Label>
              <Input
                id={`${currentFormType}-${editingTransaction?.id || 'new'}-count`}
                type="number"
                {...register("count", {
                  min: { value: 1, message: "報名人數至少為1" },
                  valueAsNumber: true,
                })}
                placeholder="例: 10"
              />
              {errors.count && <p className="text-sm text-destructive mt-1">{errors.count.message}</p>}
            </div>
          )}

          {currentFormType === 'expense' && (
            <>
              <div>
                <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-voucherType`}>憑證類型</Label>
                <Controller
                  name="voucherType"
                  control={control}
                  rules={{ required: "憑證類型為必填項" }}
                  render={({ field }) => (
                    <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value === '其他') {
                             trigger("notes");
                          } else {
                             if(errors.notes?.type === 'required') trigger("notes");
                          }
                        }}
                        value={field.value || ''}
                    >
                      <SelectTrigger id={`${currentFormType}-${editingTransaction?.id || 'new'}-voucherType`}>
                        <SelectValue placeholder="選擇憑證類型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="發票">發票</SelectItem>
                        <SelectItem value="收據">收據</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.voucherType && <p className="text-sm text-destructive mt-1">{errors.voucherType.message}</p>}
              </div>
            </>
          )}

          <div>
            <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-item`}>項目 (可自訂)</Label>
            <Controller
              name="item"
              control={control}
              rules={{ required: "項目為必填項" }}
              render={({ field }) => (
                <Popover open={isItemPopoverOpen} onOpenChange={(open) => {
                  setIsItemPopoverOpen(open);
                  if (!open && itemSearch && !commonItems.includes(itemSearch) && field.value !== itemSearch) {
                     setValue("item", itemSearch, {shouldValidate: true});
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isItemPopoverOpen}
                      className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                      onClick={() => {
                        if(field.value) setItemSearch(field.value); else setItemSearch('');
                        setIsItemPopoverOpen(true);
                      }}
                    >
                      {field.value || itemPlaceholder}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="搜尋或輸入新項目..."
                        value={itemSearch}
                        onValueChange={setItemSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {itemSearch ? `新增項目 "${itemSearch}"` : "無此項目，請輸入"}
                        </CommandEmpty>
                        <CommandGroup>
                          {commonItems
                            .filter(item => item.toLowerCase().includes(itemSearch.toLowerCase()))
                            .map((item) => (
                            <CommandItem
                              key={item}
                              value={item}
                              onSelect={() => {
                                setValue("item", item, {shouldValidate: true});
                                setItemSearch(item);
                                setIsItemPopoverOpen(false);
                              }}
                              className="flex justify-between items-center"
                            >
                              <div className="flex items-center">
                                <Check className={cn("mr-2 h-4 w-4", field.value === item ? "opacity-100" : "opacity-0")}/>
                                {item}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-50 hover:bg-transparent hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation(); 
                                  openSingleDeleteConfirm(item);
                                }}
                                aria-label={`刪除常用項目 ${item}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </CommandItem>
                          ))}
                          {itemSearch && !commonItems.some(ci => ci.toLowerCase() === itemSearch.toLowerCase()) && (
                             <CommandItem
                                key={itemSearch}
                                value={itemSearch}
                                onSelect={() => {
                                  setValue("item", itemSearch, {shouldValidate: true});
                                  setIsItemPopoverOpen(false);
                                }}
                              >
                               <PlusCircle className="mr-2 h-4 w-4" />
                                新增 "{itemSearch}"
                              </CommandItem>
                          )}
                        </CommandGroup>
                        {commonItems.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandItem
                              onSelect={() => setIsClearConfirmOpen(true)}
                              className="text-destructive hover:bg-destructive/10 justify-center"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              清除所有常用項目
                            </CommandItem>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.item && <p className="text-sm text-destructive mt-1">{errors.item.message}</p>}
          </div>


          <div>
            <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-amount`}>金額</Label>
            <Input
              id={`${currentFormType}-${editingTransaction?.id || 'new'}-amount`}
              type="number"
              step="1"
              {...register("amount", {
                required: "金額為必填項",
                valueAsNumber: true,
                min: {value: 1, message: "金額必須大於0"}
              })}
              placeholder={amountPlaceholder}
            />
            {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <Label htmlFor={`${currentFormType}-${editingTransaction?.id || 'new'}-notes`}>{notesLabel}</Label>
            <Textarea
              id={`${currentFormType}-${editingTransaction?.id || 'new'}-notes`}
              {...register("notes", {
                validate: value => {
                  if (currentFormType === 'expense' && selectedVoucherType === '其他' && !value?.trim()) {
                    return "憑證類型為「其他」時，請在備註中填寫憑證名稱。";
                  }
                  return true;
                }
              })}
              placeholder={notesPlaceholderValue}
            />
            {errors.notes && <p className="text-sm text-destructive mt-1">{errors.notes.message}</p>}
          </div>
        </div>
        <div className={cn("flex items-center pt-6", onCancelEdit && "justify-end gap-2")}>
          {onCancelEdit && (
             <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>取消</Button>
          )}
          <Button
            type="submit"
            className={cn(!onCancelEdit && "w-full")}
            disabled={isLoading}
            variant={currentFormType === 'income' ? 'income' : 'expense'}
          >
            {editingTransaction ? (
                <Check className="mr-2 h-5 w-5" />
            ) : (
                <PlusCircle className="mr-2 h-5 w-5" />
            )}
            {isLoading ? '處理中...' : buttonText}
          </Button>
        </div>
      </form>

      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
              確認清除常用項目？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作將清除所有常用「{currentFormType === 'income' ? '收入' : '支出'}」項目，且無法復原。您確定要繼續嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearAllCommonItems} 
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "清除中..." : "確認清除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSingleDeleteConfirmOpen} onOpenChange={(isOpen) => {
        setIsSingleDeleteConfirmOpen(isOpen);
        if (!isOpen) {
          setItemToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
              確認刪除項目？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您確定要從常用清單中移除「<span className="font-semibold">{itemToDelete}</span>」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDeleteSingleCommonItem} 
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
  );
}
