import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getApiUrl } from '../config/api';
import { logger } from '../utils/logger';
import SharedUserDefaults from '../utils/SharedUserDefaults';

interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  sessionToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string, coordinates?: { latitude: number; longitude: number }) => Promise<boolean>;
  createAccount: (username: string, password: string, email: string) => Promise<boolean>;
  guestLogin: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const SESSION_TOKEN_KEY = 'session_token';

  // Helper function to store session token in both AsyncStorage and shared UserDefaults
  const storeSessionToken = async (token: string) => {
    logger.info('AuthContext', 'Storing session token in AsyncStorage and shared UserDefaults');
    logger.debug('AuthContext', `Platform.OS: ${Platform.OS}, SharedUserDefaults available: ${!!SharedUserDefaults}`);
    
    // Store in AsyncStorage (for main app)
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
    logger.info('AuthContext', 'Session token stored in AsyncStorage');
    
    // Store in shared UserDefaults (for share extension)
    if (Platform.OS === 'ios') {
      if (SharedUserDefaults) {
        try {
          logger.info('AuthContext', 'Attempting to store session token in shared UserDefaults...');
          const result = await SharedUserDefaults.setSessionToken(token);
          logger.info('AuthContext', `Session token stored in shared UserDefaults successfully: ${result}`);
          
          // Test reading it back immediately
          const storedToken = await SharedUserDefaults.getSessionToken();
          logger.info('AuthContext', `Verification - token read back from shared UserDefaults: ${storedToken ? 'SUCCESS' : 'FAILED'}`);
          if (storedToken) {
            logger.debug('AuthContext', `Stored token matches: ${storedToken === token}`);
          }
        } catch (error) {
          logger.error('AuthContext', 'Failed to store session token in shared UserDefaults', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      } else {
        logger.error('AuthContext', 'SharedUserDefaults module is not available');
      }
    } else {
      logger.debug('AuthContext', 'Not iOS platform, skipping shared UserDefaults storage');
    }
  };

  // Helper function to remove session token from both locations
  const removeSessionToken = async () => {
    logger.info('AuthContext', 'Removing session token from all locations');
    
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    
    if (Platform.OS === 'ios' && SharedUserDefaults) {
      try {
        await SharedUserDefaults.removeSessionToken();
        logger.info('AuthContext', 'Session token removed from shared UserDefaults');
      } catch (error) {
        logger.error('AuthContext', 'Failed to remove session token from shared UserDefaults', error);
      }
    }
  };

  const guestLogin = async () => {
    logger.info('AuthContext', 'Starting guest login');
    try {
      setIsGuest(true);
      setIsAuthenticated(false);
      setSessionToken(null);
      logger.info('AuthContext', 'Guest login completed successfully');
    } catch (error) {
      logger.error('AuthContext', 'Guest login error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const checkAuthStatus = async () => {
    logger.info('AuthContext', 'Checking authentication status');
    try {
      // First check AsyncStorage
      let token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
      
      // If no token in AsyncStorage and we're on iOS, also check SharedUserDefaults
      if (!token && Platform.OS === 'ios' && SharedUserDefaults) {
        try {
          logger.debug('AuthContext', 'No token in AsyncStorage, checking SharedUserDefaults');
          token = await SharedUserDefaults.getSessionToken();
          if (token) {
            logger.info('AuthContext', 'Found token in SharedUserDefaults, syncing to AsyncStorage');
            // Sync the token back to AsyncStorage for consistency
            await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
          }
        } catch (error) {
          logger.warn('AuthContext', 'Failed to check SharedUserDefaults for token', error);
        }
      }
      
      if (token) {
        logger.debug('AuthContext', 'Found stored session token, validating with API');
        // Validate the token with the API
        const response = await fetch(getApiUrl('VALIDATE_TOKEN'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          logger.info('AuthContext', 'Token validation successful, user authenticated');
          // Ensure token is stored in both locations
          await storeSessionToken(token);
          setSessionToken(token);
          setIsAuthenticated(true);
          setIsGuest(false);
        } else {
          logger.warn('AuthContext', 'Token validation failed, removing invalid token');
          // Token is invalid, remove it from all locations
          await removeSessionToken();
          setSessionToken(null);
          setIsAuthenticated(false);
          setIsGuest(true); // Set guest mode when token is invalid
        }
      } else {
        logger.debug('AuthContext', 'No stored session token found in any location, user needs to log in');
        setIsGuest(false); // User needs to authenticate, not guest mode
        setIsAuthenticated(false);
        setSessionToken(null);
      }
    } catch (error) {
      logger.error('AuthContext', 'Error checking auth status', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // On error, assume not authenticated and require login
      await removeSessionToken();
      setSessionToken(null);
      setIsAuthenticated(false);
      setIsGuest(false);
    } finally {
      logger.debug('AuthContext', 'Auth status check completed, setting loading to false');
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, coordinates?: { latitude: number; longitude: number }): Promise<boolean> => {
    logger.info('AuthContext', 'Starting login process');
    logger.debug('AuthContext', 'Login request', {
      username,
      passwordLength: password.length,
      coordinates: coordinates || { latitude: 0, longitude: 0 },
      timestamp: new Date().toISOString()
    });

    try {
      // Use default coordinates if none provided (you might want to get user's location here)
      const defaultCoordinates = { latitude: 0, longitude: 0 };
      const requestBody = {
        username,
        password,
        coordinates: coordinates || defaultCoordinates,
      };

      const apiUrl = getApiUrl('LOGIN');
      logger.apiCall('AuthContext', apiUrl, 'POST', { username, coordinates: requestBody.coordinates });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      logger.apiResponse('AuthContext', apiUrl, response.status, {
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('AuthContext', 'Login API response received:', data);
        const token = data.sessionToken;
        
        if (token) {
          logger.info('AuthContext', 'Login successful, storing session token');
          await storeSessionToken(token);
          setSessionToken(token);
          setIsAuthenticated(true);
          setIsGuest(false); // Clear guest mode when login is successful
          logger.info('AuthContext', 'Login completed successfully');
          return true;
        } else {
          logger.warn('AuthContext', 'Login succeeded but no session token received. Response data:', data);
          // Check if token might be in a different field
          const possibleTokenFields = ['token', 'accessToken', 'authToken', 'jwt', 'bearer'];
          for (const field of possibleTokenFields) {
            if (data[field]) {
              logger.info('AuthContext', `Found token in field '${field}':`, data[field]);
              await storeSessionToken(data[field]);
              setSessionToken(data[field]);
              setIsAuthenticated(true);
              setIsGuest(false);
              logger.info('AuthContext', 'Login completed successfully using alternative token field');
              return true;
            }
          }
        }
      } else {
        const errorText = await response.text();
        logger.error('AuthContext', 'Login failed', { status: response.status, errorText });
        // You could throw an error here with the specific message if you want to show it to the user
      }
      
      return false;
    } catch (error) {
      logger.error('AuthContext', 'Login error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  };

  const createAccount = async (username: string, password: string, email: string): Promise<boolean> => {
    logger.info('AuthContext', 'Starting account creation process');
    logger.debug('AuthContext', 'Account creation request', {
      username,
      email,
      passwordLength: password.length,
      timestamp: new Date().toISOString()
    });

    try {
      const apiUrl = getApiUrl('CREATE_ACCOUNT');
      logger.apiCall('AuthContext', apiUrl, 'POST', { username, email, passwordLength: password.length });
      
      const requestBody = { username, password, email };
      logger.debug('AuthContext', 'Request body', { ...requestBody, password: '[REDACTED]' });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      logger.apiResponse('AuthContext', apiUrl, response.status, {
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('AuthContext', 'Account creation API response received:', data);
        logger.info('AuthContext', 'Account creation successful', {
          ...data,
          sessionToken: data.sessionToken ? '[PRESENT]' : '[MISSING]'
        });
        
        const token = data.sessionToken;
        
        if (token) {
          logger.info('AuthContext', 'Session token received, storing in AsyncStorage and SharedUserDefaults');
          await storeSessionToken(token);
          logger.info('AuthContext', 'Session token stored successfully');
          
          logger.info('AuthContext', 'Updating authentication state');
          setSessionToken(token);
          setIsAuthenticated(true);
          setIsGuest(false); // Clear guest mode when account creation is successful
          logger.info('AuthContext', 'Authentication state updated successfully');
          
          return true;
        } else {
          logger.error('AuthContext', 'Account creation succeeded but no session token received. Response data:', data);
          // Check if token might be in a different field
          const possibleTokenFields = ['token', 'accessToken', 'authToken', 'jwt', 'bearer'];
          for (const field of possibleTokenFields) {
            if (data[field]) {
              logger.info('AuthContext', `Found token in field '${field}':`, data[field]);
              await storeSessionToken(data[field]);
              setSessionToken(data[field]);
              setIsAuthenticated(true);
              setIsGuest(false);
              logger.info('AuthContext', 'Account creation completed successfully using alternative token field');
              return true;
            }
          }
          return false;
        }
      } else {
        const errorText = await response.text();
        logger.error('AuthContext', 'Account creation failed', { status: response.status, errorText });
        
        // Log additional error details
        try {
          const errorData = JSON.parse(errorText);
          logger.debug('AuthContext', 'Parsed error data', errorData);
        } catch (parseError) {
          logger.warn('AuthContext', 'Could not parse error response as JSON', { parseError });
        }
        
        return false;
      }
    } catch (error) {
      logger.error('AuthContext', 'Create account error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  };

  const logout = async () => {
    logger.info('AuthContext', 'Starting logout process');
    try {
      await removeSessionToken();
      setSessionToken(null);
      setIsAuthenticated(false);
      setIsGuest(false);
      logger.info('AuthContext', 'Logout completed successfully');
    } catch (error) {
      logger.error('AuthContext', 'Logout error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  useEffect(() => {
    logger.info('AuthContext', 'AuthProvider mounted, checking auth status');
    checkAuthStatus();
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isGuest,
    sessionToken,
    isLoading,
    login,
    createAccount,
    guestLogin,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
