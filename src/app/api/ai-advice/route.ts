import { NextRequest, NextResponse } from 'next/server'
import { getFinancialAdvice, askFinancialQuestion } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data, question } = body

    let advice: string

    if (type === 'question' && question) {
      advice = await askFinancialQuestion(question, data)
    } else {
      advice = await getFinancialAdvice(data)
    }

    return NextResponse.json({ advice })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to get advice' },
      { status: 500 }
    )
  }
}