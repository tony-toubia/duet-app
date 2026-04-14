import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Lobby: { autoJoinCode?: string } | undefined;
  Room: undefined;
  Profile: undefined;
  Friends: undefined;
  ContentHub: undefined;
};

export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;
export type LobbyScreenProps = NativeStackScreenProps<RootStackParamList, 'Lobby'>;
export type RoomScreenProps = NativeStackScreenProps<RootStackParamList, 'Room'>;
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
export type FriendsScreenProps = NativeStackScreenProps<RootStackParamList, 'Friends'>;
export type ContentHubScreenProps = NativeStackScreenProps<RootStackParamList, 'ContentHub'>;
