import { NextRequest, NextResponse } from 'next/server'
import { getFinancialAdvice, askFinancialQuestion } from '@/lib/openai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('ai_opt_in')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings?.ai_opt_in) {
      return NextResponse.json(
        { error: 'AI features are disabled in settings.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, data, question } = body

    let advice: string

    if (type === 'question' && question) {
      advice = await askFinancialQuestion(question, data)
    } else {
      advice = await getFinancialAdvice(data)
    }

    return NextResponse.json({ advice })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to get advice' },
      { status: 500 }
    )
  }
}
