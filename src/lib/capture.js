export function createVideoRecordingStream(video, audioTracks) {
  const canvas = document.createElement('canvas');
  if (!canvas.captureStream) return null;
  if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is still warming up. Try again in a moment.');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the video recording.');

  function draw() {
    // Keep the last frame while the next camera opens, without changing recorder tracks.
    if (video.readyState < 2 || !video.srcObject?.getVideoTracks().some((track) => track.readyState === 'live')) return;
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }

  draw();
  const stream = canvas.captureStream(30);
  for (const track of audioTracks) stream.addTrack(track);
  const timer = setInterval(draw, 1000 / 30);
  return {
    stream,
    stop() {
      clearInterval(timer);
      stream.getVideoTracks().forEach((track) => track.stop());
    },
  };
}
