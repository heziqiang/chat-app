import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { SEND_MESSAGE } from '../graphql/queries';
import { updateMessagesCache, updateChannelsCache } from '../graphql/cacheUpdaters';
import type { MentionData, MessageData } from './MessageItem';
import './MessageComposer.css';

interface SendMessageResult {
  sendMessage: MessageData;
}

interface SendMessageVariables {
  input: {
    channelId: string;
    content: string;
    replyTo?: string;
    mentions?: string[];
  };
}

interface MessageComposerProps {
  replyingTo?: MessageData | null;
  onClearReply?: () => void;
}

type MentionDraft = {
  start: number;
  end: number;
  query: string;
};

const MAX_MENTION_OPTIONS = 5;
const MENTION_MENU_WIDTH = 324;

function isMentionBoundary(char: string | undefined) {
  return !char || /[\s.,!?;:()[\]{}"'`]/.test(char);
}

function getMentionToken(displayName: string) {
  return `@${displayName}`;
}

function containsStructuredMention(content: string, displayName: string) {
  const token = getMentionToken(displayName);

  for (let index = 0; index <= content.length - token.length; index += 1) {
    if (
      content.startsWith(token, index) &&
      isMentionBoundary(content[index - 1]) &&
      isMentionBoundary(content[index + token.length])
    ) {
      return true;
    }
  }

  return false;
}

function getMentionDraft(content: string, cursor: number): MentionDraft | null {
  let start = cursor;
  while (start > 0 && !isMentionBoundary(content[start - 1])) {
    start -= 1;
  }

  const token = content.slice(start, cursor);
  if (!token.startsWith('@') || token.slice(1).includes('@')) {
    return null;
  }

  return {
    start,
    end: cursor,
    query: token.slice(1),
  };
}

function getTextareaCaretPosition(textarea: HTMLTextAreaElement, position: number) {
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const propertiesToCopy = [
    'boxSizing',
    'width',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'wordBreak',
    'overflowWrap',
    'whiteSpace',
  ] as const;

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.top = '0';
  mirror.style.left = '0';

  for (const property of propertiesToCopy) {
    mirror.style[property] = computedStyle[property];
  }

  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordBreak = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.textContent = textarea.value.slice(0, position);
  marker.textContent = textarea.value.slice(position) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const coordinates = {
    left: marker.offsetLeft - textarea.scrollLeft,
    top: marker.offsetTop - textarea.scrollTop,
  };

  document.body.removeChild(mirror);
  return coordinates;
}

export default function MessageComposer({ replyingTo, onClearReply }: MessageComposerProps) {
  const { currentChannelId, currentUser, users, channels } = useApp();
  const [content, setContent] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<MentionData[]>([]);
  const [mentionDraft, setMentionDraft] = useState<MentionDraft | null>(null);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const [mentionMenuPosition, setMentionMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const skipNextSelectionSyncRef = useRef(false);
  const currentChannel = channels.find((channel) => channel.id === currentChannelId) ?? null;
  const mentionEnabled = currentChannel?.type === 'group';
  const currentChannelMemberIds = new Set(currentChannel?.members.map((member) => member.id) ?? []);

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
      setSelectedMentions([]);
      setMentionDraft(null);
      setHighlightedMentionIndex(0);
      setMentionMenuPosition(null);
      onClearReply?.();
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    setContent('');
    setSelectedMentions([]);
    setMentionDraft(null);
    setHighlightedMentionIndex(0);
    setMentionMenuPosition(null);
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

  useEffect(() => {
    const textarea = textareaRef.current;
    const nextSelection = pendingSelectionRef.current;
    if (!textarea || nextSelection === null) return;

    textarea.focus();
    textarea.setSelectionRange(nextSelection, nextSelection);
    pendingSelectionRef.current = null;
  }, [content]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!mentionEnabled || !mentionDraft || !textarea) {
      setMentionMenuPosition(null);
      return;
    }

    const updateMentionMenuPosition = () => {
      const caret = getTextareaCaretPosition(textarea, mentionDraft.end);
      const maxLeft = Math.max(textarea.clientWidth - MENTION_MENU_WIDTH, 0);

      setMentionMenuPosition({
        left: Math.min(Math.max(caret.left, 0), maxLeft),
        top: Math.max(caret.top, 0),
      });
    };

    updateMentionMenuPosition();
    window.addEventListener('resize', updateMentionMenuPosition);
    textarea.addEventListener('scroll', updateMentionMenuPosition);

    return () => {
      window.removeEventListener('resize', updateMentionMenuPosition);
      textarea.removeEventListener('scroll', updateMentionMenuPosition);
    };
  }, [content, mentionDraft, mentionEnabled]);

  const mentionOptions = mentionDraft && mentionEnabled
    ? users
        .filter((user) => user.id !== currentUser?.id)
        .filter((user) => currentChannelMemberIds.has(user.id))
        .filter((user) => {
          const normalizedQuery = mentionDraft.query.trim().toLowerCase();
          if (!normalizedQuery) {
            return true;
          }

          return (
            user.username.toLowerCase().includes(normalizedQuery) ||
            user.displayName.toLowerCase().includes(normalizedQuery)
          );
        })
        .slice(0, MAX_MENTION_OPTIONS)
    : [];

  useEffect(() => {
    if (mentionEnabled) {
      return;
    }

    setMentionDraft(null);
    setHighlightedMentionIndex(0);
    setMentionMenuPosition(null);
    setSelectedMentions([]);
  }, [mentionEnabled, currentChannelId]);

  useEffect(() => {
    if (mentionOptions.length === 0) {
      setHighlightedMentionIndex(0);
      return;
    }

    setHighlightedMentionIndex((currentIndex) =>
      Math.min(currentIndex, mentionOptions.length - 1),
    );
  }, [mentionOptions.length]);

  const trimmedContent = content.trim();

  function syncMentionDraft(nextContent: string, cursor: number) {
    if (!mentionEnabled) {
      setMentionDraft(null);
      setMentionMenuPosition(null);
      return;
    }

    setMentionDraft(getMentionDraft(nextContent, cursor));
  }

  function syncSelectedMentions(nextContent: string) {
    setSelectedMentions((currentMentions) =>
      currentMentions.filter((mention) =>
        containsStructuredMention(nextContent, mention.displayName),
      ),
    );
  }

  function applyMention(user: MentionData) {
    if (!mentionDraft || !mentionEnabled) return;

    const before = content.slice(0, mentionDraft.start);
    const after = content.slice(mentionDraft.end);
    const mentionToken = getMentionToken(user.displayName);
    const spacer = after.startsWith(' ') || after.startsWith('\n') || after.length === 0 ? '' : ' ';
    const nextContent = `${before}${mentionToken}${spacer}${after}`;
    const nextCursor = before.length + mentionToken.length + spacer.length;

    setContent(nextContent);
    setMentionDraft(null);
    setHighlightedMentionIndex(0);
    setMentionMenuPosition(null);
    skipNextSelectionSyncRef.current = true;
    setSelectedMentions((currentMentions) => {
      const nextMentions = currentMentions.filter((mention) =>
        containsStructuredMention(nextContent, mention.displayName),
      );

      if (nextMentions.some((mention) => mention.id === user.id)) {
        return nextMentions;
      }

      return [
        ...nextMentions,
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      ];
    });
    pendingSelectionRef.current = nextCursor;
  }

  async function handleSend() {
    if (!currentChannelId || !currentUser || !trimmedContent || loading) return;

    const mentionIds = selectedMentions
      .filter((mention) => containsStructuredMention(trimmedContent, mention.displayName))
      .map((mention) => mention.id);

    try {
      await sendMessage({
        variables: {
          input: {
            channelId: currentChannelId,
            content: trimmedContent,
            ...(replyingTo ? { replyTo: replyingTo.id } : {}),
            ...(mentionIds.length > 0 ? { mentions: mentionIds } : {}),
          },
        },
      });
    } catch {
      // Mutation error is surfaced through Apollo state below.
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionEnabled && mentionDraft && mentionOptions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedMentionIndex((currentIndex) => (currentIndex + 1) % mentionOptions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedMentionIndex(
          (currentIndex) => (currentIndex - 1 + mentionOptions.length) % mentionOptions.length,
        );
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const selectedUser = mentionOptions[highlightedMentionIndex];
        if (selectedUser) {
          applyMention(selectedUser);
        }
        return;
      }
    }

    if (mentionEnabled && mentionDraft && event.key === 'Escape') {
      event.preventDefault();
      setMentionDraft(null);
      setHighlightedMentionIndex(0);
      setMentionMenuPosition(null);
      return;
    }

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
          onChange={(event) => {
            const nextContent = event.target.value;
            setContent(nextContent);
            syncSelectedMentions(nextContent);
            syncMentionDraft(nextContent, event.target.selectionStart ?? nextContent.length);
          }}
          onKeyDown={handleKeyDown}
          onClick={(event) =>
            syncMentionDraft(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length,
            )
          }
          onKeyUp={(event) =>
            {
              if (skipNextSelectionSyncRef.current) {
                skipNextSelectionSyncRef.current = false;
                return;
              }

              syncMentionDraft(
                event.currentTarget.value,
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              );
            }
          }
          onBlur={() => {
            setMentionDraft(null);
            setHighlightedMentionIndex(0);
            setMentionMenuPosition(null);
          }}
          placeholder="Type a message..."
          rows={2}
        />
        {mentionDraft && mentionMenuPosition && (
          <div
            className="composer-mention-menu"
            role="listbox"
            aria-label="Mention suggestions"
            style={{
              left: `${mentionMenuPosition.left}px`,
              top: `${mentionMenuPosition.top}px`,
            }}
          >
            {mentionOptions.length > 0 ? (
              mentionOptions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  className={`composer-mention-option ${
                    index === highlightedMentionIndex ? 'active' : ''
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMention(user);
                  }}
                >
                  <img
                    className="composer-mention-avatar"
                    src={user.avatarUrl}
                    alt={user.displayName}
                  />
                  <span className="composer-mention-copy">
                    <span className="composer-mention-name">{user.displayName}</span>
                    <span className="composer-mention-username">
                      {user.title ? `${user.title} · ` : ''}@{user.username}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="composer-mention-empty">No people found.</div>
            )}
          </div>
        )}
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
