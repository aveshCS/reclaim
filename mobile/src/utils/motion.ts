import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Tests switch ambient (looping) animation off so they finish cleanly. */
export const motionConfig = { ambient: true };

/** True when the user asked Android to remove animations, or ambient motion is disabled. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(v => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced || !motionConfig.ambient;
}
