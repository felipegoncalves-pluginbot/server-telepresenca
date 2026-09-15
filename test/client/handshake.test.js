import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  hasRenderableRemoteVideo,
  shouldRestartForCapture,
  waitWithTimeout,
} from "../../public/js/webrtc/handshake.js";

test("shouldRestartForCapture ignores first apply (null previous key)", () => {
  assert.equal(
    shouldRestartForCapture(null, { width: 640, height: 480, fps: 15 }),
    false,
  );
  assert.equal(
    shouldRestartForCapture("", { width: 1280, height: 720, fps: 30 }),
    false,
  );
});

test("shouldRestartForCapture only when capture key actually changes", () => {
  assert.equal(
    shouldRestartForCapture("1280x720@30", {
      width: 1280,
      height: 720,
      fps: 30,
    }),
    false,
  );
  assert.equal(
    shouldRestartForCapture("1280x720@30", {
      width: 1920,
      height: 1080,
      fps: 30,
    }),
    true,
  );
  assert.equal(shouldRestartForCapture("auto", { adaptive: true }), false);
});

test("hasRenderableRemoteVideo requires frames, not just a live track", () => {
  assert.equal(hasRenderableRemoteVideo(null), false);
  assert.equal(
    hasRenderableRemoteVideo({
      videoWidth: 0,
      videoHeight: 0,
      srcObject: {
        getVideoTracks: () => [{ readyState: "live", muted: true }],
      },
    }),
    false,
  );
  assert.equal(
    hasRenderableRemoteVideo({
      videoWidth: 1280,
      videoHeight: 720,
      srcObject: null,
    }),
    true,
  );
  assert.equal(
    hasRenderableRemoteVideo({
      videoWidth: 0,
      videoHeight: 0,
      srcObject: {
        getVideoTracks: () => [{ readyState: "live", muted: false }],
      },
    }),
    true,
  );
});

test("waitWithTimeout returns fallback when the promise is slow", async () => {
  const slow = new Promise(() => {});
  const value = await waitWithTimeout(slow, 20, "fallback");
  assert.equal(value, "fallback");
});

test("waitWithTimeout returns the resolved value when it wins", async () => {
  const value = await waitWithTimeout(Promise.resolve("ok"), 50, "fallback");
  assert.equal(value, "ok");
});

test("ice restart is not warranted while a live frame is already rendering", () => {
  assert.equal(
    hasRenderableRemoteVideo({
      videoWidth: 960,
      videoHeight: 540,
      srcObject: {
        getVideoTracks: () => [{ readyState: "live", muted: false }],
      },
    }),
    true,
  );
});
