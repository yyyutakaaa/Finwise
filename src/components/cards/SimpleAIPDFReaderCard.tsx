import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

interface ProcessResult {
  transactions: AITransaction[];
  totalFound: number;
  summary: string;
  bankDetected?: string;
}

export function SimplifiedAIPDFReaderCard() {
  const { user } = useAuth();
  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Analyze text with AI
  const analyzeWithAI = async (textContent: string): Promise<ProcessResult> => {
    const prompt = `
Extract ALL transactions from this bank statement text (likely from Revolut or another Dutch bank).

Rules:
1. Convert Dutch dates (e.g., "1 mei 2025") to ISO format "2025-05-01"
2. For amounts: remove € symbol, convert European format (1.234,56 → 1234.56)
3. Determine type: "Uitgegeven geld" or negative = expense, "Ontvangen geld" or positive = income
4. Smart categorization based on merchant names
5. Clean descriptions (remove card numbers, extra codes)
6. Skip headers, footers, balance summaries - only extract actual transactions

Categories to use: groceries, transport, salary, dining, shopping, entertainment, utilities, healthcare, education, transfer, other

Return ONLY valid JSON:
{
  "transactions": [
    {
      "date": "2025-05-01",
      "description": "Aldi",
      "amount": 0.55,
      "type": "expense",
      "category": "groceries"
    }
  ],
  "bankDetected": "Revolut",
  "summary": "Found X transactions from Y to Z"
}`;

    const response = await fetch('/api/ai-pdf-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, pdfText: textContent })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI analysis error:', errorText);
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    console.log('AI analysis result:', data);
    
    return {
      transactions: data.result.transactions || [],
      totalFound: data.result.transactions?.length || 0,
      summary: data.result.summary || 'Analysis completed',
      bankDetected: data.result.bankDetected
    };
  };

  // Save transactions to database
  const saveTransactions = async (transactions: AITransaction[]) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    console.log('Preparing to save transactions:', {
      count: transactions.length,
      userId: user.id,
      sample: transactions[0]
    });

    const requestBody = {
      transactions: transactions,
      bankType: 'manual_import',
      userId: user.id
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('/api/import-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('Save response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Failed to save: ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return { success: transactions.length, failed: 0 };
    }
  };

  // Process the pasted text
  const processText = async () => {
    if (!manualText.trim()) {
      setError('Please paste your bank statement text first');
      return;
    }

    if (!user) {
      setError('Please log in to continue');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Analyze with AI
      setProcessingStep('🧠 AI is analyzing your bank statement...');
      const aiResult = await analyzeWithAI(manualText);
      
      if (!aiResult.transactions || aiResult.transactions.length === 0) {
        throw new Error('No transactions found. Please check if you pasted the complete bank statement.');
      }

      console.log(`AI found ${aiResult.transactions.length} transactions`);

      // Step 2: Save to database
      setProcessingStep('💾 Saving transactions to your account...');
      const saveResult = await saveTransactions(aiResult.transactions);
      
      console.log('Save completed:', saveResult);

      // Success!
      setResult(aiResult);
      
      // Clear the text area after successful import
      setManualText('');

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Clear everything
  const clearAll = () => {
    setManualText('');
    setResult(null);
    setError(null);
  };

}