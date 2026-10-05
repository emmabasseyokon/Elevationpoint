-- ================================================================
-- PlotManager White-Label — Full Database Schema
-- Run this in a fresh Supabase project SQL Editor to set up everything
-- ================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UTILITY: updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. COMPANIES (single company record)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    form_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_days_before INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce exactly one company row
CREATE UNIQUE INDEX IF NOT EXISTS companies_single_row ON companies ((TRUE));

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. PROFILES (admin users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. ESTATES
-- ============================================
CREATE TABLE IF NOT EXISTS estates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    image_url TEXT,
    total_plots INTEGER NOT NULL DEFAULT 0,
    available_plots INTEGER NOT NULL DEFAULT 0 CHECK (available_plots >= 0),
    price_per_plot NUMERIC(15, 2) DEFAULT 0,
    plot_sizes JSONB DEFAULT '[]'::jsonb CHECK (jsonb_typeof(plot_sizes) = 'array'),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'coming_soon')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_estates_updated_at
    BEFORE UPDATE ON estates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_estates_status ON estates(status);

ALTER TABLE estates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. AGENTS
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    commission_type TEXT NOT NULL DEFAULT 'percentage'
        CHECK (commission_type IN ('percentage', 'flat')),
    commission_rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_agents_phone ON agents(phone);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. BUYERS
