import { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_CHANNELS } from '../graphql/queries';
import './ChannelList.css';

interface MemberData {
  id: string;
  displayName: string;
  avatarUrl: string;
}

interface ChannelData {
  id: string;
  name: string;
  type: 'group' | 'dm';
  avatarUrl: string;
  members: MemberData[];
  lastMessage: {
    id: string;
    content: string;
    sender: { id: string; displayName: string };
    createdAt: string;
  } | null;
  unreadCount: number;
}

function getDmPeer(members: MemberData[], currentUserId: string): MemberData | undefined {
  return members.find((m) => m.id !== currentUserId) ?? members[0];
}

/** Group: 2 member avatars stacked; DM: single peer avatar */
function ChannelAvatar({ channel, currentUserId }: { channel: ChannelData; currentUserId: string }) {
  if (channel.type === 'dm') {
    const peer = getDmPeer(channel.members, currentUserId);
    return <img className="channel-row-avatar" src={peer?.avatarUrl} alt="" />;
  }

  // Group: 2x2 grid of first 4 member avatars in a circle
  const shown = channel.members.slice(0, 4);
  return (
    <div className="channel-row-avatar-grid">
      {shown.map((m) => (
        <img key={m.id} className="channel-row-avatar-grid-item" src={m.avatarUrl} alt="" />
      ))}
    </div>
  );
}

export default function ChannelList() {
  const { currentUser, setCurrentUser, currentChannelId, setCurrentChannelId } = useApp();
  const { data, loading, error } = useQuery<{ channels: ChannelData[] }>(GET_CHANNELS, {
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-first',
    skip: !currentUser,
  });

  const channels = (data?.channels ?? []).filter(
    (channel) => !currentUser || channel.members.some((member) => member.id === currentUser.id),
  );

  useEffect(() => {
    if (currentChannelId && !channels.some((channel) => channel.id === currentChannelId)) {
      setCurrentChannelId(null);
    }
  }, [channels, currentChannelId, setCurrentChannelId]);

  return (
    <div className="channel-list">
      <div className="channel-list-header">
        <span className="channel-list-user">
          <img className="channel-list-user-avatar" src={currentUser?.avatarUrl} alt="" />
          {currentUser?.displayName}
        </span>
        <button
          className="channel-list-switch"
          onClick={() => {
            setCurrentUser(null);
            setCurrentChannelId(null);
          }}
          title="Switch user"
        >
          Switch
        </button>
      </div>

      <div className="channel-list-items">
        {loading && <div className="channel-list-state">Loading channels...</div>}
        {error && !loading && <div className="channel-list-state">Failed to load channels.</div>}
        {!loading && !error && channels.length === 0 && (
          <div className="channel-list-state">No channels available.</div>
        )}
        {!loading && !error && channels.map((ch) => {
          const isDm = ch.type === 'dm';
          const peer = isDm && currentUser ? getDmPeer(ch.members, currentUser.id) : undefined;
          const displayName = isDm ? (peer?.displayName ?? 'Direct Message') : ch.name;

          return (
            <button
              key={ch.id}
              className={`channel-row ${ch.id === currentChannelId ? 'active' : ''}`}
              onClick={() => setCurrentChannelId(ch.id)}
            >
              <div className="channel-row-avatar-wrap">
                <ChannelAvatar channel={ch} currentUserId={currentUser?.id ?? ''} />
                {ch.unreadCount > 0 && (
                  <span className="channel-row-badge">{ch.unreadCount}</span>
                )}
              </div>
              <div className="channel-row-info">
                <div className="channel-row-top">
                  <span className="channel-row-name">{displayName}</span>
                </div>
                {ch.lastMessage && (
                  <p className="channel-row-preview">
                    <span className="channel-row-sender">
                      {ch.lastMessage.sender.displayName}:
                    </span>{' '}
                    {ch.lastMessage.content}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
