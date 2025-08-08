import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const goToTikTokList = () => {
    router.push('/tiktok-list');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TEST SCREEN</Text>
      <Text style={styles.subtitle}>If you can see this, the app is working!</Text>
      
      <TouchableOpacity style={styles.button} onPress={goToTikTokList}>
        <Text style={styles.buttonText}>GO TO TIKTOK LIST</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF00FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00FF00',
    padding: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'black',
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 