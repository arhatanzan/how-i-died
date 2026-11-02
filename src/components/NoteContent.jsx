import { normalizeWebUrl, splitLinks } from '../../shared/attachments';

const INLINE_PATTERN = /(\*\*.+?\*\*|~~.+?~~|\+\+.+?\+\+|\*.+?\*|_.+?_|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function renderPlainText(text, keyPrefix) {
  return splitLinks(text).map((part, index) => (
    part.url
      ? <a key={`${keyPrefix}-${index}`} href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a>
      : part.text
  ));
}

function renderInline(text, keyPrefix) {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={key}>{renderInline(part.slice(2, -2), key)}</del>;
    if (part.startsWith('++') && part.endsWith('++')) return <u key={key}>{renderInline(part.slice(2, -2), key)}</u>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;

    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      const url = normalizeWebUrl(link[2]);
      if (url) return <a key={key} href={url} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    }
    return <span key={key}>{renderPlainText(part, key)}</span>;
  });
}

function getBlockType(line) {
  if (/^#{1,3}\s+/.test(line)) return 'heading';
  if (/^>\s?/.test(line)) return 'quote';
  if (/^\s*[-*]\s+/.test(line)) return 'unordered-list';
  if (/^\s*\d+\.\s+/.test(line)) return 'ordered-list';
  return 'paragraph';
}

export default function NoteContent({ text }) {
  const lines = text.split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }

    const type = getBlockType(lines[index]);
    if (type === 'unordered-list' || type === 'ordered-list') {
      const items = [];
      while (index < lines.length && getBlockType(lines[index]) === type) {
        items.push(lines[index].replace(type === 'unordered-list' ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/, ''));
        index++;
      }
      const List = type === 'unordered-list' ? 'ul' : 'ol';
      blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    if (type === 'heading') {
      const line = lines[index];
      const [, marks, content] = line.match(/^(#{1,3})\s+(.*)$/);
      const Heading = marks.length === 1 ? 'h2' : 'h3';
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(content, `heading-${index}`)}</Heading>);
      index++;
      continue;
    }

    if (type === 'quote') {
      const quotedLines = [];
      while (index < lines.length && getBlockType(lines[index]) === 'quote') {
        quotedLines.push(lines[index].replace(/^>\s?/, ''));
        index++;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {quotedLines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line, `quote-${index}-${lineIndex}`)}</span>)}
        </blockquote>
      );
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index].trim() && getBlockType(lines[index]) === 'paragraph') {
      paragraphLines.push(lines[index]);
      index++;
    }
    blocks.push(
      <p key={`paragraph-${index}`}>
        {paragraphLines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line, `paragraph-${index}-${lineIndex}`)}</span>)}
      </p>
    );
  }

  return <>{blocks}</>;
}
