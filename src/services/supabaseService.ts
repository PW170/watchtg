import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { SyncEvent, SyncEventType } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Using the "anon" key or the publishable key provided
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
// Note: client creation is lightweight, but we should ensure we have env vars
export const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// Auth Helpers
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUp = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        full_name: name, // Standard Supabase field
      },
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { data, error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Database API
export const getRoom = async (roomCode: string) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', roomCode)
    .single();
  return { data, error };
};

export const createRoom = async (roomCode: string, initialState: any) => {
  const { data, error } = await supabase
    .from('rooms')
    .upsert([{
      code: roomCode,
      ...initialState
    }], { onConflict: 'code' })
    .select()
    .single();
  return { data, error };
};

export const updateRoom = async (roomId: string, updates: any) => {
  const { error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId);
  return { error };
};

export const createRoomEvent = async (roomId: string, eventType: string, payload: any, senderId: string) => {
  const { error } = await supabase
    .from('room_events')
    .insert([{
      room_id: roomId,
      event_type: eventType,
      payload,
      sender_id: senderId
    }]);
  return { error };
};

class RoomSyncService {
  private channel: RealtimeChannel | null = null;
  private listeners: ((event: SyncEvent) => void)[] = [];
  private statusListeners: ((status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void)[] = [];
  private roomId: string = ''; // Key DB ID
  private roomCode: string = '';

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('Supabase credentials missing in .env.local');
    }
  }

  public async connect(roomCode: string, dbRoomId: string): Promise<void> {
    this.disconnect();
    this.roomId = dbRoomId;
    this.roomCode = roomCode;
    this.notifyStatus('CONNECTING');

    return new Promise((resolve, reject) => {
      this.channel = supabase.channel(`room-${dbRoomId}`)
        // Listen for new events (Chat, etc.)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'room_events',
          },
          (payload) => {
            // console.log('[SyncService] Raw DB Event:', payload);
            const newEvent = payload.new as any;
            if (!newEvent) {
              console.warn('[SyncService] Received event with no new data:', payload);
              return;
            }
            // Map DB event to SyncEvent
            const syncEvent: SyncEvent = {
              type: newEvent.event_type as SyncEventType,
              payload: newEvent.payload,
              senderId: newEvent.sender_id
            };
            console.log('[SyncService] Dispatching Event:', syncEvent);
            this.notifyListeners(syncEvent);
          }
        )
        // Listen for Room State updates (Video URL, Play/Pause)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${dbRoomId}`
          },
          (payload) => {
            const newRoom = payload.new as any;
            // Synthesize a STATE update event
            const syncEvent: SyncEvent = {
              type: SyncEventType.SYNC_STATE,
              payload: {
                videoUrl: newRoom.video_url,
                source: newRoom.source,
                isPlaying: newRoom.is_playing,
                currentTime: newRoom.current_time,
                lastUpdated: newRoom.last_updated
              },
              senderId: 'system'
            };
            this.notifyListeners(syncEvent);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Sync] Connected to DB channel for room: ${roomCode} (${dbRoomId})`);
            this.isConnected = true;
            this.notifyStatus('CONNECTED');
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Sync] Connection failed: ${status}`);
            this.isConnected = false;
            this.notifyStatus('ERROR');
            reject(new Error(status));
          } else if (status === 'CLOSED') {
            this.isConnected = false;
            this.notifyStatus('DISCONNECTED');
          }
        });
    });
  }

  public disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.isConnected = false;
    this.notifyStatus('DISCONNECTED');
  }

  // Helper to send events implies interacting with DB now
  // We'll keep this method signature but implement it via DB calls
  // However, Room.tsx might need to call updateRoom directly for state changes.
  // We can facilitate that here or let Room.tsx call the exported functions.
  // For backward compatibility with Room.tsx mostly, let's proxy.
  // BUT: `send` was async void, `updateRoom` is async {error}.

  // NOTE: In the new architecture, "Sending" a PLAY event means Updating the Room DB.
  // "Sending" a CHAT event means Inserting into RoomEvents.

  public isConnected: boolean = false;

  public onEvent(callback: (event: SyncEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public onStatusChange(callback: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(event: SyncEvent) {
    this.listeners.forEach(l => l(event));
  }

  private notifyStatus(status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') {
    this.statusListeners.forEach(l => l(status));
  }
}

export const syncService = new RoomSyncService();