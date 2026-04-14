import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { AvatarCircle } from './AvatarCircle';
import { colors } from '@/theme';

export interface ParticipantInfo {
  uid: string;
  isSpeaking: boolean;
  isMuted: boolean;
  connectionState: string;
}

interface ParticipantGridProps {
  participants: ParticipantInfo[];
}

export const ParticipantGrid = ({ participants }: ParticipantGridProps) => {

  return (
    <View style={styles.gridContainer}>
      {participants.map((p, i) => (
        <View key={p.uid} style={styles.participantItem}>
          <AvatarCircle 
            label={`Participant ${i + 1}`} 
            initials={`P${i + 1}`} 
            isSpeaking={p.isSpeaking} 
            isMuted={p.isMuted} 
          />
          <Text style={[styles.statusText, p.connectionState === 'connected' ? styles.statusConnected : styles.statusConnecting]}>
            {p.connectionState}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  participantItem: {
    alignItems: 'center',
    width: 100,
  },
  statusText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusConnected: {
    color: colors.success,
  },
  statusConnecting: {
    color: colors.warning,
  }
});
