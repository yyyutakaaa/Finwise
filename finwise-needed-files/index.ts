export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

export interface Expense {
  id: string
  user_id: string
  amount: number
  description: string
  type: 'fixed' | 'variable'
  category: string
  date: string
  created_at: string
}

export interface CashBalance {
  id: string
  user_id: string
  amount: number
  updated_at: string
}

export interface AuthFormData {
  email: string
  password: string
  fullName?: string
}
