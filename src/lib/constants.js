// Media recording and capture constraints
export const MEDIA_CONSTRAINTS = {
  MAX_FILE_BYTES: 250 * 1024 * 1024,
  MAX_RECORDING_SECONDS: 3600,
  MAX_RECORDING_MILLI_BUFFER: 2 * 1024 * 1024,
  DEFAULT_VIDEO_BITRATE: 1500000,
  DEFAULT_AUDIO_BITRATE: 128000,
  DEFAULT_CANVAS_FPS: 30,
  MAX_EDGE_LENGTH: 2000,
  MAX_SOURCE_IMAGE_BYTES: 30 * 1024 * 1024,
};

// Mime types for recording fallbacks
export const MIME_TYPES = {
  VIDEO: ['video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc3.42001e,mp4a.40.2', 'video/mp4', 'video/webm'],
  AUDIO: ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'],
};

// Component status states
export const CAPTURE_STATUS = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  CONNECTING: 'connecting',
  READY: 'ready',
  RECORDING: 'recording',
  PAUSED: 'paused',
  CAPTURING: 'capturing',
  REVIEW: 'review',
  UPLOADING: 'uploading',
  ERROR: 'error',
};

export const ASYNC_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

export const NOTE_VIEW_TYPES = [
  { key: 'masonry', label: 'Grid' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'calendar', label: 'Calendar' },
];

export const NOTE_SORT_TYPES = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'longest', label: 'Longest first' },
];

export const NOTE_TEXT_PREVIEW_CLAMP = 700;
