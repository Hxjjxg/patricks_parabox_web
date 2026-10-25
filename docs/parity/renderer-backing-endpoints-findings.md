# Native backing rectangle endpoints

The independent static-integrated-v1 review identified a stable gray exterior L around the first puzzle root at800x600: Web x645/y538..544 and y545/x637..645 were gray80 while native was black0. It also identified a one-pixel light row between touching gold boxes in the second puzzle at all three DPR1 sizes.

The actual drawLevel regression exposed the same root: solid and center-gradient backgrounds used the fractional ticket rectangle directly, while native DrawBlock calls SetDrawRect before each texture. The800x600 ticket is x154.0000021457672,y54.00000214576721,width491.9999957084656,height491.9999957084656, but native's rendered rectangle is[154,54,491,491]. Unsapped backgrounds therefore paint a fractional fringe outside the native draw extent.

At1001x733 the actual gold border strips are already contiguous at[330,332) and[332,334); no epsilon or overlap correction is needed. The upper gold's unsnapped backing ends at332.607778 and can antialias over row332 of the previously drawn lower gold border. Truncating its draw quad to332 preserves that row. The logical ticket rectangle used by child geometry and the camera is unchanged.

The actual first-puzzle background regression failed before the fix and now passes; the existing four block backing/wall tests also pass. Fresh PNG comparison is required to accept exterior and shared-border results; source diagnosis is not a substitute for that check.
