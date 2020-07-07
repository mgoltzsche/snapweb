
function setCookie(key: string, value: string, exdays: number = -1) {
    let d = new Date();
    if (exdays < 0)
        exdays = 10 * 365;
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = key + "=" + value + ";" + expires + ";sameSite=Strict;path=/";
}


function getCookie(key: string, defaultValue: string = ""): string {
    let name = key + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let c of ca) {
        c = c.trimLeft();
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    setCookie(key, defaultValue);
    return defaultValue;
}


function uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


class Tv {
    constructor(sec: number, usec: number) {
        this.sec = sec;
        this.usec = usec;
    }

    setMilliseconds(ms: number) {
        this.sec = Math.floor(ms / 1000);
        this.usec = Math.floor(ms * 1000) % 1000000;
    }

    getMilliseconds(): number {
        return this.sec * 1000 + this.usec / 1000;
    }

    sec: number = 0;
    usec: number = 0;
}


class BaseMessage {
    constructor(buffer?: ArrayBuffer) {
    }

    deserialize(buffer: ArrayBuffer) {
        let view = new DataView(buffer);
        this.type = view.getUint16(0, true);
        this.id = view.getUint16(2, true);
        this.refersTo = view.getUint16(4, true);
        this.received = new Tv(view.getInt32(6, true), view.getInt32(10, true));
        this.sent = new Tv(view.getInt32(14, true), view.getInt32(18, true));
        this.size = view.getUint32(22, true);
    }

    serialize(): ArrayBuffer {
        this.size = 26 + this.getSize();
        let buffer = new ArrayBuffer(this.size);
        let view = new DataView(buffer);
        view.setUint16(0, this.type, true);
        view.setUint16(2, this.id, true);
        view.setUint16(4, this.refersTo, true);
        view.setInt32(6, this.sent.sec, true);
        view.setInt32(10, this.sent.usec, true);
        view.setInt32(14, this.received.sec, true);
        view.setInt32(18, this.received.usec, true);
        view.setUint32(22, this.size, true);
        return buffer;
    }

    getSize() {
        return 0;
    }

    type: number = 0;
    id: number = 0;
    refersTo: number = 0;
    received: Tv = new Tv(0, 0);
    sent: Tv = new Tv(0, 0);
    size: number = 0;
}


class CodecMessage extends BaseMessage {
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        this.payload = new ArrayBuffer(0);
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 1;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        let view = new DataView(buffer);
        let codecSize = view.getInt32(26, true);
        let decoder = new TextDecoder("utf-8");
        this.codec = decoder.decode(buffer.slice(30, 30 + codecSize));
        let payloadSize = view.getInt32(30 + codecSize, true);
        console.log("payload size: " + payloadSize);
        this.payload = buffer.slice(34 + codecSize, 34 + codecSize + payloadSize);
        console.log("payload: " + this.payload);
    }

    codec: string = "";
    payload: ArrayBuffer;
}


class TimeMessage extends BaseMessage {
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 4;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        let view = new DataView(buffer);
        this.latency = new Tv(view.getInt32(26, true), view.getInt32(30, true));
    }

    serialize(): ArrayBuffer {
        let buffer = super.serialize();
        let view = new DataView(buffer);
        view.setInt32(26, this.latency.sec, true);
        view.setInt32(30, this.latency.sec, true);
        return buffer;
    }

    getSize() {
        return 8;
    }

    latency: Tv = new Tv(0, 0);
}


class JsonMessage extends BaseMessage {
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        if (buffer) {
            this.deserialize(buffer);
        }
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        let view = new DataView(buffer);
        let size = view.getInt32(26, true);
        let decoder = new TextDecoder();
        this.json = JSON.parse(decoder.decode(buffer.slice(30)));
    }

    serialize(): ArrayBuffer {
        let buffer = super.serialize();
        let view = new DataView(buffer);
        let jsonStr = JSON.stringify(this.json);
        view.setUint32(26, jsonStr.length, true);
        let encoder = new TextEncoder();
        let encoded = encoder.encode(jsonStr);
        for (let i = 0; i < encoded.length; ++i)
            view.setUint8(30 + i, encoded[i]);
        return buffer;
    }

    getSize() {
        let encoder = new TextEncoder();
        let encoded = encoder.encode(JSON.stringify(this.json));
        return encoded.length + 4;
        // return JSON.stringify(this.json).length;
    }

    json: any;
}


