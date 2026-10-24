"use client";

import { useState } from "react";
import { StartButton } from "./Start";

const STEPS = [
  {
    n: "1",
    title: "See what's working",
    text: "Your competitors' videos that beat their usual views, and why.",
  },
  {
    n: "2",
    title: "Get your version",
    text: "Short videos in those formats, made from your real product.",
  },
  {
    n: "3",
    title: "Find people asking",
    text: "Real posts from people who want what you built, with a reply ready.",
  },
  {
    n: "4",
    title: "See who clicked",
    text: "Every post and reply gets its own link. Clicks show up live.",
  },
];

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#F6F4EF] text-black selection:bg-black selection:text-white">
      {/* Sleek Top Navigation Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-black/[0.05] bg-[#F6F4EF]/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <a
            href="/"
            className="text-xs font-bold uppercase tracking-[0.25em] text-black/40 transition-colors hover:text-black"
          >
            Pollen
          </a>
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 shadow-xs backdrop-blur-sm transition-all hover:border-black/20">
            <span className="h-1.5 w-1.5 rounded-full bg-black/50" />
            <p className="text-xs font-semibold text-black/50">Customers, not marketing advice.</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero Section */}
        <section className="flex w-full max-w-3xl flex-col items-center justify-center text-center">
          {/* Eyebrow */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/60 px-3.5 py-1 backdrop-blur-xs">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">Pollen</p>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl md:leading-[1.08]">
            Tell it you need customers.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-xl text-base leading-relaxed text-black/60 sm:text-lg">
            It shows what&apos;s working in your market, makes your version, finds the people who want your product right
            now, and shows you who clicked.
          </p>

          {/* CTA Cluster */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <StartButton />
            <p className="text-sm font-semibold text-black/40">Customers, not marketing advice.</p>
          </div>
        </section>

        {/* Interactive Steps Workflow Section */}
        <section className="mt-16 w-full max-w-5xl">
          {/* Interactive Step Progress Connector */}
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              {STEPS.map((step, idx) => (
                <button
                  key={step.n}
                  onClick={() => setActiveStep(idx)}
                  className={`flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeStep === idx
                      ? "bg-black text-white shadow-xs"
                      : "bg-white/80 text-black/40 border border-black/[0.06] hover:text-black hover:border-black/20"
                  }`}
                  aria-label={`Select step ${step.n}`}
                >
                  <span>{step.n}</span>
                  <span className="hidden sm:inline font-normal opacity-80">{step.title}</span>
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-black/30">
              <span>{activeStep + 1}</span>
              <span>/</span>
              <span>{STEPS.length}</span>
            </div>
          </div>

          {/* 4 Interactive Step Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={s.n}
                  onClick={() => setActiveStep(idx)}
                  onMouseEnter={() => setActiveStep(idx)}
                  className={`group relative flex flex-col justify-between rounded-3xl bg-white p-6 text-left transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? "border-black/25 shadow-[0_16px_36px_rgba(0,0,0,0.08)] ring-1 ring-black/10 -translate-y-1.5"
                      : "border-black/[0.06] shadow-sm hover:border-black/20 hover:shadow-md hover:-translate-y-1"
                  }`}
                >
                  {/* Subtle Top Active Indicator */}
                  <div className="absolute top-0 left-6 right-6 h-0.5 overflow-hidden rounded-full bg-transparent">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isActive ? "w-full bg-black" : "w-0 bg-transparent group-hover:w-1/2 group-hover:bg-black/20"
                      }`}
                    />
                  </div>

                  <div>
                    {/* Step Number Badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-all duration-200 ${
                          isActive
                            ? "bg-black text-white shadow-xs"
                            : "bg-black/[0.04] text-black/30 group-hover:bg-black/[0.08] group-hover:text-black"
                        }`}
                      >
                        {s.n}
                      </span>
                      <span
                        className={`text-xs font-mono transition-transform duration-200 ${
                          isActive ? "translate-x-0.5 text-black" : "text-black/20 group-hover:text-black/50"
                        }`}
                      >
                        →
                      </span>
                    </div>

                    {/* Step Title */}
                    <p className="mt-4 font-bold text-base text-black transition-colors">
                      {s.title}
                    </p>

                    {/* Step Text */}
                    <p className="mt-2 text-sm leading-relaxed text-black/60">
                      {s.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sleek Minimalist Footer */}
      <footer className="w-full border-t border-black/[0.05] bg-[#F6F4EF] py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-xs text-black/40">
          <p className="font-bold uppercase tracking-[0.2em]">Pollen</p>
          <p className="font-semibold">Customers, not marketing advice.</p>
        </div>
      </footer>
    </div>
  );
}
