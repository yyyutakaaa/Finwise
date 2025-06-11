// src/app/api/import-transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

interface ImportTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactions, bankType, fileName } = body

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'Invalid transactions data' }, { status: 400 })
    }

    console.log(`Processing ${transactions.length} transactions from ${fileName || bankType}`)

    // Create Supabase client with proper auth handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // We don't need to set cookies in API routes
          },
          remove(name: string, options: any) {
            // We don't need to remove cookies in API routes
          },
        },
      }
    )

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    let imported = 0
    let duplicates = 0
    let failed = 0

    // Process each transaction
    for (const transaction of transactions as ImportTransaction[]) {
      try {
        // Check for duplicates based on date, amount, and description similarity
        const { data: existing, error: searchError } = await supabase
          .from('expenses')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', transaction.date)
          .eq('amount', transaction.amount)
          .ilike('description', `%${transaction.description.substring(0, 20)}%`)
          .limit(1)

        if (searchError) {
          console.error('Error checking for duplicates:', searchError)
          failed++
          continue
        }

        if (existing && existing.length > 0) {
          duplicates++
          continue
        }

        // Map transaction type to your expense schema
        const expenseType = transaction.type === 'income' ? 'income' : 'variable'

        // Insert new transaction
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            user_id: user.id,
            description: transaction.description,
            amount: transaction.amount,
            type: expenseType,
            date: transaction.date,
            category: transaction.category || 'Imported',
            source: `bank_import_${bankType}`
          })

        if (insertError) {
          console.error('Failed to insert transaction:', insertError)
          failed++
        } else {
          imported++
        }

      } catch (error) {
        console.error('Error processing transaction:', transaction, error)
        failed++
      }
    }

    console.log(`Import completed: ${imported} imported, ${duplicates} duplicates, ${failed} failed`)

    return NextResponse.json({
      success: imported,
      duplicates,
      failed,
      total: transactions.length
    })

  } catch (error) {
    console.error('Import transactions error:', error)
    return NextResponse.json({ 
      error: 'Failed to import transactions', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}