import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import type { ContentItem } from '@/services/ContentService';
import { colors } from '@/theme';

interface ContentCardProps {
  item: ContentItem;
  onListenTogether: (item: ContentItem) => void;
}

export const ContentCard = ({ item, onListenTogether }: ContentCardProps) => {
  const handleOpenLocal = async () => {
    try {
      const supported = await Linking.canOpenURL(item.deepLink);
      if (supported) {
        await Linking.openURL(item.deepLink);
      } else {
        console.warn('Cannot open deep link:', item.deepLink);
      }
    } catch (e) {
      console.warn('Failed opening deep link', e);
    }
  };

  return (
    <View style={styles.card}>
      {!!item.image && (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.content}>
        <Text style={styles.typeTag}>{item.type.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.city && (
          <Text style={styles.cityText}>Localized for {item.city}</Text>
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.openLocalBtn} onPress={handleOpenLocal}>
            <Text style={styles.openLocalText}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listenTogetherBtn} onPress={() => onListenTogether(item)}>
              <Text style={styles.listenTogetherText}>Listen Together</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    marginBottom: 16,
    flexDirection: 'row',
  },
  image: {
    width: 100,
    height: '100%',
    backgroundColor: '#3d3d50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cityText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 'auto',
  },
  openLocalBtn: {
    backgroundColor: colors.glass,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  openLocalText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  listenTogetherBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  listenTogetherText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  }
});