class HelloMessage extends JsonMessage {
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 5;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        this.mac = this.json["MAC"];
        this.hostname = this.json["HostName"];
        this.version = this.json["Version"];
        this.clientName = this.json["ClientName"];
        this.os = this.json["OS"];
        this.arch = this.json["Arch"];
        this.instance = this.json["Instance"];
        this.uniqueId = this.json["ID"];
        this.snapStreamProtocolVersion = this.json["SnapStreamProtocolVersion"];
    }

    serialize(): ArrayBuffer {
        this.json = { "MAC": this.mac, "HostName": this.hostname, "Version": this.version, "ClientName": this.clientName, "OS": this.os, "Arch": this.arch, "Instance": this.instance, "ID": this.uniqueId, "SnapStreamProtocolVersion": this.snapStreamProtocolVersion };
        return super.serialize();
    }

    mac: string = "";
    hostname: string = "";
    version: string = "0.1.0";
    clientName = "Snapweb";
    os: string = "";
    arch: string = "web";
    instance: number = 1;
    uniqueId: string = "";
    snapStreamProtocolVersion: number = 2;
}


class ServerSettingsMessage extends JsonMessage {
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 3;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        this.bufferMs = this.json["bufferMs"];
        this.latency = this.json["latency"];
        this.volumePercent = this.json["volume"];
        this.muted = this.json["muted"];
    }

    serialize(): ArrayBuffer {
        this.json = { "bufferMs": this.bufferMs, "latency": this.latency, "volume": this.volumePercent, "muted": this.muted };
        return super.serialize();
    }

    bufferMs: number = 0;
    latency: number = 0;
    volumePercent: number = 0;
    muted: boolean = false;
}


class PcmChunkMessage extends BaseMessage {
    constructor(buffer: ArrayBuffer, sampleFormat: SampleFormat) {
        super(buffer);
        this.deserialize(buffer);
        this.sampleFormat = sampleFormat;
        this.type = 2;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        let view = new DataView(buffer);
        this.timestamp = new Tv(view.getInt32(26, true), view.getInt32(30, true));
        // this.payloadSize = view.getUint32(34, true);
        this.payload = buffer.slice(38);//, this.payloadSize + 38));// , this.payloadSize);
        // console.log("ts: " + this.timestamp.sec + " " + this.timestamp.usec + ", payload: " + this.payloadSize + ", len: " + this.payload.byteLength);
    }

    readFrames(frames: number): ArrayBuffer {
        let frameCnt = frames;
        let frameSize = this.sampleFormat.frameSize();
        if (this.idx + frames > this.payloadSize() / frameSize)
            frameCnt = (this.payloadSize() / frameSize) - this.idx;
        let begin = this.idx * frameSize;
        this.idx += frameCnt;
        let end = begin + frameCnt * frameSize;
        // console.log("readFrames: " + frames + ", result: " + frameCnt + ", begin: " + begin + ", end: " + end + ", payload: " + this.payload.byteLength);
        return this.payload.slice(begin, end);
    }

    getFrameCount(): number {
        return (this.payloadSize() / this.sampleFormat.frameSize());
    }

    isEndOfChunk(): boolean {
        return this.idx >= this.getFrameCount();
    }

    startMs(): number {
        return this.timestamp.getMilliseconds() + 1000 * (this.idx / this.sampleFormat.rate);
    }

    payloadSize(): number {
        return this.payload.byteLength;
    }

    clearPayload(): void {
        this.payload = new ArrayBuffer(0);
    }

    addPayload(buffer: ArrayBuffer) {
        let payload = new ArrayBuffer(this.payload.byteLength + buffer.byteLength);
        let view = new DataView(payload);
        let viewOld = new DataView(this.payload);
        let viewNew = new DataView(buffer);
        for (let i = 0; i < viewOld.byteLength; ++i) {
            view.setInt8(i, viewOld.getInt8(i));
        }
        for (let i = 0; i < viewNew.byteLength; ++i) {
            view.setInt8(i + viewOld.byteLength, viewNew.getInt8(i));
        }
        this.payload = payload;
    }

    timestamp: Tv = new Tv(0, 0);
    // payloadSize: number = 0;
    payload: ArrayBuffer = new ArrayBuffer(0);
    idx: number = 0;
    sampleFormat: SampleFormat;
}


