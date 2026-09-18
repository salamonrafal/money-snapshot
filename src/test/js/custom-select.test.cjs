const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const source = readFileSync('src/main/resources/static/js/components/custom-select.js', 'utf8');

// Small DOM adapter keeps these interaction regressions runnable with plain Node.
class Element extends EventTarget {
    constructor() {
        super();
        this.attributes = new Map();
        this.children = [];
        this.dataset = {};
        this.classList = {toggle() {}};
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    after(element) { this.sibling = element; }
    focus() {}
    scrollIntoView() {}
}

function setup() {
    const select = new Element();
    select.required = true;
    select.selectedIndex = 0;
    select.form = new Element();
    select.options = ['', 'FINAL', 'PARTIAL'].map(value => ({
        value, textContent: value, dataset: {}, parentElement: select
    }));
    Object.defineProperty(select, 'selectedOptions', {get: () => [select.options[select.selectedIndex]]});
    Object.defineProperty(select, 'validity', {get: () => ({valid: select.selectedIndex > 0})});
    const document = new Element();
    document.createElement = () => new Element();
    document.createTextNode = text => ({textContent: text});
    document.querySelectorAll = () => [];
    const window = new Element();
    runInNewContext(source, {window, document, Event, setTimeout, clearTimeout,
        MutationObserver: class { observe() {} }});
    const component = window.MoneySnapshotSelect.create(select);
    const [trigger, list] = select.sibling.children;
    return {select, component, trigger, list};
}

function invalidate(select) {
    select.dispatchEvent(new Event('invalid', {cancelable: true}));
}
const settleReset = () => new Promise(resolve => setTimeout(resolve, 10));

test('correcting a required selection clears native error on the visible control', () => {
    const {select, trigger, list} = setup();
    invalidate(select);
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
    list.children[1].dispatchEvent(new Event('click'));
    assert.equal(select.selectedIndex, 1);
    assert.equal(trigger.getAttribute('aria-invalid'), 'false');
    assert.equal(select.getAttribute('aria-invalid'), null);
});

test('refresh after a programmatic correction clears the native error', () => {
    const {select, trigger, component} = setup();
    invalidate(select);
    component.refresh();
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
    select.selectedIndex = 2;
    component.refresh();
    assert.equal(trigger.getAttribute('aria-invalid'), 'false');
});

test('reset clears native error even when default selection is still empty', async () => {
    const {select, trigger} = setup();
    invalidate(select);
    select.form.dispatchEvent(new Event('reset', {cancelable: true}));
    await settleReset();
    assert.equal(trigger.getAttribute('aria-invalid'), 'false');
    invalidate(select);
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
});

test('selection correction and reset preserve external validation errors', async () => {
    const {select, trigger, list} = setup();
    invalidate(select);
    select.setAttribute('aria-invalid', 'true');
    select.setAttribute('aria-describedby', 'server-error');
    list.children[1].dispatchEvent(new Event('click'));
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
    select.form.dispatchEvent(new Event('reset', {cancelable: true}));
    await settleReset();
    assert.equal(select.getAttribute('aria-invalid'), 'true');
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
    assert.equal(trigger.getAttribute('aria-describedby'), 'server-error');
});

test('cancelled reset preserves the native validation error', async () => {
    const {select, trigger} = setup();
    invalidate(select);
    select.form.addEventListener('reset', event => event.preventDefault());
    select.form.dispatchEvent(new Event('reset', {cancelable: true}));
    await settleReset();
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
});
