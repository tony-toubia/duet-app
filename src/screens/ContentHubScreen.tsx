import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ContentService, ContentItem } from '@/services/ContentService';
import { useDuetStore } from '@/hooks/useDuetStore';
import { ContentCard } from '@/components/ContentCard';
import { colors } from '@/theme';
import type { ContentHubScreenProps } from '@/navigation/types';

export const ContentHubScreen = ({ navigation }: ContentHubScreenProps) => {
  const insets = useSafeAreaInsets();
  const userCity = useDuetStore(s => s.userCity);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // We fetch city natively whenever available inside this scope via store or fallback
  const fetchHub = async () => {
    try {
      const data = await ContentService.fetchContent();
      const filtered = ContentService.filterContentByCity(data, userCity); 
      setItems(filtered);
    } catch(e) {
      console.warn("Failed retrieving content", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHub();
  }, [userCity]);

  const handleListenTogether = (item: ContentItem) => {
    const webrtc = useDuetStore.getState().webrtc;
    const partyWebrtc = useDuetStore.getState().partyWebrtc;
    
    // Ping everyone active with the deep link URI over WebRTC Data Channels using "C|" syntax map
    if (webrtc?.connectionState === 'connected') {
      webrtc.sendAudioData(`C|${item.id}|${item.deepLink}`);
    } else if (partyWebrtc) {
      partyWebrtc.sendAudioData(`C|${item.id}|${item.deepLink}`);
    } else {
      console.warn("Not in an active room to broadcast listen together intent.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      {/* Stack has headerShown:false and gestureEnabled:false, so without an
          explicit control there is no way off this screen on iOS. */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Hub</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={v => v.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ContentCard item={item} onListenTogether={handleListenTogether} />
          )}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>No content available yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    color: colors.text,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    minHeight: 200,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  }
});
