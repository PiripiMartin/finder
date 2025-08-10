# Logging System Documentation

## Overview

The TokApp now includes a comprehensive logging system that provides detailed visibility into the create account functionality and other authentication processes. This system helps with debugging, monitoring user interactions, and tracking API calls.

## Logger Utility

The main logging utility is located at `app/utils/logger.ts` and provides:

- **Structured logging** with timestamps, log levels, and component names
- **Different log levels**: DEBUG, INFO, WARN, ERROR
- **Development vs Production** logging (DEBUG logs only show in development)
- **Convenience methods** for common logging patterns

## Log Levels

- **DEBUG**: Detailed information for debugging (only shown in development)
- **INFO**: General information about application flow
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for actual problems

## Usage Examples

### Basic Logging
```typescript
import { logger } from '../utils/logger';

logger.info('ComponentName', 'User action performed');
logger.debug('ComponentName', 'Debug information', { data: 'value' });
logger.warn('ComponentName', 'Warning message');
logger.error('ComponentName', 'Error occurred', { error: 'details' });
```

### Convenience Methods
```typescript
// API calls
logger.apiCall('ComponentName', '/api/endpoint', 'POST', { data: 'value' });
logger.apiResponse('ComponentName', '/api/endpoint', 200, { response: 'data' });

// User actions
logger.userAction('ComponentName', 'Button clicked', { button: 'submit' });

// Validation
logger.validation('ComponentName', 'email', true, { format: 'valid' });

// Navigation
logger.navigation('ComponentName', 'from-screen', 'to-screen');
```

## Create Account Logging

The create account functionality now includes comprehensive logging for:

### Form Validation
- Username validation (length, format)
- Email validation (format, required)
- Password validation (length, required)
- Password confirmation matching

### User Interactions
- Form field changes
- Button clicks
- Navigation between screens

### API Communication
- Request details (endpoint, method, data)
- Response status and data
- Error handling and parsing
- Performance timing

### Authentication State
- Token storage and retrieval
- State updates
- AsyncStorage operations

## Viewing Logs

### Development
In development mode, all logs are displayed in the console with detailed formatting:
```
[2024-01-15T10:30:00.000Z] [INFO] [CreateAccount] Component mounted
[2024-01-15T10:30:05.000Z] [DEBUG] [CreateAccount] Username changed {"from": "", "to": "john", "length": 4}
[2024-01-15T10:30:10.000Z] [INFO] [CreateAccount] Starting form validation
```

### Production
In production mode:
- DEBUG logs are suppressed
- ERROR logs can be sent to external logging services
- INFO and WARN logs are still displayed in console

## Configuration

The logger automatically detects the environment:
- `__DEV__` flag determines development vs production mode
- Production mode suppresses DEBUG logs
- Error logs can be configured to send to external services

## Best Practices

1. **Use appropriate log levels**:
   - DEBUG for detailed debugging information
   - INFO for general flow information
   - WARN for potential issues
   - ERROR for actual problems

2. **Include relevant context**:
   - Component name for easy filtering
   - Structured data for better analysis
   - Timestamps for chronological tracking

3. **Avoid sensitive information**:
   - Never log passwords or tokens
   - Use `[REDACTED]` for sensitive fields
   - Log only necessary data for debugging

4. **Performance considerations**:
   - DEBUG logs are automatically disabled in production
   - Use structured logging for better performance
   - Avoid complex object serialization in production

## Future Enhancements

- **External logging services**: Integration with Sentry, LogRocket, or similar
- **Log persistence**: Store logs locally for offline debugging
- **Log filtering**: UI for filtering logs by component, level, or time
- **Performance metrics**: Automatic timing for API calls and operations
- **Error reporting**: Automatic error reporting to monitoring services
