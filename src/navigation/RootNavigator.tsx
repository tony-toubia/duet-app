import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { RoomScreen } from '@/screens/RoomScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="Room" component={RoomScreen} />
    </Stack.Navigator>
  );
};
