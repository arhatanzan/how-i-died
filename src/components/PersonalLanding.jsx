import { useState } from 'react';
import LandingDrawing from './LandingDrawing';

const LETTERS = {
  A: 'M4 153L48 9Q51 2 55 10L99 154L88 155L76 112L29 113L15 156ZM33 101L73 100L52 28Z',
  R: 'M8 155L10 8Q53 3 80 20Q101 33 91 61Q86 78 64 84L99 152L87 156L53 88L22 89L20 155ZM22 20L22 77Q57 78 75 65Q88 55 81 37Q73 18 22 20Z',
  H: 'M8 9L20 8L22 73L79 71L80 8L92 10L91 154L79 155L79 84L22 86L24 155L12 156Z',
  T: 'M2 9L102 7L103 19L59 21L61 155L47 156L46 21L3 23Z',
  N: 'M8 155L10 8L22 8L82 128L80 9L92 9L95 154L82 156L22 35L21 156Z',
  Z: 'M6 9L96 7L97 20L21 143L98 140L99 153L6 157L5 143L81 21L7 23Z',
};

const NAME = [
  ['A', 0, -2], ['R', 110, 1], ['H', 220, -1], ['A', 330, 2], ['T', 440, -1],
  ['A', 600, 1], ['N', 710, -2], ['Z', 820, 1], ['A', 930, -1], ['N', 1040, 1],
];

export default function PersonalLanding() {
  const [paused, setPaused] = useState(false);
  return (
    <section className={`personal-landing ${paused ? 'motion-paused' : ''}`} aria-labelledby="personal-name">
      <h1 id="personal-name" className="personal-name">
        <span className="sr-only">Arhat Anzan · ارحت انزن</span>
        <span className="personal-name-urdu" lang="ur" dir="rtl" aria-hidden="true">
          <span>ارحت</span>{' '}<span>انزن</span>
        </span>
        <svg className="personal-name-latin" viewBox="-16 -18 1175 200" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {NAME.map(([letter, x, angle], index) => (
              <g key={index} transform={`translate(${x} 5) rotate(${angle} 50 80)`}>
                <g className="name-letter" style={{ animationDelay: `${index * -0.13}s` }}>
                  <path d={LETTERS[letter]} />
                  <path className="name-pencil-echo" d={LETTERS[letter]} transform="translate(2 -1)" />
                </g>
              </g>
            ))}
          </g>
        </svg>
        <svg className="name-flourishes" viewBox="0 0 1200 330" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M66 107Q33 87 49 58M89 123L62 130M1046 46Q1066 23 1055 10M1104 120L1130 111M468 12L450 0M737 307Q763 316 780 301" />
          </g>
        </svg>
      </h1>
      <div className="personal-caption">
        <span>How I Died</span>
        <span>A journal for being alive.</span>
      </div>
      <LandingDrawing />
      <div className="landing-bottom">
        <a className="personal-enter" href="/#journal-archive">
          A few things worth keeping <span aria-hidden="true">↓</span>
        </a>
        <button className="motion-toggle" type="button" aria-pressed={paused} onClick={() => setPaused((current) => !current)}>
          {paused ? 'Let it move' : 'Still the page'}
        </button>
      </div>
    </section>
  );
}
