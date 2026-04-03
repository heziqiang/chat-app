import { useEffect, useRef } from 'react';
import { useQuery, useApolloClient } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_MESSAGES } from '../graphql/queries';
import { getSocket } from '../socket';
import { updateMessagesCache, updateChannelsCache } from '../graphql/cacheUpdaters';
import MessageItem, { type MessageData } from './MessageItem';
import './MessageList.css';

export default function MessageList() {
  const { currentChannelId } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);
  const client = useApolloClient();

  const { data, loading, error } = useQuery<{ messages: MessageData[] }>(
    GET_MESSAGES,
    {
      variables: { channelId: currentChannelId, limit: 30 },
      skip: !currentChannelId,
    },
  );

  const messages = data?.messages ?? [];

  // Listen for real-time new messages via Socket.io
  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = ({
      channelId,
      message,
    }: {
      channelId: string;
      message: MessageData;
    }) => {
      updateMessagesCache(client.cache, channelId, message);
      updateChannelsCache(client.cache, channelId, message, {
        activeChannelId: currentChannelId,
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [client, currentChannelId]);

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
