import {useMemo} from 'react';
import {useApp} from '../context/AppContext';

const useMessages = (peerId) => {
  const {getMessagesForPeer, markPeerRead, getUnreadCountForPeer} = useApp();

  const messages = useMemo(() => getMessagesForPeer(peerId), [getMessagesForPeer, peerId]);
  const unreadCount = getUnreadCountForPeer(peerId);

  return {
    messages,
    unreadCount,
    markPeerRead: () => markPeerRead(peerId)
  };
};

export default useMessages;
