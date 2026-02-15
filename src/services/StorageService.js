import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../utils/constants';

class StorageService {
  async getJson(key, fallbackValue) {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  async setJson(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore persistence errors for runtime reliability.
    }
  }

  getProfile() {
    return this.getJson(STORAGE_KEYS.PROFILE, null);
  }

  saveProfile(profile) {
    return this.setJson(STORAGE_KEYS.PROFILE, profile);
  }

  getPeers() {
    return this.getJson(STORAGE_KEYS.PEERS, []);
  }

  savePeers(peers) {
    return this.setJson(STORAGE_KEYS.PEERS, peers);
  }

  getMessagesByPeer() {
    return this.getJson(STORAGE_KEYS.MESSAGES, {});
  }

  saveMessagesByPeer(messagesByPeer) {
    return this.setJson(STORAGE_KEYS.MESSAGES, messagesByPeer);
  }
}

export default new StorageService();
