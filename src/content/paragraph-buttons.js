// ElevenPage Reader - Paragraph Buttons
// Shows a single floating play button next to the paragraph under the cursor.
// The button is one element appended to document.body and repositioned on
// hover — nothing in the page's own DOM is wrapped, reparented, or rewritten.

import { MessageType } from '../shared/constants.js';

/**
 * CSS class for the hover play button
 */
const BUTTON_CLASS = 'elevenlabs-paragraph-button';

/**
 * CSS class that makes the hover button visible
 */
const BUTTON_VISIBLE_CLASS = 'elevenlabs-paragraph-button-visible';

/**
 * Data attribute for the paragraph index the button currently targets
 */
const PARAGRAPH_INDEX_ATTR = 'data-paragraph-index';

/**
 * Delay before hiding the button after the cursor leaves a paragraph,
 * long enough to move the cursor onto the button itself
 */
const HIDE_DELAY_MS = 300;

/**
 * The single floating button element (null when not injected)
 */
let hoverButton = null;

/**
 * Reference to paragraphs data for click handlers
 */
let paragraphsData = null;

/**
 * Maps paragraph elements to their index for fast hover lookup
 */
let paragraphIndexMap = null;

/**
 * Pending hide timer ID
 */
let hideTimer = null;

/**
 * Creates the floating play button element
 * @returns {HTMLButtonElement} The button element
 */
function createButton() {
  const button = document.createElement('button');
  button.className = BUTTON_CLASS;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', 'Play paragraph');
  button.setAttribute('title', 'Play from here');

  // Play icon (SVG)
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `;

  return button;
}

/**
 * Handles button click - sends message to service worker
 * @param {Event} event - Click event
 */
async function handleButtonClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const paragraphIndex = parseInt(button.getAttribute(PARAGRAPH_INDEX_ATTR), 10);

  if (isNaN(paragraphIndex) || !paragraphsData || !paragraphsData[paragraphIndex]) {
    console.error('ElevenPage Reader: Invalid paragraph index');
    return;
  }

  const paragraph = paragraphsData[paragraphIndex];

  // Get the text content of the paragraph
  const text = paragraph.sentences.map(s => s.text).join(' ');

  if (!text || text.trim().length === 0) {
    console.error('ElevenPage Reader: No text content in paragraph');
    return;
  }

  try {
    // Send message to service worker to jump to this paragraph
    const response = await chrome.runtime.sendMessage({
      type: MessageType.JUMP_TO_PARAGRAPH,
      payload: {
        paragraphIndex,
        text
      }
    });

    if (!response.success) {
      console.error('ElevenPage Reader: Failed to start playback:', response.error);
    }
  } catch (error) {
    console.error('ElevenPage Reader: Error sending message:', error);
  }
}

/**
 * Positions the button to the left of a paragraph, vertically centered on
 * its first line area
 * @param {HTMLElement} element - Paragraph element being hovered
 */
function positionButton(element) {
  const win = element.ownerDocument.defaultView;
  const rect = element.getBoundingClientRect();
  const scrollX = win ? win.scrollX || 0 : 0;
  const scrollY = win ? win.scrollY || 0 : 0;

  hoverButton.style.left = `${Math.max(rect.left + scrollX - 32, 4)}px`;
  hoverButton.style.top = `${rect.top + scrollY + Math.min(rect.height / 2, 12) - 12}px`;
}

/**
 * Shows the button next to a paragraph and points it at that index
 * @param {HTMLElement} element - Paragraph element
 * @param {number} index - Paragraph index
 */
function showButtonFor(element, index) {
  if (!hoverButton) return;

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  hoverButton.setAttribute(PARAGRAPH_INDEX_ATTR, String(index));
  hoverButton.setAttribute('aria-label', `Play paragraph ${index + 1}`);
  positionButton(element);
  hoverButton.classList.add(BUTTON_VISIBLE_CLASS);
}

/**
 * Hides the button after a short delay (cancelled if the cursor reaches the
 * button or another paragraph first)
 */
function scheduleHide() {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  hideTimer = setTimeout(() => {
    hideTimer = null;
    hideButtonNow();
  }, HIDE_DELAY_MS);
}

/**
 * Hides the button immediately
 */
function hideButtonNow() {
  if (hoverButton) {
    hoverButton.classList.remove(BUTTON_VISIBLE_CLASS);
  }
}

/**
 * Delegated hover handler - shows the button when the cursor is over a
 * parsed paragraph, hides it otherwise
 * @param {Event} event - mouseover event
 */
function handleMouseOver(event) {
  if (!hoverButton || !paragraphIndexMap) return;

  // Moving onto the button itself keeps it visible
  if (event.target === hoverButton || hoverButton.contains(event.target)) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    return;
  }

  // Walk up from the hovered node to find a parsed paragraph
  let el = event.target;
  while (el && el.nodeType === 1) {
    if (paragraphIndexMap.has(el)) {
      showButtonFor(el, paragraphIndexMap.get(el));
      return;
    }
    el = el.parentElement;
  }

  scheduleHide();
}

/**
 * Sets up the hover play button for the parsed paragraphs
 * @param {Array} paragraphs - Array of paragraph objects from text parser
 * @returns {HTMLButtonElement[]} The injected button (single-element array)
 */
function injectButtons(paragraphs) {
  if (!paragraphs || !Array.isArray(paragraphs)) {
    return [];
  }

  // Clean up any existing button first
  removeButtons();

  if (paragraphs.length === 0) {
    return [];
  }

  paragraphsData = paragraphs;
  paragraphIndexMap = new WeakMap();
  paragraphs.forEach((paragraph, index) => {
    if (paragraph && paragraph.element) {
      paragraphIndexMap.set(paragraph.element, index);
    }
  });

  hoverButton = createButton();
  hoverButton.addEventListener('click', handleButtonClick);
  document.body.appendChild(hoverButton);

  document.addEventListener('mouseover', handleMouseOver);
  // Positions go stale as soon as the page scrolls; hide until next hover
  document.addEventListener('scroll', hideButtonNow, true);

  return [hoverButton];
}

/**
 * Removes the hover button and its listeners
 */
function removeButtons() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (hoverButton) {
    hoverButton.removeEventListener('click', handleButtonClick);
    hoverButton.remove();
    hoverButton = null;
  }

  if (typeof document !== 'undefined') {
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('scroll', hideButtonNow, true);
  }

  paragraphsData = null;
  paragraphIndexMap = null;
}

/**
 * Gets the number of currently injected buttons (0 or 1)
 * @returns {number} Number of buttons
 */
function getButtonCount() {
  return hoverButton ? 1 : 0;
}

/**
 * Gets all injected button elements
 * @returns {HTMLButtonElement[]} Array of button elements
 */
function getButtons() {
  return hoverButton ? [hoverButton] : [];
}

// Export for use in other modules
export {
  injectButtons,
  removeButtons,
  getButtonCount,
  getButtons,
  BUTTON_CLASS,
  BUTTON_VISIBLE_CLASS,
  PARAGRAPH_INDEX_ATTR
};
