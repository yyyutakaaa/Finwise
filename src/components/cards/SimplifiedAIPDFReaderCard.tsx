// src/components/cards/CompletePDFReaderCard.tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Sparkles,
  Copy,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
}

interface ProcessResult {
  transactions: AITransaction[];
  totalFound: number;
  summary: string;
  bankDetected: string;
}

export default function CompletePDFReaderCard() {
  const { user } = useAuth();
  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Analysis
  const analyzeWithAI = async (textContent: string, fileName: string = 'manual'): Promise<ProcessResult> => {
    const prompt = `
You are an expert at reading Dutch bank statements, especially from Revolut. Extract ALL transactions from this text.

The text comes from: ${fileName}

Text Content:
${textContent.substring(0, 8000)}

Instructions:
1. Find and extract EVERY transaction in the document
2. Convert Dutch dates (e.g., "1 mei 2025") to ISO format "2025-05-01"
3. For Revolut: "Uitgegeven geld" = expense, "Ontvangen geld" = income
4. Clean amounts: remove €, convert European format (1.234,56 → 1234.56)
5. Smart categorization based on merchant/description
6. Skip headers, footers, balance summaries

Return ONLY this JSON structure:
{
  "transactions": [
    {
      "date": "2025-05-01",
      "description": "Aldi",
      "amount": 0.55,
      "category": "groceries",
      "type": "expense"
    }
  ],
  "bankDetected": "Revolut",
  "summary": "Found X transactions from date Y to date Z"
}

Categories: groceries, transport, salary, dining, shopping, entertainment, utilities, healthcare, education, transfer, other`;

    const response = await fetch('/api/ai-pdf-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, pdfText: textContent })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const data = await response.json();
    return {
      transactions: data.result.transactions || [],
      totalFound: data.result.transactions?.length || 0,
      summary: data.result.summary || 'Analysis completed',
      bankDetected: data.result.bankDetected || 'Unknown Bank'
    };
  };

  // Save transactions to database
  const saveTransactions = async (transactions: AITransaction[]) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('Saving transactions:', {
      transactionCount: transactions.length,
      userId: user.id,
      sampleTransaction: transactions[0]
    });

    const requestBody = {
      transactions: transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category
      })),
      bankType: 'manual_text_import',
      userId: user.id
    };

    const response = await fetch('/api/import-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', errorText);
      throw new Error(`Failed to save transactions: ${errorText}`);
    }

    const result = await response.json();
    console.log('Save result:', result);
    return result;
  };

  // Process the pasted text
  const processText = async () => {
    if (!manualText.trim() || !user) {
      setError('Please paste your bank statement text first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: AI Analysis
      setProcessingStep("🧠 AI is analyzing your bank statement...");
      const aiResult = await analyzeWithAI(manualText);
      
      if (!aiResult.transactions || aiResult.transactions.length === 0) {
        throw new Error('No transactions found. Please check if you pasted the complete bank statement.');
      }

      console.log(`AI found ${aiResult.transactions.length} transactions`);

      // Step 2: Save to database
      setProcessingStep("💾 Saving transactions to your account...");
      const saveResult = await saveTransactions(aiResult.transactions);
      
      console.log('Save completed:', saveResult);

      // Success!
      setResult(aiResult);

    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
    setManualText('');
  };

}