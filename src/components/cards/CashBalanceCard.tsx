"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
export async function getCashBalance(
  userId: string
): Promise<{ amount: number }> {
  const storedBalance = localStorage.getItem(`cash-balance-${userId}`);
  return { amount: storedBalance ? parseFloat(storedBalance) : 0 };
}

export async function updateCashBalance(
  userId: string,
  amount: number
): Promise<void> {
  localStorage.setItem(`cash-balance-${userId}`, amount.toString());
}

export default function CashBalanceCard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      loadBalance();
    }
  }, [user]);

  const loadBalance = async () => {
    if (!user) return;

    setLoading(true);
    const data = await getCashBalance(user.id);
    setBalance(data?.amount || 0);
    setLoading(false);
  };

  const handleSetBalance = async () => {
    if (!user) return;

    const newBalance = prompt("Enter your current cash balance (€):");
    if (newBalance && !isNaN(parseFloat(newBalance))) {
      setUpdating(true);
      await updateCashBalance(user.id, parseFloat(newBalance));
      await loadBalance();
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Balance</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded mb-2"></div>
            <div className="h-4 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cash Balance</CardTitle>
        <CardDescription>Your current available funds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-green-600">
          €{balance.toFixed(2)}
        </div>
        <p className="text-sm text-slate-600 mt-2 mb-4">Available to spend</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSetBalance}
          disabled={updating}
        >
          {updating ? "Updating..." : "Update Balance"}
        </Button>
      </CardContent>
    </Card>
  );
}
