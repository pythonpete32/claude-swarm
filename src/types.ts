// Simple message types for the chat starter kit

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  title?: string;
}

export type OverlayMode = 'none' | 'help' | 'history';