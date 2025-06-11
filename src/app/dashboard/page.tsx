// src/app/dashboard/page.tsx
import AuthGuard from "@/components/layout/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CashBalanceCard from "@/components/cards/CashBalanceCard";
import ExpenseCard from "@/components/cards/ExpenseCard";
import AIAdviceCard from "@/components/cards/AIAdviceCard";
import CompletePDFReaderCard from "@/components/cards/CompletePDFReaderCard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600">Welcome back to Finwise</p>
          </div>

          {/* Main Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CashBalanceCard />
            <ExpenseCard />
            <AIAdviceCard />
          </div>

          {/* AI PDF Reader - The Working One */}
          <div className="mt-8">
            <CompletePDFReaderCard />
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}