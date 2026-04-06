import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_CHANNELS } from '../graphql/queries';
import './ChannelHeader.css';

interface ChannelData {
  id: string;
  name: string;
  type: 'group' | 'dm';
  members: { id: string; displayName: string; avatarUrl?: string | null }[];
}

export default function ChannelHeader() {
  const { currentUser, currentChannelId } = useApp();
  const { data } = useQuery<{ channels: ChannelData[] }>(GET_CHANNELS);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const membersPanelRef = useRef<HTMLDivElement>(null);

  const channel = data?.channels
    .filter((ch) => !currentUser || ch.members.some((member) => member.id === currentUser.id))
    .find((ch) => ch.id === currentChannelId);

  useEffect(() => {
    setIsMembersOpen(false);
  }, [currentChannelId]);

  useEffect(() => {
    if (!isMembersOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (membersPanelRef.current?.contains(event.target as Node)) return;
      setIsMembersOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMembersOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMembersOpen]);

  let title = '';
  if (channel) {
    if (channel.type === 'dm') {
      const peer = channel.members.find((m) => m.id !== currentUser?.id) ?? channel.members[0];
      title = peer?.displayName ?? 'Direct Message';
    } else {
      title = channel.name;
    }
  }

  const memberCount = channel?.members.length ?? 0;

  function getMemberInitial(memberName: string) {
    return memberName.trim().charAt(0).toUpperCase() || '?';
  }

  return (
    <div className="channel-header">
      <div className="channel-header-main">
        <h2 className="channel-header-name">{title}</h2>
      </div>
      {channel?.type === 'group' ? (
        <div className="channel-header-members" ref={membersPanelRef}>
          <button
            type="button"
            className={`channel-members-toggle ${isMembersOpen ? 'open' : ''}`}
            aria-label={`View ${memberCount} members`}
            aria-expanded={isMembersOpen}
            aria-haspopup="dialog"
            onClick={() => setIsMembersOpen((open) => !open)}
          >
            <svg
              className="channel-members-toggle-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm6 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-6 2c-2.76 0-5 1.79-5 4v1h10v-1c0-2.21-2.24-4-5-4Zm6 1c1.28.57 2 1.47 2 3v1h4v-1c0-1.91-1.54-3.51-3.74-4H15Z" />
            </svg>
            <span className="channel-members-toggle-count">{memberCount}</span>
          </button>
          {isMembersOpen ? (
            <div
              className="channel-members-popover"
              role="dialog"
              aria-label="Channel members"
            >
              <ul className="channel-members-list">
                {channel.members.map((member) => (
                  <li key={member.id} className="channel-members-item">
                    {member.avatarUrl ? (
                      <img
                        className="channel-members-avatar"
                        src={member.avatarUrl}
                        alt={member.displayName}
                      />
                    ) : (
                      <div className="channel-members-avatar channel-members-avatar-fallback">
                        {getMemberInitial(member.displayName)}
                      </div>
                    )}
                    <div className="channel-members-copy">
                      <span className="channel-members-name">{member.displayName}</span>
                      {member.id === currentUser?.id ? (
                        <span className="channel-members-note">You</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
