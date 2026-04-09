import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client';
import { shouldResetUnreadCountForIncomingMessage } from './channelReadPolicy';
import type { MessageData } from './types';
import { updateChannelsCache } from '../graphql/cacheUpdaters';
import { getSocket } from '../socket';

interface RealtimeChannelSyncProps {
  currentChannelId: string | null;
  isLatestMessageVisible: boolean;
}

export default function RealtimeChannelSync({
  currentChannelId,
  isLatestMessageVisible,
}: RealtimeChannelSyncProps) {
  const client = useApolloClient();

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = ({
      channelId,
      message,
    }: {
      channelId: string;
      message: MessageData;
    }) => {
      const resetUnreadCount = shouldResetUnreadCountForIncomingMessage(channelId, {
        currentChannelId,
        isLatestMessageVisible,
      });

      updateChannelsCache(client.cache, channelId, message, {
        resetUnreadCount,
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [client, currentChannelId, isLatestMessageVisible]);

  return null;
}
