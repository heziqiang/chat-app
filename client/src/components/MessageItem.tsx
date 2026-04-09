import type { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import './MessageItem.css';

export interface MentionData {
  id: string;
  username: string;
  displayName: string;
}

export interface MessageData {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  mentions: MentionData[];
  replyTo: {
    id: string;
    content: string;
    sender: { id: string; displayName: string };
  } | null;
}

function isMentionBoundary(char: string | undefined) {
  return !char || /[\s.,!?;:()[\]{}"'`]/.test(char);
}

function renderMessageContent(content: string, mentions: MentionData[]): ReactNode {
  if (mentions.length === 0) {
    return content;
  }

  const mentionTokens = mentions
    .map((mention) => ({ ...mention, token: `@${mention.displayName}` }))
    .sort((left, right) => right.token.length - left.token.length);
  const parts: ReactNode[] = [];
  let cursor = 0;
  let lastTextStart = 0;
  let key = 0;

  while (cursor < content.length) {
    const match = mentionTokens.find(
      ({ token }) =>
        content.startsWith(token, cursor) &&
        isMentionBoundary(content[cursor - 1]) &&
        isMentionBoundary(content[cursor + token.length]),
    );

    if (!match) {
      cursor += 1;
      continue;
    }

    if (lastTextStart < cursor) {
      parts.push(content.slice(lastTextStart, cursor));
    }

    parts.push(
      <span
        key={`mention-${key}`}
        className="message-mention"
        data-mention-user-id={match.id}
      >
        {match.token}
      </span>,
    );

    key += 1;
    cursor += match.token.length;
    lastTextStart = cursor;
  }

  if (lastTextStart < content.length) {
    parts.push(content.slice(lastTextStart));
  }

  return parts.length > 0 ? parts : content;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface MessageItemProps {
  message: MessageData;
  onReply?: (message: MessageData) => void;
}

export default function MessageItem({ message, onReply }: MessageItemProps) {
  const { currentUser } = useApp();
  const isOwn = currentUser?.id === message.sender.id;
  const canReply = Boolean(onReply);

  return (
    <div className={`message-item ${isOwn ? 'own' : 'other'} ${canReply ? 'has-reply-action' : ''}`}>
      <img
        className="message-avatar"
        src={message.sender.avatarUrl}
        alt={message.sender.displayName}
      />
      <div className="message-body">
        <div className="message-meta">
          <span className="message-sender">{message.sender.displayName}</span>
          <span className="message-time">{formatTime(message.createdAt)}</span>
        </div>
        <div className="message-bubble-wrapper">
          <div className="message-bubble">
            <p className="message-content">{renderMessageContent(message.content, message.mentions)}</p>
          </div>
          {canReply && (
            <button
              type="button"
              className="message-reply-btn"
              onClick={() => onReply?.(message)}
              aria-label="Reply"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 4C3.35 4 2 5.35 2 7V12H7V7H3C3 5.8905 3.8905 5 5 5V4ZM12 4C10.35 4 9 5.35 9 7V12H14V7H10C10 5.8905 10.8905 5 12 5V4ZM3 8H6V11H3V8ZM10 8H13V11H10V8Z" />
              </svg>
            </button>
          )}
        </div>
        {message.replyTo && (
          <div className="message-reply-quote">
            <div className="message-reply-quote-content">
              <span className="message-reply-quote-accent" aria-hidden="true" />
              <div className="message-reply-quote-copy">
                <span className="message-reply-author">
                  {message.replyTo.sender.displayName}:
                </span>
                <span className="message-reply-text">{message.replyTo.content}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
