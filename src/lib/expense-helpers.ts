import { supabase } from "./supabase"

export interface Expense {
  id: string
  amount: number
  description: string
  type: "fixed" | "variable"
  date: string
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (error) {
    console.error("Error fetching expenses:", error)
    return []
  }

  return data || []
}

export async function addExpense(userId: string, expense: Omit<Expense, "id">): Promise<boolean> {
  const { error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      amount: expense.amount,
      description: expense.description,
      type: expense.type,
      date: expense.date || new Date().toISOString()
    })

  if (error) {
    console.error("Error adding expense:", error)
    return false
  }

  return true
}

export async function updateExpense(userId: string, expenseId: string, updates: Partial<Omit<Expense, "id">>): Promise<boolean> {
  const { error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", expenseId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error updating expense:", error)
    return false
  }

  return true
}

export async function deleteExpense(userId: string, expenseId: string): Promise<boolean> {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error deleting expense:", error)
    return false
  }

  return true
}
