import {API_OPERATION, ERROR} from '../../config/constants';
import {EventEmitter} from 'events';
import {MediasoupRestApi} from './mediasoup-rest-api';
import {MediaKind, RtpCapabilities} from 'mediasoup-client/lib/RtpParameters';
import {Device} from 'mediasoup-client';
import {Transport, TransportOptions} from 'mediasoup-client/lib/Transport';
import {Producer, ProducerOptions} from 'mediasoup-client/lib/Producer';
import {Consumer} from 'mediasoup-client/lib/Consumer';
import {
  ConferenceConfig,
  ConferenceInput,
  ConsumerLayers,
  IceSever,
  Simulcast,
} from './client-interfaces';

interface IConferenceApi {
  on(
    event: 'bitRate',
    listener: ({bitRate: number, kind: MediaKind}) => void,
  ): this;
  on(event: 'connectionstatechange', listener: ({state: string}) => void): this;
  on(event: 'newTransportId', listener: ({id: string}) => void): this;
  on(
    event: 'newProducerId',
    listener: ({id: string, kind: MediaKind}) => void,
  ): this;
  on(
    event: 'newConsumerId',
    listener: ({id: string, kind: MediaKind}) => void,
  ): this;
}
export class ConferenceApi extends EventEmitter implements IConferenceApi {
  private readonly api: MediasoupRestApi;
  private readonly configs: ConferenceConfig;
  private readonly device: Device;
  private readonly connectors: Map<MediaKind, Consumer | Producer> = new Map();
  private readonly layers: Map<MediaKind, ConsumerLayers> = new Map();
  private operation: API_OPERATION;
  private transport: Transport;
  private mediaStream?: MediaStream;
  private transportTimeout: ReturnType<typeof setTimeout>;
  private iceServers: IceSever[] | undefined;
  private simulcast: Simulcast | undefined;
  private readonly timeouts: Array<ReturnType<typeof setTimeout>> = [];
  constructor(configs: ConferenceInput) {
    super();
    this.configs = {
      url: `${location.protocol}//${location.host}`,
      kinds: ['video', 'audio'],
      maxIncomingBitrate: 0,
      timeout: {
        stats: 1000,
        stream: 30000,
      },
      ...configs,
    };
    this.api = new MediasoupRestApi(this.configs.url, this.configs.token);
    this.device = new Device();
  }
  async startRecording() {
    const {stream, kinds} = this.configs;
    await this.api.startRecording({wait: true, stream, kinds});
  }
  async stopRecording() {
    const {stream} = this.configs;
    await this.api.stopRecording({wait: true, stream});
  }
  async setPreferredLayers(layers: ConsumerLayers) {
    if (this.operation === API_OPERATION.SUBSCRIBE) {
      const kind: MediaKind = 'video';
      this.layers.set(kind, layers);
      const consumer = this.connectors.get(kind);
      if (consumer) {
        await this.api.setPreferredLayers({consumerId: consumer.id, layers});
      }
    }
  }
  async addTrack(track: MediaStreamTrack) {
    if (this.operation === API_OPERATION.PUBLISH && this.mediaStream) {
      this.mediaStream.addTrack(track);
      await this.publishTrack(track);
    }
  }
  async removeTrack(track: MediaStreamTrack) {
    if (this.operation === API_OPERATION.PUBLISH && this.mediaStream) {
      this.mediaStream.removeTrack(track);
      const consumer = this.connectors.get(track.kind as MediaKind);
      if (consumer) {
        consumer.close();
        consumer.emit('close');
      }
    }
  }
  async setMaxPublisherBitrate(bitrate: number) {
    this.configs.maxIncomingBitrate = bitrate;
    if (this.transport) {
      await this.api.setMaxIncomingBitrate({
        transportId: this.transport.id,
        bitrate,
      });
    }
  }
  async updateKinds(kinds: MediaKind[]) {
    if (this.operation === API_OPERATION.SUBSCRIBE) {
      const oldKinds = this.configs.kinds;
      this.configs.kinds = kinds;
      for (const kind of oldKinds) {
        if (!kinds.includes(kind)) {
          const connector = this.connectors.get(kind);
          if (connector) {
            connector.close();
            connector.emit('close');
          }
        }
      }
      for (const kind of kinds) {
        if (!this.connectors.get(kind)) {
          await this.subscribeTrack(kind);
        }
      }
    }
  }
  private async init(operation: API_OPERATION): Promise<void> {
    if (this.operation) {
      throw new Error('Already processing');
    }
    this.operation = operation;
    if (!this.device.loaded) {
      const {
        routerRtpCapabilities,
        iceServers,
        simulcast,
      } = await this.api.getServerConfigs();
      if (routerRtpCapabilities.headerExtensions) {
        routerRtpCapabilities.headerExtensions = routerRtpCapabilities.headerExtensions.filter(
          ext => ext.uri !== 'urn:3gpp:video-orientation',
        );
      }
      await this.device.load({routerRtpCapabilities});
      this.iceServers = iceServers;
      this.simulcast = simulcast;
    }
    await this.getTransport();
  }
  async publish(mediaStream: MediaStream): Promise<MediaStream> {
    await this.init(API_OPERATION.PUBLISH);
    this.mediaStream = mediaStream;
    await Promise.all(
      mediaStream.getTracks().map(track => this.publishTrack(track)),
    );
    return mediaStream;
  }
  async subscribe(): Promise<MediaStream> {
    await this.init(API_OPERATION.SUBSCRIBE);
    const mediaStream = this.mediaStream || new MediaStream();
    this.mediaStream = mediaStream;
    this.configs.kinds.map(async kind => {
      await this.subscribeTrack(kind);
    });
    return mediaStream;
  }
  private async subscribeTrack(kind: MediaKind): Promise<void> {
    const api: ConferenceApi = this;
    const consumer: Consumer = await this.consume(
      this.transport,
      this.configs.stream,
      kind,
    );
    this.connectors.set(kind as MediaKind, consumer);
    this.emit('newConsumerId', {id: consumer.id, kind});
    const onClose = async () => {
      if (this.mediaStream) {
        consumer.track.stop();
        this.mediaStream.removeTrack(consumer.track);
        this.mediaStream.dispatchEvent(
          new MediaStreamTrackEvent('removetrack', {track: consumer.track}),
        );
      }
      if (this.transport && !this.transport.closed) {
        const _consumer = this.connectors.get(kind);
        try {
          await this.api.closeConsumer({consumerId: consumer.id});
        } catch (e) {}
        if (_consumer && consumer.id === _consumer.id) {
          this.connectors.delete(consumer.track.kind as MediaKind);
          if (this.mediaStream) {
            if (this.transport && this.configs.kinds.includes(kind)) {
              await this.subscribeTrack(kind);
            }
          }
        }
      }
    };
    consumer.on('close', onClose);
    this.listenStats(consumer, 'inbound-rtp');
    await api.api.resumeConsumer({consumerId: consumer.id});
    if (this.mediaStream) {
      this.mediaStream.addTrack(consumer.track);
      this.mediaStream.dispatchEvent(
        new MediaStreamTrackEvent('addtrack', {track: consumer.track}),
      );
    }
  }
  private async publishTrack(track: MediaStreamTrack): Promise<void> {
    const kind: MediaKind = track.kind as MediaKind;
    if (this.configs.kinds.includes(kind)) {
      track.addEventListener('ended', async () => {
        const producer = this.connectors.get(kind);
        if (producer) {
          this.connectors.delete(kind);
          try {
            await this.api.closeProducer({producerId: producer.id});
          } catch (e) {}
        }
      });
      const params: ProducerOptions = {track};
      if (this.configs.simulcast && kind === 'video' && this.simulcast) {
        if (this.simulcast.encodings) {
          params.encodings = this.simulcast.encodings;
        }
        if (this.simulcast.codecOptions) {
          params.codecOptions = this.simulcast.codecOptions;
        }
      }
      const producer = await this.transport.produce(params);
      this.listenStats(producer, 'outbound-rtp');
      this.connectors.set(kind, producer);
      this.emit('newProducerId', {id: producer.id, kind});
    }
  }
  private async consume(
    transport: Transport,
    stream: string,
    _kind: MediaKind,
  ): Promise<Consumer> {
    const rtpCapabilities: RtpCapabilities = this.device
      .rtpCapabilities as RtpCapabilities;
    try {
      const data = await this.api.consume({
        rtpCapabilities,
        stream,
        kind: _kind,
        transportId: transport.id,
      });
      const layers = this.layers.get(_kind);
      if (layers) {
        await this.api.setPreferredLayers({consumerId: data.id, layers});
      }
      return transport.consume(data);
    } catch (e) {
      if (
        e.response &&
        e.response.status &&
        e.response.status === ERROR.INVALID_STREAM
      ) {
        await new Promise(resolve =>
          this.timeouts.push(setTimeout(resolve, 1000)),
        );
        return this.consume(transport, stream, _kind);
      } else {
        throw e;
      }
    }
  }
  private listenStats(
    target: Consumer | Producer,
    type: 'inbound-rtp' | 'outbound-rtp',
  ) {
    let lastBytes = 0;
    let lastBytesTime = Date.now();
    const bytesField = type === 'inbound-rtp' ? 'bytesReceived' : 'bytesSent';
    let deadTime = 0;
    target.on('close', () => {
      this.emit('bitRate', {bitRate: 0, kind: target.kind});
    });
    const getStats = () => {
      if (target && !target.closed) {
        target.getStats().then(async stats => {
          if (target && !target.closed) {
            let alive = false;
            let i = 0;
            const checkTarget = () => {
              if (i === stats.size) {
                if (alive) {
                  deadTime = 0;
                } else {
                  this.emit('bitRate', {bitRate: 0, kind: target.kind});
                  if (type === 'inbound-rtp') {
                    deadTime++;
                    if (deadTime > 5) {
                      try {
                        target.close();
                        target.emit('close');
                      } catch (e) {}
                      return;
                    }
                  }
                }
                setTimeout(getStats, this.configs.timeout.stats);
              }
            };
            if (stats.size) {
              stats.forEach(s => {
                if (s && s.type === type) {
                  if (s[bytesField] && s[bytesField] > lastBytes) {
                    const bitRate = Math.round(
                      ((s[bytesField] - lastBytes) /
                        (Date.now() - lastBytesTime)) *
                        1000 *
                        8,
                    );
                    this.emit('bitRate', {bitRate, kind: target.kind});
                    lastBytes = s[bytesField];
                    lastBytesTime = Date.now();
                    alive = true;
                  }
                }
                i++;
                checkTarget();
              });
            } else {
              checkTarget();
            }
          }
        });
      }
    };
    getStats();
  }
  async close(hard = true) {
    if (this.transport) {
      if (!this.transport.closed && hard) {
        this.transport.close();
      }
      try {
        await this.api.closeTransport({transportId: this.transport.id});
      } catch (e) {}
      delete this.transport;
      this.emit('connectionstatechange', {state: 'disconnected'});
    }
    if (hard && this.mediaStream) {
      this.mediaStream.getTracks().forEach(function(track) {
        track.stop();
      });
    }
    await this.closeConnectors();
    delete this.operation;
    while (this.timeouts.length) {
      const t = this.timeouts.shift();
      if (t) {
        clearTimeout(t);
      }
    }
    this.api.clear();
  }
  private async closeConnectors(): Promise<void> {
    if (this.connectors.size) {
      return new Promise(resolve => {
        this.connectors.forEach((connector, kind) => {
          this.connectors.delete(kind);
          try {
            connector.close();
            connector.emit('close');
          } catch (e) {}
          if (!this.connectors.size) {
            resolve();
          }
        });
      });
    }
  }
  private async getTransport(): Promise<Transport> {
    if (!this.transport) {
      const api: ConferenceApi = this;
      const data: TransportOptions = await this.api.createTransport();
      if (this.iceServers) {
        data.iceServers = this.iceServers;
      }
      if (this.operation === API_OPERATION.SUBSCRIBE) {
        this.transport = this.device.createRecvTransport(data);
      } else if (this.operation === API_OPERATION.PUBLISH) {
        this.transport = this.device.createSendTransport(data);
      }
      this.emit('newTransportId', {id: this.transport.id});
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
        this.emit('connectionstatechange', {state});
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
              const operation = this.operation;
              await this.close(operation === API_OPERATION.SUBSCRIBE);
              if (operation === API_OPERATION.SUBSCRIBE) {
                await this.subscribe();
              } else if (
                operation === API_OPERATION.PUBLISH &&
                this.mediaStream
              ) {
                await this.publish(this.mediaStream);
              }
            }, this.configs.timeout.stream);
            break;
        }
      });
    }
    return this.transport;
  }
}
