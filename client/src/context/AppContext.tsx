import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useQuery } from '@apollo/client';
import { GET_USERS, GET_CHANNELS } from '../graphql/queries';
import { getSocket } from '../socket';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  title: string;
}

export interface AppChannelMember {
  id: string;
  displayName: string;
  avatarUrl: string;
}

export interface AppChannel {
  id: string;
  name: string;
  type: 'group' | 'dm';
  avatarUrl: string;
  members: AppChannelMember[];
}

interface AppContextValue {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  currentChannelId: string | null;
  setCurrentChannelId: (id: string | null) => void;
  channels: AppChannel[];
  users: User[];
  usersLoading: boolean;
  usersError: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'gradual-chat-userId';

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const { data, loading, error } = useQuery<{ users: User[] }>(GET_USERS);
  const users = data?.users ?? [];

  // Restore user from sessionStorage once users are loaded
  useEffect(() => {
    if (restored || loading || users.length === 0) return;
    const storedId = sessionStorage.getItem(STORAGE_KEY);
    if (storedId) {
      const match = users.find((u) => u.id === storedId);
      if (match) setCurrentUserState(match);
    }
    setRestored(true);
  }, [loading, users, restored]);

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      sessionStorage.setItem(STORAGE_KEY, user.id);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Join all channels the user belongs to
  const { data: channelsData } = useQuery<{ channels: AppChannel[] }>(GET_CHANNELS, {
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-first',
    skip: !currentUser,
  });
  const channels = channelsData?.channels ?? [];
  const joinedChannelIdsRef = useRef<Set<string>>(new Set());

  // Manage socket connection lifecycle based on current user
  useEffect(() => {
    const socket = getSocket();
    if (!currentUser) {
      joinedChannelIdsRef.current = new Set();
      socket.disconnect();
      return;
    }

    socket.auth = { userId: currentUser.id };
    socket.connect();

    return () => {
      joinedChannelIdsRef.current = new Set();
      socket.disconnect();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || channels.length === 0) return;

    const socket = getSocket();
    const channelIds = channels.map((channel) => channel.id);

    const syncJoinedChannels = (force = false) => {
      for (const channelId of channelIds) {
        if (!force && joinedChannelIdsRef.current.has(channelId)) continue;
        socket.emit('join_channel', { channelId });
        joinedChannelIdsRef.current.add(channelId);
      }
    };

    const handleConnect = () => {
      joinedChannelIdsRef.current = new Set();
      syncJoinedChannels(true);
    };

    socket.on('connect', handleConnect);
    if (socket.connected) {
      syncJoinedChannels();
    }

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [currentUser?.id, channels]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentChannelId,
        setCurrentChannelId,
        channels,
        users,
        usersLoading: loading,
        usersError: error?.message ?? null,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
