import { supabase } from './supabase'

// Cash Balance functions
export async function getCashBalance(userId: string) {
    const { data, error } = await supabase
        .from('cash_balances')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cash balance:', error)
        return null
    }

    return data
}

export async function updateCashBalance(userId: string, amount: number) {
    const { data, error } = await supabase
        .from('cash_balances')
        .upsert({
            user_id: userId,
            amount,
            updated_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        console.error('Error updating cash balance:', error)
        return null
    }

    return data
}

// Expense calculation helper (moved from expense-helpers)
export function calculateMonthlyExpenses(expenses: any[]) {
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    const monthlyExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date)
        return expenseDate.getMonth() === currentMonth &&
            expenseDate.getFullYear() === currentYear
    })

    const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const fixed = monthlyExpenses
        .filter(expense => expense.type === 'fixed')
        .reduce((sum, expense) => sum + expense.amount, 0)
    const variable = monthlyExpenses
        .filter(expense => expense.type === 'variable')
        .reduce((sum, expense) => sum + expense.amount, 0)

    return { total, fixed, variable }
}