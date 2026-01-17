import React, { useEffect, useRef, useState } from "react";

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastPositionUpdateRef = useRef<number>(0);
  const lastMetadataUpdateRef = useRef<number>(0);
  const lastArtworkUrlRef = useRef<string>("");
  const preloadedFrames = useRef<Set<string>>(new Set());
  const unlocked = useRef(false);
  const fps = 30;

  // Modern Silent Sound (MP3) for iOS Audio Context Unlock
  // 1-second silent MP3 for iOS Audio Context Unlock
  const SILENT_SOUND =
    "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFhYAAAASAAAAbGF2ZWY0Mi40OS4xMDBAQCBAAAAAAAAD//7EZAAMAAAABAAfAAAgAAAABAAfAAAgA//7EZAAMAAAABAAfAAAgAAAABAAfAAAgA//7EZAAMAAAABAAfAAAgAAAABAAfAAAgA";

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);

  const preloadFrame = (frameNum: number) => {
    if (frameNum > 6571) return;
    const padded = String(frameNum).padStart(4, "0");
    const url = `${window.location.origin}/assets/frames/output_${padded}.jpg`;

    if (preloadedFrames.current.has(url)) return;

    const img = new Image();
    img.src = url;
    preloadedFrames.current.add(url);

    // Manage cache size (higher on desktop/android)
    const maxCache = (isMobile && !isAndroid) ? 30 : 150;
    if (preloadedFrames.current.size > maxCache) {
      const firstKey = preloadedFrames.current.values().next().value;
      if (firstKey) preloadedFrames.current.delete(firstKey);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.load();

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      const err = video.error;
      if (err) setError(`Playback Error: ${err.message || err.code}`);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);

    // Initial SMTC setup
    if ("mediaSession" in navigator) {
      const firstFrame =
        `${window.location.origin}/assets/frames/output_0001.jpg`;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Bad Apple!!",
        artist: "Alstroemeria Records",
        album: "Traditional Remix",
        artwork: [{ src: firstFrame, sizes: "480x360", type: "image/jpeg" }],
      });

      // Set action handlers early for iOS
      navigator.mediaSession.setActionHandler("play", () => {
        videoRef.current?.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - (details.seekOffset || 10),
            0,
          );
        }
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + (details.seekOffset || 10),
            videoRef.current.duration,
          );
        }
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (videoRef.current && details.seekTime !== undefined) {
          videoRef.current.currentTime = details.seekTime;
        }
      });
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
    };
  }, []);

  const updateLoop = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.duration && progressRef.current) {
      const p = (video.currentTime / video.duration) * 100;
      progressRef.current.style.width = `${p}%`;
    }

    if ("mediaSession" in navigator) {
      // 2. Position updates (2s mobile throttle)
      const posThrottle = (isMobile && !isAndroid) ? 2000 : 1000;
      if (time - lastPositionUpdateRef.current >= posThrottle) {
        if (video.duration && isFinite(video.duration)) {
          try {
            navigator.mediaSession.setPositionState({
              duration: video.duration,
              playbackRate: video.playbackRate,
              position: Math.max(
                0,
                Math.min(video.currentTime, video.duration),
              ),
            });
            lastPositionUpdateRef.current = time;
          } catch (e) {}
        }
      }

      // 3. Metadata updates
      const targetFps = isAndroid ? 30 : fps;
      const metaThrottle = (isMobile && !isAndroid) ? 1000 : (1000 / targetFps);

      if (time - lastMetadataUpdateRef.current >= metaThrottle) {
        const currentFrame = Math.floor(video.currentTime * fps) + 1;
        const paddedFrame = String(currentFrame).padStart(4, "0");
        const artworkUrl =
          `${window.location.origin}/assets/frames/output_${paddedFrame}.jpg`;

        if (artworkUrl !== lastArtworkUrlRef.current) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: "Bad Apple!!",
              artist: "Alstroemeria Records",
              album: "Traditional Remix",
              artwork: [{
                src: artworkUrl,
                sizes: "480x360",
                type: "image/jpeg",
              }],
            });
            lastMetadataUpdateRef.current = time;
            lastArtworkUrlRef.current = artworkUrl;

            // Simple preload next logical frame
            preloadFrame(currentFrame + (isMobile && !isAndroid ? 30 : 1));
          } catch (e) {}
        }
      }
    }

    if (!video.paused) {
      requestRef.current = requestAnimationFrame(updateLoop);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateLoop);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);

    if (!unlocked.current) {
      try {
        const audio = new Audio(SILENT_SOUND);
        audio.play().catch(() => {});
      } catch (e) {}
      unlocked.current = true;
    }

    if (video.paused) {
      video.muted = true;
      video.play().then(() => {
        setIsPlaying(true);
        // On iOS, we need a small delay before unmuting sometimes
        setTimeout(() => {
          if (videoRef.current) videoRef.current.muted = false;
        }, 100);
      }).catch((err) => {
        video.muted = true;
        video.play().then(() => {
          setIsPlaying(true);
          setError("Playing muted (iOS limitation)");
        }).catch((e2) => setError(`Error: ${e2.message}`));
      });
    } else {
      video.pause();
    }
  };

  return (
    <div className="app-container">
      <video
        ref={videoRef}
        id="bg-video"
        loop
        playsInline
        webkit-playsinline="true"
        muted
        autoPlay
        preload="auto"
        src="/assets/badapple.mp4"
        crossOrigin="anonymous"
      />

      <div className="glass-panel">
        <h1>Bad Apple!!</h1>
        <div className="subtitle">Media Controls Visualizer</div>
        {error && <div className="debug-error">{error}</div>}

        <div className="controls">
          <button className="btn btn-disabled">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button className="btn btn-play" onClick={togglePlay}>
            {isPlaying
              ? (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )
              : (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
          </button>
          <button className="btn btn-disabled">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div
          className="progress-container"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (videoRef.current?.duration) {
              videoRef.current.currentTime = (x / rect.width) *
                videoRef.current.duration;
            }
          }}
        >
          <div
            ref={progressRef}
            className="progress-bar"
            style={{ width: "0%" }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
