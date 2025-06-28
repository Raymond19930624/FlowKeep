
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

interface TransactionChartProps {
  transactions: Transaction[];
}

const INCOME_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-5))", "hsl(var(--chart-1) / 0.7)", "hsl(var(--chart-3) / 0.7)"];
const EXPENSE_COLORS = ["hsl(var(--chart-2))", "hsl(var(--chart-4))", "#FBBF24", "hsl(var(--chart-2) / 0.7)", "hsl(var(--chart-4) / 0.7)"];

const ChartPlaceholder = () => (
    <div className="flex items-center justify-center h-[200px] w-full">
        <Skeleton className="h-[150px] w-[150px] rounded-full" />
    </div>
);

// New, smaller component for rendering one category's breakdown
const CategoryBreakdown = ({ data, totalAmount, colors }: { 
    data: { name: string; value: number }[];
    totalAmount: number;
    colors: string[];
}) => {
    const sortedData = useMemo(() => data.sort((a, b) => b.value - a.value), [data]);

    if (sortedData.length === 0) {
        return null;
    }

    return (
        <div className="w-full mt-4 space-y-1 text-sm">
            {sortedData.map((item, index) => (
                <div key={`detail-${item.name}-${index}`} className="py-1">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
                        <div className="flex items-center gap-2 truncate">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: colors[index % colors.length] }}
                            />
                            <span className="truncate">{item.name}</span>
                        </div>
                        <div className="font-medium text-right flex-shrink-0">
                            <span className="text-foreground">{item.value.toLocaleString()}</span>
                            <span className="ml-2 w-16 text-right inline-block text-muted-foreground">
                                {`(${(totalAmount > 0 ? (item.value / totalAmount) * 100 : 0).toFixed(0)}%)`}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


export default function TransactionChart({ transactions }: TransactionChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { incomeData, totalIncome } = useMemo(() => {
    const dataMap = new Map<string, number>();
    let total = 0;
    transactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        const currentAmount = dataMap.get(t.item) || 0;
        dataMap.set(t.item, currentAmount + t.amount);
        total += t.amount;
      });
    return {
      incomeData: Array.from(dataMap, ([name, value]) => ({ name, value })),
      totalIncome: total,
    };
  }, [transactions]);

  const { expenseData, totalExpense } = useMemo(() => {
    const dataMap = new Map<string, number>();
    let total = 0;
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const currentAmount = dataMap.get(t.item) || 0;
        dataMap.set(t.item, currentAmount + t.amount);
        total += t.amount;
      });
    return {
      expenseData: Array.from(dataMap, ([name, value]) => ({ name, value })),
      totalExpense: total,
    };
  }, [transactions]);


  if (transactions.length === 0) {
    return null;
  }
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const isIncome = incomeData.some((item) => item.name === data.name);
      const total = isIncome ? totalIncome : totalExpense;
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(0) : 0;
      
      return (
        <div className="p-2 bg-card border rounded-md shadow-lg text-card-foreground">
          <p className="label">{`${data.name}: ${data.value.toLocaleString()} (${percentage}%)`}</p>
        </div>
      );
    }
    return null;
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) {
        return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#FFFFFF"
        stroke="rgba(0, 0, 0, 0.4)"
        strokeWidth={2}
        paintOrder="stroke"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">收支分類圖表</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          
          {/* Income Chart and Breakdown */}
          <div className="flex flex-col items-center">
            <h3 className="font-medium mb-2">收入分類</h3>
            {!isMounted ? <ChartPlaceholder /> : incomeData.length > 0 ? (
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={incomeData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={2} 
                      labelLine={false} 
                      label={renderCustomizedLabel}
                    >
                      {incomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">尚無收入資料</div>
            )}
            <CategoryBreakdown 
                data={incomeData}
                totalAmount={totalIncome}
                colors={INCOME_COLORS}
            />
          </div>
          
          {/* Expense Chart and Breakdown */}
          <div className="flex flex-col items-center">
            <h3 className="font-medium mb-2">支出分類</h3>
            {!isMounted ? <ChartPlaceholder /> : expenseData.length > 0 ? (
               <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expenseData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={2}
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">尚無支出資料</div>
            )}
            <CategoryBreakdown 
                data={expenseData}
                totalAmount={totalExpense}
                colors={EXPENSE_COLORS}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
