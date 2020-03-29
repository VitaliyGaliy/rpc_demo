import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Button} from 'react-native';
import {
  registerGlobals,
  RTCView,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import {API_OPERATION} from '../../mediasoup/config/constants';
import {ConferenceApi} from '../../conference-api';

const api = null;
const device = null;
const iceServers = null;
const simulcast = null;
const player = null;
const transportTimeout: any;
const transport: any;
const operation: API_OPERATION = API_OPERATION.SUBSCRIBE;
const configs = {
  maxIncomingBitrate: 0,
  timeout: {
    stats: 1000,
    stream: 30000,
  },
};

const SubscriberScreen = () => {
  const [stream, setStream] = useState(null);

  useEffect(() => {
    registerGlobals();
    // return () => {
    //   cleanup
    // };
  }, []);

  const onConsume = async ev => {
    ev && ev.preventDefault && ev.preventDefault();

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

    const playback = new ConferenceApi({
      kinds: ['audio', 'video'],
      stream: 'stream1',
      url,
      token,
    })
      .on('bitRate', ({bitRate, kind}) => {
        console.log('bitrate: ', bitRate);
        // if(kind==='video'){
        //     br.innerText=Math.round(bitRate).toString();
        //     if(bitRate>0){
        //         br.classList.add('connected');
        //     }
        //     else {
        //         br.classList.remove('connected');
        //     }
        // }
      })
      .on('connectionstatechange', ({state}) => {
        console.log('connectionstatechange 2.0', state);
        // console.log('connectionstatechange',state);
        // if(state==='connected'){
        //     connectionBox.classList.add('connected');
        // }
        // else {
        //     connectionBox.classList.remove('connected');
        // }
      })
      .on('newConsumerId', ({id, kind}) => {
        // conferenceIds[kind]=id;
        console.log('newConsumerId', id, kind);
      });

    const streams = [];

    const onStreamChange = () => {
      console.log('onStreamChange 1.0', mediaStream.getTracks());

      const tracks = mediaStream.getTracks();

      // tracks.forEach(track => {
      //   if (track.kind === 'audio') {
      //     streams.push(track);
      //   } else if (track.kind === 'video') {
      //     streams.push(track);
      //   }
      // });

      // console.log('streams: ', tracks);

      // if (tracks.length != 2) {
      //   return;
      // }

      // console.log('onStreamChange 1.2.0', tracks);

      // const mediaStream2 = new MediaStream(tracks);

      // console.log('mediaStream._reactTag: ', mediaStream2._reactTag);

      // this.setState({ stream: mediaStream2 });

      // console.log('onStreamChange 1.2.1');
    };

    // playback.on('addtrack', async () => {
    //   console.log('addtrack 1.0.0');

    //   const mediaStream = await playback.subscribe();

    //   console.log('mediaStream 2.0: ', mediaStream);
    //   console.log('url 2.0: ', mediaStream.getTracks());

    //   this.setState({ stream: new MediaStream(mediaStream.getTracks()) });

    //   console.log('addtrack 1.1.0');
    // });

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

    const onRemoteTrack = track => {
      console.log('onRemoteTrack', track);
      console.log('mediaStream 2.0 ', mediaStream._reactTag);
      mediaStream.removeTrack(track.track);

      const tracks = mediaStream.getTracks();

      console.log('[onRemoteTrack] mediaStream tracks: ', tracks);
    };

    playback.on('addtrack', onAddTrack).on('removetrack', onRemoteTrack);

    const mediaStream = await playback.subscribe();

    console.log('mediaStream 1.0: ', mediaStream);
    // console.log('url 1.0: ', mediaStream.toURL());

    // this.setState({ stream: mediaStream });

    // console.log('player: ', this.player);
    // this.player.srcObject=mediaStream;
    // this.player.play();

    // this.api = new MediasoupRestApi(url, token);
    // this.device = new Device({ handlerName: 'ReactNative' });

    // const { routerRtpCapabilities, iceServers, simulcast } = await this.api.getServerConfigs();

    // if (routerRtpCapabilities.headerExtensions) {
    //   routerRtpCapabilities.headerExtensions = routerRtpCapabilities.headerExtensions.
    //     filter((ext) => ext.uri !== 'urn:3gpp:video-orientation');
    // }

    // await this.device.load({ routerRtpCapabilities });

    // this.iceServers = iceServers;
    // this.simulcast = simulcast;

    // await this.getTransport();

    // console.log('transport: ', this.transport);
  };
  console.log('stream', stream);

  return (
    <View style={styles.container}>
      <Button title="Consume" onPress={onConsume} />
      {stream && <RTCView streamURL={stream.toURL()} style={styles.video1} />}
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
    ...StyleSheet.absoluteFillObject,
  },
});
