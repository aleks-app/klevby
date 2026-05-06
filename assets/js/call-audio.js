(function () {
  if (window.KlevbyCallAudio) {
    return;
  }

  const RINGTONE_URL = "assets/audio/klevby-ringtone.mp3";
  const RINGTONE_VOLUME = 0.9;
  const REMOTE_AUDIO_RETRY_INTERVAL_MS = 650;
  const REMOTE_AUDIO_RETRY_LIMIT = 16;

  let context = {
    log: null,
    warn: null,
    showToast: null,
    getCallState: null
  };

  let audioContext = null;

  let ringInterval = null;
  let activeOscillator = null;
  let activeGain = null;
  let ringtoneAudio = null;
  let ringSoundActive = false;

  let remoteAudioSourceNode = null;
  let remoteAudioSourceStream = null;
  let remoteAudioRetryTimer = null;

  let audioUnlocked = false;

  function init(options = {}) {
    context = {
      ...context,
      ...options
    };

    preloadRingtone();
  }

  function log(...args) {
    if (typeof context.log === "function") {
      context.log(...args);
      return;
    }

    console.log("Klevby calls:", ...args);
  }

  function warn(...args) {
    if (typeof context.warn === "function") {
      context.warn(...args);
      return;
    }

    console.warn("Klevby calls:", ...args);
  }

  function showToast(text) {
    if (typeof context.showToast === "function") {
      context.showToast(text);
    }
  }

  function getCallState() {
    if (typeof context.getCallState === "function") {
      return context.getCallState();
    }

    return "idle";
  }

  function isCallIdle() {
    return getCallState() === "idle";
  }

  function ensureAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return null;

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function unlockAudioForMobile() {
    const ctx = ensureAudioContext();

    if (!ctx) {
      audioUnlocked = true;
      return;
    }

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      gain.gain.value = 0.00001;

      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      audioUnlocked = true;
      log("mobile audio unlocked");
    } catch (error) {
      audioUnlocked = true;
      warn("mobile audio unlock skipped", error);
    }
  }

  function isAudioUnlocked() {
    return audioUnlocked;
  }

  function getRingtoneAudio() {
    if (!ringtoneAudio) {
      ringtoneAudio = new Audio(RINGTONE_URL);
      ringtoneAudio.preload = "auto";
      ringtoneAudio.loop = true;
      ringtoneAudio.volume = RINGTONE_VOLUME;

      try {
        ringtoneAudio.setAttribute("playsinline", "");
        ringtoneAudio.setAttribute("webkit-playsinline", "");
      } catch (error) {}
    }

    return ringtoneAudio;
  }

  function preloadRingtone() {
    try {
      const audio = getRingtoneAudio();

      if (audio && typeof audio.load === "function") {
        audio.load();
      }
    } catch (error) {
      warn("custom ringtone preload skipped", error);
    }
  }

  function stopRingtoneAudio() {
    if (!ringtoneAudio) return;

    try {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    } catch (error) {}
  }

  function stopSingleBeep() {
    try {
      if (activeOscillator) {
        activeOscillator.onended = null;
        activeOscillator.stop();
      }
    } catch (error) {}

    try {
      if (activeGain) {
        activeGain.disconnect();
      }
    } catch (error) {}

    activeOscillator = null;
    activeGain = null;
  }

  function playSingleBeep() {
    const ctx = ensureAudioContext();

    if (!ctx) return;

    stopSingleBeep();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    activeOscillator = oscillator;
    activeGain = gain;

    oscillator.onended = () => {
      try {
        gain.disconnect();
      } catch (error) {}

      if (activeOscillator === oscillator) activeOscillator = null;
      if (activeGain === gain) activeGain = null;
    };
  }

  function startFallbackBeepRing() {
    if (!ringSoundActive) return;

    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }

    playSingleBeep();

    ringInterval = setInterval(() => {
      if (!ringSoundActive) {
        clearInterval(ringInterval);
        ringInterval = null;
        return;
      }

      playSingleBeep();
    }, 1850);
  }

  function playCustomRingtoneOrFallback() {
    const audio = getRingtoneAudio();

    if (!audio) {
      startFallbackBeepRing();
      return;
    }

    try {
      audio.loop = true;
      audio.volume = RINGTONE_VOLUME;
      audio.currentTime = 0;

      const playResult = audio.play();

      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            if (!ringSoundActive) {
              stopRingtoneAudio();
              return;
            }

            log("custom ringtone playing");
          })
          .catch((error) => {
            if (!ringSoundActive) return;

            warn("custom ringtone blocked, fallback beep enabled", error);
            startFallbackBeepRing();
          });
      }
    } catch (error) {
      if (!ringSoundActive) return;

      warn("custom ringtone failed, fallback beep enabled", error);
      startFallbackBeepRing();
    }
  }

  function startRingSound() {
    stopRingSound();

    ringSoundActive = true;

    unlockAudioForMobile();
    playCustomRingtoneOrFallback();
  }

  function stopRingSound() {
    ringSoundActive = false;

    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }

    stopRingtoneAudio();
    stopSingleBeep();
  }

  function getRemoteAudioElement() {
    return document.getElementById("klevbyRemoteAudio");
  }

  function prepareRemoteAudioElement() {
    const audio = getRemoteAudioElement();

    if (!audio) return null;

    try {
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;
    } catch (error) {
      warn("remote audio prepare failed", error);
    }

    return audio;
  }

  function attachRemoteStreamToAudio(remoteStream) {
    const audio = prepareRemoteAudioElement();

    if (!audio || !remoteStream) return;

    try {
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;

      if (audio.srcObject !== remoteStream) {
        audio.srcObject = remoteStream;
      }

      log("remote audio attached", {
        tracks: remoteStream.getTracks().map((track) => ({
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        }))
      });
    } catch (error) {
      warn("remote audio attach failed", error);
    }
  }

  function connectRemoteStreamToAudioContext(remoteStream) {
    if (!remoteStream || !remoteStream.getAudioTracks().length) return;

    const ctx = ensureAudioContext();

    if (!ctx) return;

    try {
      if (remoteAudioSourceNode && remoteAudioSourceStream === remoteStream) {
        return;
      }

      if (remoteAudioSourceNode) {
        try {
          remoteAudioSourceNode.disconnect();
        } catch (error) {}
      }

      remoteAudioSourceNode = ctx.createMediaStreamSource(remoteStream);
      remoteAudioSourceStream = remoteStream;
      remoteAudioSourceNode.connect(ctx.destination);

      log("remote stream connected to audio context");
    } catch (error) {
      warn("remote audio context connect skipped", error);
    }
  }

  function tryPlayRemoteAudio(remoteStream) {
    const audio = prepareRemoteAudioElement();

    unlockAudioForMobile();

    if (!audio) return;

    attachRemoteStreamToAudio(remoteStream);
    connectRemoteStreamToAudioContext(remoteStream);

    if (!remoteStream || !remoteStream.getAudioTracks().length) {
      return;
    }

    try {
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;

      const playResult = audio.play();

      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            log("remote audio playing");
          })
          .catch((error) => {
            if (isCallIdle()) return;

            warn("remote audio play blocked", error);
            showToast("Нажми по экрану звонка, чтобы включить звук.");
          });
      }
    } catch (error) {
      if (isCallIdle()) return;

      warn("remote audio play failed", error);
    }
  }

  function startRemoteAudioRetry(getRemoteStream) {
    stopRemoteAudioRetry();

    let tries = 0;

    remoteAudioRetryTimer = setInterval(() => {
      tries += 1;

      if (isCallIdle() || tries > REMOTE_AUDIO_RETRY_LIMIT) {
        stopRemoteAudioRetry();
        return;
      }

      const remoteStream =
        typeof getRemoteStream === "function"
          ? getRemoteStream()
          : getRemoteStream;

      tryPlayRemoteAudio(remoteStream);
    }, REMOTE_AUDIO_RETRY_INTERVAL_MS);
  }

  function stopRemoteAudioRetry() {
    if (remoteAudioRetryTimer) {
      clearInterval(remoteAudioRetryTimer);
      remoteAudioRetryTimer = null;
    }
  }

  function cleanupRemoteAudio() {
    stopRemoteAudioRetry();

    if (remoteAudioSourceNode) {
      try {
        remoteAudioSourceNode.disconnect();
      } catch (error) {}
    }

    remoteAudioSourceNode = null;
    remoteAudioSourceStream = null;

    const audio = getRemoteAudioElement();

    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
      } catch (error) {}
    }
  }

  function cleanupAudio() {
    stopRingSound();
    cleanupRemoteAudio();
  }

  window.KlevbyCallAudio = {
    init,
    ensureAudioContext,
    unlockAudioForMobile,
    isAudioUnlocked,

    getRingtoneAudio,
    preloadRingtone,
    startRingSound,
    stopRingSound,

    getRemoteAudioElement,
    prepareRemoteAudioElement,
    attachRemoteStreamToAudio,
    connectRemoteStreamToAudioContext,
    tryPlayRemoteAudio,
    startRemoteAudioRetry,
    stopRemoteAudioRetry,
    cleanupRemoteAudio,
    cleanupAudio
  };
})();
