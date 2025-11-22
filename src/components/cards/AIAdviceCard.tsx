"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { getExpenses } from "@/lib/expense-helpers";
import {
  calculateMonthlyExpenses,
  getCashBalance,
} from "@/lib/finance-helpers";
import { Lock } from "lucide-react";

interface FinancialData {
  cashBalance: number;
  monthlyExpenses: {
    total: number;
    fixed: number;
    variable: number;
  };
  expenses: Array<{
    description: string;
    amount: number;
    type: "fixed" | "variable";
    date: string;
  }>;
}

export default function AIAdviceCard() {
  const { user } = useAuth();
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [hasLoadedAdvice, setHasLoadedAdvice] = useState(false); // Track if we've loaded advice
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAiStatus = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_settings')
        .select('ai_opt_in')
        .eq('user_id', user.id)
        .single();

      setAiEnabled(!!data?.ai_opt_in);
    };

    checkAiStatus();
  }, [user]);

  // Get user's financial data
  const getFinancialData =
    useCallback(async (): Promise<FinancialData | null> => {
      if (!user) return null;

      const expenses = await getExpenses(user.id);
      const monthlyExpenses = calculateMonthlyExpenses(expenses);
      const balanceData = await getCashBalance(user.id);
      const cashBalance = balanceData?.amount || 0;

      return {
        cashBalance,
        monthlyExpenses,
        expenses: expenses.slice(0, 10), // Last 10 expenses
      };
    }, [user]);

  const getGeneralAdvice = useCallback(async () => {
    const financialData = await getFinancialData();
    if (!financialData) return;

    setLoading(true);
    try {
      const response = await fetch("/api/ai-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "general",
          data: financialData,
        }),
      });

      if (response.status === 403) {
        setAdvice("AI features are disabled in settings.");
        setAiEnabled(false);
        return;
      }

      const result = await response.json();
      if (result.advice) {
        setAdvice(result.advice);
        setHasLoadedAdvice(true);
      } else {
        setAdvice("Unable to generate advice at this time.");
      }
    } catch (error) {
      console.error("Error getting advice:", error);
      setAdvice("Error connecting to AI service.");
    } finally {
      setLoading(false);
    }
  }, [getFinancialData]);

  const askQuestion = async () => {
    if (!question.trim()) return;

    const financialData = await getFinancialData();
    if (!financialData) return;

    setLoading(true);
    try {
      const response = await fetch("/api/ai-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "question",
          question: question,
          data: financialData,
        }),
      });

      if (response.status === 403) {
        setAdvice("AI features are disabled in settings.");
        setAiEnabled(false);
        return;
      }

      const result = await response.json();
      if (result.advice) {
        setAdvice(result.advice);
        setQuestion("");
        setShowQuestionForm(false);
        setHasLoadedAdvice(true);
      } else {
        setAdvice("Unable to process your question.");
      }
    } catch (error) {
      console.error("Error asking question:", error);
      setAdvice("Error connecting to AI service.");
    } finally {
      setLoading(false);
    }
  };

  // If AI is disabled, show a placeholder
  if (aiEnabled === false) {
    return (
      <Card className="bg-slate-50/50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-lg text-slate-500">AI Features Disabled</CardTitle>
          </div>
          <CardDescription>
            Enable AI in settings to get personalized financial advice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/settings">Go to Settings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showQuestionForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ask Finwise AI</CardTitle>
          <CardDescription>Get personalized financial advice</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Can I afford a €500 vacation?"
                className="mb-3"
                onKeyPress={(e) => e.key === "Enter" && askQuestion()}
              />
              <div className="text-xs text-slate-500 mb-3">
                Try asking: &quot;Can I afford X?&quot;, &quot;How can I save
                more?&quot;, &quot;Should I increase my budget?&quot;
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={askQuestion}
                disabled={loading || !question.trim()}
                className="flex-1"
              >
                {loading ? "Thinking..." : "Ask AI"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowQuestionForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI Financial Advice</CardTitle>
        <CardDescription>Smart insights powered by AI</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
              <span className="text-sm text-slate-600">
                Analyzing your finances...
              </span>
            </div>
          ) : (
            <div className="text-sm text-slate-700 leading-relaxed">
              {advice || (
                <div className="text-center py-6 text-slate-500">
                  <div className="mb-2">💡</div>
                  <div>Ready to analyze your finances!</div>
                  <div className="text-xs mt-1">
                    Click &quot;Get Analysis&quot; to receive personalized AI advice
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={getGeneralAdvice}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Analyzing..." : hasLoadedAdvice ? "Refresh Analysis" : "Get Analysis"}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowQuestionForm(true)}
              disabled={loading}
              className="flex-1"
            >
              Ask Question
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
