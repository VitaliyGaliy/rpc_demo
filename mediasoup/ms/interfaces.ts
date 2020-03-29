import {WorkerSettings} from 'mediasoup/lib/Worker';
import {RouterOptions} from 'mediasoup/lib/Router';
import {ConsumerType} from 'mediasoup/lib/Consumer';
import {
    MediaKind,
    RtpCapabilities,
    RtpCodecParameters,
    RtpParameters
} from 'mediasoup/lib/RtpParameters';
import {RtpCapabilities as ClientRtpCapabilities} from 'mediasoup-client/lib/RtpParameters';
import {
    ConsumeRequest as ClientConsumeRequest,
    ConsumeResponse as ClientConsumeResponse,
    IceSever, Simulcast
} from '../front/src/client-interfaces';
import {TransportOptions} from 'mediasoup-client/lib/Transport';

export interface MediaSoupSettings {
    worker:WorkerSettings
    router:RouterOptions
    webRtcTransport: {
        listenIp:string
        maxIncomingBitrate:number
        initialAvailableOutgoingBitrate:number
    },
    codecParameters:{[x in MediaKind]:RtpCodecParameters},
    sdp:{
        audio: string
        video: string
        header: string
        minPort: number
    }
    recording:{
        path:string
        extension:string
    }
    ffmpeg:{
        path:string
        encoding:{[x in MediaKind]:string[]}
    }
    timeout:{
        stats: number,
        stream :number
    },
    iceServers?:IceSever[]
    simulcast?:Simulcast
}
export interface ConsumeResponse  extends ClientConsumeResponse{
    rtpParameters: RtpParameters
    type: ConsumerType
}
export interface ConsumeRequest extends ClientConsumeRequest {
    rtpCapabilities: RtpCapabilities | ClientRtpCapabilities
}
export interface CreateTransportResponse extends TransportOptions{
}
export interface StartRestreamingRequest {
    stream:string
    targetUrl:string
    kinds?:MediaKind[]
    token: string
}