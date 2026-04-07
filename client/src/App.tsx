import { useEffect, useState } from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, HttpLink, ApolloLink } from '@apollo/client';
import { AppProvider, useApp } from './context/AppContext';
import { getSocket } from './socket';
import UserPicker from './components/UserPicker';
import ChannelList from './components/ChannelList';
import ChannelHeader from './components/ChannelHeader';
import MessageList from './components/MessageList';
import MessageComposer from './components/MessageComposer';
import type { MessageData } from './components/MessageItem';

const httpLink = new HttpLink({ uri: '/graphql' });

const authLink = new ApolloLink((operation, forward) => {
  const userId = sessionStorage.getItem('gradual-chat-userId');
  const headers: Record<string, string> = {};
  if (userId) {
    headers['x-user-id'] = userId;
  }
  const socket = getSocket();
  if (socket.id) {
    headers['x-socket-id'] = socket.id;
  }
  operation.setContext({ headers });
  return forward(operation);
});

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function AppContent() {
  const { currentUser, currentChannelId } = useApp();
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);

  useEffect(() => {
    setReplyingTo(null);
  }, [currentChannelId]);

  if (!currentUser) return <UserPicker />;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <ChannelList />
      </aside>
      <main className="main-panel">
        {currentChannelId ? (
          <>
            <ChannelHeader />
            <MessageList onReply={setReplyingTo} />
            <MessageComposer
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
            />
          </>
        ) : (
          <div className="empty-state">Select a channel to start chatting</div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ApolloProvider>
  );
}

export default App;
