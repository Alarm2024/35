"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { rpcFactory, isRetryable } = require("../lib/rpc");

// No real delays in tests.
const NO_WAIT = [0, 0, 0];

function okResponse(result) {
  return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: 1, result }) };
}

function abortError() {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";
  return error;
}

test("a call that answers first time makes exactly one request", async () => {
  let calls = 0;
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    fetchImpl: async () => {
      calls += 1;
      return okResponse("fine");
    },
  });
  assert.equal(await call("getHealth"), "fine");
  assert.equal(calls, 1);
});

// The failure that killed ledger-rebuild on the live desk: one slow answer out
// of hundreds of sequential getTransaction calls.
test("a timeout is retried and the run survives one slow answer", async () => {
  let calls = 0;
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw abortError();
      return okResponse("recovered");
    },
  });
  assert.equal(await call("getTransaction"), "recovered");
  assert.equal(calls, 2);
});

test("429 and 5xx are retried; the public endpoint asking for less is not fatal", async () => {
  for (const status of [429, 500, 502, 503]) {
    let calls = 0;
    const call = rpcFactory("http://x", {
      retries: NO_WAIT,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status };
        return okResponse("recovered");
      },
    });
    assert.equal(await call("getSignaturesForAddress"), "recovered", `status ${status}`);
    assert.equal(calls, 2, `status ${status}`);
  }
});

test("a JSON-RPC error body is NOT retried — the server answered clearly", async () => {
  let calls = 0;
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad param" } }),
      };
    },
  });
  await assert.rejects(() => call("getTransaction"), /bad param/);
  assert.equal(calls, 1, "retrying a deterministic error just burns the rate limit");
});

test("a 4xx that is not 429 is NOT retried", async () => {
  let calls = 0;
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 403 };
    },
  });
  await assert.rejects(() => call("getBalance"), /HTTP 403/);
  assert.equal(calls, 1);
});

test("retries are bounded — a dead endpoint does not hang forever", async () => {
  let calls = 0;
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    fetchImpl: async () => {
      calls += 1;
      throw abortError();
    },
  });
  await assert.rejects(() => call("getTransaction"));
  assert.equal(calls, NO_WAIT.length + 1);
});

// The whole point of the change: the old message was the AbortError's own text,
// which belongs to no particular request.
test("the final error names the call, the attempts, and what to change", async () => {
  const call = rpcFactory("http://x", {
    retries: NO_WAIT,
    timeoutMs: 15000,
    fetchImpl: async () => {
      throw abortError();
    },
  });
  await assert.rejects(
    () => call("getTransaction"),
    (error) => {
      assert.match(error.message, /RPC getTransaction failed/);
      assert.match(error.message, /after 4 attempts/);
      assert.match(error.message, /no answer within 15000ms/);
      assert.match(error.message, /--limit/);
      assert.match(error.message, /rpcUrl/);
      // The bare abort text must not be the whole story any more.
      assert.notEqual(error.message, "This operation was aborted");
      assert.equal(error.cause.name, "AbortError");
      return true;
    }
  );
});

test("isRetryable classifies transport faults, not answers", () => {
  assert.equal(isRetryable(abortError()), true);
  assert.equal(isRetryable(Object.assign(new Error("net"), { name: "TypeError" })), true);
  assert.equal(isRetryable(Object.assign(new Error("429"), { retryableHttp: true })), true);
  assert.equal(isRetryable(new Error("RPC getTransaction error: bad param")), false);
  assert.equal(isRetryable(null), false);
});
