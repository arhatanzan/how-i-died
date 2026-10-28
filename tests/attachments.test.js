import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAttachments, getEmbed, hasNoteContent, isImageUrl, MAX_ATTACHMENTS,
  normalizeWebUrl, splitLinks, validateAttachments,
} from '../shared/attachments.js';

test('only complete HTTP(S) links without credentials are allowed', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.org', 'https://user:password@example.org', 'not a url', null, 'https://example.org/' + 'a'.repeat(2048)]) {
    assert.equal(normalizeWebUrl(url), null);
  }
  assert.equal(normalizeWebUrl(' https://example.org/a?q=1 '), 'https://example.org/a?q=1');
  assert.equal(normalizeWebUrl('http://example.org'), 'http://example.org/');
});

test('legacy images remain available, but an explicitly cleared attachment list wins', () => {
  assert.deepEqual(getAttachments({ imageUrl: 'https://example.org/photo.png' }), [{ type: 'image', url: 'https://example.org/photo.png', alt: '' }]);
  assert.deepEqual(getAttachments({ imageUrl: 'https://example.org/old.png', attachments: [] }), []);
  assert.equal(hasNoteContent({ text: '  ', attachments: [{ type: 'link', url: 'https://example.org' }] }), true);
  assert.equal(hasNoteContent({ text: '  ', attachments: [] }), false);
});

test('attachment validation rejects excess, unsafe URLs and oversized labels', () => {
  const image = { type: 'image', url: '/api/images/12345678-1234-1234-1234-123456789abc', alt: ' A photo ' };
  assert.equal(isImageUrl(image.url), true);
  assert.equal(isImageUrl('/api/images/../../private'), false);
  assert.deepEqual(validateAttachments([image]), [{ ...image, alt: 'A photo' }]);
  assert.equal(validateAttachments(Array(MAX_ATTACHMENTS).fill(image)).length, MAX_ATTACHMENTS);
  for (const attachments of [null, Array(MAX_ATTACHMENTS + 1).fill(image), [{ type: 'iframe', url: 'https://example.org' }], [{ type: 'link', url: 'javascript:alert(1)' }], [{ ...image, alt: 'a'.repeat(501) }], [{ type: 'link', url: 'https://example.org', title: 'a'.repeat(201) }]]) {
    assert.throws(() => validateAttachments(attachments));
  }
});

test('YouTube watch, short, live and share links use the privacy-enhanced embed origin', () => {
  for (const url of ['https://youtube.com/watch?v=abcdefghijk&t=32', 'https://youtu.be/abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk', 'https://m.youtube.com/live/abcdefghijk']) {
    assert.deepEqual(getEmbed(url), { provider: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/abcdefghijk', kind: 'video' });
  }
});

test('Vimeo, Spotify and SoundCloud embeds use fixed provider URLs', () => {
  assert.equal(getEmbed('https://vimeo.com/123456789').src, 'https://player.vimeo.com/video/123456789?dnt=1');
  assert.equal(getEmbed('https://vimeo.com/123456789/abcdef1234').src, 'https://player.vimeo.com/video/123456789?dnt=1&h=abcdef1234');
  assert.equal(getEmbed('https://open.spotify.com/intl-en/track/1234567890123456789012').src, 'https://open.spotify.com/embed/track/1234567890123456789012');
  assert.match(getEmbed('https://soundcloud.com/artist/song').src, /^https:\/\/w\.soundcloud\.com\/player\/\?url=/);
});

test('spoofed providers, arbitrary HTML, and malformed IDs never become iframes', () => {
  for (const url of ['https://youtube.com.evil.example/watch?v=dQw4w9WgXc', 'https://example.org', 'https://youtube.com/watch?v=bad', 'https://vimeo.com/script', 'https://open.spotify.com/user/1234567890123456789012', '<iframe src="https://youtube.com">', 'javascript:alert(1)']) {
    assert.equal(getEmbed(url), null);
  }
});

test('inline links preserve surrounding text and are not interpreted as HTML', () => {
  assert.deepEqual(splitLinks('See https://example.org/page. Then https://example.net!'), [
    { text: 'See ' }, { text: 'https://example.org/page', url: 'https://example.org/page' }, { text: '.' },
    { text: ' Then ' }, { text: 'https://example.net', url: 'https://example.net/' }, { text: '!' },
  ]);
  assert.deepEqual(splitLinks('<script>hello</script>'), [{ text: '<script>hello</script>' }]);
});
