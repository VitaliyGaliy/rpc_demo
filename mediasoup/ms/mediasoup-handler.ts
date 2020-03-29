import {Consumer} from 'mediasoup/lib/Consumer';
import {MediaKind, RtpCapabilities} from 'mediasoup/lib/RtpParameters';
import {
    ConsumeRequest,
    ConsumeResponse,
    CreateTransportResponse,
    MediaSoupSettings,
    StartRestreamingRequest
} from './interfaces';
import {
    ConnectTransportRequest,
    ConsumerData,
    ConsumerPreferredLayers,
    PipeTransportConnectData,
    PipeTransportData,
    ProducerData,
    ProduceRequest,
    ProduceResponse,
    ServerConfigs,
    StartRecordingRequest,
    StatsInput,
    StatsOutput,
    StopRecordingRequest,
    StreamFileRequest,
    TransportBitrateData,
    TransportData
} from '../front/src/client-interfaces';
import {WebRtcTransport} from 'mediasoup/lib/WebRtcTransport';
import {Router} from 'mediasoup/lib/Router';
import {Worker} from 'mediasoup/lib/Worker';
import {Transport} from 'mediasoup/lib/Transport';
import {Producer} from 'mediasoup/lib/Producer';
import {EventEmitter} from 'events';
import {MediasoupRestApi} from '../front/src/mediasoup-rest-api';
import {ACTION, ERROR} from '../config/constants';
import * as mediasoup from 'mediasoup';
import {IMediasoupApi} from './i-mediasoup-api';
import {basename, dirname, join} from 'path';
import {PlainRtpTransport} from 'mediasoup/lib/PlainRtpTransport';
import {ChildProcess, spawn} from 'child_process';
import {IceCandidate} from 'mediasoup-client/lib/Transport';

export class MediasoupHandler extends EventEmitter implements IMediasoupApi{
    private readonly _conf:MediaSoupSettings;
    private _worker:Worker;
    private _router:Router;
    private readonly _producers:Map<string, Producer> = new Map();
    private readonly _consumers:Map<string, Consumer> = new Map();
    private readonly _transports:Map<string, Transport> = new Map();
    private readonly _producerIdByStream:Map<string, string> = new Map();
    private readonly _streamWaiters:Map<string,(()=>void)[]>= new Map();
    private readonly _mapRouterPipeTransports: Map<string, {local:PipeTransportData,remote:PipeTransportData}> = new Map();
    private readonly _rtpIndexes:string[]=[];
    private readonly _recorders: Map<string,string>=new Map();
    private readonly _childProcesses: Map<number,ChildProcess>=new Map();
    private readonly _pidsByStream: Map<string,number>=new Map();

