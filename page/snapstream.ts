
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
        if (buffer) {
            this.deserialize(buffer);
        }
        // console.log("Type: " + this.type + " id: " + this.id + ", refers to: " + this.refersTo + ", sent: " + this.sent.sec + " " + this.sent.usec + ", size: " + this.size);
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
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 1;
    }

    deserialize(buffer: ArrayBuffer) {
        super.deserialize(buffer);
        let view = new DataView(buffer);
        let size = view.getInt32(26, true);
        let decoder = new TextDecoder("utf-8");
        this.codec = decoder.decode(buffer.slice(30, 30 + size));
        size = view.getInt32(30 + size, true);
        this.payload = buffer.slice(34 + size);
    }

    codec: string = "";
    payload: ArrayBuffer = new ArrayBuffer(0);
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
    version: string = "";
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
    constructor(buffer?: ArrayBuffer) {
        super(buffer);
        if (buffer) {
            this.deserialize(buffer);
        }
        this.type = 2;
    }

    deserialize(buffer: ArrayBuffer) {
        let view = new DataView(buffer);
        this.timestamp = new Tv(view.getInt32(26, true), view.getInt32(30, true));
        this.payloadSize = view.getUint32(34, true);
        this.payload = buffer.slice(38);//, this.payloadSize + 38));// , this.payloadSize);
        // console.log("ts: " + this.timestamp.sec + " " + this.timestamp.usec + ", payload: " + this.payloadSize + ", len: " + this.payload.byteLength);
    }

    readFrames(frames: number): ArrayBuffer {
        let frameCnt = frames;
        if (this.idx + frames > this.payloadSize / 4)
            frameCnt = (this.payloadSize / 4) - this.idx;
        let begin = this.idx * 4;
        this.idx += frameCnt;
        let end = begin + frameCnt * 4;
        // console.log("readFrames: " + frames + ", result: " + frameCnt + ", begin: " + begin + ", end: " + end + ", payload: " + this.payload.byteLength);
        return this.payload.slice(begin, end);
    }

    getFrameCount(): number {
        return (this.payloadSize / 4);
    }

    isEndOfChunk(): boolean {
        return this.idx >= this.getFrameCount();
    }

    start(): number {
        return this.timestamp.getMilliseconds() + 1000 * (this.idx / 48000);
    }

    timestamp: Tv = new Tv(0, 0);
    payloadSize: number = 0;
    payload: ArrayBuffer = new ArrayBuffer(0);
    idx: number = 0;
}


class AudioStream {
    constructor(timeProvider: TimeProvider) {
        this.timeProvider = timeProvider;
    }

    chunks: Array<PcmChunkMessage> = new Array<PcmChunkMessage>();

    setVolume(percent: number, muted: boolean) {
        let base = 10;
        this.volume = (Math.pow(base, percent / 100) - 1) / (base - 1);
        console.log("setVolume: " + percent + " => " + this.volume + ", muted: " + this.muted);
        this.muted = muted;
    }

    addChunk(chunk: PcmChunkMessage) {
        this.chunks.push(chunk);
        // console.log("chunks: " + this.chunks.length);

        while (this.chunks.length > 0) {
            let age = this.timeProvider.serverNow() - this.chunks[0].timestamp.getMilliseconds();
            // todo: consider buffer ms
            if (age > 1500) {
                this.chunks.shift();
                // console.log("Dropping old chunk: " + age + ", left: " + this.chunks.length);
            }
            else
                break;
        }
    }

    getNextBuffer(buffer: AudioBuffer, playTimeMs: number): number {
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
        let startMs: number = 0;
        if (this.chunk) {
            startMs = this.chunk.start();
            while (read < frames) {
                let pcmChunk = this.chunk as PcmChunkMessage;
                let pcmBuffer = pcmChunk.readFrames(frames - read);
                let payload = new Int16Array(pcmBuffer);
                // console.log("readFrames: " + (frames - read) + ", read: " + pcmBuffer.byteLength + ", payload: " + payload.length);
                read += (pcmBuffer.byteLength / 4);
                for (let i = 0; i < payload.length; i += 2) {
                    left[pos] = (payload[i] / 32768) * volume;
                    right[pos] = (payload[i + 1] / 32768) * volume;
                    pos++;
                }
                if (pcmChunk.isEndOfChunk()) {
                    this.chunk = this.chunks.shift();
                    if (this.chunk) {
                        let age = this.timeProvider.serverNow() - (this.chunk as PcmChunkMessage).timestamp.getMilliseconds();
                        // console.log("Age: " + age + ", server now: " + this.timeProvider.serverNow() + ", chunk: " + (this.chunk as PcmChunkMessage).timestamp.getMilliseconds());
                    }
                }
            }
        }
        if (read < frames) {
            console.log("Failed to get chunk");
            left.fill(0, pos);
            right.fill(0, pos);
        }

        buffer.copyToChannel(left, 0, 0);
        buffer.copyToChannel(right, 1, 0);
        return startMs;
    }

    chunk?: PcmChunkMessage = undefined;
    volume: number = 1;
    muted: boolean = false;
    timeProvider: TimeProvider;
}


class TimeProvider {
    constructor(ctx: AudioContext) {
        this.ctx = ctx;
    }

