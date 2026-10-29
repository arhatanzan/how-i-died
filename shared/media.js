export const MEDIA_PREFIX = '/api/media/';
export const CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_BYTES = 250 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 10 * 60;

const FORMATS = {
  jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'],
  png: ['image', 'image/png'], webp: ['image', 'image/webp'], gif: ['image', 'image/gif'],
  mp3: ['audio', 'audio/mpeg'], m4a: ['audio', 'audio/mp4'],
  wav: ['audio', 'audio/wav'], ogg: ['audio', 'audio/ogg'], oga: ['audio', 'audio/ogg'],
  flac: ['audio', 'audio/flac'], aac: ['audio', 'audio/aac'],
  mp4: ['video', 'video/mp4'], m4v: ['video', 'video/mp4'],
  mov: ['video', 'video/quicktime'], webm: ['video', 'video/webm'],
  pdf: ['file', 'application/pdf'], svg: ['file', 'image/svg+xml'],
  doc: ['file', 'application/msword'],
  docx: ['file', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['file', 'application/vnd.ms-excel'],
  xlsx: ['file', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['file', 'application/vnd.ms-powerpoint'],
  pptx: ['file', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odt: ['file', 'application/vnd.oasis.opendocument.text'],
  ods: ['file', 'application/vnd.oasis.opendocument.spreadsheet'],
  odp: ['file', 'application/vnd.oasis.opendocument.presentation'],
  txt: ['file', 'text/plain'], md: ['file', 'text/plain'],
  csv: ['file', 'text/csv'], tsv: ['file', 'text/tab-separated-values'],
  rtf: ['file', 'application/rtf'],
};

export const FILE_ACCEPT = Object.keys(FORMATS).map((extension) => `.${extension}`).join(',');
export const isMediaId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export function mediaId(url) {
  if (typeof url !== 'string' || !url.startsWith(MEDIA_PREFIX)) return null;
  const id = url.slice(MEDIA_PREFIX.length);
  return isMediaId(id) ? id : null;
}

export function fileMetadata(file) {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || /[/\\\u0000-\u001f\u007f]/.test(file.name)) {
    throw new Error('Use a filename of 1–200 characters without paths or control characters.');
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_FILE_BYTES) {
    throw new Error('Files must be nonempty and no larger than 250 MB.');
  }
  const extension = file.name.toLowerCase().split('.').at(-1);
  const format = FORMATS[extension];
  if (!format) throw new Error('Unsupported file format. Executables, scripts, archives, and macro-enabled Office files are not allowed.');
  let [type, contentType] = format;
  const supplied = (file.type || '').split(';')[0].trim().toLowerCase();
  if (extension === 'webm' && supplied === 'audio/webm') [type, contentType] = ['audio', 'audio/webm'];
  return { type, name: file.name.trim(), size: file.size, contentType };
}

export function formatBytes(size) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
}
