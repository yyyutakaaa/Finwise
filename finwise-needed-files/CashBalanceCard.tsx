"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getCashBalance, updateCashBalance } from "@/lib/finance-helpers";

export default function CashBalanceCard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      console.log("Loading balance for user:", user.id);
      const data = await getCashBalance(user.id);
      console.log("Balance data received:", data);
      setBalance(data?.amount || 0);
    } catch (err) {
      console.error("Error loading balance:", err);
      setError("Failed to load balance");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBalance();
    }
  }, [user, loadBalance]);

  const handleSetBalance = async () => {
    if (!user) return;

    const newBalance = prompt("Enter your current cash balance (€):");
    if (newBalance && !isNaN(parseFloat(newBalance))) {
      setUpdating(true);
      setError(null);

      try {
        console.log("Updating balance to:", parseFloat(newBalance));
        const result = await updateCashBalance(user.id, parseFloat(newBalance));
        console.log("Update result:", result);

        if (result) {
          await loadBalance(); // Reload from database
        } else {
          setError("Failed to update balance");
        }
      } catch (err) {
        console.error("Error updating balance:", err);
        setError("Failed to update balance");
      } finally {
        setUpdating(false);
      }
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
        <CardDescription>
          Your current available funds • Synced to database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-green-600">
          €{balance.toFixed(2)}
        </div>
        <p className="text-sm text-slate-600 mt-2 mb-4">Available to spend</p>

        {error && (
          <div className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

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
