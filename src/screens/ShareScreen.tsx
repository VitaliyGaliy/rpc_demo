// import debug from 'debug';

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
  // RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';
import {useFocusEffect} from '@react-navigation/native';
import {activateKeepAwake, deactivateKeepAwake} from 'expo-keep-awake';
import socketIOClient from 'socket.io-client';
// import {v1 as uuidv1} from 'uuid';

import {ConferenceApi} from '../mediaStreaming/conference-api';
import {ERROR} from '../mediaStreaming/config/constants';

// debug.enable('*');

export enum ACTION {
  START = 'start',
  FINISH = 'finish',

  ICE_SERVERS = 'iceServers',
  ROOM_SIZE = 'roomSize',
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  ICE = 'ice',
  SDP = 'sdp',
  STREAM_ENDED = 'streamEnded',
  WB_SYNC = 'wbSync',
  WB_GET_ALL = 'wbGetAll',
}
const uuId = Date.now().toString();

const ShareScreen = () => {
  let capture = useRef<ConferenceApi>();
  let socket = useRef<SocketIOClient.Socket>();
  const [stream, setStream] = useState(null);
  const [connection, setConnection] = useState<Boolean | string>(false);

  useEffect(() => {
    registerGlobals();
    const endpoint = 'https://tabrecorder.codeda.com';
    socket.current = socketIOClient(endpoint);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          if (capture.current) {
            capture.current.close().then(() => {
              setConnection(false);
              setStream(null);
              deactivateKeepAwake();
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
    const pc = new RTCPeerConnection(configuration);

    let isFront = true;
    mediaDevices.enumerateDevices().then((sourceInfos) => {
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
        .getDisplayMedia({
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
        .then((stream) => {
          try {
            // capture.current = new ConferenceApi({
            //   maxIncomingBitrate: bitrate || 0,
            //   simulcast: false,
            //   stream: 'stream1',
            //   url: 'https://rpc.codeda.com/0',
            //   token:
            //     'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NTg0MDk4MiwiaWF0IjoxNTg0ODA0MTgyfQ.GApJ3KjICTCc0KqE_vXAfc1tfV9cR4VQY1t9cjlozyRjpZC5yNWQ180XgFV-1dwwS9CI1wWzVZ-hBDgOMYj5Qw',
            // }).on('connectionstatechange', ({state}) => {
            //   console.log('connectionstatechange', state);
            //   if (state === 'connected') {
            //     setConnection(true);
            //   } else {
            //   }
            // });
            const pcs: Record<string, RTCPeerConnection> = {};
            socket.current.on(ACTION.JOIN_ROOM, ({socketId}: SocketData) => {
              console.log('on(ACTION.JOIN_ROOM,', socketId);
              pcs[socketId] = new RTCPeerConnection({
                iceServers: [
                  {
                    urls: ['turn:18.196.113.204:3478'],
                    username: 'testUser',
                    credential: 'testPassword',
                  },
                  {
                    urls: ['stun:18.196.113.204:3478'],
                    username: 'testUser',
                    credential: 'testPassword',
                  },
                ],
              });
              pcs[socketId].addStream(stream);
              pcs[socketId].onicecandidate = function ({candidate}) {
                if (candidate) {
                  console.log('start emit(ACTION.ICE', candidate);
                  socket.current.emit(
                    ACTION.ICE,
                    {socketId, sdp: {candidate}},
                    (e) => {
                      console.log('ok emit(ACTION.ICE,', e);
                    },
                  );
                }
              };
              console.log('pcs[socketId].createOffer()', socketId);
              pcs[socketId].createOffer().then((desc) => {
                console.log(
                  'pcs[socketId].setLocalDescription()',
                  socketId,
                  desc,
                );
                pcs[socketId].setLocalDescription(desc).then(() => {
                  console.log('start emit(ACTION.SDP', desc);
                  socket.current.emit(
                    ACTION.SDP,
                    {socketId, sdp: desc},
                    (e) => {
                      console.log('ok emit(ACTION.SDP', desc);
                    },
                  );
                });
              });
            });

            socket.current.on(ACTION.SDP, ({socketId, sdp}: SocketData) => {
              console.log('on(ACTION.SDP, ', socketId, sdp);
              pcs[socketId].setRemoteDescription(sdp).then(() => {
                console.log(
                  'ok pcs[socketId].setRemoteDescription',
                  socketId,
                  sdp,
                );
              });
            });
            socket.current.on(ACTION.ICE, ({socketId, sdp}: SocketData) => {
              console.log('on(ACTION.ICE, ', socketId, sdp);
              const candidate = new RTCIceCandidate(sdp);
              pcs[socketId].addIceCandidate(candidate);
            });
            console.log('start emit(ACTION.JOIN_ROOM');
            socket.current.emit(
              ACTION.JOIN_ROOM,
              {roomId: 'wwwwwwwwww', create: true},
              (e) => {
                console.log('ok emit(ACTION.JOIN_ROOM');
              },
            );
            return stream;
            // return capture.current.publish(stream);
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
        .then((video) => {
          setStream(video);
          activateKeepAwake();
        })
        .catch((error) => {
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
        deactivateKeepAwake();
      }
    } catch (error) {}
  };

  const renderSwitch = (connection) => {
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
      {/* {stream && <RTCView streamURL={stream.toURL()} style={styles.video1} />} */}
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

export default ShareScreen;
