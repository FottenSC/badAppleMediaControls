import React, { useEffect, useRef, useState } from "react";

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastMetadataUpdateRef = useRef<number>(0);
  const preloadedFrames = useRef<Set<string>>(new Set());
  const fps = 30;

  // Improved Mobile detection
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    // Set stable metadata for mobile immediately
    if (isMobile && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Bad Apple!!",
        artist: "Alstroemeria Records",
        album: "Traditional Remix",
        artwork: [
          {
            src: `${window.location.origin}/assets/frames/output_0001.jpg`,
            sizes: "480x360",
            type: "image/jpeg",
          },
        ],
      });
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const preloadFrames = (startFrame: number, count: number) => {
    if (isMobile) return;
    for (let i = 1; i <= count; i++) {
      const frameNum = startFrame + i;
      if (frameNum > 6571) break;
      const padded = String(frameNum).padStart(4, "0");
      const url = `/assets/frames/output_${padded}.jpg`;

      if (!preloadedFrames.current.has(url)) {
        const img = new Image();
        img.src = url;
        preloadedFrames.current.add(url);
        if (preloadedFrames.current.size > 50) {
          const iterator = preloadedFrames.current.values();
          const first = iterator.next().value;
          if (first) preloadedFrames.current.delete(first);
        }
      }
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
      if (
        "setPositionState" in navigator.mediaSession && video.duration &&
        !isNaN(video.duration)
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: video.duration,
            playbackRate: video.playbackRate,
            position: video.currentTime,
          });
        } catch (e) { /* ignore */ }
      }

      // NO high-frequency metadata updates on mobile. It crashes iOS Safari.
      if (!isMobile && time - lastMetadataUpdateRef.current >= 1000 / fps) {
        lastMetadataUpdateRef.current = time;
        const currentFrame = Math.floor(video.currentTime * fps) + 1;
        const paddedFrame = String(currentFrame).padStart(4, "0");
        const artworkUrl =
          `${window.location.origin}/assets/frames/output_${paddedFrame}.jpg`;

        preloadFrames(currentFrame, 5);

        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Bad Apple!!",
          artist: "Alstroemeria Records",
          album: "Traditional Remix",
          artwork: [{ src: artworkUrl, sizes: "480x360", type: "image/jpeg" }],
        });
      }
    }

    if (!video.paused) {
      requestRef.current = requestAnimationFrame(updateLoop);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
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
    }
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        video.muted = false;
        await video.play();
      } catch (err) {
        console.warn("Unmuted play failed, fallback to muted", err);
        video.muted = true;
        await video.play().catch((e) =>
          console.error("Total playback failure", e)
        );
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
        src="/assets/badapple.mp4"
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
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
