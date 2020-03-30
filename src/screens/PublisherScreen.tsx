import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  registerGlobals,
  RTCView,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import {useFocusEffect} from '@react-navigation/native';

import {ConferenceApi} from '../mediaStreaming/conference-api';
import {ERROR} from '../mediaStreaming/config/constants';

const PublisherScreen = () => {
  let capture = useRef<ConferenceApi>();
  const [stream, setStream] = useState(null);
  const [connection, setConnection] = useState<Boolean | string>(false);

  useEffect(() => {
    registerGlobals();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          if (capture.current) {
            capture.current.close().then(() => {
              setConnection(false);
              setStream(null);
            });
          }
        } catch (error) {}
      };
    }, []),
  );

  const onPublish = async () => {
    setConnection('pending');
    const bitrate = 0;
    const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
    // const pc = new RTCPeerConnection(configuration);

    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == 'videoinput' &&
          sourceInfo.facing == (isFront ? 'front' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }
      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500, // Provide your own width, height and frame rate here
              minHeight: 300,
              minFrameRate: 30,
            },
            facingMode: isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
          },
        })
        .then(stream => {
          try {
            capture.current = new ConferenceApi({
              maxIncomingBitrate: bitrate || 0,
              simulcast: false,
              stream: 'stream1',
              url: 'https://rpc.codeda.com/0',
              token:
                'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NTg0MDk4MiwiaWF0IjoxNTg0ODA0MTgyfQ.GApJ3KjICTCc0KqE_vXAfc1tfV9cR4VQY1t9cjlozyRjpZC5yNWQ180XgFV-1dwwS9CI1wWzVZ-hBDgOMYj5Qw',
            }).on('connectionstatechange', ({state}) => {
              console.log('connectionstatechange', state);
              if (state === 'connected') {
                setConnection(true);
              } else {
              }
            });

            return capture.current.publish(stream);
          } catch (e) {
            if (e.response && e.response.status && ERROR[e.response.status]) {
              console.log('ERROR', ERROR[e.response.status]);
              alert(ERROR[e.response.status]);
            }
            console.log(e);
            if (capture.current) {
              capture.current.close();
            }
          }
          // Got stream!
        })
        .then(video => {
          setStream(video);
        })
        .catch(error => {
          // Log error
        });
    });
  };

  const onUnpublish = async () => {
    try {
      if (capture.current) {
        await capture.current.close();
        setConnection(false);
        setStream(null);
      }
    } catch (error) {}
  };

  const renderSwitch = connection => {
    if (connection === false) {
      return <Button title="Publish" onPress={onPublish} />;
    } else if (connection === true && stream) {
      return <Button title="Unpublish" onPress={onUnpublish} />;
    } else {
      return <ActivityIndicator size="small" color="#00ff00" />;
    }
  };

  return (
    // <ScrollView style={{flex: 1, flexDirection: 'column'}}>
    <View style={styles.container}>
      {stream && <RTCView streamURL={stream.toURL()} style={styles.video1} />}
      {renderSwitch(connection)}
    </View>
    // </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
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

export default PublisherScreen;