class AudioStream {
    constructor(public timeProvider: TimeProvider, public sampleFormat: SampleFormat, public bufferMs: number) {
    }

    chunks: Array<PcmChunkMessage> = new Array<PcmChunkMessage>();

    setVolume(percent: number, muted: boolean) {
        let base = 10;
        this.volume = percent / 100; // (Math.pow(base, percent / 100) - 1) / (base - 1);
        console.log("setVolume: " + percent + " => " + this.volume + ", muted: " + this.muted);
        this.muted = muted;
    }

    addChunk(chunk: PcmChunkMessage) {
        this.chunks.push(chunk);
        // let oldest = this.timeProvider.serverNow() - this.chunks[0].timestamp.getMilliseconds();
        // let newest = this.timeProvider.serverNow() - this.chunks[this.chunks.length - 1].timestamp.getMilliseconds();
        // console.debug("chunks: " + this.chunks.length + ", oldest: " + oldest.toFixed(2) + ", newest: " + newest.toFixed(2));

        while (this.chunks.length > 0) {
            let age = this.timeProvider.serverNow() - this.chunks[0].timestamp.getMilliseconds();
            // todo: consider buffer ms
            if (age > 5000 + this.bufferMs) {
                this.chunks.shift();
                console.log("Dropping old chunk: " + age.toFixed(2) + ", left: " + this.chunks.length);
            }
            else
                break;
        }
    }

    getNextBuffer(buffer: AudioBuffer, playTimeMs: number) {
        if (!this.chunk) {
            this.chunk = this.chunks.shift()
        }
        // let age = this.timeProvider.serverTime(this.playTime * 1000) - startMs;
        let frames = buffer.length;
        let read = 0;
        let left = new Float32Array(frames);
        let right = new Float32Array(frames);
        let pos = 0;
        let volume = this.muted ? 0 : this.volume;
        let serverPlayTimeMs = this.timeProvider.serverTime(playTimeMs);
        if (this.chunk) {
            let age = serverPlayTimeMs - this.chunk.startMs();// - 500;
            let reqChunkDuration = frames / this.sampleFormat.msRate();
            let secs = Math.floor(Date.now() / 1000);
            if (this.lastLog != secs) {
                this.lastLog = secs;
                console.log("age: " + age.toFixed(2) + ", req: " + reqChunkDuration);
            }
            if (age < -reqChunkDuration) {
                console.log("age: " + age.toFixed(2) + " < req: " + reqChunkDuration * -1 + ", chunk.startMs: " + this.chunk.startMs().toFixed(2) + ", timestamp: " + this.chunk.timestamp.getMilliseconds().toFixed(2));
                console.log("Chunk too young, returning silence");
            } else {
                while (age > reqChunkDuration) {
                    console.log("Chunk too old, dropping");
                    this.chunk = this.chunks.shift();
                    if (!this.chunk)
                        break;
                    age = serverPlayTimeMs - (this.chunk as PcmChunkMessage).startMs();
                }

                let addFrames = 0;
                let everyN = 0;
                if (age > 1) {
                    addFrames = Math.ceil(age / 5);
                } else if (age < 1) {
                    addFrames = Math.floor(age / 5);
                }
                let readFrames = frames + addFrames;
                if (addFrames != 0)
                    everyN = Math.floor((frames + addFrames) / (Math.abs(addFrames) + 1));
                // addFrames = 0;
                // console.log("frames: " + frames + ", readFrames: " + readFrames + ", everyN: " + everyN);
                while ((read < readFrames) && this.chunk) {
                    let pcmChunk = this.chunk as PcmChunkMessage;
                    let pcmBuffer = pcmChunk.readFrames(readFrames - read);
                    let payload = new Int16Array(pcmBuffer);
                    // console.log("readFrames: " + (frames - read) + ", read: " + pcmBuffer.byteLength + ", payload: " + payload.length);
                    read += (pcmBuffer.byteLength / this.sampleFormat.frameSize());
                    for (let i = 0; i < payload.length; i += 2) {
                        left[pos] = (payload[i] / 32768) * volume;
                        right[pos] = (payload[i + 1] / 32768) * volume;
                        if ((everyN != 0) && (i > 0) && (i % (2 * everyN) == 0)) {
                            if (addFrames > 0) {
                                pos--;
                            } else {
                                left[pos + 1] = left[pos];
                                right[pos + 1] = right[pos];
                                pos++;
                            }
                        }
                        pos++;
                    }
                    if (pcmChunk.isEndOfChunk()) {
                        this.chunk = this.chunks.shift();
                    }
                }
                // console.log("Pos: " + pos + ", frames: " + frames + ", add: " + addFrames + ", everyN: " + everyN);
                if (read == readFrames)
                    read = frames;
            }
        }

        if (read < frames) {
            console.log("Failed to get chunk, read: " + read + "/" + frames + ", chunks left: " + this.chunks.length);
            left.fill(0, pos);
            right.fill(0, pos);
        }

        buffer.copyToChannel(left, 0, 0);
        buffer.copyToChannel(right, 1, 0);
    }

