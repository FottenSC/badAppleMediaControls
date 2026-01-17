import React, { useEffect, useRef, useState } from "react";

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastMetadataUpdateRef = useRef<number>(0);
  const preloadedFrames = useRef<Set<string>>(new Set());
  const fps = 30;

  // iOS/Mobile detection to disable heavy effects
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Sync isPlaying state with video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    // Initial interaction sync for iOS
    const handleFirstInteraction = () => {
      if (video.paused) video.load();
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("mousedown", handleFirstInteraction);
    };
    document.addEventListener("touchstart", handleFirstInteraction);
    document.addEventListener("mousedown", handleFirstInteraction);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("mousedown", handleFirstInteraction);
    };
  }, []);

  // Preload function to keep frames in browser cache
  const preloadFrames = (startFrame: number, count: number) => {
    if (isMobile) return;
    for (let i = 1; i <= count; i++) {
      const frameNum = startFrame + i;
      const padded = String(frameNum).padStart(4, "0");
      const url = `/assets/frames/output_${padded}.jpg`;

      if (!preloadedFrames.current.has(url)) {
        const img = new Image();
        img.src = url;
        preloadedFrames.current.add(url);

        if (preloadedFrames.current.size > 100) {
          const first = preloadedFrames.current.values().next().value;
          if (first) preloadedFrames.current.delete(first);
        }
      }
    }
  };

  // Main update loop for SMTC artwork and UI progress
  const updateLoop = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Update UI Progress every frame for smoothness (Direct DOM update)
    if (video.duration && progressRef.current) {
      const p = (video.currentTime / video.duration) * 100;
      progressRef.current.style.width = `${p}%`;
    }

    // Update SMTC (Throttled to fps, heavily throttled on mobile)
    if ("mediaSession" in navigator) {
      const timeSinceLastUpdate = time - lastMetadataUpdateRef.current;
      const updateInterval = isMobile ? 5000 : (1000 / fps);

      if (timeSinceLastUpdate >= updateInterval) {
        lastMetadataUpdateRef.current = time;
        try {
          const currentTime = video.currentTime;
          const currentFrame = Math.floor(currentTime * fps) + 1;
          const paddedFrame = String(currentFrame).padStart(4, "0");
          const artworkUrl = `/assets/frames/output_${paddedFrame}.jpg`;

          if (!isMobile) preloadFrames(currentFrame, 5);

          navigator.mediaSession.metadata = new MediaMetadata({
            title: "Bad Apple!!",
            artist: "Alstroemeria Records",
            album: "Traditional Remix",
            artwork: [
              { src: artworkUrl, sizes: "480x360", type: "image/jpeg" },
            ],
          });

          if ("setPositionState" in navigator.mediaSession && video.duration) {
            navigator.mediaSession.setPositionState({
              duration: video.duration,
              playbackRate: video.playbackRate,
              position: video.currentTime,
            });
          }
        } catch (e) {
          console.error("MediaSession update failed:", e);
        }
      }
    }

    if (!video.paused) {
      requestRef.current = requestAnimationFrame(updateLoop);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (e) {
            console.error("SMTC Play failed:", e);
          }
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (videoRef.current) videoRef.current.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        if (videoRef.current) {
          videoRef.current.currentTime -= details.seekOffset || 10;
        }
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        if (videoRef.current) {
          videoRef.current.currentTime += details.seekOffset || 10;
        }
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (videoRef.current && details.seekTime !== undefined) {
          videoRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (!video.paused) {
        video.pause();
      } else {
        video.muted = false;
        await video.play();
      }
    } catch (err) {
      console.error("Toggle play failed:", err);
      try {
        video.muted = true;
        await video.play();
      } catch (mutedErr) {
        console.error("Muted playback failed too:", mutedErr);
      }
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = x / rect.width;
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = clickedProgress *
        videoRef.current.duration;
    }
  };

  return (
    <div className="app-container">
      <video
        ref={videoRef}
        id="bg-video"
        src="/assets/badapple.mp4"
        loop
        playsInline
        preload="auto"
      />

      <div className="glass-panel">
        <h1>Bad Apple!!</h1>
        <div className="subtitle">Media Controls Visualizer</div>

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
