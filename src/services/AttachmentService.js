import {launchImageLibrary} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';

const normalizeNameFromUri = (uri, fallback = 'attachment') => {
  const value = String(uri || '').split('/').pop() || '';
  return value.trim() || fallback;
};

class AttachmentService {
  async pickImage() {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false
    });

    if (result.didCancel) {
      return null;
    }
    if (result.errorCode) {
      throw new Error(result.errorMessage || '이미지를 불러올 수 없어요.');
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      throw new Error('선택한 이미지 정보를 읽을 수 없어요.');
    }

    return {
      type: 'image',
      url: asset.uri,
      name: asset.fileName || normalizeNameFromUri(asset.uri, 'image.jpg'),
      size: asset.fileSize || null,
      mimeType: asset.type || 'image/*'
    };
  }

  async pickFile() {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory'
      });

      const uri = file.fileCopyUri || file.uri;
      if (!uri) {
        throw new Error('선택한 파일 경로를 읽을 수 없어요.');
      }

      return {
        type: 'file',
        url: uri,
        name: file.name || normalizeNameFromUri(uri, 'file'),
        size: file.size || null,
        mimeType: file.type || 'application/octet-stream'
      };
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        return null;
      }
      throw new Error(error?.message || '파일을 불러올 수 없어요.');
    }
  }
}

export default new AttachmentService();
