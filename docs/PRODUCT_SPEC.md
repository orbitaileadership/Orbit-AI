# Product Spec — Orbit AI (Launch v1)

**Launch:** Mon Oct 19 2026 · **Audience:** Western students with a verified @uwo.ca email
**Owners:** Noah (tech) · Jake (economics, priorities, testing) · Natan (outreach, onboarding, support)

## Goal
One mobile-friendly web app where a student can chat with models from four providers, switch models mid-conversation, and keep the full context.

## Launch requirements
1. **Access.** Sign in with email OTP. Only verified addresses at the exact `uwo.ca` domain get access or credits. (This checks email ownership, not enrolment.)
2. **Models.** At least one clearly named model from each provider: OpenAI, Anthropic, Google, xAI. Exact models and prices must be checked against official docs before we promise them publicly. *(TBD: list in `src/config/models.ts`)*
3. **Chat.** Saved text conversations: list, open, rename, delete. Streaming replies. Each assistant message shows the model that wrote it.
4. **Model switching.** Change the model in the same chat. The new model gets the earlier history, including replies from other models.
5. **Context policy.** Long chats use an explicit, disclosed limit: send the most recent N tokens of history that fit the model's window and the budget reserve, and show a notice in the UI when older messages are left out. Never claim unlimited memory.
6. **Usage and limits.** Enforce cost budgets shared across providers with rolling 24-hour, 7-day and 30-day caps. The monthly cap is C$20 converted to USD at the configured account rate; daily is 1/30 and weekly is 7/30 of monthly. Students see percentages and colored remaining-allowance bars in Settings → Usage; authorized admins can see costs. Existing trial expiry and smaller/lifetime allowances also apply. Pause generation when allowance cannot cover the request. See [USAGE_WINDOWS_PLAN.md](USAGE_WINDOWS_PLAN.md) for implementation and rollout status.
7. **Status.** The UI clearly shows trial or subscription status.
8. **Controls.** Per-user rate limits, a team-wide spending stop, a disable switch for each provider.
9. **Reporting.** Admin view or report for Jake: spend by user and model, total API cost, errors. No message content.
10. **UX states.** Sending, streaming, waiting, errors, rate limits and budget pauses all make sense on phone and desktop.

## Historical provisional economics (superseded where noted below)

October 23 update: C$30 subscription price and C$20 API allowance are the approved sizing; rolling usage caps are approved. Paid enrollment, renewals and payment activation remain pending. See [DECISIONS.md](DECISIONS.md).

| Setting | Provisional value | Owner / due |
|---|---|---|
| Currency | TBD | Jake, Oct 5 |
| Subscription price | $30/mo | Jake, Oct 10 |
| Monthly API allowance | $20 | Jake, Oct 10 |
| Trial allowance | < $5 (exact TBD) | Jake, Oct 5 |
| Launch mode | paid or trial (TBD) | Jake, Oct 5 |
| Reset / renewal / carry-over / cancellation / failed payment | TBD | Jake, Oct 10 |
| Payments | **Disabled** until rules are final | Jake |

## Deferred
- **Post-launch roadmap:** model comparison, in-app images, smart model selection, more models.
- **Optional, only after launch checks pass:** PDFs, web search, course folders, preferences, memory across chats.

## Core journey (the first thing to build end to end)
Verify email → start a chat → get a reply → switch model → ask a follow-up that relies on earlier context → refresh and reopen the chat (history and model labels still there).

## Open questions
- Which exact model from each provider is live at launch?
- How many simultaneous users can we safely invite? (Measure this before launch.)
- Who covers Oct 17–19, and when?

## Current phase-one proposal and branch implementation
Jake's October 13 brief proposes C$30/month, C$20 monthly API allowance, and a 7-day C$2.50 trial. Payments remain disabled pending final lifecycle rules.
The composer can explicitly select a different provider while preserving the saved chat; the chat retains its original sidebar/course home. Long-chat economic limits, summaries and optional selective retrieval are disclosed and do not imply unlimited/perfect memory.
[SMART_MEMORY_ANALYTICS.md](SMART_MEMORY_ANALYTICS.md) documents what is implemented, how to stage it and what still needs live validation.
