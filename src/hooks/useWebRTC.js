import {useApp} from '../context/AppContext';

const useWebRTC = () => {
  const {
    createOfferSignal,
    handleScannedSignal,
    getPeerConnectionState,
    sendMessageToPeer
  } = useApp();

  return {
    createOfferSignal,
    handleScannedSignal,
    getPeerConnectionState,
    sendMessageToPeer
  };
};

export default useWebRTC;
