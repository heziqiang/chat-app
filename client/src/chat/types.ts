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
