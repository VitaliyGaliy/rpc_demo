export enum ACTION {
    GET_SERVER_CONFIGS='getServerConfigs',
    CREATE_TRANSPORT='createTransport', CONNECT_TRANSPORT='connectTransport', CLOSE_TRANSPORT='closeTransport',
    PRODUCE='produce', CONSUME='consume',
    RESUME_CONSUMER='resumeConsumer',PAUSE_CONSUMER='pauseConsumer',CLOSE_CONSUMER='closeConsumer',
    RESUME_PRODUCER='resumeProducer',PAUSE_PRODUCER='pauseProducer',CLOSE_PRODUCER='closeProducer',
    STREAM_FILE='streamFile',
    START_RECORDING="startRecording", STOP_RECORDING="stopRecording",
    CREATE_PIPE_TRANSPORT='createPipeTransport', CONNECT_PIPE_TRANSPORT='connectPipeTransport',
    SET_PREFERRED_LAYERS="setPreferredLayers",SET_MAX_INCOMING_BITRATE='setMaxIncomingBitrate',
    PRODUCERS_STATS='producersStats', CONSUMERS_STATS='consumersStats', TRANSPORT_STATS='transportStats'
}
export enum PATH {
    RECORDINGS="recordings",
    MEDIASOUP="mediasoup",
    FRONT="front",
    API_DOCS="api-docs"}
export enum ERROR {UNKNOWN=500,UNAUTHORIZED=401,INVALID_TRANSPORT=530,INVALID_PRODUCER=531,INVALID_CONSUMER=532,INVALID_STREAM=533,INVALID_OPERATION=534}
export enum API_OPERATION {SUBSCRIBE,PUBLISH}