    constructor(conf:MediaSoupSettings){
        super();
        this._conf=conf;
        this.initialize().then(async ()=>{
        })
    }
    async [ACTION.CONSUME]({kind,rtpCapabilities,stream,transportId}:ConsumeRequest):Promise<ConsumeResponse>{
        const producerId=await this.producerIdByStream(stream,kind,false);
        if(producerId) {
            const producer=this.getProducer(producerId);
            const transport=this.getTransport(transportId);
            const consumer= await this.createConsumer(producer,transport, rtpCapabilities as RtpCapabilities);
            this.setConsumerListeners(consumer);
            producer.observer.on('close',()=>{
                consumer.close();
            });
            return{
                producerId: producer.id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            };
        }
        else {
            throw {errorId:ERROR.INVALID_STREAM}
        }
    }
    async [ACTION.PRODUCE]( {stream, transportId, kind, rtpParameters, paused, keyFrameRequestDelay}:ProduceRequest):Promise<ProduceResponse>{
        const transport=this.getTransport(transportId);
        //console.log('produce',keyFrameRequestDelay);
        const producer = await transport.produce({ kind, rtpParameters, paused, keyFrameRequestDelay});
        transport.observer.on('close',()=>{
            console.log('trying closing producer',producer.id);
            producer.close();
        });
        this.setProducerListeners(producer);
        this.setProducerIdByStream(stream,kind,producer.id);
        return { id: producer.id };

    }
    async [ACTION.RESUME_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        await consumer.resume();
    }
    async [ACTION.PAUSE_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        await consumer.pause();
    }
    async [ACTION.CLOSE_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        try{
            const consumer=this.getConsumer(consumerId);
            await consumer.close();
        }
        catch (e) {}

    }
    async [ACTION.SET_PREFERRED_LAYERS]({consumerId,layers}:ConsumerPreferredLayers):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        if (consumer.type === 'simulcast') {
            await consumer.setPreferredLayers(layers);
        }
    }
    async [ACTION.RESUME_PRODUCER]({producerId}:ProducerData):Promise<void>{
        const producer=this.getProducer(producerId);
        await producer.resume();
    }
    async [ACTION.PAUSE_PRODUCER]({producerId}:ProducerData):Promise<void>{
        const producer=this.getProducer(producerId);
        await producer.pause();
    }
    async [ACTION.CLOSE_PRODUCER]({producerId}:ProducerData):Promise<void>{
        try{
            const producer=this.getProducer(producerId);
            await producer.close();
        }
        catch (e) {}
    }
    async [ACTION.SET_MAX_INCOMING_BITRATE]({transportId,bitrate}:TransportBitrateData):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.setMaxIncomingBitrate(bitrate)
    }
    async [ACTION.TRANSPORT_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getTransport(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.CONSUMERS_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getConsumer(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        console.log('stats',stats);
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.PRODUCERS_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getProducer(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.GET_SERVER_CONFIGS]():Promise<ServerConfigs>{
        return {
            routerRtpCapabilities:this._router.rtpCapabilities,
            iceServers: this._conf.iceServers,
            simulcast: this._conf.simulcast
        };
    }
    async [ACTION.CREATE_PIPE_TRANSPORT]():Promise<PipeTransportData>{
        const transport=await this._router.createPipeTransport({ listenIp:this._conf.webRtcTransport.listenIp, enableSctp:true, numSctpStreams:{ OS: 1024, MIS: 1024 } });
        this.setTransportListeners(transport);
        return {pipeTransportId:transport.id,port:transport.tuple.localPort,ip:transport.tuple.localIp};
    }
    async [ACTION.CONNECT_PIPE_TRANSPORT]({pipeTransportId,ip,port,transportId}:PipeTransportConnectData):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.connect({ ip,port });
    }
    async [ACTION.CREATE_TRANSPORT]():Promise<CreateTransportResponse>{
        const transport = await this.createWebRtcTransport();
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates as IceCandidate[],
            dtlsParameters: transport.dtlsParameters
        };
    }
    async [ACTION.CONNECT_TRANSPORT]({transportId,dtlsParameters}:ConnectTransportRequest):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.connect({ dtlsParameters });
    }
    async [ACTION.CLOSE_TRANSPORT]({transportId}:TransportData):Promise<void>{
        const transport = this._transports.get(transportId);
        if(transport) {
            transport.close();
        }
    }
    async [ACTION.STOP_RECORDING]({stream,kinds=['audio','video']}:StopRecordingRequest):Promise<void> {
        for (const kind of kinds){
            const id=MediasoupHandler.streamKindId(stream,kind);
            const recorder=this._recorders.get(id);
            if(recorder){
                this._recorders.delete(id);
                const consumer = this._consumers.get(recorder);
                if(consumer) {
                    consumer.close();
                }
            }
        }

    }
    async [ACTION.START_RECORDING]({stream,filePath,kinds=['audio','video'],wait=true}:StartRecordingRequest):Promise<void>{
        const options=['-protocol_whitelist','file,pipe,udp,rtp','-i', '-'];
        let sdp=this._conf.sdp.header;
        const consumers:Consumer[]=[];
        for (const kind of kinds) {
            const id = MediasoupHandler.streamKindId(stream, kind);
            if(!this._recorders.get(id)) {
                this._recorders.set(id, ' ');
                const producerId = await this.producerIdByStream(stream, kind, false);
                if (producerId) {
                    const producer = this._producers.get(producerId);
                    if (producer) {
                        const {port, consumer} = await this.getStreamInputFromServer(producer);
                        if(!this._recorders.get(id)) {
                            return;
                        }
                        consumers.push(consumer);
                        this._recorders.set(id, consumer.id);
                        sdp+=this._conf.sdp[kind].replace('__PORT__',port.toString());
                        options.push('-map', `0:${kind.charAt(0)}:0`, `-c:${kind.charAt(0)}`, 'copy');
                        continue;
                    }
                }
                if (wait) {
                    this.producerIdByStream(stream, kind).then(async () => {
                        await this.stopRecording({stream});
                        await this.startRecording({stream, filePath, kinds, wait});
                    });
                }
            }
        }

        if(consumers.length) {
            let extension=this._conf.recording.extension;
            let name=stream;
            let folder=this._conf.recording.path;
            if(filePath){
                folder=dirname(filePath);
                name=basename(filePath);
                const nameSplit=name.split('.');
                if(nameSplit.length>1){
                    const _extension=nameSplit.pop();
                    if(_extension){
                        extension=_extension;
                    }
                    name=nameSplit.join('.')
                }
            }
            options.push(join(folder,`${name}_${Date.now()}.${extension}`),'-y');
            const p = this.launchChildProcess(options,sdp);
            if (wait) {
                this._pidsByStream.set(stream,p.pid);
                p.on('exit', async () => {
                    if (this._pidsByStream.get(stream) === p.pid) {
                        for (const kind of kinds) {
                            const id = MediasoupHandler.streamKindId(stream, kind);
                            if(this._recorders.get(id)) {
                                try {
                                    await this.stopRecording({stream});
                                    await this.startRecording({stream, filePath, kinds, wait});
                                }
                                catch (e) {
                                }
                                break;
                            }
                        }

                    }
                });
            }
            await Promise.all(consumers.map(c=>c.resume()))
        }

    }


    private setTransportListeners(transport:Transport,watchStats=true):void{
        this._transports.set(transport.id,transport);
        if(watchStats) {
            let deadTime = 0;
            const getStats = () => {
                if (transport && !transport.closed) {
                    transport.getStats().then(async stats => {
                        if (transport && !transport.closed) {
                            let alive = false;
                            while (stats && stats.length) {
                                const s = stats.shift();
                                if (s) {
                                    //console.log('stats',s.recvBitrate, s.sendBitrate);
                                    if (s.recvBitrate || s.sendBitrate) {
                                        alive = true;
                                        break;
                                    }
                                }
                            }

                            if (alive) {
                                deadTime = 0;
                            }
                            else {
                                deadTime += this._conf.timeout.stats;
                                if (deadTime >= this._conf.timeout.stream) {
                                    try {
                                        await transport.close();
                                    }
                                    catch (e) {
                                    }
                                    return;
                                }
                            }
                            setTimeout(getStats, this._conf.timeout.stats);
                        }

                    });
                }
            };
            getStats();
        }
        transport.observer.on('close',()=>{
            console.log('transport close',transport.id);
            this._transports.delete(transport.id);
        });
    }
    private setConsumerListeners(consumer:Consumer){
        this._consumers.set(consumer.id, consumer);
        consumer.on('transportclose',async ()=>{
            consumer.close();
        });
        consumer.observer.on('close',()=>{
            console.log('consumer close',consumer.id);
            this._consumers.delete(consumer.id);
        })
    }
    private setProducerListeners(producer:Producer){
        this._producers.set(producer.id, producer);
        producer.on('transportclose',async ()=>{
            producer.close();
        });
        producer.observer.on('close',()=>{
            this._producers.delete(producer.id);
            this._producerIdByStream.forEach((producerId,id)=>{
                if(producerId===producer.id){
                    this._producerIdByStream.delete(id);
                    console.log('producer stream close',producer.id,id);
                }
                const recorder=this._recorders.get(id);
                if(recorder){
                    const consumer = this._consumers.get(recorder);
                    if(consumer) {
                        consumer.close();
                    }
                }
            });
            this._rtpIndexes.filter(producerId=>producerId===producer.id).forEach((producerId,rtpIndex)=>delete this._rtpIndexes[rtpIndex]);
        })
    }
    private async createConsumer(producer:Producer, transport:Transport,rtpCapabilities:RtpCapabilities,paused?:boolean):Promise<Consumer> {
        if (!this._router.canConsume(
            {
                producerId: producer.id,
                rtpCapabilities,
            })
        ) {
            throw {message:'can not consume'};
        }
        try {
            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: paused||producer.kind === 'video',
            });
            this.setConsumerListeners(consumer);
            return consumer;
        } catch (error) {
            throw error;
        }


    }
    private setProducerIdByStream(stream:string,kind:MediaKind,producerId:string):void{
        const id=MediasoupHandler.streamKindId(stream,kind);
        const _producerId=this._producerIdByStream.get(id);
        if(_producerId){
            const _producer=this._producers.get(_producerId);
            if(_producer){
                _producer.close();
            }
        }
        this._producerIdByStream.set(id,producerId);
        console.log('producer stream',producerId,id);
        const waiters=this._streamWaiters.get(id);
        if(waiters) {
            while (waiters.length) {
                const w=waiters.shift();
                if(w){
                    w();
                }
            }
            this._streamWaiters.delete(id)
        }

    }
    private async createWebRtcTransport():Promise<WebRtcTransport> {
        const {
            maxIncomingBitrate,
            initialAvailableOutgoingBitrate
        } = this._conf.webRtcTransport;

        const transport = await this._router.createWebRtcTransport({
            listenIps: [
                {
                    ip: this._conf.webRtcTransport.listenIp
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate,
        });
        if (maxIncomingBitrate) {
            try {
                await transport.setMaxIncomingBitrate(maxIncomingBitrate);
            } catch (error) {
            }
        }
        this.setTransportListeners(transport);
        return transport;
    }
    private async createPlainRtpTransport(comedia?:boolean,rtcpMux?:boolean):Promise<PlainRtpTransport>{
        const transport= await this._router.createPlainRtpTransport(
            {
                listenIp : '127.0.0.1',
                rtcpMux, comedia
            });
        this.setTransportListeners(transport);
        return transport;
    }
    private async createPlainRtpProducer(transport:PlainRtpTransport,kind:MediaKind,ssrc:number){
        const producer= await transport.produce(
            {
                kind,
                rtpParameters :
                    {
                        codecs:[this._conf.codecParameters[kind]],
                        encodings : [ { ssrc } ]
                    }
            });
        this.setProducerListeners(producer);
        return producer;
    }
    private async initialize():Promise<void>{
        mediasoup.parseScalabilityMode('S3T1');
        this._worker = await mediasoup.createWorker(this._conf.worker);
        this._worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', this._worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        this._router = await this._worker.createRouter(this._conf.router);
    }
    private async producerIdByStream(stream:string,kind:MediaKind,wait:boolean=true):Promise<string|undefined>{
        if(wait){
            await this.waitForStream(stream,kind);
        }
        return this._producerIdByStream.get(MediasoupHandler.streamKindId(stream,kind));
    }
    private waitForStream(stream:string,kind:MediaKind){
        const id=MediasoupHandler.streamKindId(stream,kind);
        if(!this._producerIdByStream.get(id)){
            return new Promise(resolve=>{
                const w=this._streamWaiters.get(id);
                if(w){
                    w.push(resolve);
                }
                else {
                    this._streamWaiters.set(id,[resolve]);
                }
            })
        }
    }
    private getProducer(producerId:string):Producer{
        const producer=this._producers.get(producerId);
        if(producer) {
            return producer
        }
        else {
            throw {errorId:ERROR.INVALID_PRODUCER}
        }
    }
    private getConsumer(consumerId:string):Consumer{
        const consumer=this._consumers.get(consumerId);
        if(consumer) {
            return consumer
        }
        else {
            throw {errorId:ERROR.INVALID_CONSUMER}
        }
    }
    private getTransport(transportId:string):Transport{
        const transport = this._transports.get(transportId);
        if(transport) {
            return transport
        }
        else {
            throw {errorId:ERROR.INVALID_TRANSPORT}
        }
    }
    private findMinRtpIndex():number {
        for(let i=0;i<this._rtpIndexes.length;i++){
            if(!this._rtpIndexes[i]){
                return i;
            }
        }
        return this._rtpIndexes.length;
    }
    private async getStreamInputFromServer(producer:Producer):Promise<{port:number,consumer:Consumer}>{
        const transport = await this.createPlainRtpTransport();
        this.setTransportListeners(transport,false);
        producer.on('transportclose',async ()=>{
            try{
                await transport.close();
            }
            catch (e) {
            }
        });
        const rtpIndex=this.findMinRtpIndex();
        this._rtpIndexes[rtpIndex]=transport.id;
        const port=this._conf.sdp.minPort + 2 * rtpIndex;
        await transport.connect({
            ip: transport.tuple.localIp,
            port
        });
        const consumer=await this.createConsumer(producer,transport,this._router.rtpCapabilities,true);
        consumer.observer.on('close',()=>{
            transport.close();
        });
        this.setConsumerListeners(consumer);
        return {port,consumer}
    }
    private launchChildProcess(options:string[], stdInData?:string):ChildProcess{
        console.log(this._conf.ffmpeg,options.join(' '));
        const p=spawn(this._conf.ffmpeg.path,options,{detached:false} as any);
        if(stdInData){
            console.log(stdInData);
            p.stdin.write(stdInData);
            p.stdin.end();
        }
        this._childProcesses.set(p.pid,p);
        p.stderr.on('data',(data)=>{
            console.log(data.toString());
        });
        p.stdout.on('data',(data)=>{
            console.log(data.toString());
        });
        p.on('exit',(code)=>{
            console.log(`exit ${code}`);
            this._childProcesses.delete(p.pid);
        });
        return p;
    }
    private static streamKindId(stream:string,kind:MediaKind){
        return [stream,kind].join(':');
    }



    async startRestreaming({stream, targetUrl, kinds=['audio','video'],token}:StartRestreamingRequest)
    {
        let pipeTransportPair = this._mapRouterPipeTransports.get(targetUrl);
        let local:PipeTransportData,remote:PipeTransportData;
        const api=new MediasoupRestApi(targetUrl,token);

        if (pipeTransportPair)
        {
            local = pipeTransportPair.local;
            remote = pipeTransportPair.remote;
        }
        else
        {
            [local, remote] = await Promise.all(
                [
                    this.createPipeTransport(),
                    api.createPipeTransport()
                ]);

            await Promise.all(
                [
                    this.connectPipeTransport({...remote, transportId: local.pipeTransportId}),
                    api.connectPipeTransport({...local, transportId: remote.pipeTransportId}),
                ]);

            const localTransport=this._transports.get(local.pipeTransportId);
            if(localTransport){
                localTransport.observer.on('close', async () => {
                    await api.closeTransport({transportId: local.pipeTransportId});
                });
            }
        }
        for (const kind of kinds) {
            const producerId = await this.producerIdByStream(stream,kind,false);
            if(producerId) {
                const producer = this._producers.get(producerId);
                if (producer) {
                    const localTransport=this._transports.get(local.pipeTransportId);
                    if(localTransport){
                        const pipeConsumer: Consumer = await  localTransport.consume({producerId: producer.id});
                        this._consumers.set(pipeConsumer.id,pipeConsumer);
                        const remoteProducerData=await api.produce(
                            {
                                transportId: remote.pipeTransportId,
                                stream,
                                kind: pipeConsumer.kind,
                                rtpParameters: pipeConsumer.rtpParameters,
                                paused: pipeConsumer.producerPaused,
                            });

                        pipeConsumer.observer.on('close', () => api.closeProducer({producerId: remoteProducerData.id}));
                        pipeConsumer.observer.on('pause', () => api.pauseProducer({producerId: remoteProducerData.id}));
                        pipeConsumer.observer.on('resume', () => api.resumeProducer({producerId: remoteProducerData.id}));
                    }
                }
            }
        }
    }
    async streamFile({filePath, stream, kinds=['audio','video']}:StreamFileRequest):Promise<void> {
        const options:string[]=['-i',filePath];
        const tee:string[]=[];
        for (const kind of kinds){
            const transport = await this.createPlainRtpTransport(true,false);
            const ssrc=kind==='audio'?11111111:22222222;
            const producer=await this.createPlainRtpProducer(transport,kind,ssrc);
            this.setProducerIdByStream(stream,kind,producer.id);
            options.push(...this._conf.ffmpeg.encoding[kind]);
            tee.push(`[select=${kind.charAt(0)}:f=rtp:ssrc=${+ssrc}:payload_type=${this._conf.codecParameters[kind].payloadType}]rtp://127.0.0.1:${transport.tuple.localPort}?rtcpport=${transport.rtcpTuple.localPort}`);
        }
        options.push('-f','tee',tee.join('|'));
        this.launchChildProcess(options);
    }

}