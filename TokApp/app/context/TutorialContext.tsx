import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';

interface TutorialContextType {
  shouldShowTutorial: boolean;
  showTutorial: () => void;
  completeTutorial: () => void;
  isLoading: boolean;
  tutorialFeatureEnabled: boolean;
  recheckTutorialAfterLogin: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shouldShowTutorial, setShouldShowTutorial] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tutorialFeatureEnabled, setTutorialFeatureEnabled] = useState(false);

  useEffect(() => {
    console.log('🎓 [Tutorial] TutorialProvider mounted, checking feature flag (but not showing tutorial)');
    checkFeatureFlagOnly();
  }, []);

  // Check feature flag but don't show tutorial automatically
  const checkFeatureFlagOnly = async () => {
    try {
      console.log('🎓 [Tutorial] Checking feature flag for guest button logic');
      const apiUrl = buildApiUrl('/refresh');
      const response = await fetch(apiUrl);
      console.log('🎓 [Tutorial] Response status:', response.status);
      
      if (response.status === 200) {
        console.log('🎓 [Tutorial] Feature flag enabled - guest button will be hidden');
        setTutorialFeatureEnabled(true);
      } else {
        console.log('🎓 [Tutorial] Feature flag disabled - guest button will be shown');
        setTutorialFeatureEnabled(false);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('🎓 [Tutorial] Error checking feature flag:', error);
      setTutorialFeatureEnabled(false);
      setIsLoading(false);
    }
  };

  const checkFeatureFlag = async () => {
    try {
      console.log('🎓 [Tutorial] Starting feature flag check via /api/refresh');
      const apiUrl = buildApiUrl('/refresh');
      console.log('🎓 [Tutorial] API URL:', apiUrl);
      console.log('🎓 [Tutorial] Full endpoint:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('🎓 [Tutorial] Response status:', response.status);
      
      if (response.status === 200) {
        console.log('🎓 [Tutorial] Feature flag enabled - showing tutorial on login regardless of completion status');
        setTutorialFeatureEnabled(true);
        
        // Always show tutorial when feature flag is enabled, ignoring local storage
        console.log('🎓 [Tutorial] Showing tutorial (feature flag enabled)');
        setShouldShowTutorial(true);
        setIsLoading(false);
      } else {
        console.log('🎓 [Tutorial] Feature flag disabled - tutorial hidden (status:', response.status, ')');
        setTutorialFeatureEnabled(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('🎓 [Tutorial] Error checking feature flag:', error);
      setTutorialFeatureEnabled(false);
      setIsLoading(false);
    }
  };

  const showTutorial = () => {
    console.log('🎓 [Tutorial] showTutorial called - tutorialFeatureEnabled:', tutorialFeatureEnabled, 'isLoading:', isLoading);
    if (!tutorialFeatureEnabled) {
      console.log('🎓 [Tutorial] Tutorial feature disabled - not showing tutorial');
      return;
    }
    
    console.log('🎓 [Tutorial] Showing tutorial for user (server enabled via 200 response)');
    setShouldShowTutorial(true);
  };

  const completeTutorial = async () => {
    try {
      console.log('🎓 [Tutorial] Marking tutorial as completed (will show again on next login if feature flag enabled)');
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setShouldShowTutorial(false);
    } catch (error) {
      console.error('🎓 [Tutorial] Error saving tutorial completion:', error);
    }
  };

  const recheckTutorialAfterLogin = async () => {
    console.log('🎓 [Tutorial] Rechecking tutorial state after login');
    // Reset states
    setShouldShowTutorial(false);
    setIsLoading(true);
    setTutorialFeatureEnabled(false);
    
    // Re-check feature flag (which now includes completion check)
    await checkFeatureFlag();
  };

  return (
    <TutorialContext.Provider
      value={{
        shouldShowTutorial,
        showTutorial,
        completeTutorial,
        isLoading,
        tutorialFeatureEnabled,
        recheckTutorialAfterLogin,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
