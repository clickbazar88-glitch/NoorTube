/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Shield, BookOpen, Mic2, CheckCircle2, Youtube, Facebook, X, Maximize2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

interface Video {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { medium: { url: string } };
    channelTitle: string;
    duration?: string;
  };
  category?: string;
}

const CATEGORIES = [
  { id: 'all', name: 'সব ভিডিও', icon: Shield },
  { id: 'quran', name: 'কুরআন তিলাওয়াত', icon: BookOpen },
  { id: 'nasheed', name: 'ইসলামিক নাশিদ', icon: Mic2 },
];

const LOGO_URL = "https://scontent.fzyl5-1.fna.fbcdn.net/v/t39.30808-6/649163336_1416925630180409_4522839099495848391_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=13d280&_nc_eui2=AeHLHO5w4ADDaToQJMu2Yk3TzLtMfXfBuo3Mu0x9d8G6jY9stzOt-EYhMrpDjf8kpbAfJEfGD77xyJe05xnixMi-&_nc_ohc=ugK_Bzv-sLcQ7kNvwEnrUd4&_nc_oc=Adl4f8D0maMaSh4julxFaQWkzdWe9mCNxeYNBAoWwynZd3uBNc8RUX_h0J9iBSiV3VuPxmuvOnS2-EguOmH56lkj&_nc_zt=23&_nc_ht=scontent.fzyl5-1.fna&_nc_gid=jhb-ByfWQdF4F6m0D5iuPQ&_nc_ss=8&oh=00_AfwGQo08ehr2d3r2QSgAaJ8c8kk-dvcSJ5YBhBQ5YoDF9g&oe=69B3348F";
const DEV_PHOTO_URL = "https://scontent.fzyl5-2.fna.fbcdn.net/v/t39.30808-6/648066219_1416925543513751_7928287528879299861_n.jpg?_nc_cat=110&ccb=1-7&_nc_sid=13d280&_nc_eui2=AeHCXFDlFVCyYYXNAeJB4ZSrVl5QbOk8BU5WXlBs6TwFTvwL1daAI_W0HUdbm-1TmQZbYnEazUS3vPVwtpRPI1fn&_nc_ohc=yYK3044YA00Q7kNvwHZcLEA&_nc_oc=Adk1cV_nH7m6UCy3zLKqzJlItSr8uKx7RTPNTt0S8-cCJKqVsE6aD-A30fsxJVyxVhsOkQPbJuJ_ybUDNI9lGXrn&_nc_zt=23&_nc_ht=scontent.fzyl5-2.fna&_nc_gid=MTHYMpfq8sz1ux9sZECJBQ&_nc_ss=8&oh=00_Afz1wbacK-d3Jla42nL0fbBikYg-whi5eCMa_uG91IGWxw&oe=69B32B0F";

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [lastTime, setLastTime] = useState(0);
  const [isShortsView, setIsShortsView] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApiReady, setIsApiReady] = useState(!!(window as any).YT && !!(window as any).YT.Player);
  const playerRef = useRef<any>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [startY, setStartY] = useState(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].pageY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].pageY;
      if (window.scrollY === 0 && endY - startY > 150 && !isRefreshing) {
        handleRefresh();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, isRefreshing, debouncedQuery, activeCategory]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
      setIsApiReady(true);
    };

    if ((window as any).YT && (window as any).YT.Player) {
      setIsApiReady(true);
    }
  }, []);

  const onPlayerReady = (event: any) => {
    setPlayer(event.target);
    playerRef.current = event.target;
  };

  const onPlayerStateChange = (event: any) => {
    setIsPlaying(event.data === 1);
    
    if ('mediaSession' in navigator) {
      switch (event.data) {
        case 1: // Playing
          navigator.mediaSession.playbackState = 'playing';
          break;
        case 2: // Paused
          navigator.mediaSession.playbackState = 'paused';
          break;
        case 0: // Ended
          navigator.mediaSession.playbackState = 'none';
          break;
        default:
          break;
      }
    }
  };

  useEffect(() => {
    let timer: any = null;

    if (selectedVideo && isApiReady) {
      // Small delay to ensure the div is in the DOM
      timer = setTimeout(() => {
        const playerId = isMiniPlayer 
          ? `youtube-player-mini-${selectedVideo.id.videoId}`
          : `youtube-player-${selectedVideo.id.videoId}`;
        
        const playerElement = document.getElementById(playerId);
        
        if (playerElement) {
          // Destroy existing player before creating a new one
          if (playerRef.current && playerRef.current.destroy) {
            try {
              playerRef.current.destroy();
            } catch (e) {
              console.error('Error destroying player:', e);
            }
            playerRef.current = null;
          }

          const currentPlayer = new (window as any).YT.Player(playerId, {
            videoId: selectedVideo.id.videoId,
            playerVars: {
              autoplay: 1,
              controls: 1, // Enable native controls
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
              iv_load_policy: 3,
              disablekb: 0, // Enable keyboard shortcuts
              fs: 1, // Enable native fullscreen
              origin: window.location.origin,
              start: Math.floor(lastTime), // Resume from last time
            },
            events: {
              onReady: (event: any) => {
                onPlayerReady(event);
                // Explicitly play video to ensure it starts
                event.target.playVideo();
                
                // Setup Media Session for background play
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.metadata = new MediaMetadata({
                    title: selectedVideo.snippet.title,
                    artist: selectedVideo.snippet.channelTitle,
                    artwork: [
                      { src: selectedVideo.snippet.thumbnails.high.url, sizes: '480x360', type: 'image/jpeg' },
                      { src: selectedVideo.snippet.thumbnails.medium.url, sizes: '320x180', type: 'image/jpeg' }
                    ]
                  });

                  // Add action handlers for background control
                  navigator.mediaSession.setActionHandler('play', () => {
                    event.target.playVideo();
                  });
                  navigator.mediaSession.setActionHandler('pause', () => {
                    event.target.pauseVideo();
                  });
                  navigator.mediaSession.setActionHandler('seekbackward', () => {
                    const currentTime = event.target.getCurrentTime();
                    event.target.seekTo(Math.max(currentTime - 10, 0), true);
                  });
                  navigator.mediaSession.setActionHandler('seekforward', () => {
                    const currentTime = event.target.getCurrentTime();
                    event.target.seekTo(currentTime + 10, true);
                  });
                  navigator.mediaSession.setActionHandler('stop', () => {
                    event.target.stopVideo();
                    setSelectedVideo(null);
                  });
                }
              },
              onStateChange: onPlayerStateChange,
            },
          });
          playerRef.current = currentPlayer;
        }
      }, 500);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('Error destroying player in cleanup:', e);
        }
        playerRef.current = null;
      }
      setPlayer(null);
    };
  }, [selectedVideo, isMiniPlayer]); // Re-init on mode change but with lastTime

  // Track time to resume and update media session position
  useEffect(() => {
    if (isPlaying && player && player.getCurrentTime) {
      const interval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        setLastTime(currentTime);
        
        // Update Media Session position state for OS controls
        if ('mediaSession' in navigator && player.getDuration) {
          try {
            navigator.mediaSession.setPositionState({
              duration: player.getDuration(),
              playbackRate: player.getPlaybackRate() || 1,
              position: currentTime
            });
          } catch (e) {
            // Some browsers might throw if data is inconsistent
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, player]);

  // Recommendation logic: Track watched categories
  const trackWatch = (video: Video) => {
    const watched = JSON.parse(localStorage.getItem('watched_categories') || '{}');
    const title = video.snippet.title.toLowerCase();
    
    if (title.includes('quran')) watched.quran = (watched.quran || 0) + 1;
    if (title.includes('nasheed')) watched.nasheed = (watched.nasheed || 0) + 1;
    if (title.includes('waz')) watched.waz = (watched.waz || 0) + 1;
    
    localStorage.setItem('watched_categories', JSON.stringify(watched));
  };

  const getRecommendedQuery = () => {
    const watched = JSON.parse(localStorage.getItem('watched_categories') || '{}');
    const sorted = Object.entries(watched).sort((a: any, b: any) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : '';
  };

  // Search Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // AI Validator Logic (Moved to frontend as per guidelines)
  const validateVideoWithAI = async (video: Video) => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      return { isIslamic: true, category: "Other" };
    }

    const prompt = `
      Analyze the following YouTube video metadata and determine if it is strictly "Islamic Content".
      Islamic content includes: Quran Tilawat, Tafsir, Hadith, Islamic Lectures, Nasheeds (without instruments or halal), Islamic History, and Halal Lifestyle.
      Block: Music, non-Islamic religious content, political propaganda, or misleading clickbait.

      Title: ${video.snippet.title}
      Description: ${video.snippet.description}

      Return a JSON object with:
      {
        "isIslamic": boolean,
        "category": "Tilawat" | "Lecture" | "Short" | "Nasheed" | "Other",
        "reason": "string"
      }
    `;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isIslamic: { type: Type.BOOLEAN },
              category: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["isIslamic", "category", "reason"]
          }
        }
      });

      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error("AI Validation Error:", error);
      return { isIslamic: true, category: "Other" }; // Fallback to allow content if AI fails
    }
  };

  const fetchVideos = async (query = '', category = 'all', isAppend = false) => {
    if (!isAppend) {
      setLoading(true);
      setPage(1);
    }
    
    setError(null);
    try {
      let finalQuery = query;
      if (category === 'all' && !query) {
        const wazKeywords = ['New Waz 2024', 'Mizanur Rahman Azhari Waz', 'Islamic Short Film', 'Islamic Lecture', 'Halal Entertainment'];
        const randomKeyword = wazKeywords[Math.floor(Math.random() * wazKeywords.length)];
        finalQuery = randomKeyword;
      }

      const cacheKey = `videos_${category}_${finalQuery.toLowerCase().trim()}`;
      
      if (!isAppend) {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData && query) {
          try {
            const parsed = JSON.parse(cachedData);
            if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
              setVideos(parsed.videos);
              setLoading(false);
              setError(null);
              return;
            }
          } catch (e) {
            sessionStorage.removeItem(cacheKey);
          }
        }
      }

      let q = finalQuery;
      const recommended = getRecommendedQuery();
      
      if (category === 'quran') q = `${finalQuery} Quran Tilawat`;
      else if (category === 'nasheed') q = `${finalQuery} Islamic Nasheed`;
      else if (category === 'all' && !finalQuery && recommended) q = recommended;
      
      const response = await fetch(`/api/videos?q=${encodeURIComponent(q)}&page=${isAppend ? page + 1 : 1}`);
      const contentType = response.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        const videoList = data.videos || [];
        
        // Filter videos with AI on the frontend
        const validatedVideos: Video[] = [];
        // Process in small batches to avoid hitting rate limits too hard
        const batchSize = 5;
        for (let i = 0; i < videoList.length; i += batchSize) {
          const batch = videoList.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(async (v: Video) => {
            const aiResult = await validateVideoWithAI(v);
            return aiResult.isIslamic ? v : null;
          }));
          validatedVideos.push(...results.filter((v): v is Video => v !== null));
          
          // If we already have enough videos for the first page, we can stop or continue
          if (!isAppend && validatedVideos.length >= 12) break;
        }
        
        if (isAppend) {
          setVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id.videoId));
            const uniqueNewVideos = validatedVideos.filter(v => v.id?.videoId && !existingIds.has(v.id.videoId));
            return [...prev, ...uniqueNewVideos];
          });
          setPage(prev => prev + 1);
        } else {
          // Even for non-append, ensure uniqueness just in case
          const seen = new Set();
          const uniqueVideos = validatedVideos.filter(v => {
            if (!v.id?.videoId || seen.has(v.id.videoId)) return false;
            seen.add(v.id.videoId);
            return true;
          });
          setVideos(uniqueVideos);
        }

        setHasMore(videoList.length > 0);
        
        // Save to cache (only for first page)
        if (!isAppend && validatedVideos.length > 0) {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            videos: validatedVideos,
            timestamp: Date.now()
          }));
        }
      } else {
        throw new Error('সার্ভার থেকে ভুল তথ্য এসেছে।');
      }
    } catch (error: any) {
      console.error('Error fetching videos:', error);
      setError(error.message || 'ভিডিও লোড করতে সমস্যা হয়েছে।');
      if (!isAppend) setVideos([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchRelatedVideos = async (video: Video) => {
    try {
      const response = await fetch(`/api/videos/related?videoId=${video.id.videoId}&q=${encodeURIComponent(video.snippet.title)}`);
      const contentType = response.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok) {
          const videoList = data.videos || [];
          const seen = new Set();
          const uniqueVideos = videoList.filter((v: any) => {
            if (!v.id?.videoId || seen.has(v.id.videoId)) return false;
            seen.add(v.id.videoId);
            return true;
          });
          setRelatedVideos(uniqueVideos);
        }
      }
    } catch (error) {
      console.error('Error fetching related videos:', error);
    }
  };

  const handleVideoSelect = (video: Video, startMinimized = false) => {
    if (!video || !video.id || !video.id.videoId) return;
    setLastTime(0); // Reset time for new video
    setSelectedVideo(video);
    setIsMiniPlayer(startMinimized);
  };

  useEffect(() => {
    fetchVideos(debouncedQuery, activeCategory);
  }, [debouncedQuery, activeCategory]);

  useEffect(() => {
    if (activeCategory === 'shorts') {
      setIsShortsView(true);
    } else {
      setIsShortsView(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (selectedVideo) {
      fetchRelatedVideos(selectedVideo);
      trackWatch(selectedVideo);
    }
  }, [selectedVideo]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchVideos(debouncedQuery, activeCategory, true);
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, debouncedQuery, activeCategory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchVideos(debouncedQuery, activeCategory, false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQuery(searchQuery);
    setIsSearchOpen(false);
  };

  const handleLogoClick = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveCategory('all');
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#E5E1D8] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4 h-16">
          <AnimatePresence mode="wait">
            {!isSearchOpen ? (
              <motion.div 
                key="nav"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between w-full gap-4"
              >
                {/* Logo Section */}
                <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={handleLogoClick}>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2D5A27] rounded-xl flex items-center justify-center overflow-hidden shadow-lg border-2 border-white group-hover:scale-105 transition-transform">
                    <img src={LOGO_URL} alt="NoorTube Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="block">
                    <h1 className="text-xl font-black tracking-tighter text-[#2D5A27] leading-none">NoorTube</h1>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Search Trigger */}
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2.5 bg-[#F5F2ED] hover:bg-[#E5E1D8] rounded-full text-[#2D5A27] transition-all"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  {/* Dev Section */}
                  <button 
                    onClick={() => setShowDevInfo(true)}
                    className="group relative p-0.5 rounded-xl border-2 border-[#E5E1D8] hover:border-[#2D5A27] transition-all bg-white shadow-sm shrink-0"
                    title="Developer Info"
                  >
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden">
                      <img src={DEV_PHOTO_URL} alt="Dev" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#2D5A27] rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="search"
                initial={{ opacity: 0, width: '0%' }}
                animate={{ opacity: 1, width: '100%' }}
                exit={{ opacity: 0, width: '0%' }}
                className="flex items-center gap-3 w-full"
              >
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-2 hover:bg-[#F5F2ED] rounded-full text-[#8C8573]"
                >
                  <X className="w-6 h-6" />
                </button>
                <form onSubmit={handleSearch} className="relative flex-1">
                  <input
                    autoFocus
                    type="text"
                    placeholder="হালাল ভিডিও খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#F5F2ED] border-2 border-[#2D5A27]/20 rounded-full py-2.5 md:py-3 px-6 focus:border-[#2D5A27]/50 focus:bg-white transition-all outline-none text-sm font-medium"
                  />
                  <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2D5A27]">
                    <Search className="w-5 h-5" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main 
        className={`max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 ${isShortsView ? 'h-[calc(100vh-120px)] overflow-hidden' : ''}`}
        onScroll={(e: any) => {
          if (e.target.scrollTop === 0 && !isRefreshing) {
            // Potential pull to refresh trigger
          }
        }}
      >
        {/* Pull to Refresh Indicator */}
        <AnimatePresence>
          {isRefreshing && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 40, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <div className="w-6 h-6 border-2 border-[#2D5A27] border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-[#2D5A27] text-white shadow-md shadow-[#2D5A27]/20'
                  : 'bg-white border border-[#E5E1D8] text-[#5C5747] hover:border-[#2D5A27]/30'
              }`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Video Grid or Shorts View */}
        {isShortsView ? (
          <div className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center">
            {videos.map((video) => (
              <div 
                key={video.id.videoId} 
                className="snap-start min-h-full w-full max-w-md flex items-center justify-center p-4"
              >
                <div 
                  className="relative w-full aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl cursor-pointer group"
                  onClick={() => handleVideoSelect(video)}
                >
                  <img
                    src={video.snippet.thumbnails.medium.url}
                    alt={video.snippet.title}
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                    <h3 className="text-white font-bold text-lg mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: video.snippet.title }} />
                    <p className="text-white/70 text-sm">{video.snippet.channelTitle}</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleVideoSelect(video, false); }}
                      className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      title="Play Video"
                    >
                      <Play className="w-8 h-8 text-white fill-current" />
                    </button>
                  </div>
                  {video.snippet.duration && (
                    <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/70 backdrop-blur-md rounded text-[10px] text-white font-bold z-10">
                      {video.snippet.duration}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 md:gap-4">
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-[#E5E1D8] rounded-xl mb-2" />
                  <div className="h-3 bg-[#E5E1D8] rounded w-3/4 mb-1" />
                  <div className="h-2 bg-[#E5E1D8] rounded w-1/2" />
                </div>
              ))
            ) : error ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">সমস্যা হয়েছে</h3>
                <p className="text-red-600 max-w-md mb-2 font-medium">{error}</p>
                {error.includes('কোটা শেষ') && (
                  <p className="text-sm text-[#8C8573] mb-6 max-w-sm">
                    ইউটিউব এপিআই-এর দৈনিক লিমিট শেষ হয়ে গেছে। এটি সাধারণত প্রতিদিন বাংলাদেশ সময় দুপুর ১টার পর রিসেট হয়। আপনি চাইলে অন্য একটি এপিআই কী ব্যবহার করতে পারেন।
                  </p>
                )}
                <button 
                  onClick={() => fetchVideos('', activeCategory)}
                  className="px-6 py-2.5 bg-[#2D5A27] text-white rounded-full font-bold hover:bg-[#3a7533] transition-all shadow-lg shadow-[#2D5A27]/20"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            ) : videos.length > 0 ? (
              <>
                {videos.map((video) => (
                  <motion.div
                    key={video.id.videoId}
                    onClick={() => handleVideoSelect(video)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-lg transition-all duration-300">
                      <img
                        src={video.snippet.thumbnails.medium.url}
                        alt={video.snippet.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleVideoSelect(video, false); }}
                          className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          title="Play Video"
                        >
                          <Play className="w-5 h-5 text-[#2D5A27] fill-current" />
                        </button>
                      </div>
                      {video.snippet.duration && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] text-white font-bold z-10">
                          {video.snippet.duration}
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-[11px] md:text-xs line-clamp-2 mb-0.5 group-hover:text-[#2D5A27] transition-colors leading-tight" dangerouslySetInnerHTML={{ __html: video.snippet.title }} />
                    <p className="text-[10px] text-[#8C8573] font-medium">{video.snippet.channelTitle}</p>
                  </motion.div>
                ))}
                {/* Infinite Scroll Trigger */}
                <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                  {hasMore && (
                    <div className="w-8 h-8 border-4 border-[#2D5A27] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </>
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-[#F5F2ED] rounded-full flex items-center justify-center mb-4">
                  <Search className="w-10 h-10 text-[#8C8573]" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">কোন ভিডিও পাওয়া যায়নি</h3>
                <p className="text-[#8C8573] max-w-xs mb-6">আপনার সার্চ কিউরি পরিবর্তন করে আবার চেষ্টা করুন অথবা ক্যাটাগরি পরিবর্তন করুন।</p>
                <button 
                  onClick={() => fetchVideos('', activeCategory)}
                  className="px-6 py-2.5 bg-[#2D5A27] text-white rounded-full font-bold hover:bg-[#3a7533] transition-all shadow-lg shadow-[#2D5A27]/20"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Custom Video Player Overlay */}
      <AnimatePresence>
        {selectedVideo && !isMiniPlayer && (
          <motion.div
            key={`player-overlay-${selectedVideo.id.videoId}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-[#FDFCF8] overflow-y-auto"
          >
            <div className="max-w-6xl mx-auto min-h-screen flex flex-col lg:flex-row lg:gap-8 lg:p-8">
              {/* Main Player Area */}
              <div className="flex-1 pointer-events-auto">
                <div className="sticky top-0 z-50 lg:top-8 bg-black">
                  {/* Top Bar for Mobile */}
                  <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-black text-white">
                    <button 
                      onClick={() => setIsMiniPlayer(true)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className="relative aspect-video w-full lg:rounded-3xl overflow-hidden shadow-2xl group/player">
                    <div 
                      id={`youtube-player-${selectedVideo.id.videoId}`} 
                      className="w-full h-full" 
                    />

                    {/* Desktop Controls */}
                    <div className="hidden lg:flex absolute top-4 right-4 z-50 gap-2">
                      <button 
                        onClick={() => setIsMiniPlayer(true)}
                        className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors"
                        title="Mini Player"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (isPlaying) {
                            setIsMiniPlayer(true);
                          } else {
                            setSelectedVideo(null);
                          }
                        }}
                        className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors"
                        title={isPlaying ? "Minimize to Background" : "Close"}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 px-4 lg:px-0 text-[#1A1A1A]">
                  <h2 className="text-xl md:text-2xl font-bold mb-2 leading-tight" dangerouslySetInnerHTML={{ __html: selectedVideo.snippet.title }} />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-y border-[#E5E1D8] gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#2D5A27] rounded-full flex items-center justify-center font-bold text-white">
                        {selectedVideo.snippet.channelTitle[0]}
                      </div>
                      <div>
                        <p className="font-bold text-base md:text-lg">{selectedVideo.snippet.channelTitle}</p>
                        <p className="text-xs text-[#8C8573]">Verified Islamic Channel</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 bg-[#F5F2ED] hover:bg-[#E5E1D8] rounded-full transition-colors text-sm font-medium">
                        <Share2 className="w-4 h-4" /> শেয়ার
                      </button>
                      <button className="flex items-center gap-2 px-6 py-2 bg-[#2D5A27] hover:bg-[#3a7533] rounded-full transition-colors text-sm font-bold text-white">
                        সাবস্ক্রাইব
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-[#F5F2ED] rounded-2xl text-sm text-[#1A1A1A] leading-relaxed max-h-40 overflow-y-auto">
                    {selectedVideo.snippet.description || 'কোনো ডেসক্রিপশন দেওয়া হয়নি।'}
                  </div>
                </div>
              </div>

              {/* Recommendations Sidebar */}
              <div className="w-full lg:w-96 space-y-4 px-4 lg:px-0 mt-6 lg:mt-0 pb-8">
                <h3 className="text-[#1A1A1A] font-bold text-lg flex items-center gap-2">
                  <Play className="w-5 h-5 text-[#2D5A27]" /> আপনার জন্য সাজেশন্স
                </h3>
                <div className="space-y-3">
                  {relatedVideos.map((video) => (
                    <div 
                      key={video.id.videoId}
                      onClick={() => handleVideoSelect(video)}
                      className="flex gap-3 group cursor-pointer"
                    >
                      <div className="relative w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0">
                        <img 
                          src={video.snippet.thumbnails.medium.url} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-current" />
                        </div>
                        {video.snippet.duration && (
                          <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 backdrop-blur-md rounded text-[10px] text-white font-bold z-10">
                            {video.snippet.duration}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 py-1">
                        <h4 className="text-[#1A1A1A] text-sm font-semibold line-clamp-2 group-hover:text-[#2D5A27] transition-colors leading-tight" dangerouslySetInnerHTML={{ __html: video.snippet.title }} />
                        <p className="text-[#8C8573] text-[11px] mt-1 font-medium">{video.snippet.channelTitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Player (Background Play Simulation) */}
      <AnimatePresence>
        {selectedVideo && isMiniPlayer && (
          <motion.div
            key={`mini-player-${selectedVideo.id.videoId}`}
            drag
            dragConstraints={{ left: -300, right: 0, top: -500, bottom: 0 }}
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-[110] w-72 bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E5E1D8] cursor-move"
          >
            <div className="relative aspect-video bg-black">
              <div 
                id={`youtube-player-mini-${selectedVideo.id.videoId}`} 
                className="w-full h-full" 
              />
              
              <div className="absolute top-2 right-2 flex gap-1 z-30">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMiniPlayer(false); }}
                  className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedVideo(null); }}
                  className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-bold line-clamp-1" dangerouslySetInnerHTML={{ __html: selectedVideo.snippet.title }} />
                <p className="text-[8px] text-[#8C8573]">{selectedVideo.snippet.channelTitle}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Info Modal */}
      <AnimatePresence>
        {showDevInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowDevInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-40 bg-gradient-to-br from-[#2D5A27] to-[#1a3a16] relative">
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-32 h-32 rounded-[2.5rem] border-8 border-white bg-[#F5F2ED] overflow-hidden shadow-2xl rotate-3">
                  <img 
                    src={DEV_PHOTO_URL} 
                    alt="Developer" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="pt-20 pb-12 px-10 text-center">
                <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tighter">Tayem Ahmed</h2>
                <p className="text-[#2D5A27] font-black text-xs uppercase tracking-[0.3em] mb-8 mt-2">Apps & Web Developer</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <a 
                    href="https://youtube.com/@tayemahmed-o2s?si=17FPZGcFP3NYHHGS" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-[#F5F2ED] rounded-[2rem] group hover:bg-[#FF0000] transition-all duration-500"
                  >
                    <Youtube className="w-8 h-8 text-[#FF0000] group-hover:text-white transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-white transition-colors">YouTube</span>
                  </a>
                  <a 
                    href="https://www.facebook.com/md.tayem.94" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-[#F5F2ED] rounded-[2rem] group hover:bg-[#1877F2] transition-all duration-500"
                  >
                    <Facebook className="w-8 h-8 text-[#1877F2] group-hover:text-white transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-white transition-colors">Facebook</span>
                  </a>
                </div>

                <button 
                  onClick={() => setShowDevInfo(false)}
                  className="mt-10 text-xs font-black text-[#8C8573] hover:text-[#2D5A27] uppercase tracking-widest transition-colors"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#E5E1D8] mt-12 text-center">
      </footer>
    </div>
  );
}
