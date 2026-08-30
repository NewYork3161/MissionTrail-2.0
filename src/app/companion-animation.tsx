import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

// ======================================
// ANIMATION 1 - EGG
// Plays one time from beginning to end.
// ======================================

const eggFrames: ImageSourcePropType[] = [
  require('../../assets/animations/companion/animation1/egg_01.png'),
  require('../../assets/animations/companion/animation1/egg_02.png'),
  require('../../assets/animations/companion/animation1/egg_03.png'),
  require('../../assets/animations/companion/animation1/egg_4.png'),
  require('../../assets/animations/companion/animation1/egg_5.png'),
  require('../../assets/animations/companion/animation1/egg_06.png'),
  require('../../assets/animations/companion/animation1/egg_7.png'),
];

// ======================================
// ANIMATION 2 - IDLE
// Starts immediately after the egg
// animation and loops continuously.
// ======================================

const idleFrames: ImageSourcePropType[] = [
  require('../../assets/animations/companion/animation2/idle_01.png'),
  require('../../assets/animations/companion/animation2/idle_02.png'),
  require('../../assets/animations/companion/animation2/idle_03.png'),
  require('../../assets/animations/companion/animation2/idle_04.png'),
  require('../../assets/animations/companion/animation2/idle_05.png'),
  require('../../assets/animations/companion/animation2/idle_06.png'),
  require('../../assets/animations/companion/animation2/idle_07.png'),
];

// ======================================
// ANIMATION SPEED
// Lower number = faster animation.
// Higher number = slower animation.
// ======================================

const EGG_FRAME_SPEED = 220;
const IDLE_FRAME_SPEED = 240;

// ======================================
// COMPANION ANIMATION
// ======================================

export default function CompanionAnimation() {
  const [animation, setAnimation] = useState<'egg' | 'idle'>('egg');
  const [frameIndex, setFrameIndex] = useState(0);

  // ======================================
  // ANIMATION 1 - EGG
  // ======================================

  useEffect(() => {
    if (animation !== 'egg') {
      return;
    }

    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => {
        // Last egg frame reached.
        // Immediately start animation 2.
        if (currentFrame >= eggFrames.length - 1) {
          clearInterval(timer);

          setAnimation('idle');

          return 0;
        }

        return currentFrame + 1;
      });
    }, EGG_FRAME_SPEED);

    return () => {
      clearInterval(timer);
    };
  }, [animation]);

  // ======================================
  // ANIMATION 2 - IDLE
  // ======================================

  useEffect(() => {
    if (animation !== 'idle') {
      return;
    }

    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => {
        // Loop back to idle frame 1.
        if (currentFrame >= idleFrames.length - 1) {
          return 0;
        }

        return currentFrame + 1;
      });
    }, IDLE_FRAME_SPEED);

    return () => {
      clearInterval(timer);
    };
  }, [animation]);

  // ======================================
  // SELECT CURRENT FRAME
  // ======================================

  const currentFrame =
    animation === 'egg'
      ? eggFrames[frameIndex]
      : idleFrames[frameIndex];

  // ======================================
  // RENDER
  // ======================================

  return (
    <View style={styles.container}>
      <Image
        source={currentFrame}
        resizeMode="contain"
        style={styles.animationImage}
      />
    </View>
  );
}

// ======================================
// STYLES
// ======================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  animationImage: {
    width: '100%',
    height: '100%',
  },
});