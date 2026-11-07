import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'Home' | 'Focus' | 'Train' | 'Insights' | 'Profile';

/** Simple 24px line icons, drawn here so no icon font is needed. */
export function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName;
  color: string;
  size?: number;
}) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'Home' && (
        <Path
          {...common}
          d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
        />
      )}
      {name === 'Focus' && (
        <>
          <Circle {...common} cx="12" cy="13" r="8" />
          <Path {...common} d="M12 9v4l2.5 2M9.5 2.5h5" />
        </>
      )}
      {name === 'Train' && (
        <>
          <Path
            {...common}
            d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"
          />
          <Path {...common} d="M19 16v4M17 18h4" />
        </>
      )}
      {name === 'Insights' && (
        <Path {...common} d="M5 20v-8M12 20V4M19 20v-5" />
      )}
      {name === 'Profile' && (
        <>
          <Circle {...common} cx="12" cy="8" r="4" />
          <Path {...common} d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </>
      )}
    </Svg>
  );
}
