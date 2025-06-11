// src/components/cards/CompletePDFReaderCard.tsx
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
import { 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Upload,
  Eye,
  Trash2 
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
  extractedText: string;
}

export default function CompletePDFReaderCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // PDF text extraction using PDF.js
  const extractTextFromPDF = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      
      script.onload = async () => {
        try {
          // @ts-ignore - Using global pdfjsLib from CDN
          const pdfjsLib = window.pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let fullText = '';
          
          // Extract text from all pages (limit to first 20 pages)
          const maxPages = Math.min(pdf.numPages, 20);
          console.log(`Processing ${maxPages} pages from PDF`);
          
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              // Process text items with better formatting
              let pageText = '';
              let currentY: number | null = null;
              
              textContent.items.forEach((item: any) => {
                const text = item.str.trim();
                if (!text) return;
                
                // Add line breaks for different Y positions (new lines)
                if (currentY !== null && Math.abs(currentY - item.transform[5]) > 5) {
                  pageText += '\n';
                }
                
                pageText += text + ' ';
                currentY = item.transform[5];
              });
              
              fullText += `\n=== Page ${pageNum} ===\n${pageText.trim()}\n`;
              
            } catch (pageError) {
              console.warn(`Error reading page ${pageNum}:`, pageError);
              fullText += `\n=== Page ${pageNum} (Error) ===\n[Could not extract text]\n`;
            }
          }
          
          // Clean up script
          document.head.removeChild(script);
          
          if (!fullText.trim()) {
            reject(new Error('No text could be extracted from the PDF'));
          } else {
            console.log(`Extracted ${fullText.length} characters from PDF`);
            resolve(fullText);
          }
          
        } catch (error) {
          document.head.removeChild(script);
          reject(new Error(`PDF processing failed: ${error}`));
        }
      };
      
      script.onerror = () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        reject(new Error('Failed to load PDF.js library'));
      };
      
      document.head.appendChild(script);
    });
  };

  // AI analysis of extracted text
  const analyzeWithAI = async (textContent: string, fileName: string): Promise<ProcessResult> => {
    const prompt = `
You are an expert at reading Dutch bank statements from all major banks (ING, Revolut, ABN AMRO, Rabobank, etc.).

Analyze this bank statement text and extract ALL transactions. The text comes from a PDF file named: ${fileName}

PDF Text Content:
${textContent.substring(0, 8000)}

Instructions:
1. Find and extract EVERY transaction (money movement) in the document
2. Skip account summaries, headers, footers, and balance information
3. Look for patterns like: dates, descriptions, amounts with +/- or Af/Bij
4. Convert Dutch date formats (DD-MM-YYYY) to YYYY-MM-DD
5. Determine if transaction is income (Bij, +, salary, etc.) or expense (Af, -, payments, etc.)
6. Smart categorization based on merchant/description
7. Clean up descriptions (remove extra codes, spaces)

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
  "bankDetected": "ING Bank",
  "summary": "Found X transactions from date Y to date Z"
}

Categories to use: groceries, transport, salary, dining, shopping, entertainment, utilities, healthcare, education, travel, other

Be very thorough - extract every transaction you can find!`;

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
      bankDetected: data.result.bankDetected || 'Unknown Bank',
      extractedText: textContent
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
        bankType: 'ai_pdf_import'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save transactions: ${errorText}`);
    }

    return await response.json();
  };

  // Main PDF processing function
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validation
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('PDF file is too large. Please use files smaller than 50MB');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setUploadedFileName(file.name);

    try {
      // Step 1: Extract text from PDF
      setProcessingStep("📄 Reading PDF content...");
      const extractedText = await extractTextFromPDF(file);
      
      if (!extractedText || extractedText.length < 100) {
        throw new Error('PDF appears to be empty, scanned, or password protected. Please try a text-based PDF.');
      }

      console.log(`Successfully extracted ${extractedText.length} characters from PDF`);

      // Step 2: AI Analysis
      setProcessingStep("🧠 AI is analyzing transactions...");
      const aiResult = await analyzeWithAI(extractedText, file.name);
      
      if (!aiResult.transactions || aiResult.transactions.length === 0) {
        throw new Error('No transactions found in the PDF. Please make sure this is a bank statement with transaction history.');
      }

      console.log(`AI found ${aiResult.transactions.length} transactions`);

      // Step 3: Save to database
      setProcessingStep("💾 Saving transactions to your account...");
      const saveResult = await saveTransactions(aiResult.transactions);
      
      console.log('Save result:', saveResult);

      // Success!
      setResult(aiResult);

    } catch (error) {
      console.error('PDF processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
    setUploadedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          AI Bank Statement Reader
        </CardTitle>
        <CardDescription>
          Upload PDF bank statements from any Dutch bank - AI will automatically extract and categorize all transactions
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        
        {/* Supported Banks */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className="text-center">
            <div className="font-semibold text-blue-700">🏦 ING</div>
            <div className="text-xs text-blue-600">Fully Supported</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-700">💳 Revolut</div>
            <div className="text-xs text-green-600">Fully Supported</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-700">🏛️ ABN AMRO</div>
            <div className="text-xs text-orange-600">Fully Supported</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-red-700">🏠 Rabobank</div>
            <div className="text-xs text-red-600">Fully Supported</div>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="space-y-4">
          <Label htmlFor="pdf-upload" className="text-base font-semibold">
            Select Bank Statement PDF
          </Label>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <Input
              ref={fileInputRef}
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handlePDFUpload}
              disabled={isProcessing}
              className="cursor-pointer"
            />
            <p className="text-sm text-gray-500 mt-2">
              Drop your PDF here or click to browse (Max 50MB)
            </p>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="space-y-4 p-6 bg-purple-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
              <div>
                <div className="font-semibold text-purple-700">Processing {uploadedFileName}...</div>
                <div className="text-sm text-purple-600">{processingStep}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-purple-600">
                AI is reading your bank statement and identifying all transactions
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div className="bg-purple-500 h-3 rounded-full animate-pulse transition-all duration-1000" 
                     style={{width: isProcessing ? '70%' : '0%'}}></div>
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
                <div className="font-semibold text-red-700">Processing Failed</div>
                <div className="text-sm text-red-600 mt-1">{error}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearResults}
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
                  <div className="text-sm text-green-600">{result.bankDetected} detected</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={clearResults}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
            
            {/* Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="font-bold text-2xl text-green-600">{result.totalFound}</div>
                <div className="text-sm text-green-700">Transactions Found</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="font-bold text-lg text-blue-600">{result.bankDetected}</div>
                <div className="text-sm text-blue-700">Bank Detected</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="font-bold text-lg text-purple-600">
                  €{result.transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-purple-700">Total Amount</div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-green-100 rounded-lg">
              <div className="font-semibold text-green-800 mb-2">Summary</div>
              <div className="text-sm text-green-700">{result.summary}</div>
            </div>

            {/* Transaction Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800">Transaction Preview</h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExtractedText(!showExtractedText)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showExtractedText ? 'Hide' : 'Show'} Extracted Text
                </Button>
              </div>
              
              {/* Sample Transactions */}
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {result.transactions.slice(0, 10).map((transaction, index) => (
                  <div key={index} className="p-3 bg-white rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{transaction.description}</div>
                        <div className="text-xs text-gray-500">
                          {transaction.date} • {transaction.category}
                        </div>
                      </div>
                      <div className={`font-semibold ${
                        transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'expense' ? '-' : '+'}€{transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {result.transactions.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {result.transactions.length - 10} more transactions
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Text Preview */}
            {showExtractedText && (
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-800">Extracted PDF Text</h4>
                <div className="max-h-40 overflow-y-auto p-3 bg-gray-50 rounded text-xs font-mono">
                  {result.extractedText.substring(0, 2000)}
                  {result.extractedText.length > 2000 && '...'}
                </div>
              </div>
            )}

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
          <div className="font-semibold">📋 How it works:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>• Upload your bank statement PDF</div>
            <div>• AI extracts text from all pages</div>
            <div>• Smart transaction identification</div>
            <div>• Automatic categorization & import</div>
          </div>
          <div className="pt-2 text-slate-400">
            💡 Tip: Works best with native PDF bank statements (not scanned images)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}