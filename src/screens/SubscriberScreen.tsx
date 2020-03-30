import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Button, ActivityIndicator} from 'react-native';
import {
  registerGlobals,
  RTCView,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import {activateKeepAwake, deactivateKeepAwake} from 'expo-keep-awake';

import {ConferenceApi} from '../mediaStreaming/conference-api';
import {useFocusEffect} from '@react-navigation/native';

// const api = null;
// const device = null;
// const iceServers = null;
// const simulcast = null;
// const player = null;
// const transportTimeout: any;
// const transport: any;
// const operation: API_OPERATION = API_OPERATION.SUBSCRIBE;
// const configs = {
//   maxIncomingBitrate: 0,
//   timeout: {
//     stats: 1000,
//     stream: 30000,
//   },
// };

const SubscriberScreen = () => {
  const [stream, setStream] = useState(null);
  const [connection, setConnection] = useState<Boolean | string>(false);
  let playback = useRef<ConferenceApi>();

  useEffect(() => {
    registerGlobals();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          if (playback.current) {
            playback.current.close().then(() => {
              setStream(null);
              setConnection(false);
              deactivateKeepAwake();
            });
          }
        } catch (error) {}
      };
    }, []),
  );

  const onConsume = async ev => {
    ev && ev.preventDefault && ev.preventDefault();
    setConnection('pending');
    try {
      await subscribe();
    } catch (error) {
      console.log('Error on subscribe: ', error);
    }
  };

  const subscribe = async () => {
    const url = 'https://rpc.codeda.com/0';
    const token =
      'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NTg0MDk4MiwiaWF0IjoxNTg0ODA0MTgyfQ.GApJ3KjICTCc0KqE_vXAfc1tfV9cR4VQY1t9cjlozyRjpZC5yNWQ180XgFV-1dwwS9CI1wWzVZ-hBDgOMYj5Qw';

    console.log('HERE');

    playback.current = new ConferenceApi({
      kinds: ['audio', 'video'],
      stream: 'stream1',
      url,
      token,
    }).on('connectionstatechange', ({state}) => {
      console.log('connectionstatechange', state);
      if (state === 'connected') {
        setConnection(true);
        activateKeepAwake();
      } else {
      }
    });

    const onAddTrack = track => {
      console.log('onAddTrack', track);
      console.log('mediaStream 1.0 ', mediaStream._reactTag);
      mediaStream.addTrack(track.track);

      const tracks = mediaStream.getTracks();

      console.log('[onAddTrack] mediaStream tracks: ', tracks);

      if (tracks.length == 2) {
        setStream(new MediaStream(tracks));
      }
    };

    const onRemoveTrack = track => {
      console.log('onRemoveTrack', track);
      console.log('mediaStream 2.0 ', mediaStream._reactTag);
      mediaStream.removeTrack(track.track);

      const tracks = mediaStream.getTracks();

      console.log('[onRemoveTrack] mediaStream tracks: ', tracks);
    };

    playback.current
      .on('addtrack', onAddTrack)
      .on('removetrack', onRemoveTrack);

    const mediaStream = await playback.current.subscribe();

    console.log('mediaStream 1.0: ', mediaStream);
  };

  const stopPlaying = async () => {
    await playback.current.close();
    setConnection(false);
    setStream(null);
    deactivateKeepAwake();
  };

  const renderSwitch = connection => {
    if (connection === false) {
      return <Button title="Consume" onPress={onConsume} />;
    } else if (connection === true && stream) {
      return <Button title="Stop Playing" onPress={stopPlaying} />;
    } else {
      return <ActivityIndicator size="small" color="#00ff00" />;
    }
  };

  return (
    <View style={styles.container}>
      {stream && <RTCView streamURL={stream.toURL()} style={styles.video1} />}
      {renderSwitch(connection)}
    </View>
  );
};

export default SubscriberScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video1: {
    flex: 1,
    width: '100%',
    height: 300,
    // ...StyleSheet.absoluteFillObject,
  },
});
