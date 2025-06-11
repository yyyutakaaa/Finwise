// components/cards/AIPDFReaderCard.tsx
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
import { FileText, Brain, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
}

interface PDFProcessResult {
  transactions: AITransaction[];
  totalFound: number;
  bankDetected: string;
  summary: string;
}

export default function AIPDFReaderCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [result, setResult] = useState<PDFProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Use CDN version to avoid build issues
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        
        script.onload = async () => {
          try {
            // @ts-ignore - Using global pdfjsLib from CDN
            const pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            // Extract text from all pages (limit to first 5 pages for performance)
            const maxPages = Math.min(pdf.numPages, 5);
            
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
              try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Combine text items with spaces and line breaks
                const pageText = textContent.items
                  .map((item: any) => {
                    // Add line breaks for better structure
                    return item.str + (item.hasEOL ? '\n' : ' ');
                  })
                  .join('');
                
                fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
              } catch (pageError) {
                console.warn(`Error reading page ${pageNum}:`, pageError);
              }
            }
            
            // Clean up script
            document.head.removeChild(script);
            resolve(fullText);
          } catch (error) {
            document.head.removeChild(script);
            reject(new Error(`PDF processing failed: ${error}`));
          }
        };
        
        script.onerror = () => {
          document.head.removeChild(script);
          reject(new Error('Failed to load PDF.js library'));
        };
      } catch (error) {
        reject(new Error(`PDF reading failed: ${error}`));
      }
    });
  };

  const analyzeWithAI = async (pdfText: string): Promise<PDFProcessResult> => {
    const prompt = `
You are an expert at reading Dutch bank statements. Analyze this PDF text and extract ALL transactions as a JSON array.

PDF Content:
${pdfText.substring(0, 8000)} // Limit text to avoid token limits

Rules:
1. Extract every transaction you can find
2. Format dates as YYYY-MM-DD
3. Negative amounts or "Af" = expense (positive number)
4. Positive amounts or "Bij" = income (positive number) 
5. Smart categorization: groceries, transport, salary, dining, shopping, etc.
6. Skip headers, footers, account summaries
7. Clean up descriptions (remove extra spaces, codes)

Return ONLY this JSON structure:
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
  "bankDetected": "ING Bank" or "Revolut" or "ABN AMRO" etc,
  "summary": "Found X transactions from date Y to Z"
}

Be very thorough - don't miss any transactions!`;

    const response = await fetch('/api/ai-pdf-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, pdfText })
    });

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    return data.result;
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
        bankType: 'ai_pdf_import'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save transactions');
    }

    return await response.json();
  };

  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validation
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('PDF too large. Please use files smaller than 10MB');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Extract text from PDF
      setProcessingStep("Reading PDF content...");
      const pdfText = await extractTextFromPDF(file);
      
      if (!pdfText || pdfText.length < 100) {
        throw new Error('PDF appears to be empty or unreadable');
      }

      console.log('Extracted PDF text length:', pdfText.length);

      // Step 2: AI Analysis
      setProcessingStep("AI is analyzing transactions...");
      const aiResult = await analyzeWithAI(pdfText);
      
      if (!aiResult.transactions || aiResult.transactions.length === 0) {
        throw new Error('No transactions found in the PDF. Please make sure it\'s a bank statement.');
      }

      console.log('AI found transactions:', aiResult.transactions.length);

      // Step 3: Save to database
      setProcessingStep("Saving transactions to your account...");
      await saveTransactions(aiResult.transactions);

      // Success!
      setResult({
        ...aiResult,
        totalFound: aiResult.transactions.length
      });

    } catch (error) {
      console.error('PDF processing error:', error);
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
          Upload PDF bank statements - AI will automatically extract and categorize all transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="pdf-file">Select bank statement PDF</Label>
          <Input
            ref={fileInputRef}
            id="pdf-file"
            type="file"
            accept=".pdf"
            onChange={handlePDFUpload}
            disabled={isProcessing}
            className="cursor-pointer"
          />
        </div>

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
            
            <div className="space-y-1">
              <div className="text-xs text-purple-600">AI is reading and understanding your transactions</div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
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
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-green-600">{result.totalFound}</div>
                <div className="text-green-700">Transactions Found</div>
              </div>
              <div>
                <div className="font-semibold text-blue-600">{result.bankDetected}</div>
                <div className="text-blue-700">Bank Detected</div>
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
          <p>1. Upload your bank statement PDF</p>
          <p>2. AI reads and extracts all transactions</p>
          <p>3. Smart categorization (groceries, transport, etc.)</p>
          <p>4. Automatic import to your Finwise account</p>
        </div>
      </CardContent>
    </Card>
  );
}