    chunk?: PcmChunkMessage = undefined;
    volume: number = 1;
    muted: boolean = false;
    lastLog: number = 0;
}


class TimeProvider {
    constructor(ctx: AudioContext | undefined = undefined) {
        if (ctx) {
            this.setAudioContext(ctx);
        }
    }

    setAudioContext(ctx: AudioContext) {
        this.ctx = ctx;
        this.reset();
    }

    reset() {
        this.diffBuffer.length = 0;
        this.diff = 0;
    }

    setDiff(c2s: number, s2c: number) {
        if (this.now() == 0) {
            this.reset()
        } else {
            if (this.diffBuffer.push((c2s - s2c) / 2) > 100)
                this.diffBuffer.shift();
            let sorted = [...this.diffBuffer];
            sorted.sort()
            this.diff = sorted[Math.floor(sorted.length / 2)];
        }
        // console.debug("c2s: " + c2s.toFixed(2) + ", s2c: " + s2c.toFixed(2) + ", diff: " + this.diff.toFixed(2) + ", now: " + this.now().toFixed(2) + ", server.now: " + this.serverNow().toFixed(2) + ", win.now: " + window.performance.now().toFixed(2));
        // console.log("now: " + this.now() + "\t" + this.now() + "\t" + this.now());
    }

    now() {
        if (!this.ctx) {
            return window.performance.now();
        } else {
            return this.ctx.getOutputTimestamp().contextTime! * 1000;
        }
    }

    serverNow() {
        return this.serverTime(this.now());
    }

    serverTime(localTimeMs: number) {
        return localTimeMs + this.diff;
    }

    diffBuffer: Array<number> = new Array<number>();
    diff: number = 0;
    ctx: AudioContext | undefined;
}


class SampleFormat {
    rate: number = 48000;
    channels: number = 2;
    bits: number = 16;

    public msRate(): number {
        return this.rate / 1000;
    }

    public toString(): string {
        return this.rate + ":" + this.bits + ":" + this.channels;
    }

    public sampleSize(): number {
        if (this.bits == 24) {
            return 4;
        }
        return this.bits / 8;
    }

    public frameSize(): number {
        return this.channels * this.sampleSize();
    }

    public durationMs(bytes: number) {
        return (bytes / this.frameSize()) * this.msRate();
    }
}


class Decoder {
    setHeader(buffer: ArrayBuffer): SampleFormat {
        return new SampleFormat();
    }

    decode(chunk: PcmChunkMessage): PcmChunkMessage | null {
        return null;
    }
}


class FlacDecoder extends Decoder {
    constructor() {
        super();
        this.decoder = Flac.create_libflac_decoder(true);
        if (this.decoder) {
            let init_status = Flac.init_decoder_stream(this.decoder, this.read_callback_fn.bind(this), this.write_callback_fn.bind(this), this.error_callback_fn.bind(this), this.metadata_callback_fn.bind(this), false);
            console.log("Flac init: " + init_status);
            Flac.setOptions(this.decoder, { analyseSubframes: true, analyseResiduals: true });
        }
        this.sampleFormat = new SampleFormat();
        this.flacChunk = new ArrayBuffer(0);
        // this.pcmChunk  = new PcmChunkMessage();

        // Flac.setOptions(this.decoder, {analyseSubframes: analyse_frames, analyseResiduals: analyse_residuals});
        // flac_ok &= init_status == 0;
        // console.log("flac init     : " + flac_ok);//DEBUG
    }

