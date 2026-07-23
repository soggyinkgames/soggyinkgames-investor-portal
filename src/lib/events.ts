/**
 * events.ts
 * 
 * Investor event logging helpers.
 * Powers the "interaction history / compounding touchpoints" feature.
 * 
 * Records: login, page_view, document_view events per investor.
 * Used by the admin dashboard to show who's engaging with what.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventType } from '../types/database';

export async function logEvent(
  supabase: SupabaseClient,
  investorId: string,
  eventType: EventType,
  target: string
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .insert({
      investor_id: investorId,
      event_type: eventType,
      target,
    });

  if (error) {
    // Non-fatal — log but don't throw
    console.error('[events] Failed to log event:', error.message);
  }
}

export async function getInvestorEvents(
  supabase: SupabaseClient,
  investorId: string,
  limit = 50
) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getAllEvents(
  supabase: SupabaseClient,
  limit = 200
) {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      investors (
        name,
        email,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
