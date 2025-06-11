// src/app/api/import-transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    const { transactions, bankType, fileName, userId } = body

    console.log('=== IMPORT REQUEST DEBUG ===')
    console.log('Raw body:', JSON.stringify(body, null, 2))
    console.log('Transactions:', transactions)
    console.log('BankType:', bankType)
    console.log('UserId:', userId)
    console.log('Transactions type:', typeof transactions)
    console.log('Transactions length:', transactions?.length)

    if (!transactions) {
      console.error('No transactions in request')
      return NextResponse.json({ error: 'Missing transactions' }, { status: 400 })
    }

    if (!Array.isArray(transactions)) {
      console.error('Transactions is not an array:', typeof transactions)
      return NextResponse.json({ error: 'Transactions must be an array' }, { status: 400 })
    }

    if (transactions.length === 0) {
      console.error('Transactions array is empty')
      return NextResponse.json({ error: 'No transactions to process' }, { status: 400 })
    }

    if (!userId) {
      console.error('No userId provided')
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    console.log(`✅ Validation passed. Processing ${transactions.length} transactions for user ${userId}`)

    let imported = 0
    let duplicates = 0
    let failed = 0

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i]
      try {
        console.log(`Processing transaction ${i + 1}/${transactions.length}:`, transaction)

        // Validate transaction fields
        if (!transaction.date || !transaction.description || typeof transaction.amount !== 'number') {
          console.error(`Invalid transaction ${i + 1}:`, transaction)
          failed++
          continue
        }

        // Check for duplicates
        const { data: existing, error: searchError } = await supabase
          .from('expenses')
          .select('id')
          .eq('user_id', userId)
          .eq('date', transaction.date)
          .eq('amount', transaction.amount)
          .ilike('description', `%${transaction.description.substring(0, 20)}%`)
          .limit(1)

        if (searchError) {
          console.error('Duplicate search error:', searchError)
          failed++
          continue
        }

        if (existing && existing.length > 0) {
          console.log(`Duplicate found for: ${transaction.description}`)
          duplicates++
          continue
        }

        // Map transaction type to your expense schema
        const expenseType = transaction.type === 'income' ? 'income' : 'variable'

        // Insert new transaction
        const insertData = {
          user_id: userId,
          description: transaction.description,
          amount: transaction.amount,
          type: expenseType,
          date: transaction.date,
          category: transaction.category || 'Imported',
          source: `bank_import_${bankType}`
        }

        console.log('Inserting transaction:', insertData)

        const { data: insertResult, error: insertError } = await supabase
          .from('expenses')
          .insert(insertData)
          .select()

        if (insertError) {
          console.error('Insert error:', insertError)
          failed++
        } else {
          console.log('✅ Transaction inserted successfully')
          imported++
        }

      } catch (error) {
        console.error(`Transaction ${i + 1} processing error:`, error)
        failed++
      }
    }

    const result = {
      success: imported,
      duplicates,
      failed,
      total: transactions.length
    }

    console.log('🎉 Import completed:', result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('💥 Import API error:', error)
    return NextResponse.json({ 
      error: 'Failed to import transactions', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}