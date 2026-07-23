/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly FOUNDER_NOTIFICATION_EMAIL: string;
  readonly ADMIN_EMAIL: string;
  readonly RESEND_API_KEY: string;
  readonly RESEND_FROM_EMAIL: string;
  readonly PORTAL_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    investor: {
      id: string;
      email: string;
      name: string;
      role: 'prospective' | 'invested';
      approved: boolean;
    } | null;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  }
}
