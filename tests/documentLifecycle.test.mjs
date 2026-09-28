import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentLifecycle } from '../src/documentLifecycle.ts';

test('switching documents resets version state without transferring edit snapshots', () => {
  const lifecycle = new DocumentLifecycle();
  lifecycle.open('first', 1);
  lifecycle.change(2);

  assert.equal(lifecycle.dirty, true);
  lifecycle.open('second', 1);
  assert.equal(lifecycle.docId, 'second');
  assert.equal(lifecycle.dirty, false);
});

test('save remains dirty until the matching host acknowledgement', () => {
  const lifecycle = new DocumentLifecycle();
  lifecycle.open('first', 1);
  lifecycle.change(2);
  const request = lifecycle.requestSave('edited');
  assert.ok(request);
  assert.deepEqual(request, { requestId: 1, docId: 'first', content: 'edited' });
  assert.equal(lifecycle.dirty, true);

  assert.equal(lifecycle.confirmSave(request.requestId, 'first', false), false);
  assert.equal(lifecycle.dirty, true);
  assert.equal(lifecycle.confirmSave(request.requestId, 'first', true), true);
  assert.equal(lifecycle.dirty, false);
});

test('an acknowledged save preserves edits typed while the save was pending', () => {
  const lifecycle = new DocumentLifecycle();
  lifecycle.open('first', 1);
  lifecycle.change(2);
  const request = lifecycle.requestSave('saving');
  assert.ok(request);
  lifecycle.change(3);

  assert.equal(lifecycle.confirmSave(request.requestId, 'first', true), true);
  assert.equal(lifecycle.dirty, true);
  assert.equal(lifecycle.canApplyHostUpdate('first'), false);
});

test('undoing to the saved Monaco version clears dirty without copying text', () => {
  const lifecycle = new DocumentLifecycle();
  lifecycle.open('first', 4);
  lifecycle.change(5);
  assert.equal(lifecycle.dirty, true);
  lifecycle.change(4);
  assert.equal(lifecycle.dirty, false);
});

test('late save results cannot change another document or override a newer save', () => {
  const lifecycle = new DocumentLifecycle();
  lifecycle.open('first', 1);
  lifecycle.change(2);
  const oldRequest = lifecycle.requestSave('edited');
  const newRequest = lifecycle.requestSave('edited');
  assert.ok(oldRequest && newRequest);
  assert.equal(lifecycle.confirmSave(oldRequest.requestId, 'first', true), false);
  lifecycle.open('second', 1);
  assert.equal(lifecycle.confirmSave(newRequest.requestId, 'first', true), false);
  assert.equal(lifecycle.dirty, false);
});

test('document-scoped controls reject missing and stale IDs after a switch', () => {
  const lifecycle = new DocumentLifecycle();
  assert.equal(lifecycle.isCurrentDocument(undefined), false);
  lifecycle.open('first', 1);
  assert.equal(lifecycle.isCurrentDocument('first'), true);
  assert.equal(lifecycle.isCurrentDocument(undefined), false);
  lifecycle.open('second', 1);
  assert.equal(lifecycle.isCurrentDocument('first'), false);
  assert.equal(lifecycle.isCurrentDocument('second'), true);
});