    decode(chunk: PcmChunkMessage): PcmChunkMessage | null {
        // console.log("Flac decode: " + chunk.payload.byteLength);
        this.flacChunk = chunk.payload.slice(0);
        this.pcmChunk = chunk;
        this.pcmChunk!.clearPayload();
        this.cacheInfo = { cachedBlocks: 0, isCachedChunk: true };
        // console.log("Flac len: " + this.flacChunk.byteLength);
        while (this.flacChunk.byteLength && Flac.FLAC__stream_decoder_process_single(this.decoder)) {
            let state = Flac.FLAC__stream_decoder_get_state(this.decoder);
            // console.log("State: " + state);
        }
        // console.log("Pcm payload: " + this.pcmChunk!.payloadSize());
        if (this.cacheInfo.cachedBlocks > 0) {
            let diffMs = this.cacheInfo.cachedBlocks / this.sampleFormat.msRate();
            // console.log("Cached: " + this.cacheInfo.cachedBlocks + ", " + diffMs + "ms");
            this.pcmChunk!.timestamp.setMilliseconds(this.pcmChunk!.timestamp.getMilliseconds() - diffMs);
        }
        return this.pcmChunk!;
    }

    read_callback_fn(bufferSize: number): Flac.ReadResult | Flac.CompletedReadResult {
        // console.log('  decode read callback, buffer bytes max=', bufferSize);
        if (this.header) {
            console.log("  header: " + this.header.byteLength);
            let data = new Uint8Array(this.header);
            this.header = null;
            return { buffer: data, readDataLength: data.byteLength, error: false };
        } else if (this.flacChunk) {
            // console.log("  flacChunk: " + this.flacChunk.byteLength);
            // a fresh read => next call to write will not be from cached data
            this.cacheInfo.isCachedChunk = false;
            let data = new Uint8Array(this.flacChunk.slice(0, Math.min(bufferSize, this.flacChunk.byteLength)));
            this.flacChunk = this.flacChunk.slice(data.byteLength);
            return { buffer: data, readDataLength: data.byteLength, error: false };
        }
        return { buffer: new Uint8Array(0), readDataLength: 0, error: false };
    }

    write_callback_fn(data: Array<Uint8Array>, frameInfo: Flac.BlockMetadata) {
        // console.log("  write frame metadata: " + frameInfo + ", len: " + data.length);
        if (this.cacheInfo.isCachedChunk) {
            // there was no call to read, so it's some cached data
            this.cacheInfo.cachedBlocks += frameInfo.blocksize;
        }
        let payload = new ArrayBuffer((frameInfo.bitsPerSample / 8) * frameInfo.channels * frameInfo.blocksize);
        let view = new DataView(payload);
        for (let channel: number = 0; channel < frameInfo.channels; ++channel) {
            let channelData = new DataView(data[channel].buffer, 0, data[channel].buffer.byteLength);
            // console.log("channelData: " + channelData.byteLength + ", blocksize: " + frameInfo.blocksize);
            for (let i: number = 0; i < frameInfo.blocksize; ++i) {
                view.setInt16(2 * (frameInfo.channels * i + channel), channelData.getInt16(2 * i, true), true);
            }
        }
        this.pcmChunk!.addPayload(payload);
        // console.log("write: " + payload.byteLength + ", len: " + this.pcmChunk!.payloadSize());
    }

    /** @memberOf decode */
    metadata_callback_fn(data: any) {
        console.info('meta data: ', data);
        // let view = new DataView(data);
        this.sampleFormat.rate = data.sampleRate;
        this.sampleFormat.channels = data.channels;
        this.sampleFormat.bits = data.bitsPerSample;
        console.log("metadata_callback_fn, sampleformat: " + this.sampleFormat.toString());
    }

    /** @memberOf decode */
    error_callback_fn(err: any, errMsg: any) {
        console.error('decode error callback', err, errMsg);
    }

    setHeader(buffer: ArrayBuffer): SampleFormat {
        this.header = buffer.slice(0);
        Flac.FLAC__stream_decoder_process_until_end_of_metadata(this.decoder);
        return this.sampleFormat;
    }

    sampleFormat: SampleFormat;
    decoder: number;
    header: ArrayBuffer | null = null;
    flacChunk: ArrayBuffer;
    pcmChunk?: PcmChunkMessage;

    cacheInfo: { isCachedChunk: boolean, cachedBlocks: number } = { isCachedChunk: false, cachedBlocks: 0 };
}


