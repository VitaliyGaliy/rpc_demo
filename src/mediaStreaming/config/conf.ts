import {MediaSoupSettings} from '../ms/interfaces';
import {MediaKind, RtpCodecParameters} from 'mediasoup/lib/RtpParameters';
const codecParameters: {[x in MediaKind]: RtpCodecParameters} = {
  audio: {
    mimeType: 'audio/OPUS',
    clockRate: 48000,
    channels: 2,
    payloadType: 101,
    rtcpFeedback: [],
    parameters: {'sprop-stereo': 1},
  },
  video: {
    mimeType: 'video/VP8',
    clockRate: 90000,
    payloadType: 102,
    rtcpFeedback: [],
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
};
const mediasoup: MediaSoupSettings = {
  // Worker settings
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 12047,
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp' /*,
                'rtx',
                'bwe',
                'score',
                'simulcast',
                'svc'*/,
    ],
  },
  // Router settings
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: codecParameters.audio.mimeType,
        clockRate: codecParameters.audio.clockRate,
        channels: codecParameters.audio.channels,
        preferredPayloadType: codecParameters.audio.payloadType,
      },
      {
        kind: 'video',
        mimeType: codecParameters.video.mimeType,
        clockRate: codecParameters.video.clockRate,
        preferredPayloadType: codecParameters.video.payloadType,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  // WebRtcTransport settings
  webRtcTransport: {
    listenIp: '62.210.189.244',
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
  codecParameters,
  recording: {
    path: 'recordings',
    extension: 'webm',
  },
  sdp: {
    minPort: 12048,
    header: `v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
c=IN IP4 127.0.0.1
t=0 0`,
    audio: `
m=audio __PORT__ RTP/AVP ${codecParameters.audio.payloadType}
a=rtcp-mux
a=rtpmap:${codecParameters.audio.payloadType} ${
      codecParameters.audio.mimeType.split('/')[1]
    }/${codecParameters.audio.clockRate}/${codecParameters.audio.channels}
a=fmtp:${codecParameters.audio.payloadType} minptime=10`,
    video: `
m=video __PORT__ RTP/AVP ${codecParameters.video.payloadType}
a=rtcp-mux
a=rtpmap:${codecParameters.video.payloadType} ${
      codecParameters.video.mimeType.split('/')[1]
    }/${codecParameters.video.clockRate}`,
  },
  ffmpeg: {
    path: 'ffmpeg',
    encoding: {
      audio: [
        '-map',
        '0:a:0',
        '-c:a',
        'libopus',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-ar',
        '48000',
      ],
      video: [
        '-map',
        '0:v:0',
        '-c:v',
        'libvpx',
        '-b:v',
        '1000k',
        '-deadline',
        'realtime',
        '-cpu-used',
        '4',
      ],
    },
  },
  timeout: {
    stats: 2000,
    stream: 30000,
  } /*,
    "iceServers": [
        {
            "urls": ["turn:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        },
        {
            "urls": ["stun:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        }
    ]*/,
  simulcast: {
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
    encodings: [
      {maxBitrate: 500000},
      {maxBitrate: 2000000},
      {maxBitrate: 10000000},
    ],
  },
};
export const conf = {
  port: 7776,
  auth: {
    secret: 'LH_Secret1_',
    algorithm: 'HS512',
  },
  recording: {
    path: 'recordings',
    timestamp: 'YYYY-MM-DDTHH:mm:ss.SSS[Z]',
  },
  mediasoup,
};
