import AuthGuard from "@/components/layout/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CashBalanceCard from "@/components/cards/CashBalanceCard";
import ExpenseCard from "@/components/cards/ExpenseCard";
import AIAdviceCard from "@/components/cards/AIAdviceCard";
import WelcomeHeader from "@/components/layout/WelcomeHeader";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <WelcomeHeader />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CashBalanceCard />
            <ExpenseCard />
            <AIAdviceCard />
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}