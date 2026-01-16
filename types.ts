export enum VideoSource {
  YOUTUBE = 'YOUTUBE',
  EXTERNAL = 'EXTERNAL',
}

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  color: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomState {
  roomId: string;
  videoUrl: string;
  source: VideoSource;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number; // To reconcile seek conflicts
}

export enum SyncEventType {
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  SEEK = 'SEEK',
  URL_CHANGE = 'URL_CHANGE',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  USER_JOIN = 'USER_JOIN',
  REQUEST_STATE = 'REQUEST_STATE',
  SYNC_STATE = 'SYNC_STATE',
}

export interface SyncEvent {
  type: SyncEventType;
  payload: any;
  senderId: string;
}

export interface AdConfig {
  showAds: boolean;
}