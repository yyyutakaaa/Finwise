import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface FinancialData {
  cashBalance: number
  monthlyExpenses: {
    total: number
    fixed: number
    variable: number
  }
  expenses: Array<{
    description: string
    amount: number
    type: 'fixed' | 'variable'
    date: string
  }>
}

export async function getFinancialAdvice(data: FinancialData): Promise<string> {
  const prompt = `You are Finwise AI, a helpful personal finance advisor. Analyze this user's financial data and provide practical, actionable advice.

USER'S FINANCIAL DATA:
- Current Cash Balance: €${data.cashBalance}
- Monthly Expenses: €${data.monthlyExpenses.total} (Fixed: €${data.monthlyExpenses.fixed}, Variable: €${data.monthlyExpenses.variable})
- Recent Expenses: ${data.expenses.slice(0, 5).map(e => `€${e.amount} on ${e.description} (${e.type})`).join(', ')}

PROVIDE:
1. A brief assessment of their financial health (2-3 sentences)
2. How much they can safely spend this month
3. One specific actionable tip for improvement
4. One positive reinforcement

Keep it friendly, concise (under 150 words), and encouraging. Use euros (€) for all amounts.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Finwise AI, a friendly and knowledgeable personal finance advisor. Always be encouraging and provide practical advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "Unable to generate advice at this time."
  } catch (error) {
    console.error('OpenAI API Error:', error)
    return "I'm having trouble connecting to the AI service right now. Please try again later."
  }
}

export async function askFinancialQuestion(question: string, data: FinancialData): Promise<string> {
  const prompt = `You are Finwise AI. The user has asked: "${question}"

Their financial context:
- Cash Balance: €${data.cashBalance}
- Monthly Expenses: €${data.monthlyExpenses.total}
- Fixed Costs: €${data.monthlyExpenses.fixed}
- Variable Costs: €${data.monthlyExpenses.variable}

Provide a helpful, specific answer based on their financial situation. Be concise (under 100 words) and practical.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Finwise AI, a helpful personal finance advisor. Give practical, specific advice based on the user's actual financial data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "I couldn't process that question right now."
  } catch (error) {
    console.error('OpenAI API Error:', error)
    return "I'm having trouble connecting right now. Please try again later."
  }
}
