import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface TutorialProps {
  onComplete: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps = [
    {
      title: "How to Share from TikTok",
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.stepDescription}>
            Follow these steps to share TikTok videos to lai:
          </Text>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              Press <Text style={styles.boldText}>Share</Text> on any TikTok video
            </Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              Tap the <Text style={styles.boldText}>...</Text> button in the share menu
            </Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              Tap <Text style={styles.boldText}>lai</Text> to save the video
            </Text>
          </View>
          
          <View style={styles.illustrationContainer}>
            <Ionicons name="share-outline" size={60} color="#4E8886" />
            <Text style={styles.illustrationText}>Share from any TikTok video!</Text>
          </View>
        </View>
      ),
    },
    {
      title: "Add lai to Your Share Menu",
      content: (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepDescription}>
            Don't see lai in your share menu? Add it with these steps:
          </Text>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              Press <Text style={styles.boldText}>Share</Text> in TikTok
            </Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              Swipe to the right and press <Text style={styles.boldText}>More</Text>
            </Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              Press <Text style={styles.boldText}>Edit</Text> and find lai
            </Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.instructionText}>
              Press <Text style={styles.boldText}>+</Text> <Text style={styles.boldText}>icon</Text> and reorder if necessary
            </Text>
          </View>
          
          <View style={styles.illustrationContainer}>
            <View style={styles.iconRow}>
              <Ionicons name="share-outline" size={40} color="#4E8886" />
              <Ionicons name="chevron-forward" size={30} color="#999" />
              <Ionicons name="ellipsis-horizontal" size={40} color="#4E8886" />
              <Ionicons name="chevron-forward" size={30} color="#999" />
              <Ionicons name="create-outline" size={40} color="#4E8886" />
              <Ionicons name="chevron-forward" size={30} color="#999" />
              <Ionicons name="add-circle-outline" size={40} color="#4E8886" />
            </View>
            <Text style={styles.illustrationText}>
              Share → More → Edit → Add lai
            </Text>
          </View>
        </ScrollView>
      ),
    },
    {
      title: "We'll Save Everything for You!",
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.stepDescription}>
            Once you share a TikTok video, here's what we do automatically:
          </Text>
          
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name="bookmark" size={32} color="#4E8886" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Save to Your Collection</Text>
              <Text style={styles.featureDescription}>
                Every location gets saved to your <Text style={styles.boldText}>Saved tab</Text> so you can find it later
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name="location" size={32} color="#4E8886" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Pin on the Map</Text>
              <Text style={styles.featureDescription}>
                We'll automatically <Text style={styles.boldText}>pin the location</Text> on your map for easy discovery
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name="star" size={32} color="#4E8886" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Smart Organization</Text>
              <Text style={styles.featureDescription}>
                All your favorite spots organized and ready to explore anytime
              </Text>
            </View>
          </View>
          
          <View style={styles.finalIllustrationContainer}>
            <View style={styles.finalIllustration}>
            </View>
          </View>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          {tutorialSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep ? styles.progressDotActive : styles.progressDotInactive,
              ]}
            />
          ))}
        </View>
        
        <View style={styles.skipButton} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{tutorialSteps[currentStep].title}</Text>
        {tutorialSteps[currentStep].content}
      </View>

      <View style={styles.footer}>
        {currentStep < tutorialSteps.length - 1 && (
          <Text style={styles.contactText}>
            Email us @ lai.contact.help@gmail.com with any questions
          </Text>
        )}
        <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>
            {currentStep < tutorialSteps.length - 1 ? 'Next' : 'Get Started'}
          </Text>
          <Ionicons 
            name={currentStep < tutorialSteps.length - 1 ? "chevron-forward" : "checkmark"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  skipButton: {
    width: 60,
  },
  skipText: {
    color: '#4E8886',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    backgroundColor: '#4E8886',
  },
  progressDotInactive: {
    backgroundColor: '#E0E0E0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  stepContent: {
    flex: 1,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4E8886',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#4E8886',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingVertical: 20,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  illustrationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  finalIllustrationContainer: {
    alignItems: 'center',
    marginTop: 20, // Move the heart up
  },
  finalIllustration: {
    alignItems: 'center',
    paddingVertical: 15, // Reduced padding
  },
  finalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4E8886',
    marginTop: 10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 16,
  },
  nextButton: {
    backgroundColor: '#4E8886',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default Tutorial;
