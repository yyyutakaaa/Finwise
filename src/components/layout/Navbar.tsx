'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function Navbar() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-xl font-bold text-slate-900 hover:text-slate-700">
              Finwise
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    📊 Dashboard
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="ghost" size="sm">
                    ⚙️ Settings
                  </Button>
                </Link>
              </>
            )}
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}