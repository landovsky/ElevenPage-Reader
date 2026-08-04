// ElevenPage Reader - Storage Utility
// Chrome storage wrapper for settings persistence

import { STORAGE_KEYS, DEFAULTS } from '../src/shared/constants.js';

/**
 * Save a setting to Chrome storage
 * @param {string} key - The storage key
 * @param {*} value - The value to store
 * @returns {Promise<void>}
 */
async function saveSettings(key, value) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new Error('Storage key must be a non-empty string');
  }
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get a setting from Chrome storage
 * @param {string} key - The storage key
 * @returns {Promise<*>} The stored value or undefined
 */
async function getSettings(key) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new Error('Storage key must be a non-empty string');
  }
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[key]);
      }
    });
  });
}

/**
 * Get all settings from Chrome storage
 * @returns {Promise<Object>} All stored settings
 */
async function getAllSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Remove a setting from Chrome storage
 * @param {string} key - The storage key to remove
 * @returns {Promise<void>}
 */
async function removeSettings(key) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new Error('Storage key must be a non-empty string');
  }
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([key], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear all settings from Chrome storage
 * @returns {Promise<void>}
 */
async function clearAllSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Export for use in other modules
export {
  STORAGE_KEYS,
  DEFAULTS,
  saveSettings,
  getSettings,
  getAllSettings,
  removeSettings,
  clearAllSettings
};
