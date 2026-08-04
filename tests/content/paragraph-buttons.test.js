/**
 * Property-based tests for paragraph buttons module
 *
 * Feature: elevenlabs-reader
 * Property 8: Paragraph Button Hover Behavior
 *
 * The buttons module maintains ONE floating play button appended to
 * document.body and repositions it next to whichever parsed paragraph the
 * cursor is over. The page's own DOM is never wrapped or reparented.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { JSDOM } from 'jsdom';

// Import the paragraph buttons module
import {
  injectButtons,
  removeButtons,
  getButtonCount,
  getButtons,
  BUTTON_CLASS,
  BUTTON_VISIBLE_CLASS,
  PARAGRAPH_INDEX_ATTR
} from '../../src/content/paragraph-buttons.js';

// Import text parser for creating paragraph structures
import {
  parsePageContent,
  escapeHtml
} from '../../src/content/text-parser.js';

/**
 * Helper to create a DOM document with paragraphs
 * @param {string[]} paragraphTexts - Array of paragraph text contents
 * @returns {{dom: JSDOM, document: Document}}
 */
function createDocument(paragraphTexts) {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <main>
          ${paragraphTexts.map(text => `<p>${escapeHtml(text)}</p>`).join('\n')}
        </main>
      </body>
    </html>
  `;
  const dom = new JSDOM(html);
  return { dom, document: dom.window.document };
}

/**
 * Setup global document and chrome mock for tests
 */
function setupGlobals(dom, doc) {
  global.document = doc;
  global.window = dom.window;
  global.chrome = {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({ success: true })
    }
  };
}

/**
 * Cleanup globals after tests
 */
function cleanupGlobals() {
  delete global.document;
  delete global.window;
  delete global.chrome;
}

/**
 * Dispatch a bubbling mouseover event on an element
 */
function hover(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }));
}

/**
 * Arbitrary for arrays of readable paragraph texts
 */
const paragraphArbitrary = (maxLength = 8) => fc.array(
  fc.stringOf(
    fc.char16bits().filter(c => /[a-zA-Z0-9 .,!?]/.test(c)),
    { minLength: 5, maxLength: 50 }
  ).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: maxLength }
);

describe('Paragraph Buttons Module - Property Tests', () => {

  afterEach(() => {
    removeButtons();
    cleanupGlobals();
  });

  describe('Property 8: Hover Button Behavior', () => {

    it('should create exactly one hidden button regardless of paragraph count', () => {
      fc.assert(
        fc.property(
          paragraphArbitrary(10),
          (paragraphTexts) => {
            const { dom, document: doc } = createDocument(paragraphTexts);
            setupGlobals(dom, doc);

            const parsed = parsePageContent(doc);
            const buttons = injectButtons(parsed.paragraphs);

            const oneButton = getButtonCount() === 1 && buttons.length === 1;
            const inBody = buttons[0].parentElement === doc.body;
            const hiddenInitially = !buttons[0].classList.contains(BUTTON_VISIBLE_CLASS);

            removeButtons();

            return oneButton && inBody && hiddenInitially;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never wrap or reparent the page paragraphs', () => {
      fc.assert(
        fc.property(
          paragraphArbitrary(8),
          (paragraphTexts) => {
            const { dom, document: doc } = createDocument(paragraphTexts);
            setupGlobals(dom, doc);

            const parsed = parsePageContent(doc);
            const parentsBefore = parsed.paragraphs.map(p => p.element.parentElement);
            const htmlBefore = parsed.paragraphs.map(p => p.element.outerHTML);

            injectButtons(parsed.paragraphs);
            // Hover each paragraph to exercise the show/position path
            for (const p of parsed.paragraphs) {
              hover(dom, p.element);
            }

            const parentsUnchanged = parsed.paragraphs.every(
              (p, i) => p.element.parentElement === parentsBefore[i]
            );
            const htmlUnchanged = parsed.paragraphs.every(
              (p, i) => p.element.outerHTML === htmlBefore[i]
            );

            removeButtons();

            return parentsUnchanged && htmlUnchanged;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should point the button at the hovered paragraph with a matching index and label', () => {
      fc.assert(
        fc.property(
          paragraphArbitrary(8),
          (paragraphTexts) => {
            const { dom, document: doc } = createDocument(paragraphTexts);
            setupGlobals(dom, doc);

            const parsed = parsePageContent(doc);
            injectButtons(parsed.paragraphs);
            const [button] = getButtons();

            let allCorrect = true;
            for (let i = 0; i < parsed.paragraphs.length; i++) {
              hover(dom, parsed.paragraphs[i].element);

              const visible = button.classList.contains(BUTTON_VISIBLE_CLASS);
              const index = parseInt(button.getAttribute(PARAGRAPH_INDEX_ATTR), 10);
              const label = button.getAttribute('aria-label');

              if (!visible || index !== i || label !== `Play paragraph ${i + 1}`) {
                allCorrect = false;
                break;
              }
            }

            removeButtons();

            return allCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should follow hovers on nested elements inside a paragraph', () => {
      const { dom, document: doc } = createDocument(['Some text with markup.']);
      setupGlobals(dom, doc);

      // Add an inline element inside the paragraph after parsing
      const parsed = parsePageContent(doc);
      const inner = doc.createElement('em');
      inner.textContent = 'nested';
      parsed.paragraphs[0].element.appendChild(inner);

      injectButtons(parsed.paragraphs);
      const [button] = getButtons();

      hover(dom, inner);

      expect(button.classList.contains(BUTTON_VISIBLE_CLASS)).toBe(true);
      expect(button.getAttribute(PARAGRAPH_INDEX_ATTR)).toBe('0');
    });

    it('should handle empty paragraph array', () => {
      const { dom, document: doc } = createDocument([]);
      setupGlobals(dom, doc);

      const buttons = injectButtons([]);

      expect(buttons.length).toBe(0);
      expect(getButtonCount()).toBe(0);
      expect(doc.querySelectorAll(`.${BUTTON_CLASS}`).length).toBe(0);
    });

    it('should remove the button and stop reacting to hovers after removeButtons', () => {
      fc.assert(
        fc.property(
          paragraphArbitrary(6),
          (paragraphTexts) => {
            const { dom, document: doc } = createDocument(paragraphTexts);
            setupGlobals(dom, doc);

            const parsed = parsePageContent(doc);
            injectButtons(parsed.paragraphs);
            const countBefore = getButtonCount();

            removeButtons();

            const countAfter = getButtonCount();
            const buttonsInDom = doc.querySelectorAll(`.${BUTTON_CLASS}`).length;

            // Hovering after removal must not throw or resurrect the button
            hover(dom, parsed.paragraphs[0].element);
            const stillGone = doc.querySelectorAll(`.${BUTTON_CLASS}`).length === 0;

            return countBefore === 1 && countAfter === 0 &&
                   buttonsInDom === 0 && stillGone;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Button Properties', () => {

    it('should create the button with correct accessibility attributes and class', () => {
      const { dom, document: doc } = createDocument(['First paragraph.', 'Second paragraph.']);
      setupGlobals(dom, doc);

      const parsed = parsePageContent(doc);
      injectButtons(parsed.paragraphs);
      const [button] = getButtons();

      expect(button.classList.contains(BUTTON_CLASS)).toBe(true);
      expect(button.getAttribute('type')).toBe('button');
      expect(button.hasAttribute('aria-label')).toBe(true);
      expect(button.hasAttribute('title')).toBe(true);
    });

    it('should send JUMP_TO_PARAGRAPH with the hovered paragraph index and text on click', async () => {
      const { dom, document: doc } = createDocument(['First paragraph.', 'Second paragraph here.']);
      setupGlobals(dom, doc);

      const parsed = parsePageContent(doc);
      injectButtons(parsed.paragraphs);
      const [button] = getButtons();

      hover(dom, parsed.paragraphs[1].element);
      button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

      // Click handler is async; let it settle
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      const message = global.chrome.runtime.sendMessage.mock.calls[0][0];
      expect(message.type).toBe('jumpToParagraph');
      expect(message.payload.paragraphIndex).toBe(1);
      expect(message.payload.text).toBe(
        parsed.paragraphs[1].sentences.map(s => s.text).join(' ')
      );
    });
  });
});
