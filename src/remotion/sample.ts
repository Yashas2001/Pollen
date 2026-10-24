import type { VideoProps } from "./schema";

// Default props so `npm run studio` shows something before any job exists.
export const sampleProps: VideoProps = {
  script: {
    format: "hook_demo",
    title: "Sample",
    theme: "dark",
    shots: [
      { scene: "type", assetIndex: -1, secondAssetIndex: -1, elementIndex: -1, onScreenText: "Stop editing videos by hand", highlight: "hand", voiceLine: "Stop editing videos by hand.", mood: "problem", prompt: "", items: [] },
      { scene: "prompt", assetIndex: -1, secondAssetIndex: -1, elementIndex: -1, onScreenText: "Just ask", highlight: "ask", voiceLine: "Just ask for what you want.", mood: "solution", prompt: "Make it punchy for Reels", items: [] },
      { scene: "checklist", assetIndex: -1, secondAssetIndex: -1, elementIndex: -1, onScreenText: "All in seconds", highlight: "seconds", voiceLine: "Cuts, captions and music in seconds.", mood: "solution", prompt: "", items: ["Cuts", "Captions", "Music"] },
    ],
    cta: "Try it free today",
    basedOn: -1,
    postCaption: "",
    hashtags: [],
  },
  brand: { name: "Sample", tagline: "", primary: "#6C4BFF", background: "#F6F4EF", text: "#111111" },
  logoUrl: null,
  assets: [],
  elements: [],
  voiceUrl: null,
  musicUrl: null,
  captions: [],
  shotStartsMs: [0, 2200, 4400],
  durationMs: 6600,
};
