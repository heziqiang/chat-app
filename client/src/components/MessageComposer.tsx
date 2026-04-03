import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { SEND_MESSAGE } from '../graphql/queries';
import { updateMessagesCache, updateChannelsCache } from '../graphql/cacheUpdaters';
import type { MessageData } from './MessageItem';
import './MessageComposer.css';

interface SendMessageResult {
  sendMessage: MessageData;
}

interface SendMessageVariables {
  input: {
    channelId: string;
    content: string;
  };
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
      updateChannelsCache(cache, currentChannelId, data.sendMessage, {
        resetUnreadCount: true,
      });
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
