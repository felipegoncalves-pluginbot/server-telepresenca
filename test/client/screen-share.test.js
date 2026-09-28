import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  createScreenShareController,
  isScreenShareSupported,
} from "../../public/js/media/screen-share.js";

function createMockTrack(kind = "video") {
  let stopped = false;
  let onendedHandler = null;

  return {
    kind,
    contentHint: "",
    get enabled() {
      return !stopped;
    },
    stop() {
      stopped = true;
    },
    get isStopped() {
      return stopped;
    },
    get onended() {
      return onendedHandler;
    },
    set onended(fn) {
      onendedHandler = fn;
    },
    async simulateEnded() {
      if (onendedHandler) return onendedHandler();
      return undefined;
    },
  };
}

function createMockPeer(initialVideoTrack) {
  let currentSenderTrack = initialVideoTrack;
  const replacedTracks = [];

  const videoSender = {
    track: currentSenderTrack,
    replaceTrack: async (newTrack) => {
      replacedTracks.push(newTrack);
      currentSenderTrack = newTrack;
      videoSender.track = newTrack;
      return true;
    },
  };

  const pc = {
    getSenders: () => [videoSender],
  };

  return {
    pc,
    videoSender,
    replacedTracks,
    getCurrentTrack: () => currentSenderTrack,
  };
}

function createScreenShareFixture() {
  const cameraTrack = createMockTrack("video");
  const screenTrack = createMockTrack("video");
  const mockPeer = createMockPeer(cameraTrack);
  const stateChanges = [];

  const screenStream = {
    getVideoTracks: () => [screenTrack],
    getTracks: () => [screenTrack],
  };

  const controller = createScreenShareController({
    getPc: () => mockPeer.pc,
    getCamTrack: () => cameraTrack,
    getDisplayMedia: async () => screenStream,
    onStateChange: (active) => stateChanges.push(active),
  });

  return {
    cameraTrack,
    screenTrack,
    mockPeer,
    stateChanges,
    controller,
  };
}

test("isScreenShareSupported returns false when navigator or getDisplayMedia is missing", () => {
  assert.equal(isScreenShareSupported(null), false);
  assert.equal(isScreenShareSupported({}), false);
  assert.equal(isScreenShareSupported({ mediaDevices: {} }), false);
});

test("isScreenShareSupported returns true when getDisplayMedia is a function", () => {
  const mockNav = {
    mediaDevices: {
      getDisplayMedia: async () => ({}),
    },
  };
  assert.equal(isScreenShareSupported(mockNav), true);
});

test("screenShareController starts sharing, sets contentHint to detail and replaces track", async () => {
  const { controller, screenTrack, mockPeer, stateChanges } =
    createScreenShareFixture();

  assert.equal(controller.isSharing(), false);

  const started = await controller.start();
  assert.equal(started, true);
  assert.equal(controller.isSharing(), true);
  assert.equal(screenTrack.contentHint, "detail");
  assert.equal(mockPeer.getCurrentTrack(), screenTrack);
  assert.deepEqual(stateChanges, [true]);
});

test("screenShareController stops sharing, stops screen track and restores camera track", async () => {
  const { controller, screenTrack, cameraTrack, mockPeer, stateChanges } =
    createScreenShareFixture();

  await controller.start();
  assert.equal(controller.isSharing(), true);

  await controller.stop();
  assert.equal(controller.isSharing(), false);
  assert.equal(screenTrack.isStopped, true);
  assert.equal(mockPeer.getCurrentTrack(), cameraTrack);
  assert.deepEqual(stateChanges, [true, false]);
});

test("screenShareController handles screenTrack onended (browser native stop sharing)", async () => {
  const { controller, screenTrack, cameraTrack, mockPeer, stateChanges } =
    createScreenShareFixture();

  await controller.start();
  assert.equal(controller.isSharing(), true);

  // Simula clique na barra flutuante nativa do navegador
  await screenTrack.simulateEnded();

  assert.equal(controller.isSharing(), false);
  assert.equal(mockPeer.getCurrentTrack(), cameraTrack);
  assert.deepEqual(stateChanges, [true, false]);
});

test("screenShareController gracefully handles permission cancellation (NotAllowedError)", async () => {
  const cameraTrack = createMockTrack("video");
  const mockPeer = createMockPeer(cameraTrack);
  const errors = [];
  const stateChanges = [];

  const controller = createScreenShareController({
    getPc: () => mockPeer.pc,
    getCamTrack: () => cameraTrack,
    getDisplayMedia: async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    },
    onStateChange: (active) => stateChanges.push(active),
    onError: (err) => errors.push(err.name),
  });

  const started = await controller.start();
  assert.equal(started, false);
  assert.equal(controller.isSharing(), false);
  assert.equal(mockPeer.getCurrentTrack(), cameraTrack);
  assert.deepEqual(stateChanges, []);
  assert.deepEqual(errors, ["NotAllowedError"]);
});

test("screenShareController returns false when getDisplayMedia is not available", async () => {
  const cameraTrack = createMockTrack("video");
  const mockPeer = createMockPeer(cameraTrack);

  const controller = createScreenShareController({
    getPc: () => mockPeer.pc,
    getCamTrack: () => cameraTrack,
    getDisplayMedia: null,
  });

  assert.equal(controller.isSupported(), false);
  const started = await controller.start();
  assert.equal(started, false);
});
