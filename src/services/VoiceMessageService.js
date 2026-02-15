import {PermissionsAndroid, Platform} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

const normalizeFilePath = (value) => String(value || '').replace(/^file:\/\//, '');
const withFileScheme = (value) => {
  const normalized = normalizeFilePath(value);
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('file://') ? normalized : `file://${normalized}`;
};

const estimateBase64ByteSize = (base64Value) => {
  const normalized = String(base64Value || '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

class VoiceMessageService {
  constructor() {
    this.recorder = new AudioRecorderPlayer();
    this.recordingPath = '';
    this.recordingStartAt = 0;
    this.recordingActive = false;
  }

  async ensureRecordPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  }

  getRecordingTargetPath() {
    const fileName = `voice-${Date.now()}.m4a`;
    const basePath =
      RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
    return `${basePath}/${fileName}`;
  }

  async startRecording() {
    if (this.recordingActive) {
      return withFileScheme(this.recordingPath);
    }

    const granted = await this.ensureRecordPermission();
    if (!granted) {
      throw new Error('Microphone permission denied');
    }

    const targetPath = this.getRecordingTargetPath();
    const actualPath = await this.recorder.startRecorder(targetPath);
    const normalizedPath = normalizeFilePath(actualPath || targetPath);

    this.recordingPath = normalizedPath;
    this.recordingStartAt = Date.now();
    this.recordingActive = true;

    return withFileScheme(normalizedPath);
  }

  async stopRecording() {
    if (!this.recordingActive) {
      return null;
    }

    let stoppedPath = '';
    try {
      stoppedPath = await this.recorder.stopRecorder();
    } finally {
      this.recordingActive = false;
    }

    const normalizedPath = normalizeFilePath(stoppedPath || this.recordingPath);
    const startedAt = this.recordingStartAt || Date.now();
    this.recordingPath = '';
    this.recordingStartAt = 0;

    if (!normalizedPath) {
      throw new Error('Failed to save voice recording');
    }

    const base64Data = await RNFS.readFile(normalizedPath, 'base64');
    const durationMs = Math.max(1000, Date.now() - startedAt);

    return {
      type: 'audio',
      url: withFileScheme(normalizedPath),
      name: `voice-${startedAt}.m4a`,
      mimeType: 'audio/mp4',
      size: estimateBase64ByteSize(base64Data),
      durationMs,
      dataB64: base64Data
    };
  }

  async cancelRecording() {
    if (!this.recordingActive) {
      return;
    }

    const pathToDelete = this.recordingPath;
    try {
      await this.recorder.stopRecorder();
    } catch (error) {
      // Best effort: stop may fail when recorder state already changed.
    } finally {
      this.recordingActive = false;
      this.recordingPath = '';
      this.recordingStartAt = 0;
    }

    if (!pathToDelete) {
      return;
    }

    try {
      await RNFS.unlink(pathToDelete);
    } catch (error) {
      // Ignore cleanup failures.
    }
  }

  async saveIncomingAudioBase64(base64Data, suggestedName = '') {
    const safeName = String(suggestedName || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 48);
    const fileName = safeName || `voice-incoming-${Date.now()}.m4a`;
    const basePath =
      RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
    const targetPath = `${basePath}/${fileName}`;

    await RNFS.writeFile(targetPath, String(base64Data || ''), 'base64');
    return withFileScheme(targetPath);
  }
}

export default new VoiceMessageService();

