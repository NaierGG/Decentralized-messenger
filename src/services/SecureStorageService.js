import * as Keychain from 'react-native-keychain';

const IDENTITY_SEED_SERVICE = 'p2p_messenger.identity_seed';
const IDENTITY_SEED_USERNAME = 'identity_seed';

class SecureStorageService {
  async getIdentitySeed() {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: IDENTITY_SEED_SERVICE
      });
      return credentials ? credentials.password : null;
    } catch (error) {
      return null;
    }
  }

  async setIdentitySeed(seed) {
    if (!seed) {
      return false;
    }

    try {
      return Keychain.setGenericPassword(IDENTITY_SEED_USERNAME, String(seed), {
        service: IDENTITY_SEED_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
    } catch (error) {
      return false;
    }
  }

  async removeIdentitySeed() {
    try {
      await Keychain.resetGenericPassword({service: IDENTITY_SEED_SERVICE});
    } catch (error) {
      // Keep runtime stable even if secure storage cleanup fails.
    }
  }
}

export default new SecureStorageService();
