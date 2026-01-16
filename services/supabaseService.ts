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

class RoomSyncService {
  private channel: RealtimeChannel | null = null;
  private listeners: ((event: SyncEvent) => void)[] = [];
  private statusListeners: ((status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void)[] = [];
  private userId: string = '';
  public isConnected: boolean = false;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('Supabase credentials missing in .env.local');
    }
  }

  public connect(roomId: string, userId: string): Promise<void> {
    this.disconnect(); // Ensure clean start
    this.userId = userId;
    this.notifyStatus('CONNECTING');

    return new Promise((resolve, reject) => {
      // Subscribe to a unique channel for the room
      this.channel = supabase.channel(`room:${roomId}`, {
        config: {
          broadcast: { self: false } // Don't receive own messages
        }
      });

      this.channel
        .on(
          'broadcast',
          { event: 'sync_event' },
          (payload) => {
            if (payload && payload.event) {
              this.notifyListeners(payload.event as SyncEvent);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Sync] Connected to Supabase channel: room:${roomId}`);
            this.isConnected = true;
            this.notifyStatus('CONNECTED');
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Sync] Failed to connect: ${status}`);
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

  public async send(type: SyncEventType, payload: any) {
    if (!this.channel || !this.isConnected) {
      console.warn('[Sync] Cannot send, channel not connected');
      return;
    }

    const event: SyncEvent = {
      type,
      payload,
      senderId: this.userId,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'sync_event',
      payload: { event },
    });
  }

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