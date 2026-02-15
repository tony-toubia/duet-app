import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Lobby: { autoJoinCode?: string } | undefined;
  Room: undefined;
  Profile: undefined;
  Friends: undefined;
};

export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type LobbyScreenProps = NativeStackScreenProps<RootStackParamList, 'Lobby'>;
export type RoomScreenProps = NativeStackScreenProps<RootStackParamList, 'Room'>;
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
export type FriendsScreenProps = NativeStackScreenProps<RootStackParamList, 'Friends'>;
