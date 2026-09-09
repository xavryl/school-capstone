import { createClient } from '@/lib/supabase/server';
import type { Department, QueueSnapshot } from '@/lib/types';
import DisplayClient from './DisplayClient';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dept: string }> };

export default async function DisplayPage({ params }: Params) {
  const { dept } = await params;
  const department: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  const supabase = await createClient();
  const { data } = await supabase.rpc('current_queue_state', { dept: department });

  return <DisplayClient dept={department} initial={(data as QueueSnapshot) ?? null} />;
}
