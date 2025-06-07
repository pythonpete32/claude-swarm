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

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  logs: string[];
}

export type AgentStatus = 'queued' | 'running' | 'completed';

export type OverlayMode = 'none' | 'help' | 'history';
