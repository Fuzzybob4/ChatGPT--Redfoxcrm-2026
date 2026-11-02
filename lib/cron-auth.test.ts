import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCronAuthorized } from './cron-auth.ts';

describe('isCronAuthorized', () => {
  it('rejects every request when CRON_SECRET is missing', () => {
    assert.equal(isCronAuthorized('Bearer undefined', undefined), false);
    assert.equal(isCronAuthorized('Bearer undefined', ''), false);
    assert.equal(isCronAuthorized(null, undefined), false);
  });

  it('accepts only the exact bearer secret', () => {
    assert.equal(isCronAuthorized('Bearer topsecret', 'topsecret'), true);
    assert.equal(isCronAuthorized('Bearer topsecret ', 'topsecret'), false);
    assert.equal(isCronAuthorized('Bearer wrong', 'topsecret'), false);
    assert.equal(isCronAuthorized(null, 'topsecret'), false);
  });
});
