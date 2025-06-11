// src/app/api/ai-pdf-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, pdfText } = await request.json()

    if (!prompt || !pdfText) {
      return NextResponse.json({ error: 'Missing prompt or PDF text' }, { status: 400 })
    }

    console.log('Processing AI analysis request...')
    console.log('PDF text length:', pdfText.length)
    console.log('First 500 chars:', pdfText.substring(0, 500))

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use latest model
      messages: [
        {
          role: 'system',
          content: `You are an expert at reading Dutch bank statements and extracting transaction data. 
          You understand various Dutch bank formats (ING, Revolut, ABN AMRO, Rabobank, etc.).
          Always return valid JSON only - no explanations or markdown formatting.
          Focus on finding actual money transactions, not account balances or summaries.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 4000,
    })

    const aiResponse = completion.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    console.log('AI response length:', aiResponse.length)
    console.log('AI response preview:', aiResponse.substring(0, 500))

    // Parse the JSON response
    let parsedResult
    try {
      // Clean the response more thoroughly
      let cleanedResponse = aiResponse.trim();
      
      // Remove any markdown formatting
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^[^{]*/, '') // Remove text before first {
        .replace(/[^}]*$/, '') // Remove text after last }
        .trim();
      
      // Find JSON object
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd);
      }
      
      console.log('Cleaned response for parsing:', cleanedResponse.substring(0, 200));
      
      parsedResult = JSON.parse(cleanedResponse);
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('Full AI response:', aiResponse);
      
      // Fallback: try to extract basic info and create minimal response
      try {
        // Look for any numbers that could be amounts
        const amounts = aiResponse.match(/\d+\.?\d*/g) || [];
        console.log('Found potential amounts:', amounts);
        
        // Create a basic fallback response
        parsedResult = {
          transactions: [],
          bankDetected: "Unknown Bank",
          summary: "AI response could not be parsed properly. Please try again with clearer transaction data."
        };
        
      } catch (fallbackError) {
        throw new Error(`AI returned unparseable response. Please try again.`);
      }
    }

    // Validate the structure
    if (!parsedResult.transactions || !Array.isArray(parsedResult.transactions)) {
      console.error('Invalid structure:', parsedResult)
      throw new Error('AI response missing transactions array')
    }

    // Validate and clean each transaction
    const validTransactions = parsedResult.transactions
      .filter((t: any) => {
        return t.date && t.description && typeof t.amount === 'number' && t.type
      })
      .map((t: any) => ({
        date: t.date,
        description: t.description.substring(0, 100), // Limit description length
        amount: Math.abs(Number(t.amount)), // Ensure positive number
        category: t.category || 'other',
        type: t.type === 'income' ? 'income' : 'expense'
      }))

    console.log(`Validated ${validTransactions.length} transactions out of ${parsedResult.transactions.length}`)

    return NextResponse.json({
      result: {
        transactions: validTransactions,
        bankDetected: parsedResult.bankDetected || 'Unknown Bank',
        summary: parsedResult.summary || `Found ${validTransactions.length} transactions`
      }
    })

  } catch (error) {
    console.error('AI PDF analysis error:', error)
    
    return NextResponse.json({
      error: 'AI analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}