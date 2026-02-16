import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, update } from 'firebase/database';
import { firebaseAuth, firebaseDb, firebaseStorage } from './firebase';

class StorageService {
  /**
   * Pick an image file via file input dialog.
   * Returns the File object or null if cancelled.
   */
  pickImage(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0] || null;
        resolve(file);
      };
      // Handle cancel
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  /**
   * Upload avatar image to Firebase Storage and update profile.
   */
  async uploadAvatar(file: File): Promise<string> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Must be signed in to upload avatar.');

    const storagePath = `avatars/${user.uid}.jpg`;
    const fileRef = storageRef(firebaseStorage, storagePath);

    await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(fileRef);

    await update(dbRef(firebaseDb, `/users/${user.uid}/profile`), {
      avatarUrl: downloadUrl,
    });

    console.log('[Storage] Avatar uploaded:', downloadUrl);
    return downloadUrl;
  }
}

export const storageService = new StorageService();
