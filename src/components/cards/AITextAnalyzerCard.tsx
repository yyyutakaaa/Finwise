// src/components/cards/AITextAnalyzerCard.tsx
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
import { Label } from "@/components/ui/label";
import { 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Copy,
  Trash2,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
}

interface AnalysisResult {
  transactions: AITransaction[];
  totalFound: number;
  summary: string;
  bankDetected: string;
  totalAmount: number;
  expenseAmount: number;
  incomeAmount: number;
}

export default function AITextAnalyzerCard() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>("");

  // Sample text to help users understand format
  const sampleText = `Voorbeeld bankafschrift tekst:

01-01-2024  Albert Heijn Amsterdam          -25.50 EUR
01-01-2024  Salary Monthly Payment         +2500.00 EUR  
02-01-2024  Shell Station Utrecht           -45.00 EUR
02-01-2024  Rent Payment January           -850.00 EUR
03-01-2024  Netflix Subscription            -12.99 EUR
04-01-2024  Restaurant De Librije           -85.00 EUR
05-01-2024  ING Interest Payment            +15.50 EUR

Of ING format:
Datum,Naam/Omschrijving,Rekening,Tegenrekening,Code,Af Bij,Bedrag
01-01-2024,"Albert Heijn","NL123","NL456","BA","Af","25.50"
01-01-2024,"Salaris","NL123","NL789","GT","Bij","2500.00"

Of Revolut format:
01 Jan 2024  Albert Heijn Amsterdam  €25.50  Card Payment
01 Jan 2024  Salary Deposit         €2500.00  Bank Transfer`;

  // AI analysis function
  const analyzeWithAI = async (textContent: string): Promise<AnalysisResult> => {
    const prompt = `
You are an expert at reading Dutch bank statements from all major banks (ING, Revolut, ABN AMRO, Rabobank, ASN Bank, etc.).

Analyze this bank statement text and extract ALL transactions. Be very thorough and find every single transaction.

Bank Statement Text:
${textContent}

Instructions:
1. Find and extract EVERY transaction (money movement) in the text
2. Skip account balances, headers, footers, and summary information  
3. Look for patterns like: dates, descriptions, amounts with +/- or Af/Bij or card payments
4. Convert ALL date formats to YYYY-MM-DD (from DD-MM-YYYY, DD/MM/YYYY, "01 Jan 2024", etc.)
5. Determine transaction type:
   - INCOME: Bij, +, salary, salaris, interest, rente, refund, deposit, income, wages
   - EXPENSE: Af, -, card payment, betaling, purchase, aankoop, withdrawal, opname
6. Smart categorization based on merchant/description:
   - groceries: Albert Heijn, Jumbo, Lidl, Aldi, supermarket, grocery
   - transport: Shell, BP, Esso, petrol, benzine, train, bus, taxi, parking
   - dining: restaurant, cafe, McDonald's, KFC, food delivery
   - entertainment: Netflix, Spotify, cinema, movie, theater
   - utilities: gas, water, electricity, internet, phone, telecom
   - healthcare: doctor, hospital, pharmacy, dentist, medical
   - shopping: clothing, electronics, Amazon, bol.com, retail
   - housing: rent, huur, mortgage, hypotheek, insurance
   - salary: salary, salaris, wages, loon, income
7. Clean descriptions: remove extra codes, numbers, and clean up text

Return ONLY this exact JSON structure:
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
  "bankDetected": "ING Bank",
  "summary": "Found X transactions from date Y to date Z, total expenses €X, total income €Y"
}

Be extremely thorough - extract every single transaction you can identify in the text!`;

    const response = await fetch('/api/ai-pdf-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, pdfText: textContent })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`AI analysis failed: ${errorData}`);
    }

    const data = await response.json();
    
    // Calculate totals
    const transactions = data.result.transactions || [];
    const expenseAmount = transactions
      .filter((t: AITransaction) => t.type === 'expense')
      .reduce((sum: number, t: AITransaction) => sum + t.amount, 0);
    
    const incomeAmount = transactions
      .filter((t: AITransaction) => t.type === 'income')
      .reduce((sum: number, t: AITransaction) => sum + t.amount, 0);

    return {
      transactions,
      totalFound: transactions.length,
      summary: data.result.summary || `Found ${transactions.length} transactions`,
      bankDetected: data.result.bankDetected || 'Unknown Bank',
      totalAmount: incomeAmount - expenseAmount,
      expenseAmount,
      incomeAmount
    };
  };

  // Save transactions to database
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
      throw new Error(`Failed to save transactions: ${errorText}`);
    }

    return await response.json();
  };

  // Main analysis function
  const handleAnalyze = async () => {
    if (!inputText.trim() || !user) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Validate input
      setProcessingStep("🔍 Validating bank statement text...");
      
      if (inputText.length < 50) {
        throw new Error('Text is too short. Please provide more bank statement content.');
      }

      // Step 2: AI Analysis
      setProcessingStep("🧠 AI is analyzing your transactions...");
      const aiResult = await analyzeWithAI(inputText);
      
      if (!aiResult.transactions || aiResult.transactions.length === 0) {
        throw new Error('No transactions found in the text. Please check if this is valid bank statement data.');
      }

      console.log(`AI found ${aiResult.transactions.length} transactions`);

      // Step 3: Save to database
      setProcessingStep("💾 Saving transactions to your account...");
      const saveResult = await saveTransactions(aiResult.transactions);
      
      console.log('Save result:', saveResult);

      // Success!
      setResult(aiResult);

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const clearAll = () => {
    setResult(null);
    setError(null);
    setInputText("");
  };

  const loadSampleText = () => {
    setInputText(sampleText);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Could not copy to clipboard');
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          AI Bank Statement Text Analyzer
        </CardTitle>
        <CardDescription>
          Paste your bank statement text and AI will automatically extract and categorize all transactions
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        
        {/* Supported Banks */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className="text-center">
            <div className="font-semibold text-blue-700">🏦 ING</div>
            <div className="text-xs text-blue-600">All Formats</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-700">💳 Revolut</div>
            <div className="text-xs text-green-600">All Formats</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-700">🏛️ ABN AMRO</div>
            <div className="text-xs text-orange-600">All Formats</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-red-700">🏠 Rabobank</div>
            <div className="text-xs text-red-600">All Formats</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-purple-700">🌿 ASN Bank</div>
            <div className="text-xs text-purple-600">All Formats</div>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="bank-text" className="text-base font-semibold">
              Bank Statement Text
            </Label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadSampleText}
                disabled={isProcessing}
              >
                <Copy className="h-4 w-4 mr-2" />
                Load Example
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
          
          <textarea
            id="bank-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your bank statement text here...

You can paste:
• PDF text copied from your bank statement
• CSV data from your bank export  
• Any transaction list with dates, descriptions, and amounts
• Multiple formats supported (ING, Revolut, ABN AMRO, etc.)

Example:
01-01-2024  Albert Heijn Amsterdam  -25.50 EUR
02-01-2024  Salary Payment         +2500.00 EUR"
            className="w-full h-64 p-4 border rounded-lg resize-none text-sm font-mono"
            disabled={isProcessing}
          />
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {inputText.length} characters • {inputText.split('\n').length} lines
            </div>
            <Button 
              onClick={handleAnalyze}
              disabled={isProcessing || !inputText.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-4 p-6 bg-purple-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
              <div>
                <div className="font-semibold text-purple-700">Processing your bank statement...</div>
                <div className="text-sm text-purple-600">{processingStep}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-purple-600">
                AI is reading and identifying all transactions in your text
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div className="bg-purple-500 h-3 rounded-full animate-pulse transition-all duration-1000" 
                     style={{width: isProcessing ? '75%' : '0%'}}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-700">Analysis Failed</div>
                <div className="text-sm text-red-600 mt-1">{error}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setError(null)}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Results */}
        {result && (
          <div className="space-y-6 p-6 bg-green-50 rounded-lg border border-green-200">
            
            {/* Success Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <div className="font-semibold text-green-700">AI Analysis Complete!</div>
                  <div className="text-sm text-green-600">{result.bankDetected} format detected</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Results
              </Button>
            </div>
            
            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div className="font-bold text-2xl text-blue-600">{result.totalFound}</div>
                <div className="text-sm text-blue-700">Transactions</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div className="font-bold text-lg text-green-600">€{result.incomeAmount.toFixed(2)}</div>
                <div className="text-sm text-green-700">Income</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="h-5 w-5 text-red-500" />
                </div>
                <div className="font-bold text-lg text-red-600">€{result.expenseAmount.toFixed(2)}</div>
                <div className="text-sm text-red-700">Expenses</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="font-bold text-lg text-gray-800">€{result.totalAmount.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Net Amount</div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-green-100 rounded-lg">
              <div className="font-semibold text-green-800 mb-2">Analysis Summary</div>
              <div className="text-sm text-green-700">{result.summary}</div>
            </div>

            {/* Transaction List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800">All Transactions</h4>
                <div className="text-sm text-gray-500">
                  Showing all {result.totalFound} transactions
                </div>
              </div>
              
              <div className="grid gap-2 max-h-80 overflow-y-auto">
                {result.transactions.map((transaction, index) => (
                  <div key={index} className="p-3 bg-white rounded border hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{transaction.description}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{transaction.date}</span>
                          <span>•</span>
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {transaction.category}
                          </span>
                        </div>
                      </div>
                      <div className={`font-semibold text-lg ${
                        transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'expense' ? '-' : '+'}€{transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              ✨ Refresh Dashboard to See New Transactions
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-slate-500 space-y-2 border-t pt-4">
          <div className="font-semibold">📋 How to use:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>• Copy text from your PDF bank statement</div>
            <div>• Paste CSV export from your bank</div>
            <div>• Include any transaction list format</div>
            <div>• AI automatically detects and categorizes</div>
          </div>
          <div className="pt-2 text-slate-400">
            💡 Tip: Works with any text format - just make sure dates, descriptions, and amounts are visible
          </div>
        </div>
      </CardContent>
    </Card>
  );
}