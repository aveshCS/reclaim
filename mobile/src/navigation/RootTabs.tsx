import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabIcon } from '../components';
import { FocusScreen } from '../features/focus/FocusScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { InsightsScreen } from '../features/insights/InsightsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { TrainScreen } from '../features/train/TrainScreen';
import { colors, fonts } from '../theme/tokens';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const renderIcon =
  (name: keyof RootTabParamList) =>
  ({ color }: { color: string }) =>
    <TabIcon name={name} color={color} />;

export function RootTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarButtonTestID: `tab-${route.name}`,
        tabBarAccessibilityLabel: `${route.name} tab`,
        tabBarIcon: renderIcon(route.name),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Focus" component={FocusScreen} />
      <Tab.Screen name="Train" component={TrainScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopColor: colors.line,
    borderTopWidth: 2,
    paddingTop: 6,
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
