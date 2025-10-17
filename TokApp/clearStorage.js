/**
 * Clear AsyncStorage Script
 * Run this in your app's development console or add to a dev menu
 * 
 * This will clear all AsyncStorage keys including:
 * - session_token
 * - tutorial_completed
 * - location_order
 * - folders
 */

// To run this, paste it into the Chrome DevTools console when your app is running
// Or add it to your app as a development utility

const clearAsyncStorage = async () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    console.log('🗑️ Clearing all AsyncStorage data...');
    
    // Get all keys first to see what we're clearing
    const keys = await AsyncStorage.getAllKeys();
    console.log('📋 Keys to be cleared:', keys);
    
    // Clear all keys
    await AsyncStorage.clear();
    
    console.log('✅ AsyncStorage cleared successfully!');
    console.log('🔄 Please restart the app to see changes');
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing AsyncStorage:', error);
    return false;
  }
};

// If running in browser console with React Native remote debugging
if (typeof AsyncStorage !== 'undefined') {
  clearAsyncStorage();
} else {
  console.log('⚠️ This script needs to be run in the React Native context');
  console.log('Options:');
  console.log('1. Run it in Chrome DevTools when remote debugging is enabled');
  console.log('2. Add this function to your app and call it from a button');
  console.log('3. Use the React Native CLI: npx react-native run-ios --reset-cache');
}

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clearAsyncStorage };
}

