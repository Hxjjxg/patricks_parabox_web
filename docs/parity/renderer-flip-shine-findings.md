# Native flip shine

The previous Web diagonal line was a synthetic marker, visible throughout the failed recursive flip captures. DrawFlipShine3916 instead draws a clipped vertical white band. It skips filled boxes and Grid root tickets. Band phase is MiscAnimT*0.5 modulo1.3, with a no-band interval from1 to1.3. The band width is the native quadratic triangle times0.4block width; its center uses QuadInOut twice. Ticket flip parity or SpecialEffect3 reverses travel.

Direct white alpha is min(-log10(fraction+0.5)+0.18,0.22) times the native flip intensity, then GUIx2. FadeFlipH interpolates toward the new FlipH; effects2/3 force intensity1. The helper preserves source float arithmetic and native snapped/clipped rectangle endpoints. Ordinary source band width40.000000596 at a100px block produces native snapped width41, which is covered explicitly by the regression.

Three actual drawFlipShine regressions failed before implementation, then passed along with context/recursive tests (12 focused cases total). CloneFade intensity blending remains part of the pending clone context module. Fresh natural scene PNG acceptance is required.
