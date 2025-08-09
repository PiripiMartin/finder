import { Stack } from "expo-router";
import { ThemeProvider } from './context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_left',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="_location" 
          options={{
            animation: 'slide_from_left',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
