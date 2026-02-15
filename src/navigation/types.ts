import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Lobby: { autoJoinCode?: string } | undefined;
  Room: undefined;
};

export type LobbyScreenProps = NativeStackScreenProps<RootStackParamList, 'Lobby'>;
export type RoomScreenProps = NativeStackScreenProps<RootStackParamList, 'Room'>;
