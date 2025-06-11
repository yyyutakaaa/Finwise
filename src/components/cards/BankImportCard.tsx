// components/cards/BankImportCard.tsx
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
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  transactions: ParsedTransaction[];
}

export default function BankImportCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bankFormats = {
    ing: {
      name: "ING Bank",
      columns: ["Datum", "Naam/Omschrijving", "Rekening", "Tegenrekening", "Code", "Af Bij", "Bedrag", "MutatieSoort", "Mededelingen"],
      dateFormat: "DD-MM-YYYY"
    },
    revolut: {
      name: "Revolut",
      columns: ["Type", "Product", "Started Date", "Completed Date", "Description", "Amount", "Fee", "Currency", "State", "Balance"],
      dateFormat: "YYYY-MM-DD"
    }
  };

  const parseCSV = (content: string, bankType: "ing" | "revolut"): ParsedTransaction[] => {
    try {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const transactions: ParsedTransaction[] = [];

      console.log(`Parsing ${lines.length} lines for ${bankType}`);

      // Skip header row and process data
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          let transaction: ParsedTransaction | null = null;
          
          if (bankType === "ing") {
            transaction = parseINGTransaction(line);
          } else if (bankType === "revolut") {
            transaction = parseRevolutTransaction(line);
          }
          
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          console.warn(`Failed to parse line ${i + 1}: "${line.substring(0, 50)}..." - ${error}`);
          // Continue processing other lines instead of failing completely
        }
      }

      console.log(`Successfully parsed ${transactions.length} transactions from ${lines.length - 1} lines`);
      return transactions;
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const parseINGTransaction = (line: string): ParsedTransaction | null => {
    try {
      // ING CSV format: "Datum","Naam/Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag","MutatieSoort","Mededelingen"
      const columns = parseCSVLine(line);
      
      if (columns.length < 7) {
        console.warn(`ING line has insufficient columns (${columns.length}): ${line.substring(0, 50)}`);
        return null;
      }

      const dateStr = columns[0]?.trim();
      const description = columns[1]?.trim() || "Unknown transaction";
      const direction = columns[5]?.trim(); // "Af" or "Bij"
      const amountStr = columns[6]?.trim();

      if (!dateStr || !amountStr || !direction) {
        console.warn(`ING line missing required fields: date="${dateStr}", amount="${amountStr}", direction="${direction}"`);
        return null;
      }

      const date = parseDate(dateStr, "DD-MM-YYYY");
      const amount = parseFloat(amountStr.replace(',', '.'));

      if (isNaN(amount) || amount === 0) {
        console.warn(`ING line has invalid amount: "${amountStr}"`);
        return null;
      }

      return {
        date: date.toISOString().split('T')[0],
        description: description.trim(),
        amount: Math.abs(amount),
        type: direction === "Bij" ? "income" : "expense",
        category: categorizeTransaction(description)
      };
    } catch (error) {
      console.warn(`Error parsing ING transaction: ${error}`);
      return null;
    }
  };

  const parseRevolutTransaction = (line: string): ParsedTransaction | null => {
    // Revolut CSV format varies, but typically: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
    const columns = parseCSVLine(line);
    if (columns.length < 6) return null;

    const type = columns[0];
    const date = parseDate(columns[3] || columns[2], "YYYY-MM-DD");
    const description = columns[4] || "Unknown transaction";
    const amount = parseFloat(columns[5]);

    if (isNaN(amount) || type === "EXCHANGE") return null; // Skip currency exchanges

    return {
      date: date.toISOString().split('T')[0],
      description: description.trim(),
      amount: Math.abs(amount),
      type: amount > 0 ? "income" : "expense",
      category: categorizeTransaction(description)
    };
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result.map(item => item.replace(/^"|"$/g, ''));
  };

  const parseDate = (dateStr: string, format: string): Date => {
    try {
      if (format === "DD-MM-YYYY") {
        const parts = dateStr.split('-');
        if (parts.length !== 3) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
        const year = parseInt(parts[2]);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          throw new Error(`Invalid date parts: ${dateStr}`);
        }
        
        const date = new Date(year, month, day);
        
        // Validate the date
        if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
          throw new Error(`Invalid date: ${dateStr}`);
        }
        
        return date;
      } else {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }
        return date;
      }
    } catch (error) {
      console.warn(`Date parsing error for "${dateStr}":`, error);
      // Return current date as fallback
      return new Date();
    }
  };

  const categorizeTransaction = (description: string): string => {
    const desc = description.toLowerCase();
    
    if (desc.includes('supermarkt') || desc.includes('grocery') || desc.includes('albert heijn')) return 'Food';
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('dining')) return 'Dining';
    if (desc.includes('fuel') || desc.includes('shell') || desc.includes('bp')) return 'Transport';
    if (desc.includes('rent') || desc.includes('huur') || desc.includes('mortgage')) return 'Housing';
    if (desc.includes('salary') || desc.includes('salaris') || desc.includes('income')) return 'Income';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('subscription')) return 'Entertainment';
    
    return 'Other';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);

    try {
      // File validation
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please select a CSV file');
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File too large. Please use files smaller than 10MB');
      }

      if (file.size === 0) {
        throw new Error('File is empty');
      }

      console.log(`Processing file: ${file.name}, size: ${(file.size / 1024).toFixed(1)}KB`);

      // Read file content safely
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('Failed to read file content'));
          }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file, 'UTF-8');
      });

      if (!content || content.length < 10) {
        throw new Error('File appears to be empty or corrupted');
      }

      console.log(`File content length: ${content.length} characters`);

      // Detect bank type based on file content
      let bankType: "ing" | "revolut" = "ing";
      const contentLower = content.toLowerCase();
      if (contentLower.includes("type,product,started date") || 
          contentLower.includes("revolut") ||
          contentLower.includes("completed date")) {
        bankType = "revolut";
      }

      console.log(`Detected bank type: ${bankType}`);

      // Parse CSV with chunking for large files
      const lines = content.split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header and one data row');
      }

      console.log(`Found ${lines.length} lines in CSV`);

      // Process in chunks to prevent memory issues
      const chunkSize = 100;
      const allTransactions: ParsedTransaction[] = [];
      
      for (let i = 1; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize);
        const chunkContent = [lines[0], ...chunk].join('\n'); // Include header
        
        try {
          const chunkTransactions = parseCSV(chunkContent, bankType);
          allTransactions.push(...chunkTransactions);
          
          // Update progress for large files
          if (lines.length > 200) {
            const progress = Math.min(100, Math.round((i / lines.length) * 100));
            console.log(`Processing: ${progress}%`);
          }
        } catch (chunkError) {
          console.warn(`Error processing chunk starting at line ${i}:`, chunkError);
        }
      }

      console.log(`Parsed ${allTransactions.length} transactions`);
      
      if (allTransactions.length === 0) {
        throw new Error("No valid transactions found in the file. Please check the file format.");
      }

      if (allTransactions.length > 1000) {
        throw new Error(`Too many transactions (${allTransactions.length}). Please split into smaller files of max 1000 transactions.`);
      }

      // Send to API to save to database
      const response = await fetch('/api/import-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: allTransactions,
          bankType,
          fileName: file.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import transactions');
      }

      const result = await response.json();
      setImportResult(result);

      console.log('Import completed:', result);

    } catch (error) {
      console.error('File upload error:', error);
      setError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-500" />
          Import Bank Statements
        </CardTitle>
        <CardDescription>
          Upload CSV files from ING or Revolut to automatically import your transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Supported Banks Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
          <div>
            <h4 className="font-semibold text-sm text-slate-700">ING Bank</h4>
            <p className="text-xs text-slate-600">Export from ING Business → CSV format</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-700">Revolut</h4>
            <p className="text-xs text-slate-600">Export from app → Statements → CSV</p>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="bank-file">Select bank statement file</Label>
          <Input
            ref={fileInputRef}
            id="bank-file"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="cursor-pointer"
          />
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm text-blue-700">Processing your bank statements...</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Success Result */}
        {importResult && (
          <div className="space-y-3 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-semibold text-green-700">Import completed!</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-green-600">{importResult.success}</div>
                <div className="text-green-700">Imported</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-yellow-600">{importResult.duplicates}</div>
                <div className="text-yellow-700">Duplicates</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-600">{importResult.failed}</div>
                <div className="text-red-700">Failed</div>
              </div>
            </div>

            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
              size="sm"
            >
              Refresh Dashboard
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-slate-500 space-y-1">
          <p><strong>ING:</strong> Log in → Transacties → Export → CSV</p>
          <p><strong>Revolut:</strong> App → Hub → Statements → Export → CSV</p>
          <p>Transactions will be automatically categorized and added to your expenses.</p>
        </div>
      </CardContent>
    </Card>
  );
}
