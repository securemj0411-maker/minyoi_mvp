# Shorts HyperFrames Intake

## Context

User wants to edit `/Users/iminje/Desktop/0603(2).mp4` with `/Users/iminje/Desktop/0603(3).srt` as a shorts video using HyperFrames.

## Decisions

1. Preserve the desktop originals and copy working assets into the project.
   - Video working copy: `mvp/assets/shorts/0603/source.mp4`
   - Subtitle working copy: `mvp/assets/shorts/0603/captions.srt`
   - App feed screenshot: `mvp/assets/shorts/0603/screens/feed.png`
   - App profit screenshot: `mvp/assets/shorts/0603/screens/apple-watch-profit.png`
   - App sales-cycle screenshot: `mvp/assets/shorts/0603/screens/apple-watch-cycle.png`
2. Normalize working filenames to avoid shell/HTML escaping issues from parentheses in the original filenames.
3. Treat this as a 1080x1920 vertical shorts composition.
   - Source metadata: 1080x1920, 30fps, about 25.15 seconds.
4. Use the supplied in-app screenshots as proof/feature insert cuts rather than requiring additional screen capture up front.
5. Create a first HyperFrames draft in `mvp/shorts/0603-hyperframes`.
   - Style: dark SaaS / Swiss Pulse-inspired app ad.
   - Structure: source video and audio as the base, large Korean captions, app proof cards, profit metric strip, final profile-link CTA.
   - Draft render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft.mp4`
6. Revise the draft after user feedback that the first version felt too static and repeated the hook text.
   - Removed the duplicated top headline so "매일 당근마켓으로 6만 원 벌 기회" is not shown twice.
   - Reworked the app screenshots as phone mockups that enter from the bottom around 5s, 8s, and 15s.
   - Added explicit focus callouts for the 10s buy price and 12s used-market price beats.
   - Removed the app screenshot behind the 13s profit beat and the 18s limited-access beat so the speaker face is visible.
   - Latest draft render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v3.mp4`
7. Re-time the edit to the SRT after user feedback that visual timing was not synced to the spoken lines.
   - Feed phone proof now settles just before the 5.03s "이 사이트..." line.
   - Profit phone proof now settles just before the 8.80s "15만 원..." line.
   - Buy-price callout now starts with the 8.80s buy-price line.
   - Market-price callout now starts with the 10.40s "현재 중고..." line and carries into the 10.96s "시세..." line.
   - Profit number now starts at the 12.43s "이거 그냥 사고..." line with the app screen removed.
   - Removed the sales-speed phone cut because the SRT at 14.83s is "단 300명..." rather than sales-speed narration.
   - CTA button now starts slightly before the 18.76s profile-link line so it is visible when the line begins.
   - Latest sync render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v6-sync.mp4`
8. Rework the shorts styling after user feedback that the edit still felt unlike Instagram/shorts, had distracting top labels, weak subtitles, green tint, small numeric emphasis, missing product/sales-speed beats, and card clutter.
   - Removed the top brand/tag overlays from the visible edit.
   - Removed the green/blue decorative filter and scanline; retained only a subtle bottom readability gradient.
   - Changed subtitles to large white shorts-style captions with shadow instead of boxed UI captions.
   - Added a 7s Apple Watch product proof pop.
   - Changed buy and market-price beats into large vertical callouts: `당근 매입가 / 15만원` and `중고 시세 / 21만 4,500원`.
   - Reworked the 12.43s profit beat to show the speaker face with only a large money pop animation, no app card behind it.
   - Added the sales-speed phone screen around 14.65s and a large animated `300명` limit effect at 14.83s.
   - Latest shorts-style render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v9-shorts.mp4`
9. Rebuild the edit as a minimal three-phone-screen version after user feedback to remove everything else.
   - Removed all visible captions, labels, CTA, number callouts, product cards, and decorative overlays.
   - Kept only source video/audio plus three smartphone-style screen inserts.
   - Feed screen starts at 5.00s and gradually scales up.
   - Apple Watch price/profit screen starts at 8.00s.
   - Apple Watch 2.4-day sales-speed screen starts at 15.00s.
   - Screenshots are now fitted with `object-fit: contain` inside ratio-matched phone frames so the in-app screens are not cropped.
   - Latest minimal render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v11-three-phones.mp4`
10. Enlarge the 5s feed insert and add magnifier emphasis to the Apple Watch price screen.
   - Increased the feed phone frame size so the 5s feed proof reads larger.
   - Added a magnifier animation at 8.80s over `150,000원`, matching the SRT "15만 원에..." line.
   - Added a second magnifier animation at 10.40s over `214,500원`, matching the SRT "현재 중고 / 시세..." lines.
   - Implemented the magnifier with CSS background zoom layers instead of duplicate image nodes, avoiding HyperFrames media warnings.
   - Latest magnifier render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v14-magnifier.mp4`