-- ============================================
CREATE TABLE IF NOT EXISTS buyers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    estate_id UUID REFERENCES estates(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    gender TEXT,
    home_address TEXT,
    city TEXT,
    state TEXT,
    plot_size TEXT,
    plot_location TEXT,
    plot_number TEXT,
    number_of_plots INTEGER DEFAULT 1,
    purchase_date DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    next_payment_date DATE,
    payment_status TEXT NOT NULL DEFAULT 'installment'
        CHECK (payment_status IN ('fully_paid', 'installment', 'overdue')),
    has_installment_plan BOOLEAN DEFAULT FALSE,
    initial_deposit NUMERIC(15, 2) DEFAULT 0,
    plan_duration_months INTEGER,
    plan_start_date DATE,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_address TEXT,
    next_of_kin_relationship TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    referral_source TEXT,
    referral_phone TEXT,
    allocation_status TEXT NOT NULL DEFAULT 'not_allocated'
        CHECK (allocation_status IN ('allocated', 'not_allocated')),
    payment_proof_url TEXT,
    documents JSONB DEFAULT '[]'::jsonb CHECK (jsonb_typeof(documents) = 'array'),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_buyers_updated_at
    BEFORE UPDATE ON buyers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_buyers_estate ON buyers(estate_id);
CREATE INDEX IF NOT EXISTS idx_buyers_status ON buyers(payment_status);
CREATE INDEX IF NOT EXISTS idx_buyers_created ON buyers(created_at DESC);

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. COMMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS commissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    commission_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'partially_paid', 'paid')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_commissions_updated_at
    BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_commissions_agent ON commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_buyer ON commissions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. COMMISSION_PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS commission_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('cash', 'bank_transfer', 'pos', 'online')),
    reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_commission ON commission_payments(commission_id);

ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. PAYMENTS (payment history per buyer)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('cash', 'bank_transfer', 'pos', 'online')),
    reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_buyer ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. PAYMENT SCHEDULES (installment tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    expected_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial', 'overdue')),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_payment_schedules_updated_at
    BEFORE UPDATE ON payment_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_schedules_buyer ON payment_schedules(buyer_id);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON payment_schedules(status);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. REMINDERS
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL DEFAULT 'payment_due'
        CHECK (reminder_type IN ('payment_due', 'custom')),
    message TEXT NOT NULL,
    sent_via TEXT NOT NULL DEFAULT 'email'
        CHECK (sent_via IN ('email', 'whatsapp', 'sms')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_buyer ON reminders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON reminders(sent_at DESC);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. ACTIVITY LOGS (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_label TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. RLS POLICIES
-- ============================================

-- Companies: admins can see the company
CREATE POLICY "Users can view company"
    ON companies FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Profiles: users can only view their own profile (non-recursive)
-- NOTE: Do NOT use a subquery on profiles itself here — that causes
-- PostgreSQL infinite recursion when evaluating the RLS policy.
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Estates: admins can CRUD estates
CREATE POLICY "Users can view estates"
    ON estates FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert estates"
    ON estates FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update estates"
    ON estates FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete estates"
    ON estates FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Agents: admins can CRUD agents
CREATE POLICY "Users can view agents"
    ON agents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert agents"
    ON agents FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update agents"
    ON agents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete agents"
    ON agents FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Buyers: admins can CRUD buyers
CREATE POLICY "Users can view buyers"
    ON buyers FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert buyers"
    ON buyers FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update buyers"
    ON buyers FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete buyers"
    ON buyers FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Payments: admins can CRUD payments
CREATE POLICY "Users can view payments"
    ON payments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert payments"
    ON payments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update payments"
    ON payments FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete payments"
    ON payments FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Payment Schedules: admins can CRUD schedules
CREATE POLICY "Users can view schedules"
    ON payment_schedules FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert schedules"
    ON payment_schedules FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update schedules"
    ON payment_schedules FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete schedules"
    ON payment_schedules FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Commissions: admins can CRUD commissions
CREATE POLICY "Users can view commissions"
    ON commissions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert commissions"
    ON commissions FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update commissions"
    ON commissions FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete commissions"
    ON commissions FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Commission Payments: admins can view and insert
CREATE POLICY "Users can view commission payments"
    ON commission_payments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert commission payments"
    ON commission_payments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update commission payments"
    ON commission_payments FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete commission payments"
    ON commission_payments FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Reminders: admins can CRUD reminders
CREATE POLICY "Users can view reminders"
    ON reminders FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert reminders"
    ON reminders FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update reminders"
    ON reminders FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete reminders"
    ON reminders FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- Activity Logs: admins can view logs
CREATE POLICY "Users can view activity logs"
    ON activity_logs FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

-- ============================================
-- 12. SERVICE ROLE POLICIES (for API operations)
-- ============================================
CREATE POLICY "Service role full access to companies"
    ON companies FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to profiles"
    ON profiles FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to estates"
    ON estates FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to buyers"
    ON buyers FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to payments"
    ON payments FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to payment_schedules"
    ON payment_schedules FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to agents"
    ON agents FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to commissions"
    ON commissions FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to commission_payments"
    ON commission_payments FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to reminders"
    ON reminders FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to activity_logs"
    ON activity_logs FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ============================================
-- 13. STORAGE: Estate images bucket & policies
-- ============================================

-- Create the storage bucket for estate images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('estates', 'estates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload estate images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'estates');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update own estate images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'estates' AND owner = auth.uid());

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own estate images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'estates' AND owner = auth.uid());

-- Allow public read access to estate images
CREATE POLICY "Public read access to estate images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'estates');

-- ============================================
-- 14. STORAGE: Buyer documents bucket & policies
-- ============================================

-- Create the storage bucket for buyer documents (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('buyer-documents', 'buyer-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload buyer documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'buyer-documents');

CREATE POLICY "Users can update own buyer documents"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'buyer-documents' AND owner = auth.uid());

CREATE POLICY "Users can delete own buyer documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'buyer-documents' AND owner = auth.uid());

CREATE POLICY "Public read access to buyer documents"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'buyer-documents');

-- Service role full access to buyer-documents bucket
CREATE POLICY "Service role full access to buyer-documents"
    ON storage.objects FOR ALL TO service_role
    USING (bucket_id = 'buyer-documents') WITH CHECK (bucket_id = 'buyer-documents');

-- ============================================
-- 15. RATE LIMITS (shared across serverless instances)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to rate_limits"
    ON rate_limits FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Atomically counts a hit for p_key and says whether it is within the limit.
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_reset TIMESTAMPTZ;
BEGIN
    INSERT INTO rate_limits AS r (key, count, reset_at)
    VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN r.reset_at <= NOW() THEN 1 ELSE r.count + 1 END,
        reset_at = CASE WHEN r.reset_at <= NOW()
            THEN NOW() + make_interval(secs => p_window_seconds)
            ELSE r.reset_at END
    RETURNING r.count, r.reset_at INTO v_count, v_reset;

    -- Opportunistic cleanup of expired rows
    IF random() < 0.01 THEN
        DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 hour';
    END IF;

    allowed := v_count <= p_max;
    retry_after_seconds := CASE
        WHEN allowed THEN 0
        ELSE GREATEST(CEIL(EXTRACT(EPOCH FROM (v_reset - NOW())))::INTEGER, 1)
    END;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================
-- 16. SEED: Pre-create the company
-- Replace these values with the client's details
-- ============================================
-- INSERT INTO companies (name, slug, email, phone, form_enabled)
-- VALUES (
--     'ABC Homes',
--     'abc-homes',
--     'info@abchomes.com',
--     '+2349012345678',
--     true
-- );
