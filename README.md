# v0-voco-dispatch-dashboard

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_K4LxlQWZuytEXtWj3jIWft4GzYEO)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Create a `.env.local` file (or copy from `.env.example`) and set:

- `NEXT_PUBLIC_MAPBOX_TOKEN` for `react-map-gl`
- `GEMINI_API_KEY` for `/api/process` multimodal reasoning
- `ELEVENLABS_API_KEY` for `/api/tts` fallback streaming route
- `NEXT_PUBLIC_ELEVENLABS_API_KEY` for direct client-side ElevenLabs calls
- `NEXT_PUBLIC_ELEVENLABS_VOICE_ID` optional voice override (default included)

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/Embotic-Wayne/v0-voco-dispatch-dashboard" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
