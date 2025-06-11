import { supabase } from './supabase'

// Cash Balance functions - Fixed to handle multiple records
export async function getCashBalance(userId: string) {
    // Get the latest record instead of using .single()
    const { data, error } = await supabase
        .from('cash_balances')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)

    if (error) {
        console.error('Error fetching cash balance:', error)
        return { amount: 0 }
    }

    // If no records, create one
    if (!data || data.length === 0) {
        console.log('No cash balance record found, creating one...')
        const { data: newRecord, error: insertError } = await supabase
            .from('cash_balances')
            .insert({
                user_id: userId,
                amount: 0,
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error creating cash balance record:', insertError)
            return { amount: 0 }
        }

        return newRecord
    }

    return data[0] // Return the latest record
}

export async function updateCashBalance(userId: string, amount: number) {
    console.log('Updating cash balance for user:', userId, 'amount:', amount)

    // First, clean up old records (keep only the latest one)
    await cleanupDuplicateCashBalances(userId)

    // Then update or insert
    const { data, error } = await supabase
        .from('cash_balances')
        .upsert({
            user_id: userId,
            amount,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id' // This should work if we have a unique constraint
        })
        .select()

    if (error) {
        console.error('Error updating cash balance:', error)
        // Fallback: just insert a new record
        const { data: newData, error: insertError } = await supabase
            .from('cash_balances')
            .insert({
                user_id: userId,
                amount,
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting cash balance:', insertError)
            return null
        }
        return newData
    }

    console.log('Cash balance updated successfully:', data)
    return data[0]
}

// Cleanup function to remove duplicate records
async function cleanupDuplicateCashBalances(userId: string) {
    // Get all records for this user
    const { data: allRecords, error } = await supabase
        .from('cash_balances')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

    if (error || !allRecords || allRecords.length <= 1) {
        return // No cleanup needed
    }

    // Keep the latest record, delete the rest
    const recordsToDelete = allRecords.slice(1) // All except the first (latest)
    const idsToDelete = recordsToDelete.map(record => record.id)

    if (idsToDelete.length > 0) {
        console.log(`Cleaning up ${idsToDelete.length} duplicate cash balance records`)
        const { error: deleteError } = await supabase
            .from('cash_balances')
            .delete()
            .in('id', idsToDelete)

        if (deleteError) {
            console.error('Error cleaning up duplicates:', deleteError)
        } else {
            console.log('Duplicate records cleaned up successfully')
        }
    }
}

// Expense calculation helper
export function calculateMonthlyExpenses(expenses: Array<{
    amount: number
    type: 'fixed' | 'variable'
    date: string
}>) {
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