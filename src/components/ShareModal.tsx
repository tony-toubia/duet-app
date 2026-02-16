import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { colors } from '@/theme';

const getShareAdUnitId = () => {
  if (__DEV__) return TestIds.NATIVE;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobLobbyNativeIdIos : extras?.admobLobbyNativeIdAndroid;
  return id || TestIds.NATIVE;
};

const SHARE_AD_UNIT_ID = getShareAdUnitId();

interface ShareModalProps {
  visible: boolean;
  roomCode: string;
  onClose: () => void;
}

export const ShareModal = ({ visible, roomCode, onClose }: ShareModalProps) => {
  const [copied, setCopied] = useState(false);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const adRef = useRef<NativeAd | null>(null);

  // Load ad when modal becomes visible
  useEffect(() => {
    if (!visible) return;

    let destroyed = false;

    NativeAd.createForAdRequest(SHARE_AD_UNIT_ID, {
      aspectRatio: NativeMediaAspectRatio.ANY,
    })
      .then((loadedAd) => {
        if (!destroyed) {
          adRef.current = loadedAd;
          setNativeAd(loadedAd);
          console.log('[Ad] Share modal native ad loaded');
        } else {
          loadedAd.destroy();
        }
      })
      .catch((err) => {
        console.log('[Ad] Share modal native ad failed:', err.message);
      });

    return () => {
      destroyed = true;
      adRef.current?.destroy();
      adRef.current = null;
      setNativeAd(null);
    };
  }, [visible]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Duet! Enter code: ${roomCode}`,
      });
    } catch {
      // Share cancelled
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <Text style={styles.title}>Your Room Code</Text>
          <Text style={styles.subtitle}>
            Share this code with your partner to connect
          </Text>

          <TouchableOpacity style={styles.codeBox} onPress={handleCopy}>
            <Text style={styles.codeText}>{roomCode}</Text>
            <Text style={styles.copyHint}>
              {copied ? 'Copied!' : 'Tap to copy'}
            </Text>
          </TouchableOpacity>

          {/* Native ad */}
          {nativeAd && (
            <NativeAdView nativeAd={nativeAd} style={styles.adContainer}>
              <View style={styles.adRow}>
                <Text style={styles.adBadge}>Ad</Text>
                {nativeAd.icon && (
                  <NativeAsset assetType={NativeAssetType.ICON}>
                    <Image source={{ uri: nativeAd.icon.url }} style={styles.adIcon} />
                  </NativeAsset>
                )}
                <View style={styles.adContent}>
                  <NativeAsset assetType={NativeAssetType.HEADLINE}>
                    <Text style={styles.adHeadline} numberOfLines={1}>{nativeAd.headline}</Text>
                  </NativeAsset>
                  {nativeAd.body && (
                    <NativeAsset assetType={NativeAssetType.BODY}>
                      <Text style={styles.adBody} numberOfLines={1}>{nativeAd.body}</Text>
                    </NativeAsset>
                  )}
                </View>
                {nativeAd.callToAction && (
                  <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                    <Text style={styles.adCta}>{nativeAd.callToAction}</Text>
                  </NativeAsset>
                )}
              </View>
            </NativeAdView>
          )}

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b80',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: '#f5f5fa',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e8e8f0',
    width: '100%',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: 6,
  },
  copyHint: {
    fontSize: 11,
    color: '#9a9aaa',
    marginTop: 6,
  },
  shareBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  closeBtnText: {
    color: '#9a9aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  adContainer: {
    width: '100%',
    backgroundColor: '#f5f5fa',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adBadge: {
    color: '#9a9aaa',
    fontSize: 9,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#c0c0cc',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    overflow: 'hidden',
  },
  adIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  adContent: {
    flex: 1,
  },
  adHeadline: {
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: '600',
  },
  adBody: {
    color: '#6b6b80',
    fontSize: 11,
    marginTop: 1,
  },
  adCta: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#e8734a',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
});
