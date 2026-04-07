import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_MESSAGES, MARK_AS_READ } from '../graphql/queries';
import { getSocket } from '../socket';
import {
  MESSAGE_PAGE_SIZE,
  updateMessagesCache,
  updateChannelsCache,
  resetChannelUnreadCount,
} from '../graphql/cacheUpdaters';
import MessageItem, { type MessageData } from './MessageItem';
import './MessageList.css';

const SCROLL_EDGE_THRESHOLD = 48;

interface MessageQueryData {
  messages: MessageData[];
}

type HistoryBannerState = 'hidden' | 'loading' | 'end';

interface MessageListProps {
  onReply?: (message: MessageData) => void;
}

export default function MessageList({ onReply }: MessageListProps) {
  const { currentChannelId } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  const previousChannelIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const lastMarkedReadRef = useRef<{ channelId: string; messageId: string } | null>(null);
  const isNearBottomRef = useRef(true);
  const scrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const hasMoreHistoryRef = useRef(true);
  const isFetchingOlderRef = useRef(false);
  const [historyBanner, setHistoryBanner] = useState<HistoryBannerState>('hidden');
  const client = useApolloClient();
  const [markAsRead] = useMutation<{ markAsRead: boolean }>(MARK_AS_READ);

  const { data, loading, error, fetchMore } = useQuery<MessageQueryData>(
    GET_MESSAGES,
    {
      variables: { channelId: currentChannelId, limit: MESSAGE_PAGE_SIZE },
      skip: !currentChannelId,
    },
  );

  const messages = data?.messages ?? [];
  const firstMessageId = messages.length > 0 ? messages[0].id : null;
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  const setHasMoreHistory = (value: boolean) => {
    hasMoreHistoryRef.current = value;
  };

  const markCurrentChannelAsRead = () => {
    if (!currentChannelId || !lastMessageId || !isNearBottomRef.current) return;

    if (
      lastMarkedReadRef.current?.channelId === currentChannelId &&
      lastMarkedReadRef.current?.messageId === lastMessageId
    ) {
      return;
    }

    lastMarkedReadRef.current = { channelId: currentChannelId, messageId: lastMessageId };
    resetChannelUnreadCount(client.cache, currentChannelId);
    markAsRead({
      variables: { channelId: currentChannelId, messageId: lastMessageId },
    }).catch(() => {
      lastMarkedReadRef.current = null;
    });
  };

  const syncNearBottomState = () => {
    const listEl = listRef.current;
    if (!listEl) return;

    isNearBottomRef.current =
      listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight <= SCROLL_EDGE_THRESHOLD;
  };

  const loadOlderMessages = async () => {
    const listEl = listRef.current;
    if (
      !currentChannelId ||
      !firstMessageId ||
      !listEl ||
      !hasMoreHistoryRef.current ||
      isFetchingOlderRef.current
    ) {
      return;
    }

    isFetchingOlderRef.current = true;
    setHistoryBanner('loading');
    scrollRestoreRef.current = {
      scrollHeight: listEl.scrollHeight,
      scrollTop: listEl.scrollTop,
    };

    try {
      let fetchedCount = 0;
      await fetchMore<MessageQueryData>({
        variables: {
          channelId: currentChannelId,
          limit: MESSAGE_PAGE_SIZE,
          before: firstMessageId,
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
          const olderMessages = fetchMoreResult?.messages ?? [];
          fetchedCount = olderMessages.length;
          if (olderMessages.length === 0) {
            return previousResult;
          }

          const existingIds = new Set(previousResult.messages.map((message) => message.id));
          return {
            messages: [
              ...olderMessages.filter((message) => !existingIds.has(message.id)),
              ...previousResult.messages,
            ],
          };
        },
      });

      if (fetchedCount === 0) {
        scrollRestoreRef.current = null;
      }
      setHasMoreHistory(fetchedCount === MESSAGE_PAGE_SIZE);
      setHistoryBanner(fetchedCount < MESSAGE_PAGE_SIZE ? 'end' : 'hidden');
    } catch {
      scrollRestoreRef.current = null;
      setHistoryBanner('hidden');
    } finally {
      isFetchingOlderRef.current = false;
    }
  };

  useEffect(() => {
    setHasMoreHistory(true);
    isFetchingOlderRef.current = false;
    scrollRestoreRef.current = null;
    isNearBottomRef.current = true;
    lastMarkedReadRef.current = null;
    setHistoryBanner('hidden');
  }, [currentChannelId]);

  useEffect(() => {
    if (!loading && messages.length < MESSAGE_PAGE_SIZE) {
      setHasMoreHistory(false);
    }
  }, [loading, messages.length]);

  // Mark channel as read when entering or when new messages arrive
  useEffect(() => {
    markCurrentChannelAsRead();
  }, [currentChannelId, lastMessageId]);

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
        resetUnreadCount: isNearBottomRef.current,
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [client, currentChannelId]);

  useLayoutEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    if (scrollRestoreRef.current) {
      const { scrollHeight, scrollTop } = scrollRestoreRef.current;
      listEl.scrollTop = scrollTop + (listEl.scrollHeight - scrollHeight);
      scrollRestoreRef.current = null;
      syncNearBottomState();
      previousChannelIdRef.current = currentChannelId;
      previousLastMessageIdRef.current = lastMessageId;
      return;
    }

    const channelChanged = previousChannelIdRef.current !== currentChannelId;
    const lastMessageChanged = previousLastMessageIdRef.current !== lastMessageId;
    if (channelChanged || (lastMessageChanged && isNearBottomRef.current)) {
      listEl.scrollTop = listEl.scrollHeight;
      syncNearBottomState();
    }

    previousChannelIdRef.current = currentChannelId;
    previousLastMessageIdRef.current = lastMessageId;
  }, [currentChannelId, lastMessageId, messages.length]);

  const handleScroll = () => {
    syncNearBottomState();

    const listEl = listRef.current;
    if (!listEl || listEl.scrollTop > SCROLL_EDGE_THRESHOLD) {
      if (isNearBottomRef.current) {
        markCurrentChannelAsRead();
      }
      return;
    }

    if (!hasMoreHistoryRef.current) {
      setHistoryBanner('end');
      return;
    }

    void loadOlderMessages();
  };

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
    <div
      ref={listRef}
      className="message-list"
      onScroll={handleScroll}
    >
      {historyBanner !== 'hidden' && (
        <div className="message-list-history-state">
          {historyBanner === 'loading' ? 'Loading earlier messages...' : 'No earlier messages'}
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} onReply={onReply} />
      ))}
    </div>
  );
}
