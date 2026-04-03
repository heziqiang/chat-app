import { useApp } from '../context/AppContext';
import './MessageItem.css';

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
  replyTo: {
    id: string;
    content: string;
    sender: { id: string; displayName: string };
  } | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageItem({ message }: { message: MessageData }) {
  const { currentUser } = useApp();
  const isOwn = currentUser?.id === message.sender.id;

  return (
    <div className={`message-item ${isOwn ? 'own' : 'other'}`}>
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
        {message.replyTo && (
          <div className="message-reply-quote">
            <span className="message-reply-author">
              {message.replyTo.sender.displayName}
            </span>
            <span className="message-reply-text">{message.replyTo.content}</span>
          </div>
        )}
        <div className="message-bubble">
          <p className="message-content">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
