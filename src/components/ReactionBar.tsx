import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useDuetStore } from '@/hooks/useDuetStore';
import { colors } from '@/theme';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'];

export const ReactionBar = () => {
  const sendReaction = useDuetStore((s) => s.sendReaction);
  const connectionState = useDuetStore((s) => s.connectionState);

  if (connectionState !== 'connected') return null;

  return (
    <View style={styles.container}>
      {REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={styles.button}
          onPress={() => sendReaction(emoji)}
          activeOpacity={0.6}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 22,
  },
});
