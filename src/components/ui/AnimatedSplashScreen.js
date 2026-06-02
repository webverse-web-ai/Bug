import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSpring,
  Easing
} from 'react-native-reanimated';
import { COLORS } from '@/constants';

const NUM_DOTS = 12;
const RADIUS = 70; // Distance of dots from center
const DOT_SIZE = 8;
const ANIMATION_DURATION = 2500; // Total duration before moving to app

const Dot = ({ index }) => {
  const angle = (index / NUM_DOTS) * 2 * Math.PI;
  const x = Math.cos(angle) * RADIUS;
  const y = Math.sin(angle) * RADIUS;

  return (
    <View
      style={[
        styles.dot,
        { transform: [{ translateX: x }, { translateY: y }] }
      ]}
    />
  );
};

export default function AnimatedSplashScreen({ onFinish }) {
  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  const [typedText, setTypedText] = useState("");
  const targetText = "Hey Buddy \n( I AM BUG )";

  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    // 0. Typing animation effect
    let charIndex = 0;
    const typingInterval = setInterval(() => {
      if (charIndex <= targetText.length) {
        setTypedText(targetText.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    // 1. Logo entry animation (scale up & fade in)
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    logoOpacity.value = withTiming(1, { duration: 600 });

    // 2. Slow rotation of the dots ring (no pulsing, just spinning)
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1, false
    );

    // 3. Fade out everything after a set duration
    const timeout = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 800 }, () => { });
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 800);
    }, ANIMATION_DURATION);

    return () => {
      clearTimeout(timeout);
      clearInterval(typingInterval);
    };
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.container, { width, height }, animatedContainerStyle]}>

      {/* Wrapper to center logo and dots together */}
      <View style={styles.loaderWrapper}>
        {/* Center Logo */}
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <Image
            source={require('../../../assets/logo/logo_nobg.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Orbiting Dots (No Pulse) */}
        <Animated.View style={[styles.dotsRing, animatedRingStyle]}>
          {Array.from({ length: NUM_DOTS }).map((_, index) => (
            <Dot key={index} index={index} />
          ))}
        </Animated.View>
      </View>

      {/* Typing Text underneath */}
      <Text style={styles.typingText}>
        {typedText}
        <Text style={styles.cursor}>_</Text>
      </Text>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.background, // Deep charcoal background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: RADIUS * 2,
    height: RADIUS * 2,
    marginBottom: 40, // Space between loader and text
  },
  logoContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  dotsRing: {
    position: 'absolute',
    width: RADIUS * 2,
    height: RADIUS * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.primary,
  },
  typingText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 16,
    color: COLORS.primary,
    letterSpacing: 2,
    height: 24, // Fix height so the layout doesn't jump
  },
  cursor: {
    color: COLORS.primary,
    opacity: 0.8,
  }
});
