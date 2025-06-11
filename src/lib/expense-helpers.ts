import { supabase } from "./supabase"

export interface Expense {
  id: string
  amount: number
  description: string
  type: "fixed" | "variable"
  date: string
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  // First, cleanup old variable expenses
  await cleanupOldVariableExpenses(userId)
  
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

// 🆕 NEW: Cleanup function for old variable expenses
async function cleanupOldVariableExpenses(userId: string): Promise<void> {
  try {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // Get first day of current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    
    console.log(`🗑️ Cleaning up variable expenses before: ${firstDayOfMonth.toISOString()}`)
    
    const { data: deletedExpenses, error } = await supabase
      .from("expenses")
      .delete()
      .eq("user_id", userId)
      .eq("type", "variable")
      .lt("date", firstDayOfMonth.toISOString())
      .select() // Return deleted rows for logging
    
    if (error) {
      console.error("Error cleaning up old variable expenses:", error)
      return
    }
    
    if (deletedExpenses && deletedExpenses.length > 0) {
      console.log(`✅ Cleaned up ${deletedExpenses.length} old variable expenses`)
      
      // Optional: Store cleanup info in a separate table for analytics
      await logCleanupEvent(userId, deletedExpenses.length)
    }
  } catch {
    console.error("Error in cleanup function")
  }
}

// 🆕 NEW: Log cleanup events (optional - for tracking)
async function logCleanupEvent(userId: string, deletedCount: number): Promise<void> {
  try {
    // Create a simple log entry (you can create this table in Supabase)
    await supabase
      .from("expense_cleanup_log")
      .insert({
        user_id: userId,
        deleted_count: deletedCount,
        cleanup_date: new Date().toISOString()
      })
  } catch {
    // Ignore errors in logging - it's not critical
    console.log("Note: Could not log cleanup event (table might not exist)")
  }
}

// 🆕 NEW: Manual cleanup function (if user wants to trigger it manually)
export async function manualCleanupVariableExpenses(userId: string): Promise<number> {
  try {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // Get first day of current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    
    const { data: deletedExpenses, error } = await supabase
      .from("expenses")
      .delete()
      .eq("user_id", userId)
      .eq("type", "variable")
      .lt("date", firstDayOfMonth.toISOString())
      .select()
    
    if (error) {
      console.error("Error in manual cleanup:", error)
      return 0
    }
    
    const deletedCount = deletedExpenses?.length || 0
    
    if (deletedCount > 0) {
      await logCleanupEvent(userId, deletedCount)
    }
    
    return deletedCount
  } catch {
    console.error("Error in manual cleanup")
    return 0
  }
}