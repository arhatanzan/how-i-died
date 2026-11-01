import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoRecordingStream } from '../src/lib/capture.js';

function setup(t) {
  const calls = [];
  const videoTrack = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const microphone = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const tracks = [videoTrack];
  const output = { getVideoTracks: () => [videoTrack], getTracks: () => tracks, addTrack: (track) => tracks.push(track) };
  const canvas = {
    getContext: () => ({
      fillRect: (...args) => calls.push(['fill', ...args]),
      drawImage: (...args) => calls.push(['draw', ...args]),
    }),
    captureStream: (fps) => { assert.equal(fps, 30); return output; },
  };
  const sourceTrack = { readyState: 'live' };
  const video = { videoWidth: 1280, videoHeight: 720, readyState: 2, srcObject: { getVideoTracks: () => [sourceTrack] } };
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  let draw;
  let cleared = false;
  t.mock.method(globalThis, 'setInterval', (callback) => { draw = callback; return 123; });
  t.mock.method(globalThis, 'clearInterval', (id) => { assert.equal(id, 123); cleared = true; });
  return { canvas, video, sourceTrack, microphone, calls, output, draw: () => draw(), cleared: () => cleared };
}

test('video recording retains the same output tracks and live microphone across camera changes', (t) => {
  const fixture = setup(t);
  const recording = createVideoRecordingStream(fixture.video, [fixture.microphone]);
  const originalTracks = recording.stream.getTracks().slice();
  assert.equal(recording.stream, fixture.output);
  assert.equal(fixture.calls.length, 2);

  fixture.sourceTrack.readyState = 'ended';
  fixture.draw();
  assert.equal(fixture.calls.length, 2, 'hold the last frame while the previous camera is stopped');
  fixture.video.readyState = 0;
  fixture.draw();
  assert.equal(fixture.calls.length, 2, 'wait for camera metadata');

  fixture.video.srcObject = { getVideoTracks: () => [{ readyState: 'live' }] };
  fixture.video.readyState = 2;
  fixture.video.videoWidth = 720;
  fixture.video.videoHeight = 1280;
  fixture.draw();
  assert.equal(fixture.canvas.width, 1280);
  assert.equal(fixture.canvas.height, 720);
  assert.deepEqual(fixture.calls.at(-1), ['draw', fixture.video, 437.5, 0, 405, 720]);
  assert.deepEqual(recording.stream.getTracks(), originalTracks);
  assert.equal(fixture.microphone.readyState, 'live');

  recording.stop();
  assert.equal(fixture.cleared(), true);
  assert.equal(originalTracks[0].readyState, 'ended');
  assert.equal(fixture.microphone.readyState, 'live', 'camera output cleanup must not interrupt shared microphone audio');
});

test('unsupported canvas capture leaves native recording available', (t) => {
  const fixture = setup(t);
  delete fixture.canvas.captureStream;
  assert.equal(createVideoRecordingStream(fixture.video, [fixture.microphone]), null);
});

test('video recording explicitly rejects a camera that is not ready', (t) => {
  const fixture = setup(t);
  fixture.video.videoWidth = 0;
  assert.throws(() => createVideoRecordingStream(fixture.video, [fixture.microphone]), /warming up/);
});

test('video recording explicitly rejects an unavailable drawing context', (t) => {
  const fixture = setup(t);
  fixture.canvas.getContext = () => null;
  assert.throws(() => createVideoRecordingStream(fixture.video, [fixture.microphone]), /could not prepare/);
});
