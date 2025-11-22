"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WelcomeHeader() {
  const { user } = useAuth();
  const router = useRouter();

  const getUserName = () => {
    if (!user) return "Guest";
    
    // Try to get name from user metadata
    const fullName = user.user_metadata?.full_name;
    if (fullName) return fullName;
    
    // Fallback to email name part
    const emailName = user.email?.split('@')[0];
    return emailName || "User";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {getGreeting()}, {getUserName()}!
        </h1>
        <p className="text-slate-600 mt-1">
          Here&apos;s your financial overview for today
        </p>
      </div>
      
      <Button 
        variant="outline" 
        onClick={() => router.push('/settings')}
        className="flex items-center space-x-2"
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </Button>
    </div>
  );
}