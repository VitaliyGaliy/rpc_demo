import React, {useEffect, useState} from 'react';
import {View, Text, Button, StyleSheet} from 'react-native';
import {
  registerGlobals,
  RTCView,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import {ConferenceApi} from '../../conference-api';

const PublisherScreen = () => {
  const [stream, setStream] = useState(null);
  useEffect(() => {
    registerGlobals();
    // return () => {
    //   cleanup
    // };
  }, []);

  const onPublish = async () => {
    let capture;
    // const br = $(`#playback-video-bit-rate`);
    // const bitrate = parseInt($('#bitrateInput').value);
    const bitrate = 0;
    const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
    const pc = new RTCPeerConnection(configuration);

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
          console.log('stream', stream);
          try {
            capture = new ConferenceApi({
              maxIncomingBitrate: bitrate || 0,
              simulcast: false,
              stream: 'stream1',
              url: 'https://rpc.codeda.com/0',
              token:
                'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NTg0MDk4MiwiaWF0IjoxNTg0ODA0MTgyfQ.GApJ3KjICTCc0KqE_vXAfc1tfV9cR4VQY1t9cjlozyRjpZC5yNWQ180XgFV-1dwwS9CI1wWzVZ-hBDgOMYj5Qw',
            })
              .on('bitRate', ({bitRate, kind}) => {
                console.log('bitRate', bitRate);

                // if (kind === 'video') {
                //   br.innerText = Math.round(bitRate).toString();
                //   if (bitRate > 0) {
                //     br.classList.add('connected');
                //   } else {
                //     br.classList.remove('connected');
                //   }
                // }
              })
              .on('connectionstatechange', ({state}) => {
                console.log('connectionstatechange', state);
                // if (state === 'connected') {
                //   connectionBox.classList.add('connected');
                // } else {
                //   connectionBox.classList.remove('connected');
                // }
              })
              .on('newProducerId', ({id, kind}) => {
                // conferenceIds[kind] = id;
                console.log('newProducerId', id, kind);
              });

            return capture.publish(stream);
            // return stream;
            // const v = $('#capture-video');
            // v.srcObject = await capture.publish(stream);
            // let playPromise = v.play();
            // if (playPromise !== undefined) {
            //   playPromise
            //     .then(_ => {})
            //     .catch(error => {
            //       v.muted = true;
            //       v.play().then(
            //         () => {
            //           console.log('errorAutoPlayCallback OK');
            //         },
            //         error => {
            //           console.log('errorAutoPlayCallback error again');
            //         },
            //       );
            //     });
            // }

            // $('#stop-publish').disabled = false;
            // $('#get-stats').disabled = false;

            // await capture.api.startRestreaming({stream:"stream1",targetUrl:'https://lh2.codeda.com'});
            //await capture.startRecording();
          } catch (e) {
            if (e.response && e.response.status && ERROR[e.response.status]) {
              console.log('ERROR', ERROR[e.response.status]);
              alert(ERROR[e.response.status]);
            }
            console.log(e);
            if (capture) {
              // await capture.close();
            }
          }
          // Got stream!
        })
        .then(video => setStream(video))
        .catch(error => {
          // Log error
        });
    });

    pc.createOffer().then(desc => {
      pc.setLocalDescription(desc).then(() => {
        // Send pc.localDescription to peer
      });
    });

    pc.onicecandidate = function(event) {
      // send event.candidate to peer
    };
  };
  console.log('stream.toURL() ', stream && stream.toURL());
  return (
    <View style={styles.container}>
      <Button title="Publish" onPress={onPublish} />
      {stream && <RTCView streamURL={stream.toURL()} style={styles.video1} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video1: {
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
});

export default PublisherScreen;
