"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsForm() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Profile form
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
  });
  
  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // AI Settings
  const [aiOptIn, setAiOptIn] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const fetchAiSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('ai_opt_in')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setAiOptIn(data.ai_opt_in);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.user_metadata?.full_name || "",
        email: user.email || "",
      });
      fetchAiSettings();
    }
  }, [user, fetchAiSettings]);

  const handleAiToggle = async (checked: boolean) => {
    if (checked) {
      // Show confirmation dialog if turning ON
      setIsAiDialogOpen(true);
    } else {
      // Turn OFF immediately
      updateAiSettings(false);
    }
  };

  const confirmAiEnable = async () => {
    await updateAiSettings(true);
    setIsAiDialogOpen(false);
  };

  const updateAiSettings = async (enabled: boolean) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ai_opt_in: enabled,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setAiOptIn(enabled);
      setMessage({
        type: 'success',
        text: `AI features ${enabled ? 'enabled' : 'disabled'} successfully.`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setMessage({ type: 'error', text: errorMessage });
      // Revert switch if update failed
      setAiOptIn(!enabled);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      // Update email if changed
      if (profileData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileData.email,
        });

        if (emailError) {
          setMessage({ type: 'error', text: emailError.message });
          setLoading(false);
          return;
        }
      }

      // Update profile data
      const { error: profileError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.fullName,
        }
      });

      if (profileError) {
        setMessage({ type: 'error', text: profileError.message });
      } else {
        setMessage({ 
          type: 'success', 
          text: profileData.email !== user.email 
            ? 'Profile updated! Please check your new email for confirmation.'
            : 'Profile updated successfully!'
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "⚠️ Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your data including expenses, cash balance, and AI advice history."
    );

    if (!confirmed) return;

    const doubleConfirm = confirm(
      "This is your final warning. Type 'DELETE' and click OK to permanently delete your account."
    );

    if (!doubleConfirm) return;

    setLoading(true);
    setMessage(null);

    try {
      // Note: Account deletion through Supabase requires admin privileges
      // For now, we'll sign out the user and they can contact support
      setMessage({ 
        type: 'error', 
        text: 'Account deletion requires admin approval. Please contact support to delete your account.' 
      });
      
      // Alternatively, you could implement a soft delete by updating a status field
      // and hiding the user's data, then actually delete it later via admin panel
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Features</CardTitle>
          <CardDescription>
            Manage your AI settings and data privacy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="ai-mode" className="text-base font-medium">
                Enable AI Features
              </Label>
              <span className="text-sm text-muted-foreground">
                Allow the app to send anonymized data to OpenAI for financial advice.
              </span>
            </div>
            <Switch
              id="ai-mode"
              checked={aiOptIn}
              onCheckedChange={handleAiToggle}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={profileData.fullName}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  fullName: e.target.value
                }))}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  email: e.target.value
                }))}
                placeholder="your@email.com"
              />
              <p className="text-xs text-slate-500">
                Changing your email will require verification
              </p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({
                  ...prev,
                  newPassword: e.target.value
                }))}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({
                  ...prev,
                  confirmPassword: e.target.value
                }))}
                placeholder="Confirm new password"
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>
            Quick actions and navigation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
            >
              ← Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-medium text-red-800 mb-2">Delete Account</h4>
              <p className="text-sm text-red-600 mb-4">
                Once you delete your account, there is no going back. This will permanently delete your profile, expenses, and all associated data.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleDeleteAccount}
                disabled={loading}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Confirmation Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable AI Features?</DialogTitle>
            <DialogDescription>
              Let op: Door dit aan te zetten, geef je toestemming om geanonimiseerde financiële data naar OpenAI te sturen voor advies. Wil je doorgaan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAiEnable}>
              Bevestigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
