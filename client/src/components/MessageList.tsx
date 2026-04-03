import { useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_MESSAGES } from '../graphql/queries';
import MessageItem, { type MessageData } from './MessageItem';
import './MessageList.css';

export default function MessageList() {
  const { currentChannelId } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, loading, error } = useQuery<{ messages: MessageData[] }>(
    GET_MESSAGES,
    {
      variables: { channelId: currentChannelId, limit: 30 },
      skip: !currentChannelId,
    },
  );

  const messages = data?.messages ?? [];

  // Auto-scroll to bottom when messages change or channel switches
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages, currentChannelId]);

  if (loading) {
    return <div className="message-list-state">Loading messages...</div>;
  }

  if (error) {
    return <div className="message-list-state">Failed to load messages.</div>;
  }

  if (messages.length === 0) {
    return <div className="message-list-state">No messages yet. Start the conversation!</div>;
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
