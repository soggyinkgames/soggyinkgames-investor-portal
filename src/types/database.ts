/**
 * database.ts
 * 
 * TypeScript types for the Supabase database schema.
 * These mirror the SQL tables defined in the build plan.
 * 
 * To regenerate from a live Supabase project:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
 */

export type InvestorRole = 'prospective' | 'invested';
export type AccessLevel = 'prospective' | 'invested';
export type DocumentCategory = 'deck' | 'legal' | 'research' | 'team';
export type EventType = 'login' | 'page_view' | 'document_view';

export interface Investor {
  id: string;
  email: string;
  name: string;
  role: InvestorRole;
  approved: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  file_url: string;
  access_level: AccessLevel;
  category: DocumentCategory;
  created_at?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  date: string;
  visibility: AccessLevel;
  created_at?: string;
}

export interface InvestorEvent {
  id: string;
  investor_id: string;
  event_type: EventType;
  target: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
  linkedin_url?: string;
  order_index: number;
}

// Supabase Database type for use with createServerClient<Database>
export interface Database {
  public: {
    Tables: {
      investors: {
        Row: Investor;
        Insert: Omit<Investor, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Investor, 'id'>>;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Document, 'id'>>;
      };
      milestones: {
        Row: Milestone;
        Insert: Omit<Milestone, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Milestone, 'id'>>;
      };
      events: {
        Row: InvestorEvent;
        Insert: Omit<InvestorEvent, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<InvestorEvent, 'id'>>;
      };
      team_members: {
        Row: TeamMember;
        Insert: Omit<TeamMember, 'id'> & { id?: string };
        Update: Partial<Omit<TeamMember, 'id'>>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
