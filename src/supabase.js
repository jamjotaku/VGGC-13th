import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ntfifimfugwxnstvjtpb.supabase.co';
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50ZmlmaW1mdWd3eG5zdHZqdHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjMyMzUsImV4cCI6MjExMDMzOTIzNX0.5g44M6BEOM4z9LFXq2lDS7zA-AXl9yllWTKJ-GtkBQo';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);
