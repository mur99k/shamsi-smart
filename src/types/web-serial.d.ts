interface TextDecoderStream {
  readable: ReadableStream<string>;
  writable: WritableStream<Uint8Array>;
}

declare const TextDecoderStream: {
  new (): TextDecoderStream;
};
