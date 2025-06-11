import AuthGuard from "@/components/layout/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SettingsForm from "@/components/forms/SettingsForm";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1">
              Manage your account preferences and security
            </p>
          </div>
          
          <SettingsForm />
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}