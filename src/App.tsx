import React, { useEffect, useRef, useState } from "react";

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const preloadedFrames = useRef<Set<string>>(new Set());
  const unlocked = useRef(false);
  const fps = 30;

  // Modern Silent Sound (MP3) for iOS Audio Context Unlock
  const SILENT_SOUND =
    "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuMTAwA/+8AAAAAAAAAAAAA";

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (typeof navigator.platform === "string" &&
      navigator.platform.includes("Mac") && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Prime the media engine
    video.load();

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      const err = video.error;
      if (err) {
        setError(
          `Playback Error: ${
            err.message || err.code
          }. Check if video exists at /assets/badapple.mp4`,
        );
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);

    // Initial Metadata Hint
    if (isMobile && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Bad Apple!!",
          artist: "Alstroemeria Records",
          album: "Traditional Remix",
          artwork: [{
            src: `${window.location.origin}/assets/frames/output_0001.jpg`,
            sizes: "480x360",
            type: "image/jpeg",
          }],
        });
      } catch (e) {}
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
    };
  }, []);

  const setupMediaSession = () => {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Bad Apple!!",
        artist: "Alstroemeria Records",
        album: "Traditional Remix",
        artwork: [{
          src: `${window.location.origin}/assets/frames/output_0001.jpg`,
          sizes: "480x360",
          type: "image/jpeg",
        }],
      });

      // Handlers
      navigator.mediaSession.setActionHandler(
        "play",
        () => videoRef.current?.play().catch(() => {}),
      );
      navigator.mediaSession.setActionHandler(
        "pause",
        () => videoRef.current?.pause(),
      );
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (videoRef.current && details.seekTime !== undefined) {
          videoRef.current.currentTime = details.seekTime;
        }
      });
    } catch (e) {
      console.warn("MediaSession setup failed", e);
    }
  };

  const updateLoop = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.duration && progressRef.current) {
      const p = (video.currentTime / video.duration) * 100;
      progressRef.current.style.width = `${p}%`;
    }

    if ("mediaSession" in navigator) {
      // Heavily throttle position updates on mobile to prevent SMTC flickering/crashing
      const shouldUpdatePosition = !isMobile ||
        (time - lastUpdateRef.current >= 2000);

      if (
        shouldUpdatePosition && "setPositionState" in navigator.mediaSession &&
        video.duration && isFinite(video.duration)
      ) {
        try {
          if (isMobile) lastUpdateRef.current = time;
          navigator.mediaSession.setPositionState({
            duration: video.duration,
            playbackRate: video.playbackRate,
            position: Math.max(0, Math.min(video.currentTime, video.duration)),
          });
        } catch (e) {}
      }

      // 30FPS Metadata updates ONLY on desktop. Crashes iPhone Safari.
      if (!isMobile && time - lastUpdateRef.current >= 1000 / fps) {
        lastUpdateRef.current = time;
        const currentFrame = Math.floor(video.currentTime * fps) + 1;
        const paddedFrame = String(currentFrame).padStart(4, "0");
        const artworkUrl =
          `${window.location.origin}/assets/frames/output_${paddedFrame}.jpg`;

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
        } catch (e) {}
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

    // iOS Audio Context Unlock
    if (!unlocked.current) {
      try {
        const audio = new Audio(SILENT_SOUND);
        audio.play().catch(() => {});
      } catch (e) {}
      unlocked.current = true;
    }

    if (video.paused) {
      // iOS Start Strategy: Muted -> Play -> Success -> Unmute
      video.muted = true;
      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          video.muted = false;
          setupMediaSession();
        }).catch((err) => {
          console.error("Play failed", err);
          // Fallback to purely muted
          video.muted = true;
          video.play().then(() => {
            setIsPlaying(true);
            setError("Playing muted (iOS limitation)");
            setupMediaSession();
          }).catch((e2) => {
            setError(`Playback failed: ${e2.message}`);
          });
        });
      }
    } else {
      video.pause();
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (videoRef.current?.duration) {
      videoRef.current.currentTime = (x / rect.width) *
        videoRef.current.duration;
    }
  };

  return (
    <div className="app-container">
      <video
        ref={videoRef}
        id="bg-video"
        loop
        playsInline
        muted
        preload="auto"
      >
        <source src="/assets/badapple.mp4" type="video/mp4" />
      </video>

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

        <div className="progress-container" onClick={handleProgressBarClick}>
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
