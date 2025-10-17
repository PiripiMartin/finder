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

interface SavedLocation {
  location: {
    id: number;
    title: string;
    description: string;
    emoji: string;
    latitude: number | null;
    longitude: number | null;
    isValidLocation: number;
    websiteUrl: string | null;
    phoneNumber: string | null;
    address: string | null;
    createdAt: string;
  };
  topPost: {
    id: number;
    url: string;
    postedBy: number;
    mapPointId: number;
    postedAt: string;
  };
}

interface LocationSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onAddLocations: (locationIds: number[]) => void;
  availableLocations: SavedLocation[];
  currentFolderLocationIds: number[];
}

export default function LocationSelectorModal({
  visible,
  onClose,
  onAddLocations,
  availableLocations,
  currentFolderLocationIds,
}: LocationSelectorModalProps) {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter available locations (exclude those already in folder)
  const unfiledLocations = availableLocations.filter(
    loc => !currentFolderLocationIds.includes(loc.location.id)
  );

  // Apply search filter
  const filteredLocations = unfiledLocations.filter(loc => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      loc.location.title.toLowerCase().includes(query) ||
      loc.location.description.toLowerCase().includes(query) ||
      loc.location.address?.toLowerCase().includes(query)
    );
  });

  const handleToggleLocation = (locationId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(locationId)) {
      newSelected.delete(locationId);
    } else {
      newSelected.add(locationId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLocations.map(loc => loc.location.id)));
    }
  };

  const handleConfirm = () => {
    onAddLocations(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  const handleCancel = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Add Locations
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search locations..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Select All Button */}
            {filteredLocations.length > 0 && (
              <TouchableOpacity
                style={[styles.selectAllButton, { borderColor: theme.colors.primary }]}
                onPress={handleSelectAll}
              >
                <Text style={[styles.selectAllText, { color: theme.colors.primary }]}>
                  {selectedIds.size === filteredLocations.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Location List */}
          <ScrollView style={styles.locationList} showsVerticalScrollIndicator={false}>
            {filteredLocations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {searchQuery ? 'No locations found' : 'There are no locations to add to this folder'}
                </Text>
              </View>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedIds.has(loc.location.id);
                return (
                  <TouchableOpacity
                    key={loc.location.id}
                    style={[
                      styles.locationItem,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }
                    ]}
                    onPress={() => handleToggleLocation(loc.location.id)}
                  >
                    <View style={styles.locationItemContent}>
                      <Text style={styles.locationEmoji}>{loc.location.emoji}</Text>
                      <View style={styles.locationItemText}>
                        <Text style={[styles.locationItemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {loc.location.title}
                        </Text>
                        {loc.location.description && (
                          <Text style={[styles.locationItemDescription, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            {loc.location.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.checkbox,
                      { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                      isSelected && { backgroundColor: theme.colors.primary }
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.selectedCount, { color: theme.colors.textSecondary }]}>
              {selectedIds.size} selected
            </Text>
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
                  styles.addButton,
                  { backgroundColor: theme.colors.primary },
                  selectedIds.size === 0 && styles.buttonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={selectedIds.size === 0}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Add ({selectedIds.size})
                </Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  selectAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  locationItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  locationEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  locationItemText: {
    flex: 1,
  },
  locationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationItemDescription: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedCount: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  addButton: {
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

