import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface CreateFolderModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateFolder: (title: string, color: string) => void;
  initialTitle?: string;
  initialColor?: string;
  mode?: 'create' | 'edit';
}

const FOLDER_COLORS = [
  { name: 'Red', hex: '#FF6B6B' },
  { name: 'Blue', hex: '#4ECDC4' },
  { name: 'Green', hex: '#95E1D3' },
  { name: 'Yellow', hex: '#FFD93D' },
  { name: 'Purple', hex: '#A29BFE' },
  { name: 'Orange', hex: '#FD79A8' },
  { name: 'Pink', hex: '#FDCB6E' },
  { name: 'Teal', hex: '#6C5CE7' },
];

export default function CreateFolderModal({
  visible,
  onClose,
  onCreateFolder,
  initialTitle = '',
  initialColor = FOLDER_COLORS[0].hex,
  mode = 'create',
}: CreateFolderModalProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(initialTitle);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  const handleCreate = () => {
    if (title.trim()) {
      onCreateFolder(title.trim(), selectedColor);
      setTitle('');
      setSelectedColor(FOLDER_COLORS[0].hex);
      onClose();
    }
  };

  const handleCancel = () => {
    setTitle(initialTitle);
    setSelectedColor(initialColor);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {mode === 'create' ? 'Create Folder' : 'Edit Folder'}
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Folder Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Enter folder name..."
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={30}
              autoFocus
            />
            <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
              {title.length}/30
            </Text>
          </View>

          {/* Color Picker */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Color</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorScrollContent}
            >
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.hex}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color.hex },
                    selectedColor === color.hex && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color.hex)}
                >
                  {selectedColor === color.hex && (
                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                { backgroundColor: theme.colors.primary },
                !title.trim() && styles.buttonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!title.trim()}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {mode === 'create' ? 'Create' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  colorScrollContent: {
    paddingVertical: 8,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginRight: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  createButton: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});


