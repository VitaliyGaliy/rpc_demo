import React from 'react';
import {StyleSheet, Text, View, Button} from 'react-native';
import {registerGlobals, RTCView} from 'react-native-webrtc';
// import Video from 'react-native-video';

// import {Device} from 'mediasoup-client';
// import {MediasoupRestApi} from './mediasoup-rest-api';

import {API_OPERATION, ERROR} from './mediasoup/config/constants';
import {ConferenceApi} from './conference-api';

export default class App extends React.Component {
  api = null;
  device = null;
  iceServers = null;
  simulcast = null;
  player = null;
  transportTimeout: any;
  transport: any;
  private operation: API_OPERATION = API_OPERATION.SUBSCRIBE;
  private configs = {
    maxIncomingBitrate: 0,
    timeout: {
      stats: 1000,
      stream: 30000,
    },
  };

  state = {
    stream: null,
  };

  componentDidMount() {
    registerGlobals();
  }

  onConsume = async ev => {
    ev && ev.preventDefault && ev.preventDefault();

    try {
      await this.subscribe();
    } catch (error) {
      console.log('Error on subscribe: ', error);
    }
  };

  async subscribe() {
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
        this.setState({stream: new MediaStream(tracks)});
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
  }

  async getTransport(): Promise<Transport> {
    if (!this.transport) {
      const api: any = this;
      const data: any = await this.api.createTransport();
      if (this.iceServers) {
        data.iceServers = this.iceServers;
      }
      if (this.operation === API_OPERATION.SUBSCRIBE) {
        this.transport = this.device.createRecvTransport(data);
      } else if (this.operation === API_OPERATION.PUBLISH) {
        this.transport = this.device.createSendTransport(data);
      }
      // this.emit('newTransportId', { id: this.transport.id });
      if (this.configs.maxIncomingBitrate) {
        await this.api.setMaxIncomingBitrate({
          transportId: this.transport.id,
          bitrate: this.configs.maxIncomingBitrate,
        });
      }
      this.transport.on('connect', ({dtlsParameters}, callback, errback) => {
        api.api
          .connectTransport({
            transportId: this.transport.id,
            dtlsParameters,
          })
          .then(callback)
          .catch(errback);
      });
      if (this.operation === API_OPERATION.PUBLISH) {
        this.transport.on(
          'produce',
          async ({kind, rtpParameters}, callback, errback) => {
            try {
              const data = await api.api.produce({
                transportId: this.transport.id,
                stream: api.configs.stream,
                kind,
                rtpParameters,
              });
              callback(data);
            } catch (err) {
              errback(err);
            }
          },
        );
      }
      this.transport.on('connectionstatechange', async state => {
        // this.emit('connectionstatechange', { state });
        switch (state) {
          case 'connected':
            if (this.transportTimeout) {
              clearTimeout(this.transportTimeout);
            }
            break;
          case 'failed':
          case 'disconnected':
            if (this.transportTimeout) {
              clearTimeout(this.transportTimeout);
            }
            this.transportTimeout = setTimeout(async () => {
              // await this.restartAll();
            }, this.configs.timeout.stream);
            break;
        }
      });
    }
    return this.transport;
  }

  render() {
    return (
      <View style={styles.container}>
        <Text>Open up App.tsx to start working on your app!</Text>
        <Button title="consume" onPress={this.onConsume} />
        {this.state.stream && (
          <RTCView
            streamURL={this.state.stream.toURL()}
            style={styles.video1}
          />
        )}
        {/* <Video
          style={{
            aspectRatio: 1,
            width: "100%"
          }}
          ref={(ref) => {
            this.player = ref
          }}
          repeat={true}
          resizeMode="center"
          // paused={false}
          // source={{ uri: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }}
        /> */}
      </View>
    );
  }
}

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

// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: '#313131',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     height: '100%',
//   },
//   text: {
//     fontSize: 30,
//   },
//   rtcview: {
//     justifyContent: 'center',
//     alignItems: 'center',
//     height: '40%',
//     width: '80%',
//     backgroundColor: 'black',
//   },
//   rtc: {
//     width: '80%',
//     height: '100%',
//   },
//   toggleButtons: {
//     width: '100%',
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//   },
// });
