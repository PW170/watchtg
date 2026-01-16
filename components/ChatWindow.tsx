import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, User } from '../types';
import Input from './Input';
import Button from './Button';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (text: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, currentUser, onSendMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    setInputValue('');

    // Send user message
    onSendMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-surface/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          Party Chat
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-10">
            <p>Welcome to the watch party!</p>
            <p>Say hello to start chatting.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === currentUser.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-xs font-bold ${isMe ? 'text-violet-400' : 'text-slate-400'}`}>
                  {msg.userName}
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`
                max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                ${msg.isSystem ? 'bg-slate-800 text-slate-400 text-center w-full max-w-none italic' : ''}
                ${!msg.isSystem && isMe ? 'bg-violet-600 text-white rounded-tr-sm' : ''}
                ${!msg.isSystem && !isMe ? 'bg-slate-700 text-slate-200 rounded-tl-sm' : ''}
              `}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 bg-slate-800/50 border-t border-slate-700/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="!py-2 !text-sm"
          />
          <Button type="submit" size="sm" className="!px-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;