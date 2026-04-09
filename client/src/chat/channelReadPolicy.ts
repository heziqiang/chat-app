export interface ActiveChannelViewState {
  currentChannelId: string | null;
  isLatestMessageVisible: boolean;
}

export function shouldResetUnreadCountForIncomingMessage(
  channelId: string,
  viewState: ActiveChannelViewState,
) {
  return (
    channelId === viewState.currentChannelId &&
    viewState.isLatestMessageVisible
  );
}
