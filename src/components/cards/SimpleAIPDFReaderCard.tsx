// components/cards/SimpleAIPDFReaderCard.tsx
"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
}

export default function SimpleAIPDFReaderCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState(false);

  const analyzeWithAI = async (textContent: string): Promise<ProcessResult> => {
    const prompt = `
Analyze this Dutch bank statement text and extract ALL transactions. This could be from ING, Revolut, ABN AMRO, Rabobank, or any other bank.

Bank Statement Text:
${textContent.substring(0, 6000)}

Extract every transaction you can find and return ONLY valid JSON in this exact format:
{
  "transactions": [
    {
      "date": "2024-01-15", 
      "description": "Albert Heijn Amsterdam",
      "amount": 25.50,
      "category": "groceries",
      "type": "expense"
    }
  ],
  "summary": "Found X transactions from date Y to Z"
}

Rules:
- Format dates as YYYY-MM-DD (convert from DD-MM-YYYY if needed)
- All amounts as positive numbers
- type: "expense" for money going out, "income" for money coming in
- Smart categories: groceries, transport, salary, dining, shopping, entertainment, utilities, etc.
- Clean descriptions (remove bank codes, extra spaces)
- Skip headers, footers, balances, account info
- Look for patterns like dates, amounts with € or EUR, transaction descriptions

Be thorough - extract every transaction you can identify!`;

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
      transactions: data.result.transactions,
      totalFound: data.result.transactions.length,
      summary: data.result.summary
    };
  };

  const saveTransactions = async (transactions: AITransaction[]) => {
    const response = await fetch('/api/import-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: transactions.map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category
        })),
        bankType: 'ai_text_import'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save: ${errorText}`);
    }

    return await response.json();
  };

  const processText = async (textContent: string) => {
    if (!textContent || textContent.length < 50) {
      throw new Error('Text content is too short. Please provide more bank statement data.');
    }

    setProcessingStep("AI is analyzing your bank statement...");
    const aiResult = await analyzeWithAI(textContent);
    
    if (!aiResult.transactions || aiResult.transactions.length === 0) {
      throw new Error('No transactions found. Please check if this is a valid bank statement.');
    }

    console.log('AI found transactions:', aiResult.transactions);

    setProcessingStep("Saving transactions to your account...");
    await saveTransactions(aiResult.transactions);

    setResult(aiResult);
  };

  const handleManualTextAnalysis = async () => {
    if (!manualText.trim() || !user) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      await processText(manualText);
    } catch (error) {
      console.error('Manual text analysis error:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      setProcessingStep("Reading file content...");
      
      let textContent = '';
      
      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        textContent = await file.text();
      } else {
        throw new Error('Please use .txt files or copy-paste your bank statement text manually.');
      }

      await processText(textContent);

    } catch (error) {
      console.error('File processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Bank Statement Reader
        </CardTitle>
        <CardDescription>
          Upload text files or paste your bank statement text - AI will extract and categorize transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="statement-file">Upload bank statement file (.txt)</Label>
          <Input
            ref={fileInputRef}
            id="statement-file"
            type="file"
            accept=".txt,.csv"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="cursor-pointer"
          />
        </div>

        {/* Manual Text Input Toggle */}
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualInput(!showManualInput)}
            disabled={isProcessing}
          >
            {showManualInput ? 'Hide' : 'Show'} Manual Text Input
          </Button>
        </div>

        {/* Manual Text Input */}
        {showManualInput && (
          <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
            <Label htmlFor="manual-text">Paste your bank statement text here:</Label>
            <textarea
              id="manual-text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Copy and paste your bank statement text here... 

Example:
01-01-2024 Albert Heijn Amsterdam -25.50 EUR
02-01-2024 Salary deposit +2500.00 EUR
03-01-2024 Shell Station -45.00 EUR"
              className="w-full h-32 p-3 border rounded resize-none text-sm"
              disabled={isProcessing}
            />
            <Button
              onClick={handleManualTextAnalysis}
              disabled={isProcessing || !manualText.trim()}
              className="w-full"
            >
              {isProcessing ? 'Analyzing...' : 'Analyze Text with AI'}
            </Button>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
              <div>
                <div className="font-semibold text-purple-700">Processing your bank statement...</div>
                <div className="text-sm text-purple-600">{processingStep}</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div>
              <div className="font-semibold text-red-700">Processing Failed</div>
              <div className="text-sm text-red-600">{error}</div>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="font-semibold text-green-700">AI Analysis Complete!</div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-green-600 text-2xl">{result.totalFound}</div>
                <div className="text-green-700">Transactions Found</div>
              </div>
            </div>

            <div className="text-sm text-green-700 bg-green-100 p-3 rounded">
              {result.summary}
            </div>

            {/* Sample transactions preview */}
            {result.transactions.slice(0, 3).map((t, i) => (
              <div key={i} className="text-xs bg-white p-2 rounded border">
                <div className="flex justify-between">
                  <span className="font-medium">{t.description}</span>
                  <span className={t.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                    €{t.amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-gray-500">{t.date} • {t.category}</div>
              </div>
            ))}

            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Refresh Dashboard to See New Transactions
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-slate-500 space-y-1 border-t pt-3">
          <p><strong>How it works:</strong></p>
          <p>1. Copy text from your bank statement PDF</p>
          <p>2. Paste it in the manual input field</p>
          <p>3. AI reads and extracts all transactions</p>
          <p>4. Smart categorization and automatic import</p>
        </div>
      </CardContent>
    </Card>
  );
}