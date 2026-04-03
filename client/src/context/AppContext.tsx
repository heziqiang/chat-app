import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USERS } from '../graphql/queries';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  title: string;
}

interface AppContextValue {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  currentChannelId: string | null;
  setCurrentChannelId: (id: string | null) => void;
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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentChannelId,
        setCurrentChannelId,
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
