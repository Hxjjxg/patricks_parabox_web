# Natural browser input replay, diagnostic viewport

Production controller `21af3e2` plus the then-pending renderer. No external frame clock is installed. Four cases exercise queue, rapid turns, alternating/repress and blocked/repress with ordered DOM keyboard events and actual Canvas output.

These captures are **1280x720 DPR1**, while their native motion references are800x600. Independent review supports sampled physical paths/counts and landing/queued-next-update semantics only. Cross-viewport pixel bounds are excluded. A later matched800x600 capture is required for paired visual approval.

199 sampled frames have median rAF delta16.7ms and range16.1..33.2ms. Canvas capture adds overhead. rAF timestamps can precede wall-clock event dispatch within the same frame, so these artifacts do not measure physical or event-to-presentation latency. No intentional long-frame trial is included.

All requested and actual event times remain in each trace. The physical `motionId` labels animation state, independent of the key most recently delivered.
