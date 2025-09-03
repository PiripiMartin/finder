import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';

interface TutorialContextType {
  shouldShowTutorial: boolean;
  showTutorial: () => Promise<void>;
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
    console.log('🎓 [Tutorial] TutorialProvider mounted, starting feature flag check');
    checkFeatureFlag();
  }, []);

  const checkFeatureFlag = async () => {
    try {
      console.log('🎓 [Tutorial] Starting feature flag check via /api/refresh');
      const apiUrl = buildApiUrl('/refresh');
      console.log('🎓 [Tutorial] API URL:', apiUrl);
      console.log('🎓 [Tutorial] Full endpoint:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('🎓 [Tutorial] Response status:', response.status);
      
      if (response.status === 200) {
        console.log('🎓 [Tutorial] Feature flag enabled - tutorial will be available');
        setTutorialFeatureEnabled(true);
        await checkTutorialStatus();
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

  const checkTutorialStatus = async () => {
    try {
      const tutorialCompleted = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
      console.log('🎓 [Tutorial] Tutorial status:', tutorialCompleted ? 'completed' : 'not completed');
      setIsLoading(false);
    } catch (error) {
      console.error('🎓 [Tutorial] Error checking tutorial status:', error);
      setIsLoading(false);
    }
  };

  const showTutorial = async () => {
    console.log('🎓 [Tutorial] showTutorial called - tutorialFeatureEnabled:', tutorialFeatureEnabled, 'isLoading:', isLoading);
    if (!tutorialFeatureEnabled) {
      console.log('🎓 [Tutorial] Tutorial feature disabled - not showing tutorial');
      return;
    }
    
    // Check if tutorial was already completed
    try {
      const tutorialCompleted = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
      if (tutorialCompleted) {
        console.log('🎓 [Tutorial] Tutorial already completed - not showing');
        return;
      }
    } catch (error) {
      console.error('🎓 [Tutorial] Error checking tutorial completion status:', error);
    }
    
    console.log('🎓 [Tutorial] Showing tutorial for user');
    setShouldShowTutorial(true);
  };

  const completeTutorial = async () => {
    try {
      console.log('🎓 [Tutorial] Marking tutorial as completed');
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
    
    // Re-check feature flag
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
