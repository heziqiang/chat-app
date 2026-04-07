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
    replyTo?: string;
  };
}

interface MessageComposerProps {
  replyingTo?: MessageData | null;
  onClearReply?: () => void;
}

export default function MessageComposer({ replyingTo, onClearReply }: MessageComposerProps) {
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
      onClearReply?.();
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
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
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
            ...(replyingTo ? { replyTo: replyingTo.id } : {}),
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
          rows={2}
        />
        {replyingTo && (
          <div className="composer-reply-preview">
            <div className="composer-reply-content">
              <span className="composer-reply-accent" aria-hidden="true" />
              <div className="composer-reply-copy">
                <span className="composer-reply-author">{replyingTo.sender.displayName}:</span>
                <span className="composer-reply-text">{replyingTo.content}</span>
              </div>
            </div>
            <button
              type="button"
              className="composer-reply-close"
              onClick={onClearReply}
              aria-label="Cancel reply"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 0 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {error ? <div className="message-composer-error">Failed to send message.</div> : null}
    </div>
  );
}
