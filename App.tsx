import React, {useEffect} from 'react';
import * as debug from 'debug';

(window as any).debug = debug;

import AsyncStorage from '@react-native-community/async-storage';

console.disableYellowBox = true;
console.log('Reactotron Configured');
if (__DEV__) {
  import('./src/debugger/ReactotronConfig').then(() =>
    console.log('Reactotron Configured'),
  );
}
// if (__DEV__) {
//   console = reactotron;
// }
import Navigation from './src/navigation';

export default () => {
  useEffect(() => {
    const storeValue = async () => {
      try {
        await AsyncStorage.setItem(
          'debug',
          'mediasoup-client:WARN* mediasoup-client:ERROR*',
        );
      } catch (e) {
        // saving error
      }
    };
    storeValue();
    // return () => {
    //   cleanup
    // };
  }, []);
  return <Navigation />;
};
