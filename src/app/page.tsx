"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // User is logged in, go to dashboard
        router.push("/dashboard");
      } else {
        // User is not logged in, go to login
        router.push("/login");
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Finwise</h1>
        <p className="text-slate-600">Loading your financial dashboard...</p>
        <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto mt-4"></div>
      </div>
    </div>
  );
}
