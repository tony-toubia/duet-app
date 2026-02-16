import storage from '@react-native-firebase/storage';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

class StorageService {
  /**
   * Pick an image from the gallery
   */
  async pickImage(): Promise<string | null> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }

  /**
   * Take a photo with the camera
   */
  async takePhoto(): Promise<string | null> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission is required to take a photo.');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }

  /**
   * Upload avatar image to Firebase Storage and update profile
   */
  async uploadAvatar(localUri: string): Promise<string> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in to upload avatar.');

    const storagePath = `avatars/${user.uid}.jpg`;
    const ref = storage().ref(storagePath);

    // On iOS, file:// URIs work directly. On Android, we may need to handle content:// URIs
    const uploadUri = Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri;

    await ref.putFile(uploadUri);
    const downloadUrl = await ref.getDownloadURL();

    // Update profile in database
    await database().ref(`/users/${user.uid}/profile`).update({
      avatarUrl: downloadUrl,
    });

    console.log('[Storage] Avatar uploaded:', downloadUrl);
    return downloadUrl;
  }
}

export const storageService = new StorageService();
