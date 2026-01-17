import React, { useEffect, useRef, useState } from "react";

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>();
  const fps = 30;

  // Sync isPlaying state with video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const lastMetadataUpdateRef = useRef<number>(0);

  // Main update loop for SMTC artwork and UI progress
  const updateLoop = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Update UI Progress every frame for smoothness
    if (video.duration) {
      const p = (video.currentTime / video.duration) * 100;
      setProgress(p);
    }

    // Update SMTC (Throttled to fps)
    if (
      "mediaSession" in navigator &&
      time - lastMetadataUpdateRef.current >= 1000 / fps
    ) {
      lastMetadataUpdateRef.current = time;
      const currentTime = video.currentTime;
      const currentFrame = Math.floor(currentTime * fps) + 1;
      const paddedFrame = String(currentFrame).padStart(4, "0");
      const artworkUrl = `/assets/frames/output_${paddedFrame}.jpg`;

      // Update Artwork
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Bad Apple!!",
        artist: "Alstroemeria Records",
        album: "Traditional Remix",
        artwork: [
          { src: artworkUrl, sizes: "480x360", type: "image/jpeg" },
        ],
      });

      // Update Position State for OS sync
      if ("setPositionState" in navigator.mediaSession && video.duration) {
        try {
          navigator.mediaSession.setPositionState({
            duration: video.duration,
            playbackRate: video.playbackRate,
            position: video.currentTime,
          });
        } catch (e) {
          // Ignore errors
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
      video.play().catch(console.error);
      requestRef.current = requestAnimationFrame(updateLoop);
    } else {
      video.pause();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler(
        "pause",
        () => setIsPlaying(false),
      );
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

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
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
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default App;
