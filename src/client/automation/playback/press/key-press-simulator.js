import hammerhead from '../../deps/hammerhead';
import { KEY_MAPS, domUtils, getSanitizedKey } from '../../deps/testcafe-core';
import typeChar from '../type/type-char';
import { getChar, getDeepActiveElement } from './utils';
import getKeyCode from '../../utils/get-key-code';

var browserUtils   = hammerhead.utils.browser;
var extend         = hammerhead.utils.extend;
var eventSimulator = hammerhead.eventSandbox.eventSimulator;


export default class KeyPressSimulator {
    constructor (key) {
        this.isChar          = key.length === 1 || key === 'space';
        this.sanitizedKey    = getSanitizedKey(key);
        this.modifierKeyCode = KEY_MAPS.modifiers[this.sanitizedKey];
        this.specialKeyCode  = KEY_MAPS.specialKeys[this.sanitizedKey];
        this.keyCode         = null;
        this.topSameDomainDocument = domUtils.getTopSameDomainWindow(window).document;

        if (this.isChar && key !== 'space')
            this.keyCode = getKeyCode(this.sanitizedKey);
        else if (this.modifierKeyCode)
            this.keyCode = this.modifierKeyCode;
        else if (this.specialKeyCode)
            this.keyCode = this.specialKeyCode;

        this.storedActiveElement = null;
    }

    static _isKeyActivatedInputElement (el) {
        return domUtils.isInputElement(el) && /button|submit|reset|radio|checkbox/.test(el.type);
    }

    _type (element, char) {
        var elementChanged          = element !== this.storedActiveElement;
        var shouldType              = !elementChanged;
        var elementForTyping        = element;
        var isActiveElementEditable = domUtils.isEditableElement(element);
        var isStoredElementEditable = domUtils.isEditableElement(this.storedActiveElement);

        // Unnecessary typing happens if an element was changed after the keydown/keypress event (T210448)
        // In IE, this error may occur when we try to determine if the removed element is in an iframe
        try {
            if (elementChanged) {
                var isActiveElementInIframe = domUtils.isElementInIframe(element);
                var isStoredElementInIframe = domUtils.isElementInIframe(this.storedActiveElement);

                var shouldTypeInWebKit = !(isActiveElementInIframe !== isStoredElementInIframe && !isStoredElementEditable);

                shouldType = (!browserUtils.isFirefox || isStoredElementEditable) &&
                             (!browserUtils.isWebKit || shouldTypeInWebKit);
            }
        }
            /*eslint-disable no-empty */
        catch (err) {
        }
        /*eslint-disable no-empty */


        if (shouldType) {
            if (!browserUtils.isIE && elementChanged && isStoredElementEditable && isActiveElementEditable)
                elementForTyping = this.storedActiveElement;

            typeChar(elementForTyping, char);
        }
    }

    down (modifiersState) {
        this.storedActiveElement = getDeepActiveElement(this.topSameDomainDocument);

        if (this.modifierKeyCode)
            modifiersState[this.sanitizedKey] = true;

        return eventSimulator.keydown(this.storedActiveElement, extend({ keyCode: this.keyCode }, modifiersState));
    }

    press (modifiersState) {
        if (!(this.isChar || this.specialKeyCode))
            return true;

        var activeElement = getDeepActiveElement(this.topSameDomainDocument);

        var character      = this.isChar ? getChar(this.sanitizedKey, modifiersState.shift) : null;
        var charCode       = this.specialKeyCode || character.charCodeAt(0);
        var elementChanged = activeElement !== this.storedActiveElement;

        if (browserUtils.isWebKit && elementChanged) {
            var isActiveElementInIframe = domUtils.isElementInIframe(activeElement);
            var isStoredElementInIframe = domUtils.isElementInIframe(this.storedActiveElement);

            if (isActiveElementInIframe !== isStoredElementInIframe)
                return true;
        }

        this.storedActiveElement = activeElement;

        var raiseDefault = eventSimulator.keypress(activeElement, extend({
            keyCode:  charCode,
            charCode: charCode
        }, modifiersState));

        if (!raiseDefault)
            return raiseDefault;

        activeElement = getDeepActiveElement(this.topSameDomainDocument);

        if (character && !(modifiersState.ctrl || modifiersState.alt))
            this._type(activeElement, character);

        if (this.sanitizedKey === 'enter' && KeyPressSimulator._isKeyActivatedInputElement(activeElement))
            activeElement.click();

        return raiseDefault;
    }

    up (modifiersState) {
        if (this.modifierKeyCode)
            modifiersState[this.sanitizedKey] = false;

        var raiseDefault  = eventSimulator.keyup(getDeepActiveElement(this.topSameDomainDocument), extend({ keyCode: this.keyCode }, modifiersState));
        var activeElement = getDeepActiveElement(this.topSameDomainDocument);

        if (raiseDefault && this.sanitizedKey === 'space' &&
            KeyPressSimulator._isKeyActivatedInputElement(activeElement))
            activeElement.click();

        return raiseDefault;
    }

    get key () {
        return this.sanitizedKey;
    }
}
