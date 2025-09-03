import { NativeModules } from 'react-native';

interface ShareExtensionBridgeInterface {
  getSharedData(): Promise<any>;
}

const { ShareExtensionBridge } = NativeModules;

export default ShareExtensionBridge as ShareExtensionBridgeInterface;
