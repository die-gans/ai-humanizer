# AI Humanizer — Monetization & Feature Strategy

Our goal is to be the **most transparent and effective** writing refinement tool on the market. We offer a quality-first approach with a clear path for individuals and businesses.

---

## 1. Simple 3-Tier Strategy

| Feature | Free | Pro ($15/mo) | Business ($49/mo) |
| :--- | :--- | :--- | :--- |
| **Word Limit** | 500 words / day | 25,000 words / mo | 100,000 words / mo |
| **Processing Intensity** | Light & Standard | All (Light, Std, Heavy) | All + Batch |
| **"Ultra" Bypass Mode** | ❌ | ✅ | ✅ |
| **Voice Training** | ❌ | ✅ (1 profile) | ✅ (3 profiles) |
| **API Access** | ❌ | ❌ | ✅ |
| **Integrations** | Web only | Chrome Ext | Chrome + GDocs + API |

---

## 2. Technical Implementation Plan

### Phase 1: Authentication (Supabase)
- **Flow**: Simple Email/Password or Google OAuth via Supabase Auth.
- **Data**: A `profiles` table linked to `auth.users` to store:
    - `tier`: (free, pro, business)
    - `words_remaining`: Current month's balance.
    - `stripe_customer_id`: Link to billing.
    - `voice_samples`: JSONB or storage links for custom voice profiles.

### Phase 2: Billing (Stripe)
- **Stripe Checkout**: Redirect users to a Stripe-hosted checkout page for Pro/Business tiers.
- **Stripe Customer Portal**: Allow users to manage/cancel subscriptions.
- **Webhooks**: Listen for `customer.subscription.updated`, `invoice.paid`, and `customer.subscription.deleted` to sync the Supabase `profiles` table.

### Phase 3: Usage Tracking & Middleware
- **Middleware**: A Next.js middleware or a shared library function to check:
    1. Is the user signed in?
    2. Do they have enough `words_remaining`?
    3. Are they trying to use a feature restricted to a higher tier?
- **Usage Sync**: Deduct words from `profiles` table on every successful `/api/humanize` call.

---

## 3. Deployment Notes
- **Vercel**: Set up `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Supabase**: Enable RLS on the `profiles` table. Use a service role key in API routes for secure credit deduction.
