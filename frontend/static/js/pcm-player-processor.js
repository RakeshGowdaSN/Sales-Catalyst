// In frontend/static/js/pcm-player-processor.js


class PCMPlayerProcessor extends AudioWorkletProcessor {
   constructor() {
     super();
      // Init buffer
     this.bufferSize = 24000 * 180;  // 24kHz x 180 seconds
     this.buffer = new Float32Array(this.bufferSize);
     this.writeIndex = 0;
     this.readIndex = 0;
      // Handle incoming messages from main thread
     this.port.onmessage = (event) => {


       // ▼▼▼ MODIFY THIS 'IF' CONDITION ▼▼▼
       // Reset the buffer if an 'endOfAudio' or 'clear' command is received.
       if (event.data.command === 'endOfAudio' || event.data.command === 'clear') {
         this.readIndex = this.writeIndex; // This effectively clears the buffer for playback.
         console.log(`Command received: '${event.data.command}'. Clearing audio buffer.`);
         return;
       }
       // ▲▲▲ END OF MODIFIED BLOCK ▲▲▲
        // Decode the base64 data to int16 array.
       const int16Samples = new Int16Array(event.data);
        // Add the audio data to the buffer
       this._enqueue(int16Samples);
     };
   }
    // ... the rest of your _enqueue and process methods remain exactly the same ...
   // Push incoming Int16 data into our ring buffer.
   _enqueue(int16Samples) {
     for (let i = 0; i < int16Samples.length; i++) {
       // Convert 16-bit integer to float in [-1, 1]
       const floatVal = int16Samples[i] / 32768;
        // Store in ring buffer for left channel only (mono)
       this.buffer[this.writeIndex] = floatVal;
       this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
        // Overflow handling (overwrite oldest samples)
       if (this.writeIndex === this.readIndex) {
         this.readIndex = (this.readIndex + 1) % this.bufferSize;
       }
     }
   }
    // The system calls `process()` ~128 samples at a time (depending on the browser).
   // We fill the output buffers from our ring buffer.
   process(inputs, outputs, parameters) {
      // Write a frame to the output
     const output = outputs[0];
     const framesPerBlock = output[0].length;
     for (let frame = 0; frame < framesPerBlock; frame++) {
        // Write the sample(s) into the output buffer
       output[0][frame] = this.buffer[this.readIndex]; // left channel
       if (output.length > 1) {
         output[1][frame] = this.buffer[this.readIndex]; // right channel
       }
        // Move the read index forward unless underflowing
       if (this.readIndex != this.writeIndex) {
         this.readIndex = (this.readIndex + 1) % this.bufferSize;
       }
     }
      // Returning true tells the system to keep the processor alive
     return true;
   }
 }
  registerProcessor('pcm-player-processor', PCMPlayerProcessor);
