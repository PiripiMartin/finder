import { useRouter } from "expo-router";
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from './context/ThemeContext';

const { width } = Dimensions.get('window');
const videoWidth = (width - 30) / 2; // 2 columns with padding

// Mock TikTok videos data
const mockVideos = [
  {
    id: '1',
    title: 'Amazing Coffee Art ☕',
    thumbnail: 'https://picsum.photos/200/300?random=1',
    duration: '0:15',
    likes: '2.1K',
  },
  {
    id: '2',
    title: 'Bubble Tea Making 🧋',
    thumbnail: 'https://picsum.photos/200/300?random=2',
    duration: '0:32',
    likes: '5.4K',
  },
  {
    id: '3',
    title: 'Tea Ceremony 🫖',
    thumbnail: 'https://picsum.photos/200/300?random=3',
    duration: '0:28',
    likes: '1.8K',
  },
  {
    id: '4',
    title: 'Coffee Shop Tour ☕',
    thumbnail: 'https://picsum.photos/200/300?random=4',
    duration: '0:45',
    likes: '3.2K',
  },
  {
    id: '5',
    title: 'Bubble Tea Recipe 🧋',
    thumbnail: 'https://picsum.photos/200/300?random=5',
    duration: '0:52',
    likes: '8.7K',
  },
  {
    id: '6',
    title: 'Tea Tasting Guide 🫖',
    thumbnail: 'https://picsum.photos/200/300?random=6',
    duration: '0:38',
    likes: '4.1K',
  },
  {
    id: '7',
    title: 'Coffee Bean Roasting ☕',
    thumbnail: 'https://picsum.photos/200/300?random=7',
    duration: '0:24',
    likes: '6.3K',
  },
  {
    id: '8',
    title: 'Bubble Tea Flavors 🧋',
    thumbnail: 'https://picsum.photos/200/300?random=8',
    duration: '0:41',
    likes: '2.9K',
  },
  {
    id: '9',
    title: 'Tea Garden Visit 🫖',
    thumbnail: 'https://picsum.photos/200/300?random=9',
    duration: '0:35',
    likes: '1.5K',
  },
  {
    id: '10',
    title: 'Coffee Latte Art ☕',
    thumbnail: 'https://picsum.photos/200/300?random=10',
    duration: '0:19',
    likes: '7.2K',
  },
  {
    id: '11',
    title: 'Bubble Tea DIY 🧋',
    thumbnail: 'https://picsum.photos/200/300?random=11',
    duration: '0:47',
    likes: '3.8K',
  },
  {
    id: '12',
    title: 'Tea Meditation 🫖',
    thumbnail: 'https://picsum.photos/200/300?random=12',
    duration: '0:33',
    likes: '2.4K',
  },
];

export default function Saved() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.header, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}>Saved Tiktoks</Text>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.videoGrid}>
          {mockVideos.map((video) => (
            <TouchableOpacity 
              key={video.id} 
              style={[styles.videoCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}
              onPress={() => router.push(`/location?id=${video.id}`)}
            >
              <View style={styles.thumbnailContainer}>
                <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} />
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{video.duration}</Text>
                </View>
              </View>
              <View style={styles.videoInfo}>
                <Text style={[styles.videoTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={[styles.likesText, { color: theme.colors.textSecondary }]}>❤️ {video.likes}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  videoCard: {
    width: videoWidth,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: videoWidth * 1.5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  likesText: {
    fontSize: 12,
    color: '#666',
  },
}); 