import { NextRequest, NextResponse } from 'next/server'
import { getFinancialAdvice, askFinancialQuestion, type FinancialData } from '@/lib/openai'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { type, data, question } = body

        if (!data) {
            return NextResponse.json({ error: 'Financial data is required' }, { status: 400 })
        }

        let advice: string

        if (type === 'general') {
            advice = await getFinancialAdvice(data as FinancialData)
        } else if (type === 'question' && question) {
            advice = await askFinancialQuestion(question, data as FinancialData)
        } else {
            return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
        }

        return NextResponse.json({ advice })
    } catch (error) {
        console.error('AI Advice API Error:', error)
        return NextResponse.json({ error: 'Failed to generate advice' }, { status: 500 })
    }
}