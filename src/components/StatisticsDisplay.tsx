
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Users } from 'lucide-react';

interface StatisticsDisplayProps {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  totalAttendees: number;
}

const StatCard = ({ title, value, color, icon: Icon }: { title: string; value: string | number; color: string; icon: React.ElementType }) => (
  <Card className="relative overflow-hidden shadow-md border-0 transition-transform duration-200 ease-in-out hover:-translate-y-0.5">
    <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ backgroundColor: color }}></div>
    <CardHeader className="p-2 pb-1 pl-4">
      <CardTitle className="flex items-center gap-2 text-sm font-medium" style={{ color: color }}>
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="p-2 pt-0 pl-4">
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function StatisticsDisplay({ totalIncome, totalExpenses, balance, totalAttendees }: StatisticsDisplayProps) {
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="活動收入" value={formatCurrency(totalIncome)} color="hsl(var(--stat-income))" icon={TrendingUp} />
        <StatCard title="活動支出" value={formatCurrency(totalExpenses)} color="hsl(var(--stat-expense))" icon={TrendingDown} />
        <StatCard title="活動結餘" value={formatCurrency(balance)} color="hsl(var(--stat-balance))" icon={Scale} />
        <StatCard title="活動人數" value={totalAttendees} color="hsl(var(--stat-attendees))" icon={Users} />
      </div>
    </div>
  );
}
