import { NativeModules } from 'react-native';

interface SharedUserDefaultsInterface {
  setSessionToken(token: string): Promise<boolean>;
  removeSessionToken(): Promise<boolean>;
  getSessionToken(): Promise<string | null>;
}

const { SharedUserDefaults } = NativeModules;

export default SharedUserDefaults as SharedUserDefaultsInterface;
