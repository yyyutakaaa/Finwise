export interface Expense {
  id: string
  amount: number
  description: string
  type: 'fixed' | 'variable'
  date: string
}

export function getExpenses(userId: string): Expense[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(`expenses-${userId}`)
  return stored ? JSON.parse(stored) : []
}

export function addExpense(userId: string, expense: Omit<Expense, 'id'>): void {
  if (typeof window === 'undefined') return
  const expenses = getExpenses(userId)
  const newExpense = {
    ...expense,
    id: Date.now().toString(),
    date: new Date().toISOString()
  }
  expenses.push(newExpense)
  localStorage.setItem(`expenses-${userId}`, JSON.stringify(expenses))
}

export function updateExpense(userId: string, expenseId: string, updates: Partial<Omit<Expense, 'id'>>): void {
  if (typeof window === 'undefined') return
  const expenses = getExpenses(userId)
  const index = expenses.findIndex(expense => expense.id === expenseId)

  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...updates }
    localStorage.setItem(`expenses-${userId}`, JSON.stringify(expenses))
  }
}

export function deleteExpense(userId: string, expenseId: string): void {
  if (typeof window === 'undefined') return
  const expenses = getExpenses(userId)
  const filteredExpenses = expenses.filter(expense => expense.id !== expenseId)
  localStorage.setItem(`expenses-${userId}`, JSON.stringify(filteredExpenses))
}

export function calculateMonthlyExpenses(expenses: Expense[]) {
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const monthlyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date)
    return expenseDate.getMonth() === currentMonth &&
      expenseDate.getFullYear() === currentYear
  })

  const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const fixed = monthlyExpenses
    .filter(expense => expense.type === 'fixed')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const variable = monthlyExpenses
    .filter(expense => expense.type === 'variable')
    .reduce((sum, expense) => sum + expense.amount, 0)

  return { total, fixed, variable }
}