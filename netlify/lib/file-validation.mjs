export function validateFileHeader(metadata, data) {
  const bytes = new Uint8Array(data);
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (offset, value) => [...value].every((letter, index) => bytes[offset + index] === letter.charCodeAt(0));
  if (ascii(0, 'MZ') || starts(0x7f, 0x45, 0x4c, 0x46) || ascii(0, 'dex\n')) throw new Error('Executables and application packages cannot be attached.');
  const type = metadata.contentType;
  const valid = {
    'image/jpeg': () => starts(0xff, 0xd8, 0xff),
    'image/png': () => starts(137, 80, 78, 71, 13, 10, 26, 10),
    'image/gif': () => ascii(0, 'GIF87a') || ascii(0, 'GIF89a'),
    'image/webp': () => ascii(0, 'RIFF') && ascii(8, 'WEBP'),
    'video/webm': () => starts(0x1a, 0x45, 0xdf, 0xa3),
    'audio/webm': () => starts(0x1a, 0x45, 0xdf, 0xa3),
    'video/mp4': () => ascii(4, 'ftyp'),
    'audio/mp4': () => ascii(4, 'ftyp'),
    'video/quicktime': () => ['ftyp', 'moov', 'mdat', 'wide'].some((atom) => ascii(4, atom)),
    'audio/ogg': () => ascii(0, 'OggS'),
    'audio/wav': () => ascii(0, 'RIFF') && ascii(8, 'WAVE'),
    'audio/flac': () => ascii(0, 'fLaC'),
    'audio/aac': () => bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0,
    'audio/mpeg': () => ascii(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
    'application/pdf': () => ascii(0, '%PDF-'),
    'application/rtf': () => ascii(0, '{\\rtf'),
    'application/msword': () => starts(0xd0, 0xcf, 0x11, 0xe0),
    'application/vnd.ms-excel': () => starts(0xd0, 0xcf, 0x11, 0xe0),
    'application/vnd.ms-powerpoint': () => starts(0xd0, 0xcf, 0x11, 0xe0),
  }[type];
  if (valid && !valid()) throw new Error('The file contents do not match its format.');
  const officePackage = type.startsWith('application/vnd.openxmlformats-') || type.startsWith('application/vnd.oasis.opendocument.');
  if (officePackage && !ascii(0, 'PK\u0003\u0004')) throw new Error('This is not a valid Office or OpenDocument container.');
  if (!officePackage && ascii(0, 'PK\u0003\u0004')) throw new Error('Archives and application packages cannot be attached.');
}

export async function readFilePart(req, limit) {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array().buffer;
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('File part is too large.'); }
    parts.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result.buffer;
}
