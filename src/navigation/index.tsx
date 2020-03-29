import React from 'react';
import 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import PublisherScreen from '../screens/PublisherScreen';
import SubscriberScreen from '../screens/SubscriberScreen';

const Tab = createBottomTabNavigator();

const Tabbar = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Publisher" component={PublisherScreen} />
        <Tab.Screen name="Subscriber" component={SubscriberScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default Tabbar;
