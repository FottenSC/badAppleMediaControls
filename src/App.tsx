import React, { useState, useRef, useEffect } from 'react';

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fps = 30;
  const frameCount = 6571; // Approximate for Bad Apple

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateMediaSession = () => {
      if ('mediaSession' in navigator) {
        const currentTime = video.currentTime;
        const currentFrame = Math.floor(currentTime * fps) + 1;
        const paddedFrame = String(currentFrame).padStart(4, '0');
        const artworkUrl = `/assets/frames/output_${paddedFrame}.jpg`;

        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Bad Apple!!',
          artist: 'Alstroemeria Records',
          album: 'Traditional Remix',
          artwork: [
            { src: artworkUrl, sizes: '480x360', type: 'image/jpeg' }
          ]
        });
      }
    };

    let smtcInterval: number;

    if (isPlaying) {
      video.play();
      smtcInterval = window.setInterval(updateMediaSession, 1000 / fps);
    } else {
      video.pause();
    }

    return () => clearInterval(smtcInterval);
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const p = (video.currentTime / video.duration) * 100;
      setProgress(p);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (videoRef.current) videoRef.current.currentTime -= (details.seekOffset || 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (videoRef.current) videoRef.current.currentTime += (details.seekOffset || 10);
      });
    }
  }, []);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = x / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = clickedProgress * videoRef.current.duration;
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
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button className="btn btn-play" onClick={togglePlay}>
            {isPlaying ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button className="btn btn-disabled">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
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
