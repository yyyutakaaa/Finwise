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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  manualCleanupVariableExpenses,
  type Expense,
} from "@/lib/expense-helpers";
import { calculateMonthlyExpenses } from "@/lib/finance-helpers";

export default function ExpenseCard() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "variable" as "fixed" | "variable",
  });

  const loadExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const userExpenses = await getExpenses(user.id); // This automatically cleans up old variable expenses
    setExpenses(userExpenses);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user, loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.description || !formData.amount) return;

    let success = false;

    if (editingExpense) {
      // Update existing expense
      success = await updateExpense(user.id, editingExpense.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
      });
      setEditingExpense(null);
    } else {
      // Add new expense
      success = await addExpense(user.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        date: new Date().toISOString(),
      });
    }

    if (success) {
      // Reset form
      setFormData({ description: "", amount: "", type: "variable" });
      setShowAddForm(false);
      await loadExpenses();
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      type: expense.type,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!user) return;
    if (confirm("Are you sure you want to delete this expense?")) {
      const success = await deleteExpense(user.id, expenseId);
      if (success) {
        await loadExpenses();
      }
    }
  };

// 🆕 NEW: Manual cleanup function
  const handleManualCleanup = async () => {
    if (!user) return;
    
    const confirmed = confirm(
      "This will delete all variable expenses from previous months. Fixed expenses (like rent) will remain. Are you sure?"
    );
    
    if (confirmed) {
      setCleanupLoading(true);
      try {
        const deletedCount = await manualCleanupVariableExpenses(user.id);
        alert(`✅ Cleaned up ${deletedCount} old variable expenses!`);
        await loadExpenses(); // Refresh the list
      } catch {
        alert("❌ Error during cleanup. Please try again.");
      } finally {
        setCleanupLoading(false);
      }
    }
  };
  const handleCancel = () => {
    setShowAddForm(false);
    setEditingExpense(null);
    setFormData({ description: "", amount: "", type: "variable" });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Expenses</CardTitle>
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

  const { total, fixed, variable } = calculateMonthlyExpenses(expenses);

  // Show expanded expense list
  if (showAllExpenses) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            All Expenses
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualCleanup}
                disabled={cleanupLoading}
                className="text-red-600 hover:bg-red-50"
              >
                {cleanupLoading ? "Cleaning..." : "🗑️ Cleanup Old"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllExpenses(false)}
              >
                Show Summary
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Complete list of your expenses • {expenses.length} total
            <div className="text-xs mt-1 text-green-600">
              💡 Variable expenses are automatically cleaned at month start
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">💸</div>
                <div>No expenses yet</div>
                <div className="text-sm">Add your first expense to get started</div>
              </div>
            ) : (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 mb-1">
                      {expense.description}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        expense.type === 'fixed' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {expense.type === 'fixed' ? '🏠 Fixed' : '📊 Variable'}
                      </span>
                      <span>
                        {new Date(expense.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg text-slate-900">
                      €{expense.amount.toFixed(2)}
                    </span>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(expense)}
                        className="h-8 w-8 p-0"
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(expense.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button
              size="sm"
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              Add New Expense
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show add form
  if (showAddForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editingExpense ? "Edit Expense" : "Add Expense"}
          </CardTitle>
          <CardDescription>
            Track your spending
            {formData.type === 'variable' && (
              <div className="text-xs mt-1 text-green-600">
                💡 Variable expenses reset each month
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="e.g., Rent, Groceries, Coffee"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (€)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="variable">
                  📊 Variable (groceries, entertainment) - Resets monthly
                </option>
                <option value="fixed">🏠 Fixed (rent, subscriptions) - Permanent</option>
              </select>
            </div>

            <div className="flex space-x-2">
              <Button type="submit" className="flex-1">
                {editingExpense ? "Update Expense" : "Add Expense"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Show summary view (default)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Monthly Expenses</CardTitle>
        <CardDescription>
          Your spending this month • Auto-cleanup enabled
          <div className="text-xs mt-1 text-green-600">
            💡 Variable expenses reset automatically each month
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-red-600">
          €{total.toFixed(2)}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">🏠 Fixed:</span>
            <span className="font-medium">€{fixed.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">📊 Variable:</span>
            <span className="font-medium">€{variable.toFixed(2)}</span>
          </div>
        </div>

        {expenses.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">
                Recent Expenses
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllExpenses(true)}
                className="text-xs h-6"
              >
                View All ({expenses.length})
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {expenses.slice(0, 3).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded"
                >
                  <div className="flex-1">
                    <div className="font-medium truncate">
                      {expense.description}
                    </div>
                    <div className="text-slate-500">
                      {expense.type === 'fixed' ? '🏠' : '📊'} {expense.type} •{" "}
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">
                      €{expense.amount.toFixed(2)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(expense)}
                      className="h-6 w-6 p-0"
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
                      className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          onClick={() => setShowAddForm(true)}
        >
          Add Expense
        </Button>
      </CardContent>
    </Card>
  );
}