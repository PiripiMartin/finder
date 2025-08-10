import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import { logger } from '../utils/logger';

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string, coordinates?: { latitude: number; longitude: number }) => Promise<boolean>;
  createAccount: (username: string, password: string, email: string) => Promise<boolean>;
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
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const SESSION_TOKEN_KEY = 'session_token';

  const checkAuthStatus = async () => {
    logger.info('AuthContext', 'Checking authentication status');
    try {
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
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
          setSessionToken(token);
          setIsAuthenticated(true);
        } else {
          logger.warn('AuthContext', 'Token validation failed, removing invalid token');
          // Token is invalid, remove it
          await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
          setSessionToken(null);
          setIsAuthenticated(false);
        }
      } else {
        logger.debug('AuthContext', 'No stored session token found');
      }
    } catch (error) {
      logger.error('AuthContext', 'Error checking auth status', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // On error, assume not authenticated
      await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
      setIsAuthenticated(false);
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
        const token = data.sessionToken;
        
        if (token) {
          logger.info('AuthContext', 'Login successful, storing session token');
          await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
          setSessionToken(token);
          setIsAuthenticated(true);
          logger.info('AuthContext', 'Login completed successfully');
          return true;
        } else {
          logger.warn('AuthContext', 'Login succeeded but no session token received');
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
        logger.info('AuthContext', 'Account creation successful', {
          ...data,
          sessionToken: data.sessionToken ? '[PRESENT]' : '[MISSING]'
        });
        
        const token = data.sessionToken;
        
        if (token) {
          logger.info('AuthContext', 'Session token received, storing in AsyncStorage');
          await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
          logger.info('AuthContext', 'Session token stored successfully');
          
          logger.info('AuthContext', 'Updating authentication state');
          setSessionToken(token);
          setIsAuthenticated(true);
          logger.info('AuthContext', 'Authentication state updated successfully');
          
          return true;
        } else {
          logger.error('AuthContext', 'Account creation succeeded but no session token received');
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
      await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
      setIsAuthenticated(false);
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
    sessionToken,
    isLoading,
    login,
    createAccount,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
