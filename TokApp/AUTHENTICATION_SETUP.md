# Authentication System Setup

This document explains how to set up and use the authentication system in your lai.

## Overview

The authentication system provides:
- User login with username/password
- User account creation
- Session token management
- Automatic authentication state checking
- Secure token storage using AsyncStorage

## Setup Instructions

### 1. Configure API Endpoints

Edit `app/config/api.ts` and replace the placeholder values with your actual API endpoints:

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://your-api-domain.com', // Replace with your actual API base URL
  ENDPOINTS: {
    LOGIN: '/auth/login',
    CREATE_ACCOUNT: '/auth/create-account',
    MAP_POINTS: '/map-points',
    VALIDATE_TOKEN: '/auth/validate',
  },
};
```

### 2. API Response Format

Your API endpoints should return responses in the following format:

#### Login Response (`/auth/login`)
```json
{
  "success": true,
  "sessionToken": "your-session-token-here",
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

#### Create Account Response (`/auth/create-account`)
```json
{
  "success": true,
  "sessionToken": "your-session-token-here",
  "user": {
    "id": "user-id",
    "username": "username"
  }
}
```

#### Map Points Response (`/map-points`)
```json
{
  "success": true,
  "recommendedLocations": [
    {
      "location": {
        "id": "location-id",
        "title": "Location Title",
        "description": "Location Description",
        "emoji": "☕",
        "latitude": -37.8100,
        "longitude": 144.9600
      },
      "topPost": {
        "id": 458,
        "url": "tiktok-video-url",
        "postedBy": 991,
        "mapPointId": 125,
        "postedAt": "2024-01-16T18:45:00.000Z"
      }
    }
  ]
}
```

### 3. Authentication Flow

1. **App Launch**: The app checks for existing session token
2. **If token exists**: User is automatically logged in and redirected to main app
3. **If no token**: User is redirected to login screen
4. **Login/Create Account**: User enters credentials and receives session token
5. **Token Storage**: Session token is securely stored using AsyncStorage
6. **API Calls**: All subsequent API calls include the session token in Authorization header

### 4. Security Features

- Session tokens are stored securely using AsyncStorage
- Tokens are automatically included in API requests
- Logout functionality clears stored tokens
- Authentication state is managed globally through React Context

### 5. File Structure

```
app/
├── auth/
│   ├── _layout.tsx          # Auth navigation layout
│   ├── login.tsx            # Login screen
│   └── create-account.tsx   # Create account screen
├── context/
│   ├── AuthContext.tsx      # Authentication context
│   └── ThemeContext.tsx     # Theme context
├── components/
│   └── AuthWrapper.tsx      # Authentication wrapper component
├── config/
│   └── api.ts               # API configuration
└── index.tsx                # Root index with auth routing
```

### 6. Usage Examples

#### Using Authentication in Components

```typescript
import { useAuth } from '../context/AuthContext';

export default function MyComponent() {
  const { isAuthenticated, sessionToken, logout } = useAuth();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Text>Please log in</Text>;
  }
  
  // Use session token for API calls
  const fetchData = async () => {
    const response = await fetch('/api/data', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    });
  };
  
  return (
    <View>
      <Text>Welcome, authenticated user!</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

#### Making Authenticated API Calls

```typescript
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

const { sessionToken } = useAuth();

const response = await fetch(getApiUrl('MAP_POINTS'), {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`,
  },
});
```

### 7. Testing

1. **Test Login Flow**: Try logging in with valid credentials
2. **Test Create Account**: Create a new account
3. **Test Token Persistence**: Close and reopen the app
4. **Test Logout**: Use the logout button in the profile tab
5. **Test API Integration**: Verify that authenticated API calls work

### 8. Troubleshooting

#### Common Issues

1. **"Cannot find name 'setSessionToken'"**: This error occurs if you're still using the old session token state. The authentication context now manages this automatically.

2. **API calls failing**: Check that your API endpoints are correctly configured in `app/config/api.ts`.

3. **Authentication not persisting**: Ensure AsyncStorage is properly installed and working.

4. **Navigation issues**: Verify that the auth routes are properly configured in your navigation structure.

#### Debug Mode

To debug authentication issues, add console logs in the AuthContext:

```typescript
const login = async (username: string, password: string): Promise<boolean> => {
  try {
    console.log('Attempting login for:', username);
    const response = await fetch(getApiUrl('LOGIN'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    console.log('Login response status:', response.status);
    const data = await response.json();
    console.log('Login response data:', data);
    
    // ... rest of the function
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
};
```

## Support

If you encounter any issues with the authentication system, check:
1. API endpoint configuration
2. Network connectivity
3. Console logs for error messages
4. AsyncStorage permissions

The authentication system is designed to be robust and handle edge cases gracefully, falling back to offline data when necessary.
