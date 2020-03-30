import React from 'react';
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

export default () => <Navigation />;
