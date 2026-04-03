import { ApolloClient, InMemoryCache, ApolloProvider, HttpLink, ApolloLink } from '@apollo/client';
import { AppProvider, useApp } from './context/AppContext';
import UserPicker from './components/UserPicker';
import ChannelList from './components/ChannelList';
import ChannelHeader from './components/ChannelHeader';
import MessageList from './components/MessageList';
import MessageComposer from './components/MessageComposer';

const httpLink = new HttpLink({ uri: '/graphql' });

const authLink = new ApolloLink((operation, forward) => {
  const userId = sessionStorage.getItem('gradual-chat-userId');
  if (userId) {
    operation.setContext({
      headers: { 'x-user-id': userId },
    });
  }
  return forward(operation);
});

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function AppContent() {
  const { currentUser, currentChannelId } = useApp();

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
            <MessageList />
            <MessageComposer />
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