11. Rework the magnifier style after user feedback that the buy/market magnifiers still did not feel proper, restore the accidentally deleted buy-price magnifier, and add a 2.4-day magnifier.
   - Restored the `매입가 / 150,000원` magnifier that was accidentally removed.
   - Replaced fragile screenshot-crop magnifiers with clean loupe callouts that redraw the key values clearly.
   - Kept source-position rings to indicate where each value comes from in the app screen.
   - Added `판매 주기 / 2.4일` loupe on the 15s sales-speed screen.
   - Latest clean loupe render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v16-clean-loupes.mp4`
12. Remove the source-position rings after user feedback that the extra circle beside the market loupe looked wrong, and retime the sales-speed phone exit.
   - Removed all original-value focus rings from the buy-price, market-price, and 2.4-day loupe moments.
   - Kept only the clean loupe callouts so the market-price frame no longer shows a second circled original area.
   - Moved the `2.4일` loupe upward to emphasize the blue `2.4일` in the top headline instead of the lower card value.
   - Shortened the 15s sales-speed phone clip so the in-app phone screen is gone by the late 17s frame.
   - Latest no-ring render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v17-no-rings.mp4`
13. Apply Toss-style blue emphasis to the `2.4일` loupe value after user feedback that it should be blue.
   - Changed only the `2.4일` value inside the sales-speed loupe to a Toss-blue tone with a subtle blue glow.
   - Kept the label and loupe frame unchanged so the edit remains focused on the value emphasis.
   - Latest Toss-blue render: `mvp/shorts/0603-hyperframes/renders/0603-shorts-draft-v18-toss-blue-24.mp4`

## Deferred

- Further polish is deferred until user review of v18 Toss-blue render.
- Caption sub-composition extraction is deferred; current single-file caption track is acceptable for the first draft but leaves a HyperFrames maintainability warning.
- A final high-quality render is deferred until the draft direction is approved.

## Next

- Review the v18 Toss-blue draft MP4 and decide whether the `2.4일` color emphasis is approved.

## Verification

- `npm run check` completed with:
  - 0 lint errors
  - 1 maintainability warning for dense caption track
  - no console errors
  - 85 text elements passing WCAG AA
  - 0 layout issues across 9 inspected samples
- Draft MP4 metadata:
  - 1080x1920
  - 30fps
  - about 25.19 seconds
  - audio included
- Representative frames were extracted and visually reviewed at about 1.0s, 6.2s, 11.2s, 15.8s, and 21.4s.
- After v3 edits, `npm run check` completed with:
  - 0 lint errors
  - 1 maintainability warning for dense caption track
  - no console errors
  - 90 text elements passing WCAG AA
  - 0 layout issues across 9 inspected samples
- v3 representative frames were visually reviewed at about 8.8s, 13.3s, and 15.3s after rendering.
- After v6 sync edits, `npm run check` completed with:
  - 0 lint errors
  - 1 maintainability warning for dense caption track
  - no console errors
  - 80 text elements passing WCAG AA
  - 0 layout issues across 9 inspected samples
- v6 sync representative frames were visually reviewed at about 5.1s, 8.9s, 10.5s, 12.5s, 14.9s, and 18.8s.
- After v9 shorts-style edits, `npm run check` completed with:
  - 0 lint errors
  - 1 maintainability warning for dense caption track
  - no console errors
  - 20 text elements passing WCAG AA
  - 0 layout issues across 9 inspected samples
- v9 representative frames were visually reviewed at about 7.0s, 8.9s, 10.5s, 12.6s, 15.1s, and 18.8s.
- After v11 minimal edits, `npm run check` completed with:
  - 0 lint errors
  - 0 lint warnings
  - no console errors
  - 0 layout issues across 9 inspected samples
- v11 representative frames were visually reviewed at about 5.4s, 8.4s, and 15.4s to confirm the app screenshots fit inside the phone frames without cropping.
- After v14 magnifier edits, `npm run check` completed with:
  - 0 lint errors
  - 0 lint warnings
  - no console errors
  - 0 layout issues across 9 inspected samples
- v14 representative frames were visually reviewed at about 5.4s, 8.9s, 10.7s, and 15.4s. The 8.9s and 10.7s frames confirmed that the magnifiers show `150,000원` and `214,500원` fully.
- After v16 clean-loupe edits, `npm run check` completed with:
  - 0 lint errors
  - 0 lint warnings
  - no console errors
  - 20 text elements passing WCAG AA
  - 0 layout issues across 9 inspected samples
- v16 representative frames were visually reviewed at about 8.9s, 10.7s, and 15.7s to confirm `150,000원`, `214,500원`, and `2.4일` are all visible.
- After v17 no-ring edits, `npm run check` completed with:
  - 0 lint errors
  - 0 lint warnings
  - 10 non-blocking contrast warnings on the animated `2.4일` loupe
  - 0 layout issues across 9 inspected samples
- v17 representative frames were visually reviewed at about 8.95s, 10.7s, 15.7s, and 17.8s to confirm the buy-price loupe is restored, the market-price source ring is gone, the 2.4-day loupe is in the top headline area, and the phone UI is gone by late 17s.
- After v18 Toss-blue edits, `npm run check` completed with:
  - 0 lint errors
  - 0 lint warnings
  - 10 non-blocking contrast warnings on the animated `2.4일` loupe
  - 0 layout issues across 9 inspected samples
- v18 representative frame was visually reviewed at about 15.7s to confirm the `2.4일` loupe value renders in blue.
