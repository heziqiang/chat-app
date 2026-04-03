import { useQuery } from '@apollo/client';
import { useApp } from '../context/AppContext';
import { GET_CHANNELS } from '../graphql/queries';
import './ChannelHeader.css';

interface ChannelData {
  id: string;
  name: string;
  type: 'group' | 'dm';
  members: { id: string; displayName: string }[];
}

export default function ChannelHeader() {
  const { currentUser, currentChannelId } = useApp();
  const { data } = useQuery<{ channels: ChannelData[] }>(GET_CHANNELS);

  const channel = data?.channels
    .filter((ch) => !currentUser || ch.members.some((member) => member.id === currentUser.id))
    .find((ch) => ch.id === currentChannelId);

  let title = '';
  if (channel) {
    if (channel.type === 'dm') {
      const peer = channel.members.find((m) => m.id !== currentUser?.id) ?? channel.members[0];
      title = peer?.displayName ?? 'Direct Message';
    } else {
      title = channel.name;
    }
  }

  return (
    <div className="channel-header">
      <h2 className="channel-header-name">{title}</h2>
    </div>
  );
}
