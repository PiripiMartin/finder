import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ShareFolderModalProps {
  visible: boolean;
  onClose: () => void;
  folderName: string;
  folderId: number;
}

export default function ShareFolderModal({
  visible,
  onClose,
  folderName,
  folderId,
}: ShareFolderModalProps) {
  const { theme } = useTheme();

  const handleShareWithFollowers = async () => {
    try {
      const shareUrl = `lai://folder/${folderId}`;
      const message = `Check out my folder "${folderName}" on Lai!`;
      
      await Share.share({
        message: `${message}\n${shareUrl}`,
        url: shareUrl,
        title: folderName,
      });
      onClose();
    } catch (error) {
      console.error('Error sharing folder with followers:', error);
    }
  };

  const handleShareAsCollaborative = async () => {
    try {
      const shareUrl = `lai://folder/${folderId}/join-owner`;
      const message = `Join my collaborative folder "${folderName}" on Lai!`;
      
      await Share.share({
        message: `${message}\n${shareUrl}`,
        url: shareUrl,
        title: folderName,
      });
      onClose();
    } catch (error) {
      console.error('Error sharing collaborative folder:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Share Folder
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Folder Name */}
          <View style={styles.folderNameContainer}>
            <Text style={[styles.folderName, { color: theme.colors.text }]} numberOfLines={1}>
              {folderName}
            </Text>
          </View>

          {/* Share Options */}
          <View style={styles.optionsContainer}>
            {/* Share with Followers */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={handleShareWithFollowers}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="people-outline" size={32} color={theme.colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Share with Followers
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  Others can follow this folder to see its locations. They won't be able to add or edit locations.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Share as Collaborative Folder */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={handleShareAsCollaborative}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="people" size={32} color={theme.colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Share as Collaborative Folder
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  Others can join as co-owners and add, edit, or remove locations in this folder.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  folderNameContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});