class PcmDecoder extends Decoder {
    setHeader(buffer: ArrayBuffer): SampleFormat {
        let sampleFormat = new SampleFormat();
        let view = new DataView(buffer);
        sampleFormat.channels = view.getUint16(22, true);
        sampleFormat.rate = view.getUint32(24, true);
        sampleFormat.bits = view.getUint16(34, true);
        return sampleFormat;
    }

    decode(chunk: PcmChunkMessage): PcmChunkMessage | null {
        return chunk;
    }
}


class SnapStream {
    constructor(host: string, port: number) {
        this.streamsocket = new WebSocket('ws://' + host + ':' + port + '/stream');
        this.streamsocket.binaryType = "arraybuffer";
        this.streamsocket.onmessage = (msg) => {
            let view = new DataView(msg.data);
            let type = view.getUint16(0, true);
            if (type == 1) {
                let codec = new CodecMessage(msg.data);
                console.log("Codec: " + codec.codec);
                if (codec.codec == "flac") {
                    this.decoder = new FlacDecoder();
                } else if (codec.codec == "pcm") {
                    this.decoder = new PcmDecoder();
                } else {
                    alert("Codec not supported: " + codec.codec);
                }
                if (this.decoder) {
                    this.sampleFormat = this.decoder.setHeader(codec.payload);
                    console.log("Sampleformat: " + this.sampleFormat.toString());
                    if ((this.sampleFormat.channels != 2) || (this.sampleFormat.bits != 16)) {
                        alert("Stream must be stereo with 16 bit depth, actual format: " + this.sampleFormat.toString());
                    } else {
                        if (this.bufferDurationMs != 0) {
                            this.bufferFrameCount = Math.floor(this.bufferDurationMs * this.sampleFormat.msRate());
                        }
                        this.ctx = new AudioContext({ latencyHint: "playback", sampleRate: this.sampleFormat.rate });
                        this.timeProvider.setAudioContext(this.ctx);
                        this.gainNode = this.ctx.createGain();
                        this.gainNode.connect(this.ctx.destination);
                        this.gainNode.gain.value = this.serverSettings!.muted ? 0 : this.serverSettings!.volumePercent / 100;
                        this.timeProvider = new TimeProvider(this.ctx);
                        this.stream = new AudioStream(this.timeProvider, this.sampleFormat, this.bufferMs);
                        console.log("Base latency: " + this.ctx.baseLatency + ", output latency: " + this.ctx.outputLatency);
                        this.play();
                    }
                }
            } else if (type == 2) {
                let pcmChunk = new PcmChunkMessage(msg.data, this.sampleFormat as SampleFormat);
                let decoded = this.decoder?.decode(pcmChunk);
                if (decoded) {
                    this.stream!.addChunk(decoded);
                }
            } else if (type == 3) {
                this.serverSettings = new ServerSettingsMessage(msg.data);
                if (this.gainNode) {
                    this.gainNode.gain.value = this.serverSettings.muted ? 0 : this.serverSettings.volumePercent / 100;
                }
                this.bufferMs = this.serverSettings.bufferMs - this.serverSettings.latency;
                console.log("ServerSettings bufferMs: " + this.serverSettings.bufferMs + ", latency: " + this.serverSettings.latency + ", volume: " + this.serverSettings.volumePercent + ", muted: " + this.serverSettings.muted);
            } else if (type == 4) {
                if (this.timeProvider) {
                    let time = new TimeMessage(msg.data);
                    this.timeProvider.setDiff(time.latency.getMilliseconds(), this.timeProvider.now() - time.sent.getMilliseconds());
                }
                // console.log("Time sec: " + time.latency.sec + ", usec: " + time.latency.usec + ", diff: " + this.timeProvider.diff);
            } else {
                console.info("Message not handled, type: " + type);
            }
        }

        this.streamsocket.onopen = (ev) => {
            console.log("on open");
            let hello = new HelloMessage();

            hello.mac = "00:00:00:00:00:00";
            hello.arch = "web";
            hello.os = navigator.platform;
            hello.hostname = location.hostname;
            hello.uniqueId = getCookie("uniqueId", uuidv4());
            this.sendMessage(hello);
            this.syncTime();
            this.syncHandle = window.setInterval(() => this.syncTime(), 1000);
        }
        this.streamsocket.onerror = (ev) => { alert("error: " + ev.type); }; //this.onError(ev);
        this.streamsocket.onclose = (ev) => {
            stop();
        }
        // this.ageBuffer = new Array<number>();
        this.timeProvider = new TimeProvider();
    }


