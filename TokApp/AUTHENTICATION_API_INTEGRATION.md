# Authentication API Integration

This document describes the changes made to integrate the lai with the local API server for authentication functionality.

## Changes Made

### 1. API Configuration (`app/config/api.ts`)
- Updated `BASE_URL` to point to local API server: `http://localhost:8000/api`
- Updated endpoints to match the actual API:
  - Login: `/login`
  - Create Account: `/signup`
  - Validate Token: `/validate-token`

### 2. Authentication Context (`app/context/AuthContext.tsx`)
- Updated `login` function to include coordinates parameter (required by API)
- Updated `createAccount` function to include email parameter (required by API)
- Added token validation on app startup using the API
- Improved error handling and logging

### 3. Login Screen (`app/auth/login.tsx`)
- Added location handling to get user coordinates for login
- Updated theme usage to use the proper theme object structure
- Integrated with location utility for better coordinate handling

### 4. Create Account Screen (`app/auth/create-account.tsx`)
- Added email field (required by API)
- Added email validation
- Updated theme usage to use the proper theme object structure
- Updated form validation to include email requirements

### 5. Location Utility (`app/utils/location.ts`)
- Created utility functions for handling user location
- `getCurrentLocation()`: Gets current GPS coordinates with permission handling
- `getDefaultCoordinates()`: Provides fallback coordinates if location access is denied

## API Requirements

### Login Endpoint (`/api/login`)
- **Method**: POST
- **Body**: 
  ```json
  {
    "username": "string",
    "password": "string",
    "coordinates": {
      "latitude": number,
      "longitude": number
    }
  }
  ```
- **Response**: 
  ```json
  {
    "sessionToken": "string",
    "savedLocations": [...],
    "recommendedLocations": [...]
  }
  ```

### Create Account Endpoint (`/api/signup`)
- **Method**: POST
- **Body**: 
  ```json
  {
    "username": "string",
    "password": "string",
    "email": "string"
  }
  ```
- **Response**: 
  ```json
  {
    "sessionToken": "string"
  }
  ```

### Validate Token Endpoint (`/api/validate-token`)
- **Method**: GET
- **Headers**: `Authorization: Bearer <token>`
- **Response**: User ID if valid, null if invalid

## Usage

1. **Start the API server** (runs on port 8000)
2. **Start the Expo app**
3. **Login/Create Account**: The app will automatically handle location permissions and coordinate submission
4. **Session Management**: Tokens are automatically validated on app startup

## Notes

- The app requests location permissions to provide accurate coordinates for login
- If location access is denied, default coordinates are used
- All authentication state is persisted using AsyncStorage
- Token validation happens automatically on app startup
- Error messages are logged to console for debugging

## Future Improvements

- Add better error message display to users
- Implement location-based features using the coordinates
- Add refresh token functionality
- Implement proper error handling for network issues
