import React from 'react';
import 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';

import PublisherScreen from '../screens/PublisherScreen';
import SubscriberScreen from '../screens/SubscriberScreen';
import ShareScreen from '../screens/ShareScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const Tabbar = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="ShareScreen" component={ShareScreen} />
      </Stack.Navigator>
      {/* <Tab.Navigator>
        <Tab.Screen name="Publisher" component={PublisherScreen} />
        <Tab.Screen name="Subscriber" component={SubscriberScreen} />
      </Tab.Navigator> */}
    </NavigationContainer>
  );
};

export default Tabbar;