    private sendMessage(msg: BaseMessage) {
        msg.sent = new Tv(0, 0);
        msg.sent.setMilliseconds(this.timeProvider.now());
        msg.id = ++this.msgId;
        if (this.streamsocket.readyState != this.streamsocket.OPEN) {
            stop();
        } else {
            this.streamsocket.send(msg.serialize());
        }
    }

    private syncTime() {
        let t = new TimeMessage();
        t.latency.setMilliseconds(this.timeProvider.now());
        this.sendMessage(t);
        // console.log("prepareSource median: " + Math.round(this.median * 10) / 10);
    }

    private prepareSource(): AudioBufferSourceNode {
        let source = this.ctx!.createBufferSource();
        let buffer: AudioBuffer;
        // if (this.freeBuffers.length) {
        //     buffer = this.freeBuffers.pop() as AudioBuffer;
        // } else {
        buffer = this.ctx!.createBuffer(this.sampleFormat!.channels, this.bufferFrameCount, this.sampleFormat!.rate);
        // }

        let playTimeMs = (this.playTime + this.ctx!.baseLatency) * 1000 - this.bufferMs;
        // console.debug("prepareSource playTimeMs: " + playTimeMs.toFixed(2) + ", playTime: " + this.playTime.toFixed(3) + ", baseLatency: " + this.ctx!.baseLatency.toFixed(3) + ", bufferMs: " + this.bufferMs + ", now: " + this.timeProvider.now().toFixed(2) + ", server.now: " + this.timeProvider.serverNow().toFixed(2));// + ", median: " + this.median);
        // let nextBuffer = 
        this.stream!.getNextBuffer(buffer, playTimeMs);
        // if (nextBuffer.success) {
        //     let age = this.timeProvider!.serverTime(playTimeMs) - nextBuffer.chunkTime;
        //     // let age = this.timeProvider.serverTime(this.endTime) - startMs;

        //     this.ageBuffer.push(age);
        //     if (this.ageBuffer.length > 100)
        //         this.ageBuffer.shift();
        //     let sorted = [...this.ageBuffer];
        //     sorted.sort()
        //     this.median = sorted[Math.floor(sorted.length / 2)];
        // }

        source.buffer = buffer;
        source.connect(this.gainNode!);// this.ctx.destination);
        return source;
    }

    public stop() {
        window.clearInterval(this.syncHandle);
        if (this.ctx) {
            this.ctx.close();
        }
        if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(this.streamsocket.readyState)) {
            this.streamsocket.close();
        }
    }

    public play() {
        this.playTime = this.ctx!.currentTime;
        for (let i = 1; i <= this.audioBuffers; ++i) {
            this.playNext();
        }
    }

    public playNext() {
        let source = this.prepareSource();
        if (this.playTime * 1000 < this.timeProvider.now()) {
            console.log("play in: " + (this.playTime * 1000 - this.timeProvider.now()).toFixed(2));
            this.playTime = this.timeProvider.now() / 1000;
        }
        source.start(this.playTime);
        source.onended = (ev: Event) => {
            // this.endTime = window.performance.now() + (this.audioBuffers - 1) * (this.bufferSize / (this.sampleFormat as SampleFormat).rate) * 1000;
            // console.log("Perf: " + this.ctx.getOutputTimestamp().performanceTime);
            // console.log("onended: " + window.performance.now());
            // console.log("onended: " + this.ctx.currentTime * 1000);
            // this.freeBuffers.push(source.buffer as AudioBuffer);
            this.playNext();
        }
        this.playTime += this.bufferFrameCount / (this.sampleFormat as SampleFormat).rate;
    }

    streamsocket: WebSocket;
    playTime: number = 0;
    msgId: number = 0;
    bufferDurationMs: number = 0; // 0;
    bufferFrameCount: number = 3844; // 9600; // 2400;//8192;
    syncHandle: number = -1;
    // ageBuffer: Array<number>;

    timeProvider: TimeProvider;
    stream: AudioStream | undefined;
    ctx: AudioContext | undefined;
    gainNode: GainNode | undefined;
    serverSettings: ServerSettingsMessage | undefined;
    decoder: Decoder | undefined;
    sampleFormat: SampleFormat | undefined;

    // median: number = 0;
    audioBuffers: number = 3;
    bufferMs: number = 1000;
}