    setDiff(c2s: number, s2c: number) {
        if (this.now() == 0)
            this.diffBuffer.length = 0;
        if (this.diffBuffer.push((c2s - s2c) / 2) > 100)
            this.diffBuffer.shift();
        let sorted = [...this.diffBuffer];
        sorted.sort()
        this.diff = sorted[Math.floor(sorted.length / 2)];
        console.log("c2s: " + c2s + ", s2c: " + s2c + ", diff: " + this.diff + ", now: " + this.now() + ", win.now: " + window.performance.now());
    }

    now() {
        return this.ctx.currentTime * 1000;
        // return window.performance.now();
    }

    serverNow() {
        return this.serverTime(this.now());
    }

    serverTime(localTimeMs: number) {
        return localTimeMs + this.diff;
    }

    diffBuffer: Array<number> = new Array<number>();
    diff: number = 0;
    ctx: AudioContext;
}

class Decoder {
}

class PcmDecoder extends Decoder {
}


class SnapStream {
    constructor(host: string, port: number) {
        this.streamsocket = new WebSocket('ws://' + host + ':' + port + '/stream');
        this.streamsocket.binaryType = "arraybuffer";
        this.streamsocket.onmessage = (msg) => {
            let view = new DataView(msg.data);
            let type = view.getUint16(0, true);
            if (type == 1) {
                // todo: decoder, extract sampleformat
                let codec = new CodecMessage(msg.data);
                console.log("Codec: " + codec.codec);
                this.play();
            } else if (type == 2) {
                let pcmChunk = new PcmChunkMessage(msg.data);
                this.stream.addChunk(pcmChunk);
            } else if (type == 3) {
                let serverSettings = new JsonMessage(msg.data);
                let json = serverSettings.json;
                this.stream.setVolume(json["volume"] as number, json["muted"] as boolean);
                console.log("json: " + JSON.stringify(json) + ", bufferMs: " + json["bufferMs"] + ", latency: " + json["latency"] + ", volume: " + json["volume"] + ", muted: " + json["muted"]);
            } else if (type == 4) {
                let time = new TimeMessage(msg.data);
                this.timeProvider.setDiff(time.latency.getMilliseconds(), this.timeProvider.now() - time.sent.getMilliseconds());
                // console.log("Time sec: " + time.latency.sec + ", usec: " + time.latency.usec + ", diff: " + this.timeProvider.diff);
            } else {
                console.log("onmessage: " + type);
            }
        }

        this.streamsocket.onopen = (ev) => {
            console.log("on open");
            let hello = new HelloMessage();
            hello.arch = "web";
            // let loc = new Location();
            hello.hostname = location.hostname; // "T405";
            hello.uniqueId = "1234";
            this.sendMessage(hello);
            this.syncTime();
            this.syncHandle = window.setInterval(() => this.syncTime(), 1000);
        }
        this.streamsocket.onerror = (ev) => { alert("error: " + ev.type); }; //this.onError(ev);
        this.ageBuffer = new Array<number>();
        this.ctx = new AudioContext();
        this.timeProvider = new TimeProvider(this.ctx);
        this.stream = new AudioStream(this.timeProvider);
    }


    private sendMessage(msg: BaseMessage) {
        msg.sent = new Tv(0, 0);
        msg.sent.setMilliseconds(this.timeProvider.now());
        msg.id = ++this.msgId;
        this.streamsocket.send(msg.serialize());
    }

    private syncTime() {
        let t = new TimeMessage();
        t.latency.setMilliseconds(this.timeProvider.now());
        this.sendMessage(t);
    }

    private prepareSource(): AudioBufferSourceNode {
        let source = this.ctx.createBufferSource();
        let buffer: AudioBuffer;
        // if (this.freeBuffers.length) {
        //     buffer = this.freeBuffers.pop() as AudioBuffer;
        // } else {
        buffer = this.ctx.createBuffer(2, this.bufferSize, 48000);
        // }
        let startMs = this.stream.getNextBuffer(buffer, this.playTime * 1000);
        let age = this.timeProvider.serverTime(this.playTime * 1000) - startMs;
        // this.ageBuffer.push(age);
        // if (this.ageBuffer.length > 200)
        //     this.ageBuffer.shift();
        // let sorted = [...this.ageBuffer];
        // sorted.sort()
        // let median = sorted[Math.floor(sorted.length / 2)];
        console.log("prepareSource age: " + age); // + ", median: " + median);
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        return source;
    }

    public stop() {
        window.clearInterval(this.syncHandle);
        this.ctx.close();
        this.streamsocket.close();
    }

    public play() {
        this.playTime = this.ctx.currentTime;
        this.playNext();
        this.playNext();
    }

    public playNext() {
        let source = this.prepareSource();
        source.start(this.playTime);
        source.onended = (ev: Event) => {
            // console.log("onended: " + this.ctx.currentTime * 1000);
            // this.freeBuffers.push(source.buffer as AudioBuffer);
            this.playNext();
        }
        this.playTime += this.bufferSize / 48000;
    }

    streamsocket: WebSocket;
    stream: AudioStream;
    ctx: AudioContext;
    playTime: number = 0;
    msgId: number = 0;
    bufferSize: number = 2400; // 9600; // 2400;//8192;
    timeProvider: TimeProvider;
    syncHandle: number = -1;
    ageBuffer: Array<number>;
}


