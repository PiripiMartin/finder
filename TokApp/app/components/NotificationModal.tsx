import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Notification {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

interface NotificationModalProps {
  visible: boolean;
  notifications: Notification[];
  onDismiss: (notificationIds: number[]) => void;
}

export default function NotificationModal({
  visible,
  notifications,
  onDismiss,
}: NotificationModalProps) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!notifications || notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[currentIndex];
  const isLastNotification = currentIndex === notifications.length - 1;
  const hasMultiple = notifications.length > 1;

  const handleNext = () => {
    if (!isLastNotification) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDone = () => {
    // Collect all notification IDs and send them to parent
    const notificationIds = notifications.map(n => n.id);
    setCurrentIndex(0); // Reset for next time
    onDismiss(notificationIds);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleDone}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            {/* Progress Indicator */}
            {hasMultiple && (
              <View style={styles.progressContainer}>
                <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                  {currentIndex + 1} of {notifications.length}
                </Text>
              </View>
            )}

            {/* Notification Title */}
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {currentNotification.title}
            </Text>

            {/* Notification Body */}
            <ScrollView 
              style={styles.bodyScrollView}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                {currentNotification.body}
              </Text>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {isLastNotification ? (
                <TouchableOpacity
                  style={[styles.button, styles.doneButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleDone}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Done</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.nextIcon} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tap through indicator */}
            {!isLastNotification && (
              <Text style={[styles.tapHint, { color: theme.colors.textSecondary }]}>
                Tap anywhere to continue
              </Text>
            )}
          </View>
        </SafeAreaView>

        {/* Make the whole overlay tappable to advance */}
        {!isLastNotification && (
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={handleNext}
            activeOpacity={1}
          />
        )}
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  container: {
    width: width * 0.9,
    maxWidth: 500,
    maxHeight: height * 0.9,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 1,
  },
  progressContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  bodyScrollView: {
    width: '100%',
    marginBottom: 24,
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyScrollContent: {
    justifyContent: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    paddingTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  doneButton: {
    // Specific styles for done button if needed
  },
  nextButton: {
    // Specific styles for next button if needed
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  nextIcon: {
    marginLeft: 8,
  },
  tapHint: {
    fontSize: 12,
    marginTop: 12,
    opacity: 0.6,
  },
});

