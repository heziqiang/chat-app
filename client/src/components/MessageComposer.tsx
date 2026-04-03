import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, type ApolloCache } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_CHANNELS, GET_MESSAGES, SEND_MESSAGE } from '../graphql/queries';
import type { MessageData } from './MessageItem';
import './MessageComposer.css';

interface MessageQueryData {
  messages: MessageData[];
}

interface ChannelListData {
  channels: Array<{
    id: string;
    name: string;
    type: 'group' | 'dm';
    avatarUrl: string;
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string;
    }>;
    lastMessage: {
      id: string;
      content: string;
      sender: { id: string; displayName: string };
      createdAt: string;
    } | null;
    unreadCount: number;
  }>;
}

interface SendMessageResult {
  sendMessage: MessageData;
}

interface SendMessageVariables {
  input: {
    channelId: string;
    content: string;
  };
}

const MESSAGE_PAGE_SIZE = 30;

function updateMessagesCache(
  cache: ApolloCache<unknown>,
  channelId: string,
  nextMessage: MessageData,
) {
  cache.updateQuery<MessageQueryData>(
    {
      query: GET_MESSAGES,
      variables: { channelId, limit: MESSAGE_PAGE_SIZE },
    },
    (data) => ({
      messages: [...(data?.messages ?? []), nextMessage].slice(-MESSAGE_PAGE_SIZE),
    }),
  );
}

function updateChannelsCache(
  cache: ApolloCache<unknown>,
  channelId: string,
  nextMessage: MessageData,
) {
  cache.updateQuery<ChannelListData>({ query: GET_CHANNELS }, (data) => {
    if (!data) return data;

    return {
      channels: data.channels.map((channel) =>
        channel.id === channelId
          ? {
              ...channel,
              lastMessage: {
                id: nextMessage.id,
                content: nextMessage.content,
                createdAt: nextMessage.createdAt,
                sender: {
                  id: nextMessage.sender.id,
                  displayName: nextMessage.sender.displayName,
                },
              },
              unreadCount: 0,
            }
          : channel,
      ),
    };
  });
}

export default function MessageComposer() {
  const { currentChannelId, currentUser } = useApp();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sendMessage, { loading, error }] = useMutation<
    SendMessageResult,
    SendMessageVariables
  >(SEND_MESSAGE, {
    update(cache, { data }) {
      if (!currentChannelId || !data?.sendMessage) return;
      updateMessagesCache(cache, currentChannelId, data.sendMessage);
      updateChannelsCache(cache, currentChannelId, data.sendMessage);
    },
    onCompleted() {
      setContent('');
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    setContent('');
  }, [currentChannelId]);

  useEffect(() => {
    if (currentChannelId) {
      textareaRef.current?.focus();
    }
  }, [currentChannelId]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [content]);

  const trimmedContent = content.trim();
  async function handleSend() {
    if (!currentChannelId || !currentUser || !trimmedContent || loading) return;

    try {
      await sendMessage({
        variables: {
          input: {
            channelId: currentChannelId,
            content: trimmedContent,
          },
        },
      });
    } catch {
      // Mutation error is surfaced through Apollo state below.
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void handleSend();
  }

  return (
    <div className="message-composer">
      <div className="message-composer-form">
        <textarea
          ref={textareaRef}
          className="message-composer-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
        />
      </div>
      {error ? <div className="message-composer-error">Failed to send message.</div> : null}
    </div>
  );
}
