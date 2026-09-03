---
title: Choosing the right model for the job
stage: ripe
planted: 2026-09
tended: 2026-09
tags: [ai, llms, projects]
---

*What a silly side project taught me about paying for models.*

Ever since I left my PhD to do AI engineering full time, I have had what seems
like a million little side projects running at once. With that many projects,
keeping costs down is something I actually have to think about.

One of the recent ones was downloading the audio for every episode of my
favorite podcast, The Spitballers. The plan was to transcribe all 692 episodes,
then pull structured data out of the transcripts. There are patterns across the
episodes, but writing a script to extract them deterministically would have been
impossible, so the obvious answer was an LLM.

Here is the whole log, in the order it happened.

## Transcription

I started with YouTube auto-captions, because they are free. Two problems. There
is a rate-limit and ban risk, and they only covered 536 of the 692 episodes.
Rejected on coverage.

So I ran faster-whisper large-v3 on my RTX 3060 instead. 13.4x realtime. That
became the baseline.

Then I tried mlx-whisper large-v3 on my M4 Mac to see if it could beat the 3060.
2.5x. That made the Mac look five times slower.

Tried whisper large-v3-turbo on the M4 next. 13.0x, which matched the 3060 on
speed. Then I diffed the same passage against the large-v3 output, and turbo was
dropping names and the overlapping banter, which is the actual comedy. Rejected
on quality.

Then I found out my benchmark was wrong. The two machines were not running the
same config. One had beam search and VAD on, the other was running greedy. Once
I fixed that, the Mac's large-v3 came in at 7.0x rather than 2.5x, and it agreed
with the 3060 on 92.6% of words. The Mac was never five times slower. I had just
measured it badly.

## Extraction

Claude Code had written the scraper, so it suggested I use the Anthropic API for
the extraction too. Sonnet 5 quoted out at $41 for the full run. Not a huge
business expense, but more than I want to spend on a silly little side project.
It also over-split the questions, 13 where there were 10, and missed a whole
segment, 0 great questions where there were 4.

This is not sensitive data and the task is not that hard, so I went looking at
open-weight models on OpenRouter.

- **Qwen3-235B, $1.83.** Good, but it leaked submitter names into the question text.
- **DeepSeek v3.2, $4.63.** Zero recall on one segment type. Rejected.
- **Qwen3.5-397B, $10.46.** Best recall, clean output. Front-runner.
- **Kimi K2.5, $7.11.** Fine, but no advantage over the others.

At that point I was ready to pay the $10.46 and move on.

## The attributions

Then I checked something I had been taking on faith. All five models named a
host for all 36 draft picks, every time, with no hedging. So I compared their
answers against each other. Only 3 of the 33 were unanimous. They were all
guessing, and they all sounded equally sure while doing it.

So I changed the prompt instead of the model. Every attribution now has to come
with a verbatim quote from the transcript proving it. No quote, return null.

That gave me 12 honest nulls and zero names that the transcript did not back up.
None of the model swaps had done anything for that.

Then I re-ran the cheap model with the better prompt. Qwen3-235B matched the
397B exactly, at $3.71 against $11.21.

## Where it landed

The final run cost $3.71 instead of the $41 I started with. But the part I keep
thinking about is that the prompt was worth more than 10x the model spend, and
it was the only change that fixed the accuracy problem. Swapping models moved
the price around. Making the model show its work is what made the output true.

All the transcription ran locally on the 3060, so the only cost there was
electricity and my office being warmer than I would like. For me it was worth
the price.
