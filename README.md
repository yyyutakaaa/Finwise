# Finwise - AI Personal Finance Assistant

A modern web application for personal financial management with AI-powered insights and advice. Built with Next.js, Supabase, and OpenAI GPT.

## Features

### Core Functionality
- **Cash Balance Management**: Track your available funds with real-time database synchronization
- **Expense Tracking**: Add, edit, and categorize expenses as fixed or variable
- **Monthly Auto-Cleanup**: Variable expenses automatically reset each month while fixed expenses persist
- **AI Financial Advisor**: Get personalized financial advice powered by OpenAI GPT
- **User Authentication**: Secure login/registration with email and Google OAuth
- **Account Management**: Update profile information, change passwords, and manage account settings

### Technical Features
- **Progressive Web App (PWA)**: Install and use as a native app on any device
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-time Data**: Live synchronization with Supabase backend
- **Type Safety**: Full TypeScript implementation
- **Modern UI**: Clean interface built with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with email and OAuth providers
- **AI Integration**: OpenAI GPT API for financial advice
- **Deployment**: Vercel
- **Language**: TypeScript

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Supabase account and project
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finwise.git
cd finwise
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables file:
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

5. Set up database tables in Supabase:

```sql
-- Users table (handled by Supabase Auth)

-- Expenses table
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(20) CHECK (type IN ('fixed', 'variable')) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash balances table
CREATE TABLE cash_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  amount DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Cleanup log table
CREATE TABLE expense_cleanup_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_count INTEGER,
  cleanup_date TIMESTAMPTZ DEFAULT NOW()
);
```

6. Enable Row Level Security (RLS) policies:

```sql
-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_cleanup_log ENABLE ROW LEVEL SECURITY;

-- Expenses policies
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Cash balances policies
CREATE POLICY "Users can view own cash balance" ON cash_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash balance" ON cash_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cash balance" ON cash_balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Cleanup log policies
CREATE POLICY "Users can view own cleanup log" ON expense_cleanup_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cleanup log" ON expense_cleanup_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

7. Run the development server:
```bash
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── ai-advice/     # AI advice endpoint
│   │   └── auth/          # Authentication callbacks
│   ├── dashboard/         # Dashboard page
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── settings/         # Settings page
│   ├── globals.css       # Global styles
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── cards/            # Feature cards
│   ├── forms/            # Form components
│   ├── layout/           # Layout components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── expense-helpers.ts # Expense CRUD operations
│   ├── finance-helpers.ts # Financial calculations
│   ├── openai.ts         # AI integration
│   ├── supabase.ts       # Database client
│   └── utils.ts          # General utilities
└── types/                # TypeScript type definitions
```

## Key Features Explained

### Automatic Expense Cleanup
The application automatically removes variable expenses at the beginning of each month while preserving fixed expenses. This helps maintain clean monthly budgets.

### AI Financial Advisor
Users can get personalized financial advice by:
- Asking specific questions about purchases
- Receiving general monthly financial analysis
- Getting suggestions for savings and spending optimization

### Authentication Flow
- Email/password registration and login
- Google OAuth integration
- Secure session management with Supabase Auth
- Password reset functionality

### Data Management
- Real-time synchronization with PostgreSQL database
- Row-level security for data isolation
- Automatic cleanup of stale data
- Export capabilities for user data

## API Endpoints

### AI Advice
`POST /api/ai-advice`
- Generates financial advice based on user data
- Supports both general advice and specific questions

### Authentication
`GET /auth/callback`
- Handles OAuth callback for Google authentication

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `OPENAI_API_KEY` | OpenAI API key for GPT integration | Yes |

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write meaningful commit messages

## Testing

Run the test suite:
```bash
npm test
```

Build and check for errors:
```bash
npm run build
```

## Troubleshooting

### Common Issues

**Build Errors**
- Ensure all environment variables are set correctly
- Check TypeScript errors with `npm run type-check`
- Verify Supabase connection

**Authentication Issues**
- Verify Supabase URL and keys
- Check OAuth provider configuration
- Ensure RLS policies are correctly set

**AI Features Not Working**
- Verify OpenAI API key is valid
- Check API quota and usage limits
- Review error logs for specific issues

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check existing documentation
- Review Supabase and OpenAI documentation for integration issues
