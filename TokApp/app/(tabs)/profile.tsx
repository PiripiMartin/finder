import { StyleSheet, View } from "react-native";
import { useTheme } from '../context/ThemeContext';

export default function Profile() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Blank page - Profile is now accessible from the map page */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 